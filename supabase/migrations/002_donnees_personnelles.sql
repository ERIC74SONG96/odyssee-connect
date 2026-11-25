-- =====================================================================
-- 002 — Données personnelles des inscriptions (loi camerounaise n° 2024/017)
-- - e-mail obligatoire, ville non collectée ;
-- - accord d'un parent ou représentant légal pour les moins de 18 ans
--   le jour de la course (samedi 10 juillet 2027) ;
-- - texte de consentement versionné, conservé, et horodatage de l'accord ;
-- - effacement des coordonnées après la course (pseudonymisation) :
--   par l'équipe, ou automatiquement le 10 octobre 2027 si pg_cron est actif.
-- Relançable sans erreur.
-- Relectures : ChatGPT et Gemini (PR #32).
-- =====================================================================

alter table public.inscriptions add column if not exists consentement_parental boolean not null default false;
alter table public.inscriptions add column if not exists consentement_version text;
alter table public.inscriptions add column if not exists consentement_at timestamptz;
alter table public.inscriptions add column if not exists anonymise_at timestamptz;

-- Date de la course : source unique côté base (à modifier ici si la date change)
create or replace function public._date_course() returns date
language sql immutable set search_path = public, pg_temp as $$ select date '2027-07-10' $$;

-- Échéance d'effacement annoncée aux participants : trois mois après la course
create or replace function public._date_limite_effacement() returns date
language sql immutable set search_path = public, pg_temp as $$ select (public._date_course() + interval '3 months')::date $$;

-- Textes de consentement : chaque version affichée est conservée telle quelle
create table if not exists public.consentements_textes (
  version    text primary key,
  texte      text not null,
  created_at timestamptz not null default now()
);
alter table public.consentements_textes enable row level security;
drop policy if exists consentements_lecture_staff on public.consentements_textes;
create policy consentements_lecture_staff on public.consentements_textes for select using (public.est_staff());

insert into public.consentements_textes (version, texte) values ('2026-11-25',
  'J''accepte que L''Odyssée de l''environnement au Cameroun utilise mes données pour organiser la course (inscription, paiement, dossard, sécurité, résultats), conformément à la loi n° 2024/017. Elles sont hébergées sur des serveurs en Europe (Supabase). Elles ne sont jamais vendues ni louées, et ne sont communiquées qu''aux prestataires techniques nécessaires (hébergement, paiement). Mes coordonnées (nom complet, téléphone, e-mail, contact d''urgence, date de naissance précise) sont effacées au plus tard trois mois après la course. Sont alors conservés : pour les résultats, mon prénom, l''initiale de mon nom, mon année de naissance, mon sexe, mon épreuve, ma catégorie, mon dossard et mon résultat ; pour la comptabilité, la référence de l''inscription, son statut, les montants payés et leurs dates. Pour consulter, corriger ou faire supprimer mes données : contact@odyssee-env.org.
[Moins de 18 ans le jour de la course] Un parent ou représentant légal autorise cette inscription et le traitement de ces données.')
on conflict (version) do nothing;

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
  v_tel     text := public._texte(p, 'telephone', 20, true);
  v_urg     text := public._texte(p, 'urgence_tel', 20, true);
  v_mail    text := lower(public._texte(p, 'email', 120, true));
  v_don     integer;
  v_ddn     date;
  v_mineur  boolean;
  v_parent  boolean;
  v_mont    integer;
  v_ref     text;
begin
  if v_dist is null or v_dist not in ('3','5','10') then raise exception 'Distance invalide'; end if;
  if v_cat is null or v_cat not in ('etudiant','travailleur') then raise exception 'Catégorie invalide'; end if;
  if not public._tel_valide(v_tel) or not public._tel_valide(v_urg) then
    raise exception 'Numéro de téléphone invalide';
  end if;
  if v_mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  -- Don : entier positif de 7 chiffres au plus, sinon erreur claire (pas d'erreur de conversion brute)
  if v_don_txt !~ '^[0-9]{1,7}$' then raise exception 'Montant du don invalide'; end if;
  v_don := least(v_don_txt::integer, 1000000);
  -- Date de naissance : format AAAA-MM-JJ obligatoire
  if v_ddn_txt is null or v_ddn_txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Date de naissance invalide'; end if;
  begin
    v_ddn := v_ddn_txt::date;
  exception when others then
    raise exception 'Date de naissance invalide';
  end;
  -- Âge minimum (10 ans) apprécié le jour de la course, pas le jour de l'inscription
  if v_ddn > (public._date_course() - interval '10 years')::date or v_ddn < date '1920-01-01' then
    raise exception 'Date de naissance invalide';
  end if;
  -- Consentement : case cochée ET version de texte connue
  if coalesce(p ->> 'consentement', '') <> 'true' then
    raise exception 'Le consentement est obligatoire';
  end if;
  if v_version is null or not exists (select 1 from public.consentements_textes c where c.version = v_version) then
    raise exception 'Version du texte de consentement inconnue. Rechargez la page.';
  end if;
  -- Mineur le jour de la course : accord parental obligatoire (déclaration, voir issue #6)
  v_mineur := v_ddn > (public._date_course() - interval '18 years')::date;
  v_parent := coalesce(p ->> 'consentement_parental', '') = 'true';
  if v_mineur and not v_parent then
    raise exception 'L''accord d''un parent ou représentant légal est obligatoire pour les moins de 18 ans';
  end if;
  if (select count(*) from public.inscriptions i
        where public._chiffres(i.telephone) = public._chiffres(v_tel) and i.statut <> 'annule') >= 6 then
    raise exception 'Trop d''inscriptions avec ce numéro. Contactez l''organisation.';
  end if;

  select t.montant into v_mont from public.tarifs t where t.distance = v_dist and t.categorie = v_cat;
  v_ref := public._nouvelle_reference('ODY', 'inscriptions');

  insert into public.inscriptions (reference, nom, prenom, telephone, email, date_naissance, sexe, ville,
                                   distance, categorie, urgence_nom, urgence_tel, consentement,
                                   consentement_parental, consentement_version, consentement_at,
                                   montant, don, taille_tshirt)
  values (v_ref,
          public._texte(p, 'nom', 80, true),
          public._texte(p, 'prenom', 80, true),
          v_tel, v_mail, v_ddn,
          case when p ->> 'sexe' in ('F','M') then p ->> 'sexe' else null end,
          null,
          v_dist, v_cat,
          public._texte(p, 'urgence_nom', 80, true),
          v_urg, true,
          v_mineur and v_parent,   -- vrai seulement si un accord parental était requis et a été donné
          v_version, now(),
          v_mont, v_don,
          case when p ->> 'taille_tshirt' in ('XS','S','M','L','XL','XXL') then p ->> 'taille_tshirt' else null end);

  return query select v_ref, v_mont, v_don;
end $$;

-- Effacement des coordonnées (pseudonymisation) : fonction interne, appelée par l'équipe ou par pg_cron.
-- Garde, pour les résultats : prénom, initiale du nom, année de naissance, sexe, épreuve, catégorie, dossard ;
-- pour la comptabilité : référence, montants, statut et dates. (Ce qui est dit dans le texte de consentement.)
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
    anonymise_at = now()
  where anonymise_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Appel par l'équipe (espace organisateurs)
create or replace function public.anonymiser_inscriptions()
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.est_staff() then raise exception 'Accès réservé à l''équipe organisatrice'; end if;
  return public._effacer_coordonnees_inscriptions();
end $$;

-- Droits explicites (une fonction créée ou remplacée ne doit pas garder des droits par défaut)
revoke all on function public._date_course() from public, anon, authenticated;
revoke all on function public._date_limite_effacement() from public, anon, authenticated;
revoke all on function public._effacer_coordonnees_inscriptions() from public, anon, authenticated;
revoke all on function public.anonymiser_inscriptions() from public, anon, authenticated;
revoke all on function public.creer_inscription(jsonb) from public, anon, authenticated;
grant execute on function public.anonymiser_inscriptions() to authenticated;
grant execute on function public.creer_inscription(jsonb) to anon, authenticated;

-- Effacement automatique le 10 octobre (échéance annoncée), si l'extension pg_cron est activée.
-- pg_cron tourne en UTC : 03:00 UTC = 04:00 à Yaoundé (UTC+1).
-- Sans pg_cron, l'équipe lance l'effacement depuis l'espace organisateurs (voir ROADMAP).
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'odyssee-effacement-inscriptions';
    perform cron.schedule('odyssee-effacement-inscriptions', '0 3 10 10 *',
                          'select public._effacer_coordonnees_inscriptions()');
  end if;
end
$do$;
