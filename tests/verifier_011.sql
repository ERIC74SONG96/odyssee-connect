-- Tests de la migration 011 (gestion du personnel). Lancé par verifier_sql.sh.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000011aa', 'admin11@exemple.cm'),
  ('00000000-0000-0000-0000-0000000011cc', 'agent11@exemple.cm'),
  ('00000000-0000-0000-0000-0000000011dd', 'candidat11@exemple.cm')  -- compte sans accès staff
on conflict do nothing;
insert into public.staff (user_id, nom) values
  ('00000000-0000-0000-0000-0000000011aa', 'Admin Onze'),
  ('00000000-0000-0000-0000-0000000011cc', 'Agent Onze')
on conflict do nothing;
update public.staff set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000011aa';
update public.staff set role = 'agent' where user_id = '00000000-0000-0000-0000-0000000011cc';

-- 1. Un agent (non-admin) est refusé -------------------------------
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000011cc';
set local request.jwt.aal = 'aal2';
do $t$ begin
  begin perform * from public.odyris_personnel_lister();
    raise exception 'ÉCHEC : un agent a listé le personnel';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Accès réservé%' then raise exception 'ÉCHEC : message inattendu : %', sqlerrm; end if;
  end;
  begin perform public.odyris_personnel_ajouter('candidat11@exemple.cm', 'X', 'agent');
    raise exception 'ÉCHEC : un agent a ajouté du personnel';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Accès réservé%' then raise exception 'ÉCHEC : message inattendu : %', sqlerrm; end if;
  end;
end $t$;
reset role;

-- 2. Admin SANS MFA : modification refusée -------------------------
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000011aa';
set local request.jwt.aal = 'aal1';
do $t$ begin
  begin perform public.odyris_personnel_ajouter('candidat11@exemple.cm', 'X', 'agent');
    raise exception 'ÉCHEC : ajout accepté sans MFA';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%authentification%' then raise exception 'ÉCHEC : message MFA inattendu : %', sqlerrm; end if;
  end;
end $t$;
reset role;

-- 3. Admin avec MFA : lister, ajouter, changer de rôle, retirer ----
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000011aa';
set local request.jwt.aal = 'aal2';
set local request.jwt.mfa_ts = '';
do $t$ declare n int;
begin
  select count(*) into n from public.odyris_personnel_lister();
  if n < 2 then raise exception 'ÉCHEC : liste du personnel incomplète (%)', n; end if;

  perform public.odyris_personnel_ajouter('candidat11@exemple.cm', 'Candidat Onze', 'agent');
  if (select role from public.staff where user_id = '00000000-0000-0000-0000-0000000011dd') <> 'agent' then
    raise exception 'ÉCHEC : candidat non ajouté comme agent'; end if;

  perform public.odyris_personnel_role('00000000-0000-0000-0000-0000000011dd', 'admin');
  if (select role from public.staff where user_id = '00000000-0000-0000-0000-0000000011dd') <> 'admin' then
    raise exception 'ÉCHEC : rôle non passé à admin'; end if;

  perform public.odyris_personnel_retirer('00000000-0000-0000-0000-0000000011dd');
  if exists (select 1 from public.staff where user_id = '00000000-0000-0000-0000-0000000011dd') then
    raise exception 'ÉCHEC : membre non retiré'; end if;
end $t$;
reset role;

-- 4. Protection : dernier admin et auto-retrait --------------------
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000011aa';
set local request.jwt.aal = 'aal2';
set local request.jwt.mfa_ts = '';
do $t$ begin
  -- aa est le seul admin : se rétrograder doit être refusé
  begin perform public.odyris_personnel_role('00000000-0000-0000-0000-0000000011aa', 'agent');
    raise exception 'ÉCHEC : dernier admin rétrogradé';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%au moins un administrateur%' then raise exception 'ÉCHEC : message dernier admin inattendu : %', sqlerrm; end if;
  end;
  -- se retirer soi-même doit être refusé
  begin perform public.odyris_personnel_retirer('00000000-0000-0000-0000-0000000011aa');
    raise exception 'ÉCHEC : auto-retrait accepté';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%vous-même%' then raise exception 'ÉCHEC : message auto-retrait inattendu : %', sqlerrm; end if;
  end;
end $t$;
reset role;

\echo 'Migration 011 : tous les tests passent'
rollback;
