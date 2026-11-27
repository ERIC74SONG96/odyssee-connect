-- 008 — Odyris : fiche unique par personne (fondation du CRM interne)
--
-- Odyris est la console interne du personnel. Une même personne apparaît
-- aujourd'hui éparpillée dans plusieurs tables (inscriptions, dons, commandes,
-- benevoles, candidatures, participations). Cette migration ne touche à AUCUNE
-- donnée : elle ajoute deux fonctions de LECTURE, réservées au personnel, qui
-- réunissent ces lignes autour d'une personne.
--
-- Clé d'unification : le téléphone normalisé (9 derniers chiffres), présent dans
-- toutes les tables. L'e-mail (absent de dons et commandes) sert d'attribut, et
-- de clé de secours quand le téléphone manque.
--
-- Réservé au personnel : chaque fonction vérifie est_staff(). SECURITY DEFINER +
-- search_path fixé, conformément aux règles de sécurité du projet. Rejouable.

-- Clé canonique d'une personne à partir de son téléphone (et e-mail en secours).
create or replace function public._odyris_cle(p_tel text, p_mail text)
returns text language sql immutable set search_path = public as $$
  select coalesce(
    nullif(right(regexp_replace(coalesce(p_tel,''), '[^0-9]', '', 'g'), 9), ''),
    'mail:' || nullif(lower(btrim(coalesce(p_mail,''))), '')
  );
$$;

-- Toutes les opérations de toutes les personnes, à plat (vue interne).
-- Colonnes : cle, role, nom, prenom, email, telephone, ville, libelle,
--            op_date, montant (FCFA ou €, selon la source), statut, reference.
create or replace view public._odyris_operations as
  select public._odyris_cle(telephone, email) as cle, 'coureur'::text as role,
         nom, prenom, email, telephone, ville,
         'Inscription ' || coalesce(distance,'course') || ' — ' || coalesce(categorie,'') as libelle,
         created_at as op_date, montant, statut, reference
    from public.inscriptions
  union all
  select public._odyris_cle(telephone, null), 'donateur',
         nom, null, null, telephone, null,
         'Don au Fonds de solidarité', created_at, montant, statut, reference
    from public.dons
  union all
  select public._odyris_cle(telephone, null), 'boutique',
         nom, null, null, telephone, null,
         'Commande boutique', created_at, null, statut, reference
    from public.commandes
  union all
  select public._odyris_cle(telephone, email), 'benevole',
         nom, prenom, email, telephone, ville,
         'Bénévolat' || coalesce(' — ' || nullif(array_to_string(missions, ', '),''), ''), created_at, null, statut, reference
    from public.benevoles
  union all
  select public._odyris_cle(telephone, email),
         case type when 'ambassadeur' then 'ambassadeur' when 'partenaire' then 'partenaire' else 'candidat' end,
         nom, prenom, email, telephone, ville,
         coalesce(nullif(titre,''), 'Candidature') || coalesce(' (' || nullif(organisation,'') || ')', ''),
         created_at, null, statut, reference
    from public.candidatures
  union all
  select public._odyris_cle(telephone, email), 'participant',
         nom, prenom, email, telephone, null::text,
         'Participation à un événement', created_at, null, statut, reference
    from public.participations;

alter view public._odyris_operations set (security_invoker = on);

-- Liste des personnes (une ligne par personne), pour l'écran « Personnes ».
create or replace function public.odyris_personnes()
returns table(
  cle text, nom text, email text, telephone text, ville text,
  roles text[], nb_operations bigint, premier timestamptz, dernier timestamptz, don_total bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not est_staff() then raise exception 'Accès réservé au personnel'; end if;
  return query
    select o.cle,
           (array_agg(o.nom order by o.op_date desc) filter (where o.nom is not null))[1],
           (array_agg(o.email order by o.op_date desc) filter (where o.email is not null))[1],
           (array_agg(o.telephone order by o.op_date desc) filter (where o.telephone is not null))[1],
           (array_agg(o.ville order by o.op_date desc) filter (where o.ville is not null))[1],
           array_agg(distinct o.role order by o.role),
           count(*),
           min(o.op_date), max(o.op_date),
           coalesce(sum(o.montant) filter (where o.role = 'donateur'), 0)
      from public._odyris_operations o
     where o.cle is not null
     group by o.cle
     order by max(o.op_date) desc;
end $$;

-- Fiche détaillée d'une personne (identité + historique des opérations).
create or replace function public.odyris_fiche(p_cle text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not est_staff() then raise exception 'Accès réservé au personnel'; end if;
  select jsonb_build_object(
    'personne', (
      select jsonb_build_object(
        'cle', p_cle,
        'nom', (array_agg(o.nom order by o.op_date desc) filter (where o.nom is not null))[1],
        'email', (array_agg(o.email order by o.op_date desc) filter (where o.email is not null))[1],
        'telephone', (array_agg(o.telephone order by o.op_date desc) filter (where o.telephone is not null))[1],
        'ville', (array_agg(o.ville order by o.op_date desc) filter (where o.ville is not null))[1],
        'roles', array_agg(distinct o.role order by o.role),
        'premier', min(o.op_date), 'dernier', max(o.op_date),
        'don_total', coalesce(sum(o.montant) filter (where o.role='donateur'),0)
      ) from public._odyris_operations o where o.cle = p_cle
    ),
    'operations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'role', o.role, 'libelle', o.libelle, 'date', o.op_date,
        'montant', o.montant, 'statut', o.statut, 'reference', o.reference
      ) order by o.op_date desc), '[]'::jsonb)
      from public._odyris_operations o where o.cle = p_cle
    )
  ) into v;
  return v;
end $$;

revoke all on function public.odyris_personnes() from public, anon, authenticated;
revoke all on function public.odyris_fiche(text) from public, anon, authenticated;
grant execute on function public.odyris_personnes() to authenticated;
grant execute on function public.odyris_fiche(text) to authenticated;
