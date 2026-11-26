-- Tests de la migration 005 (vérification des paiements). Lancé par tests/verifier_sql.sh.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ee', 'equipe5@exemple.cm') on conflict do nothing;
insert into public.staff (user_id) values ('00000000-0000-0000-0000-0000000000ee') on conflict do nothing;
update public.reglages_inscriptions set ouvertes = true, quota = 1 where id = 1;

-- Une inscription (la seule place), paiement déclaré
set local role anon;
do $t$
declare r text;
begin
  select reference into r from public.creer_inscription('{"nom":"Six","prenom":"Refus","telephone":"+237699600001","email":"r@exemple.cm","sexe":"F","distance":"3","categorie":"etudiant","urgence_nom":"U","urgence_tel":"+237699600002","consentement":true,"consentement_version":"2026-11-25","date_naissance":"1993-02-02"}'::jsonb || jsonb_build_object('cle_envoi', gen_random_uuid()));
  perform public.declarer_paiement(r, '+237699600001', 'mtn', 'FAUX-123');
end $t$;
reset role;
update public.inscriptions set paiement_avant = now() - interval '5 days' where nom = 'Six';  -- délai initial écoulé

-- 1. anon et non-staff ne peuvent pas refuser
set local role anon;
do $t$ begin
  begin perform public.refuser_paiement((select id from public.inscriptions where nom = 'Six'), 'Introuvable');
    raise exception 'ÉCHEC : anon a refusé un paiement';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
end $t$;
reset role;
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000bb';
do $t$ begin
  begin perform public.refuser_paiement((select id from public.inscriptions where nom = 'Six'), 'Introuvable');
    raise exception 'ÉCHEC : un non-staff a refusé un paiement';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Accès réservé%' then raise exception 'ÉCHEC : message inattendu : %', sqlerrm; end if; end;
end $t$;
reset role;

-- 2. L'équipe refuse avec un motif : en attente, identifiant effacé, nouveau délai complet, place gardée
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000ee';
do $t$ begin
  begin perform public.refuser_paiement((select id from public.inscriptions where nom = 'Six'), ' ');
    raise exception 'ÉCHEC : refus sans motif accepté';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.refuser_paiement((select id from public.inscriptions where nom = 'Six'), 'Identifiant introuvable sur le relevé MTN');
end $t$;
reset role;
do $t$
declare v public.inscriptions;
begin
  select * into v from public.inscriptions where nom = 'Six';
  if v.statut <> 'en_attente' or v.transaction_id is not null or v.operateur is not null or v.refus_nombre <> 1 then
    raise exception 'ÉCHEC : état après refus incorrect (%, %, %)', v.statut, v.transaction_id, v.refus_nombre; end if;
  if v.paiement_avant < now() + interval '47 hours' then raise exception 'ÉCHEC : pas de nouveau délai après refus'; end if;
  if (public.etat_public() -> 'inscriptions' ->> 'restantes')::int <> 0 then raise exception 'ÉCHEC : la place a été libérée par le refus'; end if;
end $t$;

-- 3. Le coureur voit le motif ; l'identifiant refusé ne peut plus être déclaré (ni par lui, ni par un autre) ;
--    il déclare le bon identifiant : motif effacé
set local role anon;
do $t$
declare r text := (select reference from public.inscriptions where nom = 'Six'); m text;
begin
  select motif_refus into m from public.consulter_inscription(r, '+237699600001');
  if m is distinct from 'Identifiant introuvable sur le relevé MTN' then raise exception 'ÉCHEC : motif non visible par le coureur (%)', m; end if;
  begin
    perform public.declarer_paiement(r, '+237699600001', 'mtn', ' faux-123 ');
    raise exception 'ÉCHEC : un identifiant refusé a pu être redéclaré';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like '%déjà déclaré%' then raise exception 'ÉCHEC : message inattendu (refusé) : %', sqlerrm; end if; end;
  perform public.declarer_paiement(r, '+237699600001', 'mtn', 'VRAI-456');
  select motif_refus into m from public.consulter_inscription(r, '+237699600001');
  if m is not null then raise exception 'ÉCHEC : motif toujours affiché après nouvelle déclaration'; end if;
end $t$;
reset role;

-- 4. On ne refuse qu'un paiement déclaré (pas une inscription payée ni en attente)
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000ee';
do $t$
declare i uuid := (select id from public.inscriptions where nom = 'Six');
begin
  perform public.valider_paiement(i);
  begin perform public.refuser_paiement(i, 'Erreur');
    raise exception 'ÉCHEC : un paiement validé a été refusé';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Seul un paiement déclaré%' then raise exception 'ÉCHEC : message inattendu : %', sqlerrm; end if; end;
end $t$;
reset role;

-- 5. L'historique est réservé à l'équipe
set local request.jwt.uid = '';
set local role anon;
do $t$ begin
  if (select count(*) from public.paiements_refuses) <> 0 then raise exception 'ÉCHEC : anon lit les paiements refusés'; end if;
end $t$;
reset role;
do $t$ begin
  if (select count(*) from public.paiements_refuses where transaction_id = 'faux-123' and operateur = 'mtn') <> 1 then
    raise exception 'ÉCHEC : identifiant refusé absent de l''historique'; end if;
end $t$;

\echo 'Migration 005 : tous les tests passent'
rollback;
