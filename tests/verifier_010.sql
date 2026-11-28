-- Tests de la migration 010 (tableau de bord + file à valider).
-- Lancé par tests/verifier_sql.sh. Autonome, annulé à la fin.
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000010aa', 'staff10@exemple.cm') on conflict do nothing;
insert into public.staff (user_id, nom) values
  ('00000000-0000-0000-0000-0000000010aa', 'Staff Dix') on conflict do nothing;
update public.reglages_inscriptions set ouvertes = true, quota = 100 where id = 1;

-- Deux inscriptions : une laissée en attente, une avec paiement déclaré.
do $t$ declare r text;
begin
  select reference into r from public.creer_inscription('{"nom":"Dix","prenom":"Attente","telephone":"+237699810001","email":"a10@exemple.cm","sexe":"M","distance":"3","categorie":"etudiant","urgence_nom":"U","urgence_tel":"+237699810002","consentement":true,"consentement_version":"2026-11-25","date_naissance":"1990-01-01"}'::jsonb || jsonb_build_object('cle_envoi', gen_random_uuid()));
  -- reste en_attente

  select reference into r from public.creer_inscription('{"nom":"Dix","prenom":"Declare","telephone":"+237699810003","email":"d10@exemple.cm","sexe":"F","distance":"5","categorie":"etudiant","urgence_nom":"U","urgence_tel":"+237699810004","consentement":true,"consentement_version":"2026-11-25","date_naissance":"1991-02-02"}'::jsonb || jsonb_build_object('cle_envoi', gen_random_uuid()));
  perform public.declarer_paiement(r, '+237699810003', 'orange', 'OM-10-0001');
end $t$;

-- Un don déclaré.
do $t$ declare r text;
begin
  select reference into r from public.creer_don('{"telephone":"+237699810005","montant":2000,"nom":"Donateur Dix"}'::jsonb);
  perform public.declarer_don(r, '+237699810005', 'mtn', 'MTN-10-0002');
end $t$;

-- 1. Accès refusé aux non-staff -------------------------------------
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000bb';
do $t$ begin
  begin perform public.odyris_tableau_bord();
    raise exception 'ÉCHEC : non-staff a lu le tableau de bord';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Accès réservé%' then raise exception 'ÉCHEC : message inattendu : %', sqlerrm; end if;
  end;
  begin perform * from public.odyris_a_valider();
    raise exception 'ÉCHEC : non-staff a lu la file à valider';
  exception when others then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Accès réservé%' then raise exception 'ÉCHEC : message inattendu : %', sqlerrm; end if;
  end;
end $t$;
reset role;

-- 2. Tableau de bord : compteurs corrects ---------------------------
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000010aa';
do $t$ declare v jsonb;
begin
  v := public.odyris_tableau_bord();
  if (v->'inscriptions'->>'total')::int <> 2 then raise exception 'ÉCHEC : total inscriptions = %', v->'inscriptions'->>'total'; end if;
  if (v->'inscriptions'->>'paiement_declare')::int <> 1 then raise exception 'ÉCHEC : inscriptions paiement_declare'; end if;
  if (v->'inscriptions'->>'en_attente')::int <> 1 then raise exception 'ÉCHEC : inscriptions en_attente'; end if;
  if (v->'dons'->>'paiement_declare')::int <> 1 then raise exception 'ÉCHEC : dons paiement_declare'; end if;
  if (v->>'a_valider')::int <> 2 then raise exception 'ÉCHEC : a_valider = %', v->>'a_valider'; end if;
  if (v->'fonds') is null then raise exception 'ÉCHEC : fonds absent'; end if;
end $t$;
reset role;

-- 3. File à valider : deux entrées (1 inscription + 1 don) ----------
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000010aa';
do $t$ declare n int; ni int; nd int;
begin
  select count(*), count(*) filter (where type='inscription'), count(*) filter (where type='don')
    into n, ni, nd from public.odyris_a_valider();
  if n <> 2 then raise exception 'ÉCHEC : file à valider = % (attendu 2)', n; end if;
  if ni <> 1 or nd <> 1 then raise exception 'ÉCHEC : répartition inscription/don = %/%', ni, nd; end if;
end $t$;
reset role;

\echo 'Migration 010 : tous les tests passent'
rollback;
