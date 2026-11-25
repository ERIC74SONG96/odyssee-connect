-- =====================================================================
-- Migration 003 : ouverture des inscriptions, quota et anti-doublons
-- Issues #29 (interrupteur et quota du premier palier)
--    et #28 (doubles inscriptions et doubles paiements).
-- Rejouable : peut être appliquée plusieurs fois sans erreur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Réglages d'ouverture (une seule ligne)
--    Fermées par défaut : l'équipe ouvre depuis l'espace organisateurs.
-- ---------------------------------------------------------------------
create table if not exists public.reglages_inscriptions (
  id        smallint primary key default 1 check (id = 1),
  ouvertes  boolean not null default false,
  quota     integer not null default 3000 check (quota between 0 and 100000),
  message   text check (char_length(message) <= 300),
  maj_at    timestamptz not null default now(),
  maj_par   uuid
);
insert into public.reglages_inscriptions (id) values (1) on conflict (id) do nothing;

alter table public.reglages_inscriptions enable row level security;
drop policy if exists staff_lit_reglages on public.reglages_inscriptions;
create policy staff_lit_reglages on public.reglages_inscriptions for select using (public.est_staff());
revoke all on table public.reglages_inscriptions from public, anon, authenticated;
grant select on table public.reglages_inscriptions to authenticated;

-- ---------------------------------------------------------------------
-- 2. Colonnes et index anti-doublons
-- ---------------------------------------------------------------------
-- Clé d'envoi : tirée une fois par l'appli pour un formulaire rempli, renvoyée
-- telle quelle si l'envoi est répété (double clic, réseau coupé, nouvel essai).
alter table public.inscriptions add column if not exists cle_envoi uuid;
create unique index if not exists inscriptions_cle_envoi_uidx on public.inscriptions (cle_envoi);

-- Recherche rapide d'une même personne (nom, prénom, date de naissance)
create index if not exists inscriptions_personne_idx
  on public.inscriptions (lower(btrim(nom)), lower(btrim(prenom)), date_naissance);

-- Un identifiant de transaction Mobile Money ne sert qu'une fois par table
create unique index if not exists inscriptions_transaction_uidx
  on public.inscriptions (operateur, lower(transaction_id))
  where transaction_id is not null and statut <> 'annule';
create unique index if not exists dons_transaction_uidx
  on public.dons (operateur, lower(transaction_id))
  where transaction_id is not null and statut <> 'annule';

-- Vrai si cet identifiant est déjà déclaré pour une autre inscription ou un autre don
create or replace function public._transaction_deja_utilisee(p_operateur text, p_transaction text, p_reference text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.inscriptions i
                  where i.operateur = p_operateur and lower(i.transaction_id) = lower(btrim(p_transaction))
                    and i.statut <> 'annule' and i.reference <> upper(btrim(p_reference)))
      or exists (select 1 from public.dons d
                  where d.operateur = p_operateur and lower(d.transaction_id) = lower(btrim(p_transaction))
                    and d.statut <> 'annule' and d.reference <> upper(btrim(p_reference)));
$$;

-- ---------------------------------------------------------------------
-- 3. Créer une inscription (remplace la version de la migration 002)
--    Ordre : contrôles du formulaire, verrou, clé d'envoi déjà vue ?,
--    ouverture, quota, même personne déjà inscrite ?, insertion.
-- ---------------------------------------------------------------------
create or replace function public.creer_inscription(p jsonb)
returns table (reference text, montant integer, don integer)
language plpgsql volatile security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_dist    text := p ->> 'distance';
  v_cat     text := p ->> 'categorie';
  v_don_txt text := coalesce(p ->> 'don', '0');
  v_ddn_txt text := p ->> 'date_naissance';
  v_version text := p ->> 'consentement_version';
  v_cle_txt text := p ->> 'cle_envoi';
  v_tel     text := public._texte(p, 'telephone', 20, true);
  v_urg     text := public._texte(p, 'urgence_tel', 20, true);
  v_mail    text := lower(public._texte(p, 'email', 120, true));
  v_nom     text := public._texte(p, 'nom', 80, true);
  v_prenom  text := public._texte(p, 'prenom', 80, true);
  v_cle     uuid;
  v_don     integer;
  v_ddn     date;
  v_mineur  boolean;
  v_parent  boolean;
  v_mont    integer;
  v_ref     text;
  v_reg     public.reglages_inscriptions;
  v_deja    public.inscriptions;
  v_actives integer;
