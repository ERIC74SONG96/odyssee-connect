-- Tests de la migration 012 (écrans Bénévoles, Commandes, Candidatures, Dons).
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000012aa', 'staff12@exemple.cm') on conflict do nothing;
insert into public.staff (user_id, nom) values
  ('00000000-0000-0000-0000-0000000012aa', 'Staff Douze') on conflict do nothing;

insert into public.benevoles (reference, nom, prenom, telephone, missions, statut)
  values ('BEN-120001', 'Essa', 'Luc', '+237699120001', array['logistique','accueil'], 'nouveau');
insert into public.commandes (reference, nom, telephone, articles, statut)
  values ('CMD-120001', 'Client Test', '+237699120002', '[{"article":"t-shirt","taille":"L"}]'::jsonb, 'nouvelle');
insert into public.candidatures (reference, type, nom, telephone, message, statut)
  values ('CAN-120001', 'partenaire', 'Sponsor SA', '+237699120003', 'Proposition de partenariat', 'nouveau'),
         ('CAN-120002', 'ambassadeur', 'Ada N', '+237699120005', 'Je veux être ambassadrice', 'nouveau');
insert into public.dons (reference, telephone, montant, statut)
  values ('DON-120001', '+237699120004', 5000, 'valide');

-- 1. Non-staff : tout est refusé ------------------------------------
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000bb';
do $t$
declare fns text[] := array['odyris_benevoles','odyris_commandes','odyris_candidatures','odyris_dons'];
        f text;
begin
  foreach f in array fns loop
    begin execute format('select * from public.%I()', f);
      raise exception 'ÉCHEC : non-staff a lu %', f;
    exception when others then
      if sqlerrm like 'ÉCHEC%' then raise; end if;
      if sqlerrm not like 'Accès réservé%' then raise exception 'ÉCHEC : message % inattendu : %', f, sqlerrm; end if;
    end;
  end loop;
  begin perform public.odyris_commande_statut('CMD-120001','confirmee');
    raise exception 'ÉCHEC : non-staff a changé un statut';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Accès réservé%' then raise exception 'ÉCHEC : message action inattendu : %', sqlerrm; end if;
  end;
end $t$;
reset role;

-- 2. Staff : lectures et filtres ------------------------------------
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000012aa';
do $t$ declare n int;
begin
  if (select count(*) from public.odyris_benevoles()) < 1 then raise exception 'ÉCHEC : bénévoles vide'; end if;
  if (select count(*) from public.odyris_commandes()) < 1 then raise exception 'ÉCHEC : commandes vide'; end if;
  if (select count(*) from public.odyris_dons()) < 1 then raise exception 'ÉCHEC : dons vide'; end if;
  -- filtre candidatures par type
  select count(*) into n from public.odyris_candidatures('partenaire');
  if n <> 1 then raise exception 'ÉCHEC : filtre candidatures partenaire = %', n; end if;
  if (select count(*) from public.odyris_candidatures('ambassadeur')) <> 1 then raise exception 'ÉCHEC : filtre ambassadeur'; end if;
  if (select count(*) from public.odyris_candidatures()) < 2 then raise exception 'ÉCHEC : candidatures sans filtre'; end if;
  -- filtre dons par statut
  if (select count(*) from public.odyris_dons('valide')) <> 1 then raise exception 'ÉCHEC : filtre dons valide'; end if;
  if (select count(*) from public.odyris_dons('annule')) <> 0 then raise exception 'ÉCHEC : filtre dons annule'; end if;
end $t$;
reset role;

-- 3. Staff : actions de statut + audit ------------------------------
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000012aa';
do $t$
begin
  perform public.odyris_benevole_statut('BEN-120001','contacte');
  if (select statut from public.benevoles where reference='BEN-120001') <> 'contacte' then raise exception 'ÉCHEC : bénévole statut'; end if;

  perform public.odyris_commande_statut('CMD-120001','confirmee');
  if (select statut from public.commandes where reference='CMD-120001') <> 'confirmee' then raise exception 'ÉCHEC : commande statut'; end if;

  -- marquer « payée » (confirmation financière) sans MFA doit être refusé
  begin perform public.odyris_commande_statut('CMD-120001','payee');
    raise exception 'ÉCHEC : commande payée acceptée sans MFA';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%authentification%' then raise exception 'ÉCHEC : message MFA commande inattendu : %', sqlerrm; end if;
  end;

  perform public.odyris_candidature_statut('CAN-120001','accepte');
  if (select statut from public.candidatures where reference='CAN-120001') <> 'accepte' then raise exception 'ÉCHEC : candidature statut'; end if;

  -- statut invalide
  begin perform public.odyris_commande_statut('CMD-120001','n_importe_quoi');
    raise exception 'ÉCHEC : statut invalide accepté';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%Statut invalide%' then raise exception 'ÉCHEC : message statut inattendu : %', sqlerrm; end if;
  end;
  -- référence introuvable
  begin perform public.odyris_benevole_statut('BEN-999999','retenu');
    raise exception 'ÉCHEC : référence inexistante acceptée';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%introuvable%' then raise exception 'ÉCHEC : message introuvable inattendu : %', sqlerrm; end if;
  end;
end $t$;
reset role;

-- 3 bis. « payée » avec MFA ANCIENNE (aal2 mais horodatage vieux) : refusée.
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000012aa';
set local request.jwt.aal = 'aal2';
set local request.jwt.mfa_ts = '1700000000';   -- nov. 2023 : trop ancien
do $t$ begin
  begin perform public.odyris_commande_statut('CMD-120001','payee');
    raise exception 'ÉCHEC : payée acceptée avec MFA ancienne';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%Reconfirmez%' then raise exception 'ÉCHEC : message fraîcheur commande inattendu : %', sqlerrm; end if;
  end;
end $t$;
reset role;

-- 3 ter. Marquer « payée » AVEC MFA récente réussit (mfa_ts vide = maintenant).
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000012aa';
set local request.jwt.aal = 'aal2';
set local request.jwt.mfa_ts = '';
do $t$ begin
  perform public.odyris_commande_statut('CMD-120001','payee');
  if (select statut from public.commandes where reference='CMD-120001') <> 'payee' then
    raise exception 'ÉCHEC : commande non payée avec MFA'; end if;
end $t$;
reset role;

-- audit présent (lecture directe superuser, hors rôle)
do $t$ begin
  if (select count(*) from public.odyris_journal where action in ('benevole_statut','commande_statut','candidature_statut')) < 3 then
    raise exception 'ÉCHEC : actions non journalisées'; end if;
end $t$;

\echo 'Migration 012 : tous les tests passent'
rollback;
