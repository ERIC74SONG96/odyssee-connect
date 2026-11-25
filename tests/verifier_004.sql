-- Tests de la migration 004 (audit de sécurité). Lancé par tests/verifier_sql.sh.
-- Chaque test lève une exception en cas d'échec. Tout est annulé à la fin (rollback).
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000dd', 'equipe4@exemple.cm') on conflict do nothing;
insert into public.staff (user_id) values ('00000000-0000-0000-0000-0000000000dd') on conflict do nothing;

-- 0. Délai par défaut : 48 h ; seul le staff peut le changer
do $t$ begin
  if (select delai_paiement_heures from public.reglages_inscriptions where id = 1) <> 48 then
    raise exception 'ÉCHEC : délai de paiement par défaut différent de 48 h'; end if;
end $t$;
set local role anon;
do $t$ begin
  begin perform public.regler_delai_paiement(1); raise exception 'ÉCHEC : anon a changé le délai';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
end $t$;
reset role;
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000bb';
do $t$ begin
  begin perform public.regler_delai_paiement(1); raise exception 'ÉCHEC : un non-staff a changé le délai';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Accès réservé%' then raise exception 'ÉCHEC : message inattendu : %', sqlerrm; end if; end;
end $t$;
reset role;

-- 1. L'équipe ouvre avec 2 places
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000dd';
do $t$ begin perform public.regler_inscriptions(true, 2, null); end $t$;
reset role;