begin
  -- Clé d'envoi obligatoire (l'appli la fournit toujours)
  if v_cle_txt is null or v_cle_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Version de l''appli trop ancienne. Rechargez la page.';
  end if;
  v_cle := v_cle_txt::uuid;

  if v_dist is null or v_dist not in ('3','5','10') then raise exception 'Distance invalide'; end if;
  if v_cat is null or v_cat not in ('etudiant','travailleur') then raise exception 'Catégorie invalide'; end if;
  if not public._tel_valide(v_tel) or not public._tel_valide(v_urg) then
    raise exception 'Numéro de téléphone invalide';
  end if;
  if v_mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if v_don_txt !~ '^[0-9]{1,7}$' then raise exception 'Montant du don invalide'; end if;
  v_don := least(v_don_txt::integer, 1000000);
  if v_ddn_txt is null or v_ddn_txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Date de naissance invalide'; end if;
  begin
    v_ddn := v_ddn_txt::date;
  exception when others then
    raise exception 'Date de naissance invalide';
  end;
  if v_ddn > (public._date_course() - interval '10 years')::date or v_ddn < date '1920-01-01' then
    raise exception 'Date de naissance invalide';
  end if;
  if coalesce(p ->> 'consentement', '') <> 'true' then
    raise exception 'Le consentement est obligatoire';
  end if;
  if v_version is null or not exists (select 1 from public.consentements_textes c where c.version = v_version) then
    raise exception 'Version du texte de consentement inconnue. Rechargez la page.';
  end if;
  v_mineur := v_ddn > (public._date_course() - interval '18 years')::date;
  v_parent := coalesce(p ->> 'consentement_parental', '') = 'true';
  if v_mineur and not v_parent then
    raise exception 'L''accord d''un parent ou représentant légal est obligatoire pour les moins de 18 ans';
  end if;

  -- Verrou : une création à la fois, pour que le quota et la clé d'envoi soient exacts
  select * into v_reg from public.reglages_inscriptions where id = 1 for update;

  -- Même envoi répété : on renvoie l'inscription déjà créée, sans en créer une seconde,
  -- à condition que ce soit bien le même formulaire (mêmes données essentielles).
  select * into v_deja from public.inscriptions i where i.cle_envoi = v_cle;
  if v_deja.id is not null then
    if public._chiffres(v_deja.telephone) <> public._chiffres(v_tel) then
      raise exception 'Envoi refusé. Rechargez la page et recommencez.';
    end if;
    if lower(btrim(v_deja.nom)) <> lower(v_nom) or lower(btrim(v_deja.prenom)) <> lower(v_prenom)
       or v_deja.date_naissance <> v_ddn or v_deja.distance <> v_dist or v_deja.categorie <> v_cat then
      -- Seul l'appareil qui a tiré cette clé peut arriver ici : il peut connaître sa propre référence.
      raise exception 'Une inscription a déjà été enregistrée depuis ce formulaire (référence %), avec d''autres informations. Pour la corriger, contactez l''organisation avec cette référence.', v_deja.reference;
    end if;
    return query select v_deja.reference, v_deja.montant, v_deja.don;
    return;
  end if;

  if v_reg.id is null or not v_reg.ouvertes then
    raise exception '%', coalesce(nullif(btrim(v_reg.message), ''), 'Les inscriptions ne sont pas ouvertes pour le moment.');
  end if;
  select count(*) into v_actives from public.inscriptions i where i.statut <> 'annule';
  if v_actives >= v_reg.quota then
    raise exception 'Complet : toutes les places de cette vague sont prises. Suivez nos annonces pour la prochaine ouverture.';
  end if;

  -- Même personne déjà inscrite (hors annulées)
  if exists (select 1 from public.inscriptions i
              where lower(btrim(i.nom)) = lower(v_nom) and lower(btrim(i.prenom)) = lower(v_prenom)
                and i.date_naissance = v_ddn and i.statut <> 'annule') then
    raise exception 'Cette personne est déjà inscrite (même nom, prénom et date de naissance). Retrouvez l''inscription dans « Mon dossard » avec sa référence, ou contactez l''organisation.';
  end if;
  if (select count(*) from public.inscriptions i
        where public._chiffres(i.telephone) = public._chiffres(v_tel) and i.statut <> 'annule') >= 6 then
    raise exception 'Trop d''inscriptions avec ce numéro. Contactez l''organisation.';
  end if;

  select t.montant into v_mont from public.tarifs t where t.distance = v_dist and t.categorie = v_cat;
  v_ref := public._nouvelle_reference('ODY', 'inscriptions');

  insert into public.inscriptions (reference, cle_envoi, nom, prenom, telephone, email, date_naissance, sexe, ville,
                                   distance, categorie, urgence_nom, urgence_tel, consentement,
                                   consentement_parental, consentement_version, consentement_at,
                                   montant, don, taille_tshirt)
  values (v_ref, v_cle, v_nom, v_prenom, v_tel, v_mail, v_ddn,
          case when p ->> 'sexe' in ('F','M') then p ->> 'sexe' else null end,
          null, v_dist, v_cat,
          public._texte(p, 'urgence_nom', 80, true),
          v_urg, true,
          v_mineur and v_parent,
          v_version, now(),
          v_mont, v_don,
          case when p ->> 'taille_tshirt' in ('XS','S','M','L','XL','XXL') then p ->> 'taille_tshirt' else null end);

  return query select v_ref, v_mont, v_don;
