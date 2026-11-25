-- =====================================================================
-- Migration 006 : le fil d'actualité est publié par l'équipe Odyssée
--   Décision de l'association (25/11/2026) : seule L'Odyssée de
--   l'environnement publie des photos dans le fil. Le public les voit,
--   les aime et les commente ; il ne publie plus.
--   - creer_publication : réservé à l'équipe, publié directement ;
--   - stockage : dépôt de photos réservé à l'équipe connectée.
-- Relançable sans erreur.
-- =====================================================================

create or replace function public.creer_publication(p jsonb)
returns uuid language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_photo text := nullif(btrim(coalesce(p ->> 'photo', '')), '');
begin
  perform public._exiger_staff();
  if v_photo is null or v_photo !~ '^publications/[0-9a-f-]{36}\.jpg$' then
    raise exception 'Photo manquante ou chemin invalide';
  end if;
  insert into public.publications (appareil, auteur, ville, categorie, evenement_id, texte, lieu, photo, statut)
  values ('equipe-odyssee-000000',
          coalesce(public._texte(p, 'auteur', 80, false), 'L''Odyssée de l''environnement'),
          public._texte(p, 'ville', 80, false),
          case when p ->> 'categorie' in ('collecte','reboisement','evenement','communaute','autre') then p ->> 'categorie' else 'communaute' end,
          nullif(p ->> 'evenement_id', '')::uuid,
          public._texte(p, 'texte', 1000, false), public._texte(p, 'lieu', 120, false), v_photo, 'publie')
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.creer_publication(jsonb) from public, anon, authenticated;
grant execute on function public.creer_publication(jsonb) to authenticated;

-- Stockage : seule l'équipe connectée dépose des photos (dossier publications/)
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    drop policy if exists depot_photos_publications on storage.objects;
    drop policy if exists depot_photos_equipe on storage.objects;
    create policy depot_photos_equipe on storage.objects for insert to authenticated
      with check (bucket_id = 'photos' and name like 'publications/%' and public.est_staff());
  end if;
end $$;