-- 2. Deux inscriptions en attente remplissent les 2 places ; la 3e est refusée
set local role anon;
do $t$
declare b jsonb := '{"telephone":"+237699400001","email":"x@exemple.cm","sexe":"F","distance":"5","categorie":"etudiant","urgence_nom":"U","urgence_tel":"+237699400002","consentement":true,"consentement_version":"2026-11-25","date_naissance":"1995-03-01"}';
begin
  perform public.creer_inscription(b || '{"nom":"Quatre","prenom":"Un"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
  perform public.creer_inscription(b || '{"nom":"Quatre","prenom":"Deux"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
  begin
    perform public.creer_inscription(b || '{"nom":"Quatre","prenom":"Trois"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
    raise exception 'ÉCHEC : 3e inscription acceptée pour 2 places';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Complet%' then raise exception 'ÉCHEC : message inattendu (complet) : %', sqlerrm; end if; end;
  if (public.etat_public() -> 'inscriptions' ->> 'restantes')::int <> 0 then raise exception 'ÉCHEC : restantes <> 0'; end if;
end $t$;
reset role;

-- 3. L'inscription « Un » dépasse sa date limite : sa place se libère
do $t$ begin
  if (select paiement_avant from public.inscriptions where nom = 'Quatre' and prenom = 'Un')
     not between now() + interval '47 hours 59 minutes' and now() + interval '48 hours 1 minute' then
    raise exception 'ÉCHEC : date limite de paiement différente de création + 48 h'; end if;
end $t$;
update public.inscriptions set paiement_avant = now() - interval '1 hour' where nom = 'Quatre' and prenom = 'Un';
set local role anon;
do $t$
declare b jsonb := '{"telephone":"+237699400001","email":"x@exemple.cm","sexe":"F","distance":"5","categorie":"etudiant","urgence_nom":"U","urgence_tel":"+237699400002","consentement":true,"consentement_version":"2026-11-25","date_naissance":"1995-03-01"}';
begin
  if (public.etat_public() -> 'inscriptions' ->> 'restantes')::int <> 1 then raise exception 'ÉCHEC : la place expirée n''est pas libérée'; end if;
  perform public.creer_inscription(b || '{"nom":"Quatre","prenom":"Trois"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
  -- La même personne qu'une inscription expirée peut se réinscrire (plus de place pour l'instant : complet)
  begin
    perform public.creer_inscription(b || '{"nom":"Quatre","prenom":"Un"}' || jsonb_build_object('cle_envoi', gen_random_uuid()));
    raise exception 'ÉCHEC : inscription acceptée alors que c''est complet';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Complet%' then raise exception 'ÉCHEC : la personne expirée est refusée pour un autre motif : %', sqlerrm; end if; end;
end $t$;
reset role;

-- 3 bis. Allonger le délai ne fait pas revivre une inscription expirée (pas de dépassement du quota)
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000dd';
do $t$ begin perform public.regler_delai_paiement(720); end $t$;
reset role;
do $t$ begin
  if (public.etat_public() -> 'inscriptions' ->> 'restantes')::int <> 0 then
    raise exception 'ÉCHEC : allonger le délai a réactivé une inscription expirée'; end if;
end $t$;
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000dd';
do $t$ begin perform public.regler_delai_paiement(48); end $t$;
reset role;

-- 4. « Un » (expirée) déclare son paiement alors que tout est pris : refus clair
set local role anon;
do $t$
declare r text := (select reference from public.inscriptions where nom = 'Quatre' and prenom = 'Un');
begin
  begin
    perform public.declarer_paiement(r, '+237699400001', 'mtn', 'TX-QUATRE-UN');
    raise exception 'ÉCHEC : paiement d''une inscription expirée accepté alors que c''est complet';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%délai de paiement%' then raise exception 'ÉCHEC : message inattendu (expirée) : %', sqlerrm; end if; end;
end $t$;
reset role;

-- 5. Une place de plus : « Un » peut déclarer et reprend la place
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000dd';
do $t$ begin perform public.regler_inscriptions(true, 3, null); end $t$;
reset role;
set local role anon;
do $t$
declare r text := (select reference from public.inscriptions where nom = 'Quatre' and prenom = 'Un');
begin
  if public.declarer_paiement(r, '+237699400001', 'mtn', 'TX-QUATRE-UN') <> 'paiement_declare' then
    raise exception 'ÉCHEC : déclaration refusée alors qu''une place est libre'; end if;
  if (public.etat_public() -> 'inscriptions' ->> 'restantes')::int <> 0 then raise exception 'ÉCHEC : restantes après reprise <> 0'; end if;
end $t$;
reset role;

-- 6. Une inscription au paiement déclaré garde sa place même ancienne
update public.inscriptions set created_at = now() - interval '30 days' where nom = 'Quatre' and prenom = 'Un';
do $t$ begin
  if (public.etat_public() -> 'inscriptions' ->> 'restantes')::int <> 0 then raise exception 'ÉCHEC : un paiement déclaré a perdu sa place'; end if;
end $t$;

-- 6 ter. Une inscription annulée par l'équipe ne peut pas être « redéclarée » payée
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000dd';
do $t$ begin
  perform public.regler_inscriptions(true, 10, null);
  perform public.annuler_inscription((select id from public.inscriptions where nom = 'Quatre' and prenom = 'Deux'));
end $t$;
reset role;
set local role anon;
do $t$
declare r text := (select reference from public.inscriptions where nom = 'Quatre' and prenom = 'Deux');
begin
  begin
    perform public.declarer_paiement(r, '+237699400001', 'orange', 'TX-QUATRE-DEUX');
    raise exception 'ÉCHEC : une inscription annulée a été remise en « paiement déclaré »';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Inscription introuvable%' then raise exception 'ÉCHEC : message inattendu (annulée) : %', sqlerrm; end if; end;
end $t$;
reset role;

-- 6 quater. Expirée puis réinscrite : l'ancienne référence ne peut plus être payée
set local role anon;
do $t$
declare b jsonb := '{"nom":"Cinq","prenom":"Ancien","telephone":"+237699400011","email":"y@exemple.cm","sexe":"M","distance":"10","categorie":"travailleur","urgence_nom":"U","urgence_tel":"+237699400012","consentement":true,"consentement_version":"2026-11-25","date_naissance":"1988-07-07"}';
begin
  perform public.creer_inscription(b || jsonb_build_object('cle_envoi', gen_random_uuid()));
end $t$;
reset role;
update public.inscriptions set paiement_avant = now() - interval '1 hour' where nom = 'Cinq';
set local role anon;
do $t$
declare b jsonb := '{"nom":"Cinq","prenom":"Ancien","telephone":"+237699400011","email":"y@exemple.cm","sexe":"M","distance":"10","categorie":"travailleur","urgence_nom":"U","urgence_tel":"+237699400012","consentement":true,"consentement_version":"2026-11-25","date_naissance":"1988-07-07"}';
  ancienne text := (select reference from public.inscriptions where nom = 'Cinq');
begin
  perform public.creer_inscription(b || jsonb_build_object('cle_envoi', gen_random_uuid()));
  begin
    perform public.declarer_paiement(ancienne, '+237699400011', 'mtn', 'TX-CINQ-ANCIEN');
    raise exception 'ÉCHEC : l''ancienne référence a pu être payée alors qu''une plus récente tient une place';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%plus récente%' then raise exception 'ÉCHEC : message inattendu (réinscrit) : %', sqlerrm; end if; end;
end $t$;
reset role;

-- 6 bis. Une inscription payée (validée par l'équipe) garde sa place pour toujours
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000dd';
do $t$ begin
  perform public.valider_paiement((select id from public.inscriptions where nom = 'Quatre' and prenom = 'Un'));
end $t$;
reset role;
update public.inscriptions set created_at = now() - interval '60 days' where nom = 'Quatre' and prenom = 'Un';
do $t$ begin
  if (select statut from public.inscriptions where nom = 'Quatre' and prenom = 'Un') <> 'paye' then
    raise exception 'ÉCHEC : la validation n''a pas donné le statut paye'; end if;
  if not (select public._place_tenue(statut, paiement_avant) from public.inscriptions where nom = 'Quatre' and prenom = 'Un') then
    raise exception 'ÉCHEC : une inscription payée a perdu sa place'; end if;
end $t$;

-- 7. Droits : anon et authenticated ne peuvent ni écrire ni vider les tables
do $t$
declare t record; d text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r','p') loop
    foreach d in array array['INSERT','UPDATE','DELETE','TRUNCATE'] loop
      if has_table_privilege('anon', 'public.' || quote_ident(t.relname), d)
         or has_table_privilege('authenticated', 'public.' || quote_ident(t.relname), d) then
        raise exception 'ÉCHEC : droit % sur % pour anon/authenticated', d, t.relname;
      end if;
    end loop;
    if not (select relrowsecurity from pg_class where oid = ('public.' || quote_ident(t.relname))::regclass) then
      raise exception 'ÉCHEC : RLS désactivée sur %', t.relname;
    end if;
  end loop;
end $t$;

-- 8. Toute fonction SECURITY DEFINER fixe son search_path ; les fonctions internes (_…) ne sont pas exécutables
do $t$
declare f text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if f is not null then raise exception 'ÉCHEC : SECURITY DEFINER sans search_path : %', f; end if;
  select string_agg(p.oid::regprocedure::text, ', ') into f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like '\_%'
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  if f is not null then raise exception 'ÉCHEC : fonctions internes exécutables : %', f; end if;
end $t$;

-- 8 bis. Liste blanche : seules ces fonctions sont exécutables par anon
do $t$
declare f text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('aimer','annonces_publiques','arreter_position','commentaires_publics','commenter',
       'consulter_inscription','contenus_publics','creer_benevole','creer_candidature','creer_commande','creer_don',
       'creer_inscription','creer_participation','creer_publication','declarer_don','declarer_paiement','est_staff',
       'etat_public','evenements_publics','fil_public','groupes_publics','impact_public','partager_position',
       'points_publics','positions_publiques','resultats_publics','signaler','suivi_etat');
  if f is not null then raise exception 'ÉCHEC : fonctions exécutables par anon hors liste blanche : %', f; end if;
end $t$;

-- 8 ter. Aucune fonction du schéma public n'est exécutable par PUBLIC (droit implicite ou explicite)
do $t$
declare f text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'));
  if f is not null then raise exception 'ÉCHEC : fonctions exécutables par PUBLIC : %', f; end if;
end $t$;

-- 9. Tout compte connecté non-staff est refusé par chaque fonction réservée à l'équipe
do $t$
declare f record; argl text; ko text := '';
begin
  for f in select p.proname, p.proargtypes from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prosecdef
              and has_function_privilege('authenticated', p.oid, 'execute')
              and not has_function_privilege('anon', p.oid, 'execute') loop
    select string_agg('null::' || format_type(t, null), ',') into argl from unnest(f.proargtypes::oid[]) t;
    begin
      perform set_config('request.jwt.uid', '00000000-0000-0000-0000-0000000000bb', true);
      execute 'set local role authenticated';
      execute format('select public.%I(%s)', f.proname, coalesce(argl, ''));
      execute 'reset role';
      ko := ko || f.proname || ' ';
    exception when others then
      execute 'reset role';
      if sqlerrm not like 'Accès réservé%' then ko := ko || f.proname || ' [' || sqlerrm || '] '; end if;
    end;
  end loop;
  if ko <> '' then raise exception 'ÉCHEC : fonctions staff qui ne refusent pas un non-staff : %', ko; end if;
end $t$;

\echo 'Migration 004 : tous les tests passent'
rollback;
