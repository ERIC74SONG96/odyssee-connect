-- =====================================================================
-- Migration 012 : Odyris — écrans métier Bénévoles, Commandes,
--                 Candidatures (ambassadeurs/partenaires/sponsors), Dons.
--
-- Pour chaque domaine : une fonction de LECTURE réservée au personnel, plus,
-- quand il y a un suivi de statut, une action tracée au journal.
--   Lectures  : odyris_benevoles / odyris_commandes / odyris_candidatures /
--               odyris_dons (filtre statut/type optionnel).
--   Actions   : odyris_commande_statut / odyris_benevole_statut /
--               odyris_candidature_statut (mise à jour de statut + audit).
--
-- La validation des DONS n'est pas redéfinie ici : elle passe par
-- odyris_valider_don (migration 009), qui exige déjà la MFA.
--
-- Les actions de statut ci-dessous sont des changements d'état de suivi
-- (non financiers) : staff suffit, pas de MFA, mais tout est journalisé.
-- Toutes SECURITY DEFINER, search_path fixé, révoquées de PUBLIC/anon/
-- authenticated. Aucune donnée n'est détruite. Relançable.
-- =====================================================================

-- ---------- Bénévoles ------------------------------------------------
create or replace function public.odyris_benevoles()
returns table (reference text, nom text, prenom text, telephone text, email text, ville text,
               missions text[], disponibilites text, taille_tshirt text, statut text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_staff() then raise exception 'Accès réservé au personnel'; end if;
  return query
    select b.reference, b.nom, b.prenom, b.telephone, b.email, b.ville,
           b.missions, b.disponibilites, b.taille_tshirt, b.statut, b.created_at
      from public.benevoles b order by b.created_at desc;
end $$;
revoke all on function public.odyris_benevoles() from public, anon, authenticated;
grant execute on function public.odyris_benevoles() to authenticated;

create or replace function public.odyris_benevole_statut(p_reference text, p_statut text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_ref text := upper(btrim(coalesce(p_reference, ''))); v_statut text := lower(coalesce(p_statut, ''));
begin
  perform public._exiger_staff();
  if v_statut not in ('nouveau','contacte','retenu','decline') then raise exception 'Statut invalide'; end if;
  update public.benevoles set statut = v_statut where reference = v_ref;
  if not found then raise exception 'Bénévole introuvable : %', v_ref; end if;
  perform public._odyris_log('benevole_statut', v_ref, jsonb_build_object('statut', v_statut));
end $$;
revoke all on function public.odyris_benevole_statut(text, text) from public, anon, authenticated;
grant execute on function public.odyris_benevole_statut(text, text) to authenticated;

-- ---------- Commandes (boutique) ------------------------------------
create or replace function public.odyris_commandes()
returns table (reference text, nom text, telephone text, inscription_ref text,
               articles jsonb, statut text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_staff() then raise exception 'Accès réservé au personnel'; end if;
  return query
    select c.reference, c.nom, c.telephone, c.inscription_ref, c.articles, c.statut, c.created_at
      from public.commandes c order by c.created_at desc;
end $$;
revoke all on function public.odyris_commandes() from public, anon, authenticated;
grant execute on function public.odyris_commandes() to authenticated;

create or replace function public.odyris_commande_statut(p_reference text, p_statut text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_ref text := upper(btrim(coalesce(p_reference, ''))); v_statut text := lower(coalesce(p_statut, ''));
begin
  perform public._exiger_staff();
  if v_statut not in ('nouvelle','confirmee','payee','livree','annulee') then raise exception 'Statut invalide'; end if;
  update public.commandes set statut = v_statut where reference = v_ref;
  if not found then raise exception 'Commande introuvable : %', v_ref; end if;
  perform public._odyris_log('commande_statut', v_ref, jsonb_build_object('statut', v_statut));
end $$;
revoke all on function public.odyris_commande_statut(text, text) from public, anon, authenticated;
grant execute on function public.odyris_commande_statut(text, text) to authenticated;

-- ---------- Candidatures (ambassadeurs / partenaires / sponsors) -----
create or replace function public.odyris_candidatures(p_type text default null)
returns table (reference text, type text, nom text, prenom text, organisation text,
               telephone text, email text, ville text, titre text, message text, statut text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_type text := nullif(lower(btrim(coalesce(p_type, ''))), '');
begin
  if not public.est_staff() then raise exception 'Accès réservé au personnel'; end if;
  return query
    select c.reference, c.type, c.nom, c.prenom, c.organisation,
           c.telephone, c.email, c.ville, c.titre, c.message, c.statut, c.created_at
      from public.candidatures c
     where v_type is null or c.type = v_type
     order by c.created_at desc;
end $$;
revoke all on function public.odyris_candidatures(text) from public, anon, authenticated;
grant execute on function public.odyris_candidatures(text) to authenticated;

create or replace function public.odyris_candidature_statut(p_reference text, p_statut text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_ref text := upper(btrim(coalesce(p_reference, ''))); v_statut text := lower(coalesce(p_statut, ''));
begin
  perform public._exiger_staff();
  if v_statut not in ('nouveau','en_cours','accepte','refuse') then raise exception 'Statut invalide'; end if;
  update public.candidatures set statut = v_statut where reference = v_ref;
  if not found then raise exception 'Candidature introuvable : %', v_ref; end if;
  perform public._odyris_log('candidature_statut', v_ref, jsonb_build_object('statut', v_statut));
end $$;
revoke all on function public.odyris_candidature_statut(text, text) from public, anon, authenticated;
grant execute on function public.odyris_candidature_statut(text, text) to authenticated;

-- ---------- Dons (écran dédié) --------------------------------------
-- Lecture seule ; la validation passe par odyris_valider_don (MFA).
create or replace function public.odyris_dons(p_statut text default null)
returns table (reference text, nom text, telephone text, montant integer, statut text,
               operateur text, transaction_id text, created_at timestamptz, valide_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_statut text := nullif(lower(btrim(coalesce(p_statut, ''))), '');
begin
  if not public.est_staff() then raise exception 'Accès réservé au personnel'; end if;
  return query
    select d.reference, d.nom, d.telephone, d.montant, d.statut,
           d.operateur, d.transaction_id, d.created_at, d.valide_at
      from public.dons d
     where v_statut is null or d.statut = v_statut
     order by d.created_at desc;
end $$;
revoke all on function public.odyris_dons(text) from public, anon, authenticated;
grant execute on function public.odyris_dons(text) to authenticated;