end $$;

-- ---------------------------------------------------------------------
-- 4. Déclarer un paiement : un identifiant de transaction ne sert qu'une fois
-- ---------------------------------------------------------------------
create or replace function public.declarer_paiement(p_reference text, p_telephone text,
                                                    p_operateur text, p_transaction text)
returns text language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_statut text;
begin
  if p_operateur is null or p_operateur not in ('mtn','orange') then raise exception 'Opérateur invalide'; end if;
  if char_length(btrim(coalesce(p_transaction,''))) not between 4 and 60 then
    raise exception 'Identifiant de transaction invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext('transaction-' || p_operateur || '-' || lower(btrim(p_transaction))));
  if public._transaction_deja_utilisee(p_operateur, p_transaction, p_reference) then
    raise exception 'Cet identifiant de transaction est déjà déclaré pour un autre paiement. Vérifiez-le ou contactez l''organisation.';
  end if;
  begin
    update public.inscriptions i
       set statut = 'paiement_declare', operateur = p_operateur,
           transaction_id = btrim(p_transaction), paiement_declare_at = now()
     where i.reference = upper(btrim(p_reference))
       and public._chiffres(i.telephone) = public._chiffres(p_telephone)
       and i.statut in ('en_attente','paiement_declare')
    returning i.statut into v_statut;
  exception when unique_violation then
    raise exception 'Cet identifiant de transaction est déjà déclaré pour un autre paiement. Vérifiez-le ou contactez l''organisation.';
  end;
  if v_statut is null then raise exception 'Inscription introuvable ou déjà traitée'; end if;
  return v_statut;
end $$;

create or replace function public.declarer_don(p_reference text, p_telephone text,
                                               p_operateur text, p_transaction text)
returns text language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_statut text;
begin
  if p_operateur is null or p_operateur not in ('mtn','orange') then raise exception 'Opérateur invalide'; end if;
  if char_length(btrim(coalesce(p_transaction,''))) not between 4 and 60 then
    raise exception 'Identifiant de transaction invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext('transaction-' || p_operateur || '-' || lower(btrim(p_transaction))));
  if public._transaction_deja_utilisee(p_operateur, p_transaction, p_reference) then
    raise exception 'Cet identifiant de transaction est déjà déclaré pour un autre paiement. Vérifiez-le ou contactez l''organisation.';
  end if;
  begin
    update public.dons d
       set statut = 'paiement_declare', operateur = p_operateur,
           transaction_id = btrim(p_transaction), paiement_declare_at = now()
     where d.reference = upper(btrim(p_reference))
       and public._chiffres(d.telephone) = public._chiffres(p_telephone)
       and d.statut in ('en_attente','paiement_declare')
    returning d.statut into v_statut;
  exception when unique_violation then
    raise exception 'Cet identifiant de transaction est déjà déclaré pour un autre paiement. Vérifiez-le ou contactez l''organisation.';
  end;
  if v_statut is null then raise exception 'Don introuvable ou déjà traité'; end if;
  return v_statut;
