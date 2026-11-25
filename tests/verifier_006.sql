-- Tests de la migration 006 (fil publié par l'équipe). Lancé par tests/verifier_sql.sh.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f6', 'equipe6@exemple.cm') on conflict do nothing;
insert into public.staff (user_id) values ('00000000-0000-0000-0000-0000000000f6') on conflict do nothing;

-- 1. Le public ne publie plus
set local role anon;
do $t$ begin
  begin
    perform public.creer_publication('{"appareil":"abcdefghijklmnop1234","auteur":"X","texte":"t","photo":"publications/11111111-1111-1111-1111-111111111111.jpg"}'::jsonb);
    raise exception 'ÉCHEC : anon a publié dans le fil';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
end $t$;
reset role;
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000bb';
do $t$ begin
  begin
    perform public.creer_publication('{"auteur":"X","texte":"t","photo":"publications/11111111-1111-1111-1111-111111111111.jpg"}'::jsonb);
    raise exception 'ÉCHEC : un compte non-staff a publié dans le fil';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if;
    if sqlerrm not like 'Accès réservé%' then raise exception 'ÉCHEC : message inattendu : %', sqlerrm; end if; end;
end $t$;
reset role;

-- 2. L'équipe publie : visible tout de suite dans le fil public, auteur par défaut
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000f6';
do $t$ begin
  begin
    perform public.creer_publication('{"texte":"sans photo"}'::jsonb);
    raise exception 'ÉCHEC : publication sans photo acceptée';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
  perform public.creer_publication('{"texte":"Collecte à Efoulan","categorie":"collecte","photo":"publications/22222222-2222-2222-2222-222222222222.jpg"}'::jsonb);
end $t$;
reset role;
set local request.jwt.uid = '';
set local role anon;
do $t$
declare a text;
begin
  select auteur into a from public.fil_public('', 'abcdefghijklmnop1234') where texte = 'Collecte à Efoulan';
  if a is distinct from 'L''Odyssée de l''environnement' then raise exception 'ÉCHEC : publication de l''équipe absente du fil ou mauvais auteur (%)', a; end if;
end $t$;
reset role;

-- 3. Stockage : seul un membre de l'équipe connecté peut déposer une photo
do $t$ begin
  if not exists (select 1 from storage.buckets where id = 'photos') then raise exception 'ÉCHEC : seau photos absent'; end if;
end $t$;
set local request.jwt.uid = '';
set local role anon;
do $t$ begin
  begin insert into storage.objects (bucket_id, name) values ('photos', 'publications/anon.jpg');
    raise exception 'ÉCHEC : anon a déposé une photo';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
end $t$;
reset role;
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000bb';
do $t$ begin
  begin insert into storage.objects (bucket_id, name) values ('photos', 'publications/nonstaff.jpg');
    raise exception 'ÉCHEC : un compte non-staff a déposé une photo';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
end $t$;
reset role;
set local role authenticated;
set local request.jwt.uid = '00000000-0000-0000-0000-0000000000f6';
do $t$ begin
  insert into storage.objects (bucket_id, name) values ('photos', 'publications/equipe.jpg');
  begin insert into storage.objects (bucket_id, name) values ('photos', 'autre/equipe.jpg');
    raise exception 'ÉCHEC : dépôt hors du dossier publications/ accepté';
  exception when others then if sqlerrm like 'ÉCHEC%' then raise; end if; end;
end $t$;
reset role;
do $t$ begin
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'INSERT') <> 1 then
    raise exception 'ÉCHEC : une autre politique de dépôt existe sur storage.objects'; end if;
end $t$;

\echo 'Migration 006 : tous les tests passent'
rollback;
