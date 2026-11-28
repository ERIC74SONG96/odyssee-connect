-- =====================================================================
-- Migration 009 : Odyris étape 3 — rôles, journal d'audit, actions tracées,
--                 exigence MFA (double authentification) sur les actions.
--
-- Odyris est la console interne du personnel. Cette migration :
--   1. ajoute un rôle (agent / admin) au personnel existant ;
--   2. crée un journal d'audit (qui a fait quoi, quand, avec quel niveau
--      d'authentification) — écriture seule via fonction, lecture admin ;
--   3. ajoute des actions Odyris qui RÉUTILISENT les fonctions existantes
--      (valider_paiement, valider_don) en y ajoutant deux garde-fous :
--      vérification MFA + trace au journal.
--
-- Les fonctions d'origine ne sont PAS modifiées : l'app équipe (Odyssée
-- Connect) continue de fonctionner exactement comme avant. Odyris passe par
-- ses propres wrappers, plus stricts.
--
-- Sécurité : toutes les nouvelles fonctions sont SECURITY DEFINER à
-- search_path fixé, révoquées de PUBLIC/anon/authenticated puis accordées à
-- authenticated (le contrôle réel est fait à l'intérieur par
-- est_staff / est_admin / MFA). Aucune donnée existante n'est détruite.
-- Relançable sans erreur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Rôles du personnel
-- ---------------------------------------------------------------------
alter table public.staff add column if not exists role text not null default 'agent';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'staff_role_valide') then
    alter table public.staff add constraint staff_role_valide check (role in ('agent','admin'));
  end if;
end $$;

-- IMPORTANT : aucune promotion automatique. Tout le personnel existant reste
-- « agent » par défaut ; le rôle « admin » doit être attribué EXPLICITEMENT,
-- une personne à la fois, par une commande manuelle (voir la note de
-- déploiement). On évite ainsi que l'ensemble du personnel devienne
-- administrateur d'un coup.

-- Comme est_staff() : simple témoin booléen, utilisé aussi dans une politique RLS,
-- donc exécutable par anon/authenticated (il renvoie « faux » pour un non-admin).
create or replace function public.est_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin');
$$;
revoke all on function public.est_admin() from public;
grant execute on function public.est_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Niveau d'authentification (MFA)
--    'aal2' = deuxième facteur actif (Authenticator). 'aal1' = mot de passe seul.
-- ---------------------------------------------------------------------
create or replace function public._odyris_aal() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1');
$$;
revoke all on function public._odyris_aal() from public, anon, authenticated;

create or replace function public._odyris_exiger_mfa() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if public._odyris_aal() <> 'aal2' then
    raise exception 'Cette action exige la double authentification (MFA).';
  end if;
end $$;
revoke all on function public._odyris_exiger_mfa() from public, anon, authenticated;

-- Fraîcheur du second facteur : le claim « amr » du jeton liste les méthodes
-- d'authentification avec leur horodatage. Pour une action sensible, on exige
-- que le second facteur ait été présenté récemment (step-up), pas seulement
-- que la session soit « aal2 » (ce niveau peut dater de plusieurs heures).
create or replace function public._odyris_mfa_recente(p_max_minutes integer default 15) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
     where e ->> 'method' in ('totp','mfa','webauthn','phone')
       and to_timestamp((e ->> 'timestamp')::double precision)
             > now() - make_interval(mins => greatest(1, p_max_minutes))
  );
$$;
revoke all on function public._odyris_mfa_recente(integer) from public, anon, authenticated;

create or replace function public._odyris_exiger_mfa_fraiche(p_minutes integer default 15) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._odyris_exiger_mfa();                 -- niveau aal2 requis
  if not public._odyris_mfa_recente(p_minutes) then
    raise exception 'Reconfirmez votre code MFA pour cette action (authentification trop ancienne).';
  end if;
