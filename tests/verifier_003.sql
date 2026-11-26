-- Tests de la migration 003 (ouverture, quota, anti-doublons). Lancé par tests/verifier_sql.sh.
-- Chaque test lève une exception en cas d'échec. Tout est annulé à la fin (rollback).
\set ON_ERROR_STOP on
begin;

-- 0. État de départ : fermées, quota 3 000
do $t$ begin
  if (select ouvertes from public.reglages_inscriptions where id = 1) then raise exception 'ÉCHEC : les inscriptions sont ouvertes par défaut'; end if;
  if (select quota from public.reglages_inscriptions where id = 1) <> 3000 then raise exception 'ÉCHEC : quota par défaut différent de 3 000'; end if;
  if (public.etat_public() -> 'inscriptions' ->> 'ouvertes')::boolean then raise exception 'ÉCHEC : etat_public annonce des inscriptions ouvertes'; end if;
end $t$;

-- 1. Fermées : refus, même pour un formulaire valide
set local role anon;
do $t$
declare base jsonb := '{"nom":"Abena","prenom":"Marie","telephone":"+237699100001","email":"m@exemple.cm","sexe":"F","distance":"5","categorie":"etudiant","urgence_nom":"U","urgence_tel":"+237699100002","consentement":true,"consentement_version":"2026-11-25","date_naissance":"1995-03-01"}';
begin
  begin
    perform public.creer_inscription(base || jsonb_build_object('cle_envoi', gen_random_uuid()));
    raise exception 'ÉCHEC : inscription acceptée alors que les inscriptions sont fermées';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%pas ouvertes%' then raise exception 'ÉCHEC : message inattendu (fermé) : %', sqlerrm; end if;
  end;
  -- Sans clé d'envoi : refus clair
  begin
    perform public.creer_inscription(base);
    raise exception 'ÉCHEC : inscription sans clé d''envoi acceptée';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Version de l''appli%' then raise exception 'ÉCHEC : message inattendu (sans clé) : %', sqlerrm; end if;
  end;
  -- anon ne peut pas ouvrir
  begin
    perform public.regler_inscriptions(true, 10, null);
    raise exception 'ÉCHEC : anon a pu ouvrir les inscriptions';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
end $t$;
reset role;

-- 2. Un compte connecté non-staff ne peut ni régler ni lire les réglages
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000bb';
do $t$ begin
  if (select count(*) from public.reglages_inscriptions) <> 0 then raise exception 'ÉCHEC : un compte non-staff lit les réglages'; end if;
  begin
    perform public.regler_inscriptions(true, 10, null);
    raise exception 'ÉCHEC : un compte non-staff a pu ouvrir les inscriptions';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Accès réservé%' then raise exception 'ÉCHEC : message inattendu : %', sqlerrm; end if;
  end;
end $t$;
reset role;

-- 3. L'équipe ouvre avec un quota de 3 places
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000cc', 'equipe@exemple.cm') on conflict do nothing;
insert into public.staff (user_id) values ('00000000-0000-0000-0000-0000000000cc') on conflict do nothing;
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000cc';
do $t$
declare e jsonb;
begin
  begin
    perform public.regler_inscriptions(true, -1, null);
    raise exception 'ÉCHEC : quota négatif accepté';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  e := public.regler_inscriptions(true, 3, null);
  if not (e ->> 'ouvertes')::boolean or (e ->> 'quota')::int <> 3 or (e ->> 'restantes')::int <> 3 then
    raise exception 'ÉCHEC : réglage mal enregistré : %', e;
  end if;
end $t$;
reset role;

-- 4. Clé d'envoi : un même envoi répété ne crée qu'une inscription
set local role anon;
do $t$
declare
  base jsonb := '{"nom":"Abena","prenom":"Marie","telephone":"+237699100001","email":"m@exemple.cm","sexe":"F","distance":"5","categorie":"etudiant","urgence_nom":"U","urgence_tel":"+237699100002","consentement":true,"consentement_version":"2026-11-25","date_naissance":"1995-03-01"}';
  k uuid := gen_random_uuid();
  r1 text; r2 text; r_paul text;
