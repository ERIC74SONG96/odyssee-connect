-- =====================================================================
-- Migration 010 : Odyris — tableau de bord et file des paiements à valider.
--
-- Deux fonctions de LECTURE réservées au personnel, pour les écrans
-- quotidiens de la console interne :
--   - odyris_tableau_bord() : les chiffres clés (inscriptions par statut,
--     dons, commandes, paiements en attente de validation, Fonds).
--   - odyris_a_valider() : la file des paiements DÉCLARÉS en attente de
--     validation (inscriptions et dons), pour les traiter d'un seul endroit.
--
-- Aucune donnée modifiée. Toutes SECURITY DEFINER, search_path fixé,
-- réservées au staff, révoquées de PUBLIC/anon/authenticated. Relançable.
-- =====================================================================

-- Chiffres clés de la console (compteurs agrégés).
create or replace function public.odyris_tableau_bord()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.est_staff() then raise exception 'Accès réservé au personnel'; end if;
  select jsonb_build_object(
    'inscriptions', jsonb_build_object(
      'total',             count(*),
      'payes',             count(*) filter (where statut = 'paye'),
      'paiement_declare',  count(*) filter (where statut = 'paiement_declare'),
      'en_attente',        count(*) filter (where statut = 'en_attente'),
      'annule',            count(*) filter (where statut = 'annule')
    ) ) into v from public.inscriptions;

  v := v || jsonb_build_object('dons', (
    select jsonb_build_object(
      'valides_total',     coalesce(sum(montant) filter (where statut = 'valide'), 0),
      'valides_count',     count(*) filter (where statut = 'valide'),
      'paiement_declare',  count(*) filter (where statut = 'paiement_declare')
    ) from public.dons));

  v := v || jsonb_build_object('commandes', (
    select jsonb_build_object(
      'nouvelle',  count(*) filter (where statut = 'nouvelle'),
      'confirmee', count(*) filter (where statut = 'confirmee'),
      'payee',     count(*) filter (where statut = 'payee'),
      'livree',    count(*) filter (where statut = 'livree')
    ) from public.commandes));

  -- Nombre total de paiements en attente de validation (inscriptions + dons)
  v := v || jsonb_build_object('a_valider',
    (select count(*) from public.inscriptions where statut = 'paiement_declare')
  + (select count(*) from public.dons        where statut = 'paiement_declare'));

  v := v || jsonb_build_object('fonds', (
    select jsonb_build_object('collecte', collecte, 'donateurs', donateurs, 'objectif', objectif)
    from public.fonds where id = 1));

  return v;
end $$;
revoke all on function public.odyris_tableau_bord() from public, anon, authenticated;
grant execute on function public.odyris_tableau_bord() to authenticated;

-- File des paiements déclarés en attente de validation (inscriptions et dons).
create or replace function public.odyris_a_valider()
returns table (type text, reference text, nom text, telephone text, montant integer,
               operateur text, transaction_id text, declare_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_staff() then raise exception 'Accès réservé au personnel'; end if;
  return query
    select 'inscription'::text, i.reference,
           btrim(coalesce(i.prenom, '') || ' ' || coalesce(i.nom, '')), i.telephone,
           i.montant, i.operateur, i.transaction_id, i.paiement_declare_at
      from public.inscriptions i where i.statut = 'paiement_declare'
    union all
    select 'don'::text, d.reference, d.nom, d.telephone,
           d.montant, d.operateur, d.transaction_id, d.paiement_declare_at
      from public.dons d where d.statut = 'paiement_declare'
    order by 8 asc nulls last;   -- 8e colonne = declare_at (tri sur l'horodatage)
end $$;
revoke all on function public.odyris_a_valider() from public, anon, authenticated;
grant execute on function public.odyris_a_valider() to authenticated;
