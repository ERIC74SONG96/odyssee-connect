-- Tests de la migration 002 (données personnelles). Lancé par tests/verifier_sql.sh.
-- Chaque test lève une exception en cas d'échec.
\set ON_ERROR_STOP on
begin;
-- Depuis la migration 003, les inscriptions sont fermées par défaut : on les ouvre pour ces tests.
update public.reglages_inscriptions set ouvertes = true;
set local role anon;
do $t$
declare r record;
  base jsonb := '{"nom":"Test","prenom":"P","telephone":"+237699000101","email":"t@exemple.cm","sexe":"F","distance":"10","categorie":"travailleur","urgence_nom":"U","urgence_tel":"+237699000102","consentement":true,"consentement_version":"2026-11-25"}';
  procedure_ok boolean;
begin
  -- 1. Adulte accepté
  perform public.creer_inscription(base || '{"date_naissance":"1990-05-01"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
  -- 2. 18 ans pile le jour de la course (né le 10/07/2009) : majeur, pas d'accord parental exigé
  perform public.creer_inscription(base || '{"date_naissance":"2009-07-10","telephone":"+237699000103"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
  -- 3. 18 ans le lendemain (né le 11/07/2009) : mineur, refusé sans accord
  begin
    perform public.creer_inscription(base || '{"date_naissance":"2009-07-11","telephone":"+237699000104"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
    raise exception 'ÉCHEC : mineur (11/07/2009) accepté sans accord parental';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
  end;
  -- 4. … et accepté avec accord
  perform public.creer_inscription(base || '{"date_naissance":"2009-07-11","telephone":"+237699000104","consentement_parental":true}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
  -- 5. Sans e-mail : refusé
  begin
    perform public.creer_inscription((base - 'email') || '{"date_naissance":"1990-01-01","telephone":"+237699000105"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
    raise exception 'ÉCHEC : inscription sans e-mail acceptée';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- 6. Version de consentement inconnue : refusée
  begin
    perform public.creer_inscription(base || '{"date_naissance":"1990-01-01","telephone":"+237699000106","consentement_version":"v999"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
    raise exception 'ÉCHEC : version de consentement inconnue acceptée';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- 7. Entrées malformées : erreurs claires, pas d'erreur de conversion brute
  begin
    perform public.creer_inscription(base || '{"date_naissance":"pas-une-date","telephone":"+237699000107"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
    raise exception 'ÉCHEC : date malformée acceptée';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm <> 'Date de naissance invalide' then raise exception 'ÉCHEC : message inattendu pour une date malformée : %', sqlerrm; end if;
  end;
  begin
    perform public.creer_inscription(base || '{"date_naissance":"1990-01-01","telephone":"+237699000108","don":"abc"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
    raise exception 'ÉCHEC : don malformé accepté';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm <> 'Montant du don invalide' then raise exception 'ÉCHEC : message inattendu pour un don malformé : %', sqlerrm; end if;
  end;
  -- 8. Âge minimum apprécié le jour de la course : 10 ans le 10/07/2027 accepté
  perform public.creer_inscription(base || '{"date_naissance":"2017-07-10","telephone":"+237699000109","consentement_parental":true}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
  -- 9. Le rôle anonyme ne peut pas effacer
  begin
    perform public.anonymiser_inscriptions();
    raise exception 'ÉCHEC : anon a pu appeler anonymiser_inscriptions()';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  begin
    perform public._effacer_coordonnees_inscriptions();
    raise exception 'ÉCHEC : anon a pu appeler _effacer_coordonnees_inscriptions()';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
end $t$;
reset role;

-- 10. Un compte connecté qui n'est pas de l'équipe est refusé
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000aa';
do $t$ begin
  begin
    perform public.anonymiser_inscriptions();
    raise exception 'ÉCHEC : un compte non-staff a pu effacer';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Accès réservé%' then raise exception 'ÉCHEC : message inattendu : %', sqlerrm; end if;
  end;
  begin
    perform public._effacer_coordonnees_inscriptions();
    raise exception 'ÉCHEC : authenticated a pu appeler la fonction interne';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
end $t$;
reset role;

-- 11. Droits effectifs
do $t$ begin
  if has_function_privilege('anon', 'public.anonymiser_inscriptions()', 'execute') then raise exception 'ÉCHEC : anon peut exécuter anonymiser_inscriptions'; end if;
  if has_function_privilege('authenticated', 'public._effacer_coordonnees_inscriptions()', 'execute') then raise exception 'ÉCHEC : authenticated peut exécuter la fonction interne'; end if;
  if not has_function_privilege('anon', 'public.creer_inscription(jsonb)', 'execute') then raise exception 'ÉCHEC : anon ne peut pas s''inscrire'; end if;
end $t$;

-- 12. Ce qui est enregistré : accord parental seulement pour le mineur, version et horodatage présents
do $t$ begin
  if (select count(*) from public.inscriptions where consentement_parental) <> 2 then raise exception 'ÉCHEC : accord parental mal enregistré'; end if;
  if exists (select 1 from public.inscriptions where consentement_version is null or consentement_at is null) then raise exception 'ÉCHEC : version ou horodatage du consentement manquant'; end if;
  if exists (select 1 from public.inscriptions where ville is not null) then raise exception 'ÉCHEC : la ville est enregistrée'; end if;
end $t$;
rollback;
\echo 'Tests 002 : OK'
