-- 008 — Odyris : fiche unique par personne (fondation du CRM interne)
--
-- Odyris est la console interne du personnel. Une même personne apparaît
-- aujourd'hui éparpillée dans plusieurs tables (inscriptions, dons, commandes,
-- benevoles, candidatures, participations). Cette migration ne touche à AUCUNE
-- donnée : elle ajoute deux fonctions de LECTURE, réservées au personnel, qui
-- réunissent ces lignes autour d'une personne.
--
-- Sécurité (revue #67) : AUCUNE vue exposée. Toute la logique de réunion est
-- intégrée dans deux fonctions SECURITY DEFINER, seules portes d'entrée,
-- protégées par est_staff(). PostgREST ne peut donc rien lire directement.
--
-- Clé d'unification : le téléphone normalisé en ENTIER (tous les chiffres,
-- indicatif pays compris), présent dans toutes les tables. L'e-mail (absent de
-- dons et commandes) sert de clé de secours. Limite connue et assumée pour cette
-- première version en lecture seule : deux personnes qui partagent réellement un
-- même numéro seront réunies ; une future table centrale de personnes (avec un
-- identifiant propre) lèvera cette limite. Rejouable.

-- Clé canonique d'une personne (téléphone complet normalisé, e-mail en secours).
create or replace function public._odyris_cle(p_tel text, p_mail text)
returns text language sql immutable set search_path = public as $$
  select coalesce(
    nullif(regexp_replace(regexp_replace(coalesce(p_tel,''), '[^0-9]', '', 'g'), '^00', ''), ''),
    'mail:' || nullif(lower(btrim(coalesce(p_mail,''))), '')
  );
$$;
revoke all on function public._odyris_cle(text, text) from public, anon, authenticated;

-- Réunion de toutes les opérations de toutes les personnes (CTE interne,
-- jamais exposée). Utilisée par les deux fonctions ci-dessous.
-- Colonnes : cle, role, nom, prenom, email, telephone, ville, libelle,
--            op_date, montant, statut, reference.
create or replace function public._odyris_source()
returns table(cle text, role text, nom text, prenom text, email text,
              telephone text, ville text, libelle text, op_date timestamptz,
              montant integer, statut text, reference text)
language sql stable security definer set search_path = public as $$
  select public._odyris_cle(telephone, email), 'coureur',
         nom, prenom, email, telephone, ville,
         'Inscription ' || coalesce(distance,'course') || ' — ' || coalesce(categorie,''),
         created_at, montant, statut, reference
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
         'Bénévolat' || coalesce(' — ' || nullif(array_to_string(missions, ', '),''), ''),
         created_at, null, statut, reference
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
$$;
revoke all on function public._odyris_source() from public, anon, authenticated;

-- Liste des personnes (une ligne par personne), pour l'écran « Personnes ».
-- don_total ne compte QUE les dons validés, dans l'unité enregistrée (FCFA).
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
           coalesce(sum(o.montant) filter (where o.role = 'donateur' and o.statut = 'valide'), 0)
      from public._odyris_source() o
     where o.cle is not null
     group by o.cle
     order by max(o.op_date) desc;
end $$;
revoke all on function public.odyris_personnes() from public, anon, authenticated;
grant execute on function public.odyris_personnes() to authenticated;

-- Fiche détaillée d'une personne. Renvoie NULL si la clé n'existe pas.
create or replace function public.odyris_fiche(p_cle text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; n int;
begin
  if not est_staff() then raise exception 'Accès réservé au personnel'; end if;
  select count(*) into n from public._odyris_source() o where o.cle = p_cle;
  if n = 0 then return null; end if;
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
        'don_total', coalesce(sum(o.montant) filter (where o.role='donateur' and o.statut='valide'),0)
      ) from public._odyris_source() o where o.cle = p_cle
    ),
    'operations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'role', o.role, 'libelle', o.libelle, 'date', o.op_date,
        'montant', o.montant, 'statut', o.statut, 'reference', o.reference
      ) order by o.op_date desc), '[]'::jsonb)
      from public._odyris_source() o where o.cle = p_cle
    )
  ) into v;
  return v;
end $$;
revoke all on function public.odyris_fiche(text) from public, anon, authenticated;
grant execute on function public.odyris_fiche(text) to authenticated;

-- Nettoyage : si une version antérieure avait créé la vue, la retirer.
drop view if exists public._odyris_operations;