end $$;
revoke all on function public._odyris_exiger_mfa_fraiche(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Journal d'audit
--    Écriture : uniquement via public._odyris_log (appelée par les wrappers).
--    Lecture : administrateurs (RLS + fonction dédiée).
-- ---------------------------------------------------------------------
create table if not exists public.odyris_journal (
  id          uuid primary key default gen_random_uuid(),
  at          timestamptz not null default now(),
  acteur      uuid,                         -- auth.uid() au moment de l'action
  acteur_nom  text,
  action      text not null,                -- ex. 'valider_paiement'
  cible       text,                         -- ex. la référence ODY-xxxxxx
  details     jsonb not null default '{}'::jsonb,
  aal         text                          -- niveau d'authentification de l'acteur
);
create index if not exists odyris_journal_at_idx on public.odyris_journal (at desc);

alter table public.odyris_journal enable row level security;
revoke insert, update, delete, truncate, references, trigger on public.odyris_journal from anon, authenticated;
drop policy if exists admin_lit_journal on public.odyris_journal;
create policy admin_lit_journal on public.odyris_journal for select using (public.est_admin());

-- Insertion tracée. Non accordée à personne : seules les fonctions Odyris
-- (SECURITY DEFINER, donc exécutées comme le propriétaire) peuvent l'appeler.
create or replace function public._odyris_log(p_action text, p_cible text, p_details jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  insert into public.odyris_journal (acteur, acteur_nom, action, cible, details, aal)
  values (auth.uid(),
          (select nom from public.staff where user_id = auth.uid()),
          p_action, p_cible, coalesce(p_details, '{}'::jsonb), public._odyris_aal());
end $$;
revoke all on function public._odyris_log(text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Actions Odyris : réutilisent la logique existante + MFA + trace
-- ---------------------------------------------------------------------
-- Les actions prennent la RÉFÉRENCE (ODY-… / DON-…), celle qu'affiche la fiche.
create or replace function public.odyris_valider_paiement(p_reference text)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid; v_num integer; v_ref text := upper(btrim(coalesce(p_reference, '')));
begin
  perform public._exiger_staff();
  perform public._odyris_exiger_mfa_fraiche(15);        -- aal2 + second facteur récent
  select id into v_id from public.inscriptions where reference = v_ref;
  if v_id is null then raise exception 'Inscription introuvable : %', v_ref; end if;
  v_num := public.valider_paiement(v_id);            -- logique existante (dossard, Fonds)
  perform public._odyris_log('valider_paiement', v_ref, jsonb_build_object('dossard', v_num));
  return v_num;
end $$;
revoke all on function public.odyris_valider_paiement(text) from public, anon, authenticated;
grant execute on function public.odyris_valider_paiement(text) to authenticated;

create or replace function public.odyris_valider_don(p_reference text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid; v_montant integer; v_ref text := upper(btrim(coalesce(p_reference, '')));
begin
  perform public._exiger_staff();
  perform public._odyris_exiger_mfa_fraiche(15);        -- aal2 + second facteur récent
  select id, montant into v_id, v_montant from public.dons where reference = v_ref;
  if v_id is null then raise exception 'Don introuvable : %', v_ref; end if;
  perform public.valider_don(v_id);                  -- logique existante (Fonds)
  perform public._odyris_log('valider_don', v_ref, jsonb_build_object('montant', v_montant));
end $$;
revoke all on function public.odyris_valider_don(text) from public, anon, authenticated;
grant execute on function public.odyris_valider_don(text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Lecture du journal (administrateurs) et identité courante
-- ---------------------------------------------------------------------
create or replace function public.odyris_journal_lire(p_limit integer default 100)
returns table (at timestamptz, acteur_nom text, action text, cible text, details jsonb, aal text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé aux administrateurs'; end if;
  return query
    select j.at, j.acteur_nom, j.action, j.cible, j.details, j.aal
      from public.odyris_journal j
     order by j.at desc
     limit greatest(1, least(coalesce(p_limit, 100), 1000));
end $$;
revoke all on function public.odyris_journal_lire(integer) from public, anon, authenticated;
grant execute on function public.odyris_journal_lire(integer) to authenticated;

-- Qui suis-je dans Odyris (pour adapter l'interface) : nom, rôle, MFA active ?
-- Refuse un non-staff (comme toutes les fonctions réservées).
create or replace function public.odyris_moi()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_staff() then raise exception 'Accès réservé au personnel'; end if;
  return jsonb_build_object(
    'staff', true,
    'nom',   (select nom  from public.staff where user_id = auth.uid()),
    'role',  (select role from public.staff where user_id = auth.uid()),
    'admin', public.est_admin(),
    'aal',   public._odyris_aal()
  );
end $$;
revoke all on function public.odyris_moi() from public, anon, authenticated;
grant execute on function public.odyris_moi() to authenticated;