begin
  select reference into r1 from public.creer_inscription(base || jsonb_build_object('cle_envoi', k));
  select reference into r2 from public.creer_inscription(base || jsonb_build_object('cle_envoi', k));
  if r1 is null or r1 <> r2 then raise exception 'ÉCHEC : envoi répété → deux références (% / %)', r1, r2; end if;
  -- Même clé et même téléphone mais données modifiées : pas de référence renvoyée en silence
  begin
    perform public.creer_inscription(base || jsonb_build_object('cle_envoi', k, 'prenom', 'Mariette'));
    raise exception 'ÉCHEC : même clé avec un autre prénom acceptée';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Une inscription a déjà été enregistrée depuis ce formulaire%' then raise exception 'ÉCHEC : message inattendu (clé, données modifiées) : %', sqlerrm; end if;
  end;
  -- Même clé avec un autre téléphone : refus
  begin
    perform public.creer_inscription(base || jsonb_build_object('cle_envoi', k, 'telephone', '+237699100099'));
    raise exception 'ÉCHEC : clé d''envoi réutilisée avec un autre téléphone';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  -- 5. Même personne, nouvelle clé : refus (casse et espaces ignorés)
  begin
    perform public.creer_inscription(base || jsonb_build_object('cle_envoi', gen_random_uuid(), 'nom', '  ABENA ', 'distance', '10'));
    raise exception 'ÉCHEC : la même personne a pu s''inscrire deux fois';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Cette personne est déjà inscrite%' then raise exception 'ÉCHEC : message inattendu (doublon) : %', sqlerrm; end if;
  end;
  -- 6. Deux autres personnes : le quota de 3 est atteint, la 4e est refusée
  select reference into r_paul from public.creer_inscription(base || jsonb_build_object('cle_envoi', gen_random_uuid(), 'prenom', 'Paul', 'telephone', '+237699100003'));
  perform public.creer_inscription(base || jsonb_build_object('cle_envoi', gen_random_uuid(), 'prenom', 'Rose', 'telephone', '+237699100004'));
  begin
    perform public.creer_inscription(base || jsonb_build_object('cle_envoi', gen_random_uuid(), 'prenom', 'Luc', 'telephone', '+237699100005'));
    raise exception 'ÉCHEC : quota dépassé';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Complet%' then raise exception 'ÉCHEC : message inattendu (quota) : %', sqlerrm; end if;
  end;
  -- … mais l'envoi répété d'une inscription déjà faite répond toujours, même complet
  select reference into r2 from public.creer_inscription(base || jsonb_build_object('cle_envoi', k));
  if r2 <> r1 then raise exception 'ÉCHEC : envoi répété refusé une fois complet'; end if;
  if (public.etat_public() -> 'inscriptions' ->> 'restantes')::int <> 0 then raise exception 'ÉCHEC : places restantes mal comptées'; end if;

  -- 7. Paiement : un identifiant de transaction ne sert qu'une fois
  perform public.declarer_paiement(r1, '+237699100001', 'mtn', 'MP2611250001');
  perform public.declarer_paiement(r1, '+237699100001', 'mtn', 'MP2611250001');  -- répété : accepté
  begin
    perform public.declarer_paiement(r_paul, '+237699100003', 'mtn', 'mp2611250001');
    raise exception 'ÉCHEC : identifiant de transaction réutilisé pour une autre inscription';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Cet identifiant de transaction%' then raise exception 'ÉCHEC : message inattendu (transaction) : %', sqlerrm; end if;
  end;
  -- Même identifiant chez l'autre opérateur : accepté (numérotations différentes)
  perform public.declarer_paiement(r_paul, '+237699100003', 'orange', 'MP2611250001');
end $t$;
reset role;

-- 8. Fermeture avec message : le message est celui affiché ; un inscrit peut encore déclarer son paiement
select set_config('test.rose', (select reference from public.inscriptions where prenom = 'Rose'), true);
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000cc';
select public.regler_inscriptions(false, 3000, 'Inscriptions suspendues : reprise demain à 8 h.');
reset role;
set local role anon;
do $t$ begin
  begin
    perform public.creer_inscription('{"nom":"Nkodo","prenom":"Jean","telephone":"+237699100006","email":"j@exemple.cm","sexe":"M","distance":"10","categorie":"travailleur","urgence_nom":"U","urgence_tel":"+237699100007","consentement":true,"consentement_version":"2026-11-25","date_naissance":"1988-08-08"}'::jsonb || jsonb_build_object('cle_envoi', gen_random_uuid()));
    raise exception 'ÉCHEC : inscription acceptée après suspension';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm <> 'Inscriptions suspendues : reprise demain à 8 h.' then raise exception 'ÉCHEC : message de suspension non repris : %', sqlerrm; end if;
  end;
  if public.etat_public() -> 'inscriptions' ->> 'message' <> 'Inscriptions suspendues : reprise demain à 8 h.' then raise exception 'ÉCHEC : message absent de etat_public'; end if;
  if public.declarer_paiement(current_setting('test.rose'), '+237699100004', 'orange', 'OM2611250077') <> 'paiement_declare' then
    raise exception 'ÉCHEC : paiement impossible après la fermeture des inscriptions';
  end if;
end $t$;
reset role;

-- 9. Droits effectifs
do $t$ begin
  if has_function_privilege('anon', 'public.regler_inscriptions(boolean, integer, text)', 'execute') then raise exception 'ÉCHEC : anon peut exécuter regler_inscriptions'; end if;
  if has_function_privilege('anon', 'public._transaction_deja_utilisee(text, text, text)', 'execute') then raise exception 'ÉCHEC : anon peut exécuter la fonction interne'; end if;
  if has_table_privilege('anon', 'public.reglages_inscriptions', 'select') then raise exception 'ÉCHEC : anon peut lire les réglages'; end if;
  if has_function_privilege('authenticated', 'public._transaction_deja_utilisee(text, text, text)', 'execute') then raise exception 'ÉCHEC : authenticated peut exécuter _transaction_deja_utilisee'; end if;
  if has_function_privilege('authenticated', 'public._etat_inscriptions()', 'execute') then raise exception 'ÉCHEC : authenticated peut exécuter _etat_inscriptions'; end if;
  if has_function_privilege('anon', 'public._etat_inscriptions()', 'execute') then raise exception 'ÉCHEC : anon peut exécuter _etat_inscriptions'; end if;
  if has_function_privilege('authenticated', 'public._effacer_coordonnees_inscriptions()', 'execute') then raise exception 'ÉCHEC : la fonction d''effacement redevient exécutable'; end if;
  if not has_function_privilege('anon', 'public.etat_public()', 'execute') then raise exception 'ÉCHEC : anon ne peut plus lire etat_public'; end if;
end $t$;
rollback;
\echo 'Tests 003 : OK'
