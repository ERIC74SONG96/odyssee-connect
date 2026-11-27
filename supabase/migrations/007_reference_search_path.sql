-- 007 — Correctif production : génération des références d'inscription
--
-- Problème constaté le 27/11/2026 depuis le Cameroun (vraie base) :
--   « function gen_random_bytes(integer) does not exist »
-- La fonction public._nouvelle_reference() appelle gen_random_bytes(), fournie par
-- l'extension pgcrypto. Sur Supabase, pgcrypto est installée dans le schéma
-- « extensions », pas « public ». Comme le search_path de la fonction était fixé à
-- « public » seul, gen_random_bytes restait introuvable et AUCUNE inscription (ni don,
-- ni commande) ne pouvait être créée en production.
--
-- La CI tourne sur un PostgreSQL standard où « create extension pgcrypto » installe
-- dans « public » : gen_random_bytes y est sur le search_path, d'où un test au vert
-- malgré le bug côté Supabase.
--
-- Correctif : élargir le search_path de la fonction à « public, extensions ». Cela
-- fonctionne dans les deux cas (CI : pgcrypto dans public, extensions absent et ignoré ;
-- Supabase : pgcrypto dans extensions). Le search_path reste fixé explicitement, donc
-- l'exigence de sécurité (pas de search_path modifiable) est préservée.
-- Fichier rejouable sans erreur.

create or replace function public._nouvelle_reference(prefixe text, table_nom text)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare r text; existe boolean;
begin
  loop
    r := prefixe || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
    execute format('select exists (select 1 from public.%I where reference = $1)', table_nom)
      into existe using r;
    exit when not existe;
  end loop;
  return r;
end $$;
