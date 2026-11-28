-- Tests de la migration 009 (Odyris : rôles, journal d'audit, actions tracées,
-- exigence MFA). Lancé par tests/verifier_sql.sh. Autonome, annulé à la fin.
\set ON_ERROR_STOP on
begin;

-- Deux membres du personnel : un administrateur, un agent. Plus un non-staff.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000009aa', 'admin9@exemple.cm'),
  ('00000000-0000-0000-0000-0000000009cc', 'agent9@exemple.cm')
on conflict do nothing;
insert into public.staff (user_id, nom) values
  ('00000000-0000-0000-0000-0000000009aa', 'Admin Neuf'),
  ('00000000-0000-0000-0000-0000000009cc', 'Agent Neuf')
on conflict do nothing;
update public.staff set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000009aa';
update public.staff set role = 'agent' where user_id = '00000000-0000-0000-0000-0000000009cc';
update public.reglages_inscriptions set ouvertes = true, quota = 100 where id = 1;

-- On fabrique une inscription (à valider) et un don (à valider).
create temp table t9 (k text primary key, v text);
grant select on t9 to anon, authenticated;
do $t$ declare r text;
begin
  select reference into r from public.creer_inscription('{"nom":"Neuf","prenom":"Test","telephone":"+237699711001","email":"n9@exemple.cm","sexe":"M","distance":"3","categorie":"etudiant","urgence_nom":"U","urgence_tel":"+237699711002","consentement":true,"consentement_version":"2026-11-25","date_naissance":"1990-03-03"}'::jsonb || jsonb_build_object('cle_envoi', gen_random_uuid()));
  insert into t9 values ('ins', r);
end $t$;
do $t$ declare r text;
begin
  select reference into r from public.creer_don('{"telephone":"+237699711003","montant":500,"nom":"Donateur Neuf"}'::jsonb);
  insert into t9 values ('don', r);
end $t$;

-- 1. Rôles et identité ------------------------------------------------
--    Admin + MFA active (aal2)
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000009aa';
set local request.jwt.aal = 'aal2';
do $t$ begin
  if not public.est_staff()  then raise exception 'ÉCHEC : admin non reconnu staff'; end if;
  if not public.est_admin()  then raise exception 'ÉCHEC : admin non reconnu admin'; end if;
  if (public.odyris_moi()->>'role')  <> 'admin' then raise exception 'ÉCHEC : odyris_moi.role'; end if;
  if (public.odyris_moi()->>'admin') <> 'true'  then raise exception 'ÉCHEC : odyris_moi.admin'; end if;
  if (public.odyris_moi()->>'aal')   <> 'aal2'  then raise exception 'ÉCHEC : odyris_moi.aal'; end if;
end $t$;
reset role;

--    Agent, mot de passe seul (aal1)
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000009cc';
set local request.jwt.aal = 'aal1';
do $t$ begin
  if not public.est_staff() then raise exception 'ÉCHEC : agent non reconnu staff'; end if;
  if public.est_admin()     then raise exception 'ÉCHEC : agent reconnu admin à tort'; end if;
  if (public.odyris_moi()->>'admin') <> 'false' then raise exception 'ÉCHEC : odyris_moi.admin agent'; end if;
end $t$;
reset role;

--    Non-staff
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000bb';
do $t$ begin
  if public.est_staff() then raise exception 'ÉCHEC : non-staff reconnu staff'; end if;
  begin
    perform public.odyris_moi();
    raise exception 'ÉCHEC : odyris_moi n''a pas refusé un non-staff';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Accès réservé%' then
      raise exception 'ÉCHEC : message odyris_moi inattendu : %', sqlerrm; end if;
  end;
end $t$;
reset role;

-- 2. MFA exigée sur les actions --------------------------------------
--    Agent SANS MFA : la validation doit être refusée
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000009cc';
set local request.jwt.aal = 'aal1';
do $t$
begin
  begin
    perform public.odyris_valider_paiement((select v from t9 where k = 'ins'));
    raise exception 'ÉCHEC : validation acceptée sans MFA';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%double authentification%' then
      raise exception 'ÉCHEC : message MFA inattendu : %', sqlerrm; end if;
  end;
end $t$;
reset role;

-- 3. Agent AVEC MFA : validation + trace au journal -------------------
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000009cc';
set local request.jwt.aal = 'aal2';
do $t$ declare d integer;
begin
  d := public.odyris_valider_paiement((select v from t9 where k = 'ins'));
  if d is null then raise exception 'ÉCHEC : aucun dossard attribué'; end if;
  if (select statut from public.inscriptions where reference = (select v from t9 where k = 'ins')) <> 'paye' then
    raise exception 'ÉCHEC : inscription non passée à payé'; end if;
end $t$;
reset role;
do $t$ begin
  if (select count(*) from public.odyris_journal
        where action = 'valider_paiement'
          and acteur = '00000000-0000-0000-0000-0000000009cc'
          and aal = 'aal2') <> 1 then
    raise exception 'ÉCHEC : trace de validation absente ou en double'; end if;
end $t$;

-- 4. Validation d'un don (admin, MFA) --------------------------------
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000009aa';
set local request.jwt.aal = 'aal2';
do $t$
begin
  perform public.odyris_valider_don((select v from t9 where k = 'don'));
  if (select statut from public.dons where reference = (select v from t9 where k = 'don')) <> 'valide' then
    raise exception 'ÉCHEC : don non validé'; end if;
end $t$;
reset role;

-- 5. Lecture du journal réservée aux admins --------------------------
--    Agent : refus
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000009cc';
set local request.jwt.aal = 'aal2';
do $t$ begin
  begin
    perform public.odyris_journal_lire(10);
    raise exception 'ÉCHEC : un agent a lu le journal';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%administrateurs%' then
      raise exception 'ÉCHEC : message journal inattendu : %', sqlerrm; end if;
  end;
end $t$;
reset role;
--    Admin : au moins deux lignes (paiement + don)
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000009aa';
set local request.jwt.aal = 'aal2';
do $t$ declare n integer;
begin
  select count(*) into n from public.odyris_journal_lire(100);
  if n < 2 then raise exception 'ÉCHEC : journal admin incomplet (% lignes)', n; end if;
end $t$;
reset role;

-- 6. Lecture directe de la table journal verrouillée -----------------
--    (RLS : seul un admin voit les lignes ; anon et agent voient zéro)
set local request.jwt.uid = '';
set local role anon;
do $t$ begin
  if (select count(*) from public.odyris_journal) <> 0 then
    raise exception 'ÉCHEC : anon lit le journal en direct'; end if;
  begin
    perform public.odyris_valider_paiement('ODY-ZZZZZZ');
    raise exception 'ÉCHEC : anon a pu valider';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;  -- permission denied attendu
  end;
end $t$;
reset role;
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000009cc';
do $t$ begin
  if (select count(*) from public.odyris_journal) <> 0 then
    raise exception 'ÉCHEC : un agent lit le journal en direct'; end if;
end $t$;
reset role;

\echo 'Migration 009 : tous les tests passent'
rollback;
