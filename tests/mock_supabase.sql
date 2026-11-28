-- Imitation minimale de l'environnement Supabase, pour tester les migrations
-- sur un PostgreSQL ordinaire (intégration continue, poste de développement).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.uid', true),'')::uuid $$;
-- Imitation de auth.jwt() : en vrai Supabase, les claims du jeton (dont « aal »,
-- le niveau d'authentification) sont exposés ici. Pour les tests, on les
-- reconstruit depuis des réglages de session : request.jwt.claims (jsonb complet)
-- ou, à défaut, request.jwt.uid + request.jwt.aal.
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    jsonb_build_object(
      'sub', nullif(current_setting('request.jwt.uid', true), ''),
      'aal', coalesce(nullif(current_setting('request.jwt.aal', true), ''), 'aal1')
    ));
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select on tables to anon, authenticated;
-- Droits par défaut de Supabase (pire cas) : tout ce qui est créé dans public est
-- accordé à anon et authenticated ; seules la RLS et les révocations protègent.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;


-- Stockage minimal (imitation de Supabase Storage) pour tester les politiques de dépôt
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
