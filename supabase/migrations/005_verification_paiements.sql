-- =====================================================================
-- Migration 005 : vérification des paiements par l'équipe (issue #27)
--   L'équipe compare chaque paiement déclaré au relevé Mobile Money.
--   Trouvé : « Valider » (existant). Introuvable ou montant faux : « Refuser »
--   remet l'inscription en attente avec un motif que le coureur voit, efface
--   l'identifiant déclaré et lui redonne le délai de paiement complet.
--   La place reste tenue pendant ce nouveau délai (elle l'était déjà).
--   L'identifiant refusé est gardé dans paiements_refuses : il ne peut plus
--   être déclaré par personne (l'équipe peut toujours valider à la main).
-- Relançable sans erreur.
-- =====================================================================

alter table public.inscriptions add column if not exists motif_refus text;
alter table public.inscriptions add column if not exists refus_at timestamptz;
alter table public.inscriptions add column if not exists refus_nombre integer not null default 0;


-- Historique des identifiants refusés : un refus n'efface pas la trace de la transaction.
-- Sans cela, un identifiant réel refusé par erreur pourrait être redéclaré pour une autre
-- inscription et validé une seconde fois (deux inscriptions pour un seul paiement).
create table if not exists public.paiements_refuses (
  id             uuid primary key default gen_random_uuid(),
  operateur      text not null check (operateur in ('mtn','orange')),
  transaction_id text not null,            -- normalisé : lower(btrim(...))
  reference      text not null,            -- inscription à laquelle il avait été déclaré
  motif          text not null,
  refuse_par     uuid,
  refuse_at      timestamptz not null default now()
);
create unique index if not exists paiements_refuses_uidx on public.paiements_refuses (operateur, transaction_id);
alter table public.paiements_refuses enable row level security;
drop policy if exists staff_lit_paiements_refuses on public.paiements_refuses;
create policy staff_lit_paiements_refuses on public.paiements_refuses for select using (public.est_staff());
revoke insert, update, delete, truncate, references, trigger on public.paiements_refuses from anon, authenticated;

-- Contrôle d'unicité des identifiants : déclarés ailleurs, ou déjà refusés
create or replace function public._transaction_deja_utilisee(p_operateur text, p_transaction text, p_reference text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.inscriptions i
                  where i.operateur = p_operateur and lower(i.transaction_id) = lower(btrim(p_transaction))
                    and i.statut <> 'annule' and i.reference <> upper(btrim(p_reference)))
      or exists (select 1 from public.dons d
                  where d.operateur = p_operateur and lower(d.transaction_id) = lower(btrim(p_transaction))
                    and d.statut <> 'annule' and d.reference <> upper(btrim(p_reference)))
      -- Un identifiant refusé par l'équipe ne peut plus être déclaré, par personne
      or exists (select 1 from public.paiements_refuses r
                  where r.operateur = p_operateur and r.transaction_id = lower(btrim(p_transaction)));
$$;
create or replace function public.refuser_paiement(p_id uuid, p_motif text)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v public.inscriptions; v_reg public.reglages_inscriptions; v_motif text := btrim(coalesce(p_motif, ''));
begin
  perform public._exiger_staff();
  if char_length(v_motif) not between 3 and 200 then raise exception 'Indiquez un motif (3 à 200 caractères)'; end if;
  -- Même ordre de verrous que la création et la déclaration : réglages, puis la ligne
  select * into v_reg from public.reglages_inscriptions where id = 1 for update;
  select * into v from public.inscriptions where id = p_id for update;
  if v.id is null then raise exception 'Inscription introuvable'; end if;
  if v.statut <> 'paiement_declare' then raise exception 'Seul un paiement déclaré peut être refusé (statut actuel : %)', v.statut; end if;
  insert into public.paiements_refuses (operateur, transaction_id, reference, motif, refuse_par)
  values (v.operateur, lower(btrim(v.transaction_id)), v.reference, v_motif, auth.uid())
  on conflict (operateur, transaction_id) do nothing;
  update public.inscriptions
     set statut = 'en_attente', operateur = null, transaction_id = null, paiement_declare_at = null,
         motif_refus = v_motif, refus_at = now(), refus_nombre = refus_nombre + 1,
         paiement_avant = now() + make_interval(hours => coalesce(v_reg.delai_paiement_heures, 48))
   where id = p_id;
end $$;

-- Déclarer un paiement : comme la 004, et le motif d'un refus précédent est effacé
create or replace function public.declarer_paiement(p_reference text, p_telephone text,
                                                    p_operateur text, p_transaction text)
returns text language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_statut text; v_ins public.inscriptions; v_reg public.reglages_inscriptions;
begin
  if p_operateur is null or p_operateur not in ('mtn','orange') then raise exception 'Opérateur invalide'; end if;
  if char_length(btrim(coalesce(p_transaction,''))) not between 4 and 60 then
    raise exception 'Identifiant de transaction invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext('transaction-' || p_operateur || '-' || lower(btrim(p_transaction))));
  if public._transaction_deja_utilisee(p_operateur, p_transaction, p_reference) then
    raise exception 'Cet identifiant de transaction est déjà déclaré pour un autre paiement. Vérifiez-le ou contactez l''organisation.';
  end if;

  select * into v_reg from public.reglages_inscriptions where id = 1 for update;
  select * into v_ins from public.inscriptions i
   where i.reference = upper(btrim(p_reference))
     and public._chiffres(i.telephone) = public._chiffres(p_telephone)
   for update;
  if v_ins.id is null or v_ins.statut not in ('en_attente','paiement_declare') then
    raise exception 'Inscription introuvable ou déjà traitée';
  end if;

  if not public._place_tenue(v_ins.statut, v_ins.paiement_avant) then
    if exists (select 1 from public.inscriptions i
                where i.id <> v_ins.id
                  and lower(btrim(i.nom)) = lower(btrim(v_ins.nom)) and lower(btrim(i.prenom)) = lower(btrim(v_ins.prenom))
                  and i.date_naissance = v_ins.date_naissance
                  and public._place_tenue(i.statut, i.paiement_avant)) then
      raise exception 'Le délai de paiement de cette inscription est dépassé et vous avez une inscription plus récente : payez avec sa référence (« Mon dossard »).';
    end if;
    if public._places_prises() >= coalesce(v_reg.quota, 0) then
      raise exception 'Le délai de paiement de cette inscription est dépassé et toutes les places sont prises. Si vous avez déjà payé, contactez l''organisation avec votre référence.';
    end if;
  end if;

  begin
    update public.inscriptions i
       set statut = 'paiement_declare', operateur = p_operateur,
           transaction_id = btrim(p_transaction), paiement_declare_at = now(), motif_refus = null
     where i.id = v_ins.id and i.statut in ('en_attente','paiement_declare')
    returning i.statut into v_statut;
  exception when unique_violation then
    raise exception 'Cet identifiant de transaction est déjà déclaré pour un autre paiement. Vérifiez-le ou contactez l''organisation.';
  end;
  if v_statut is null then raise exception 'Inscription introuvable ou déjà traitée'; end if;
  return v_statut;
end $$;

-- « Mon dossard » : le motif du refus en plus (le type de retour change)
drop function if exists public.consulter_inscription(text, text);
create function public.consulter_inscription(p_reference text, p_telephone text)
returns table (reference text, prenom text, nom text, distance text, categorie text, montant integer,
               don integer, statut text, dossard integer, retire boolean, created_at timestamptz, taille_tshirt text,
               paiement_avant timestamptz, motif_refus text)
language sql stable security definer set search_path = public, pg_temp as $$
  select i.reference, i.prenom, i.nom, i.distance, i.categorie, i.montant, i.don, i.statut,
         i.dossard, i.retire, i.created_at, i.taille_tshirt, i.paiement_avant, i.motif_refus
  from public.inscriptions i
  where i.reference = upper(btrim(p_reference))
    and public._chiffres(i.telephone) = public._chiffres(p_telephone)
  limit 1;
$$;

-- Effacement après la course : le motif d'un refus est effacé aussi (le reste est inchangé)
create or replace function public._effacer_coordonnees_inscriptions()
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  if current_date <= public._date_course() then
    raise exception 'L''effacement n''est possible qu''après la course';
  end if;
  delete from public.paiements_refuses;
  update public.inscriptions set
    nom = left(nom, 1) || '.',
    telephone = 'efface-' || left(id::text, 8),
    email = null,
    date_naissance = make_date(extract(year from date_naissance)::integer, 1, 1),
    ville = null,
    urgence_nom = '',
    urgence_tel = '',
    transaction_id = null,
    motif_refus = null,
    cle_envoi = null,
    anonymise_at = now()
  where anonymise_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public._effacer_coordonnees_inscriptions()          from public, anon, authenticated;
revoke all on function public.refuser_paiement(uuid, text)                  from public, anon, authenticated;
revoke all on function public._transaction_deja_utilisee(text, text, text)   from public, anon, authenticated;
revoke all on function public.declarer_paiement(text, text, text, text)     from public, anon, authenticated;
revoke all on function public.consulter_inscription(text, text)             from public, anon, authenticated;
grant execute on function public.refuser_paiement(uuid, text)               to authenticated;
grant execute on function public.declarer_paiement(text, text, text, text)  to anon, authenticated;
grant execute on function public.consulter_inscription(text, text)          to anon, authenticated;