end $$;

-- ---------------------------------------------------------------------
-- 5. Réglages par l'équipe, et état public
-- ---------------------------------------------------------------------
create or replace function public.regler_inscriptions(p_ouvertes boolean, p_quota integer, p_message text)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public._exiger_staff();
  if p_ouvertes is null then raise exception 'Choisissez ouvertes ou fermées'; end if;
  if p_quota is null or p_quota < 0 or p_quota > 100000 then raise exception 'Quota invalide (0 à 100 000)'; end if;
  if char_length(coalesce(p_message, '')) > 300 then raise exception 'Message trop long (300 caractères au plus)'; end if;
  update public.reglages_inscriptions
     set ouvertes = p_ouvertes, quota = p_quota, message = nullif(btrim(coalesce(p_message, '')), ''),
         maj_at = now(), maj_par = auth.uid()
   where id = 1;
  return public._etat_inscriptions();
end $$;

create or replace function public._etat_inscriptions()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'ouvertes', r.ouvertes,
    'quota', r.quota,
    'restantes', greatest(0, r.quota - (select count(*) from public.inscriptions i where i.statut <> 'annule')),
    'message', r.message)
  from public.reglages_inscriptions r where r.id = 1;
$$;

create or replace function public.etat_public()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'fonds', (select jsonb_build_object('objectif', f.objectif, 'collecte', f.collecte,
                                        'donateurs', f.donateurs, 'maj', f.maj)
              from public.fonds f where f.id = 1),
    'inscrits', jsonb_build_object(
      '3',  (select count(*) from public.inscriptions where distance = '3'  and statut <> 'annule'),
      '5',  (select count(*) from public.inscriptions where distance = '5'  and statut <> 'annule'),
      '10', (select count(*) from public.inscriptions where distance = '10' and statut <> 'annule')),
    'inscriptions', public._etat_inscriptions(),
    'resultats', (select count(*) from public.resultats)
  );
$$;

-- ---------------------------------------------------------------------
-- 6. Effacement des coordonnées : la clé d'envoi est effacée aussi
--    (remplace la version de la migration 002, le reste est inchangé)
-- ---------------------------------------------------------------------
create or replace function public._effacer_coordonnees_inscriptions()
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  if current_date <= public._date_course() then
    raise exception 'L''effacement n''est possible qu''après la course';
  end if;
  update public.inscriptions set
    nom = left(nom, 1) || '.',
    telephone = 'efface-' || left(id::text, 8),
    email = null,
    date_naissance = make_date(extract(year from date_naissance)::integer, 1, 1),
    ville = null,
    urgence_nom = '',
    urgence_tel = '',
    transaction_id = null,
    cle_envoi = null,
    anonymise_at = now()
  where anonymise_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public._effacer_coordonnees_inscriptions() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Droits d'exécution explicites
-- ---------------------------------------------------------------------
revoke all on function public._transaction_deja_utilisee(text, text, text) from public, anon, authenticated;
revoke all on function public._etat_inscriptions() from public, anon, authenticated;
revoke all on function public.creer_inscription(jsonb) from public, anon, authenticated;
revoke all on function public.declarer_paiement(text, text, text, text) from public, anon, authenticated;
revoke all on function public.declarer_don(text, text, text, text) from public, anon, authenticated;
revoke all on function public.regler_inscriptions(boolean, integer, text) from public, anon, authenticated;
revoke all on function public.etat_public() from public, anon, authenticated;
grant execute on function public.creer_inscription(jsonb) to anon, authenticated;
grant execute on function public.declarer_paiement(text, text, text, text) to anon, authenticated;
grant execute on function public.declarer_don(text, text, text, text) to anon, authenticated;
grant execute on function public.etat_public() to anon, authenticated;
grant execute on function public.regler_inscriptions(boolean, integer, text) to authenticated;
