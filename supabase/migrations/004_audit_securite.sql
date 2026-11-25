-- =====================================================================
-- Migration 004 : audit de sécurité avant la production (issue #26)
--   1. Délai de paiement : une inscription non payée ne tient sa place que
--      jusqu'à sa date limite (« paiement_avant », fixée à la création :
--      48 h par défaut). Sans cela, des inscriptions abandonnées ou envoyées
--      en masse par un robot rempliraient le quota sans payer.
--      Changer le délai ne vaut que pour les nouvelles inscriptions : une
--      inscription déjà expirée ne reprend jamais de place toute seule.
--   2. Déclaration de paiement sérialisée avec les créations (même verrou),
--      ligne verrouillée, aucun retour en arrière depuis « payé » ou « annulé ».
--   3. Droits : anon et authenticated ne gardent que la lecture sur les
--      tables (filtrée par la RLS) ; plus de droit EXECUTE implicite (PUBLIC)
--      sur les fonctions futures ; plus de dépôt anonyme de photos.
-- Relançable sans erreur.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Délai de paiement
-- ---------------------------------------------------------------------
alter table public.reglages_inscriptions
  add column if not exists delai_paiement_heures integer not null default 48;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reglages_delai_paiement_borne') then
    alter table public.reglages_inscriptions add constraint reglages_delai_paiement_borne
      check (delai_paiement_heures between 1 and 720);
  end if;
end $$;

alter table public.inscriptions add column if not exists paiement_avant timestamptz;
-- Inscriptions déjà en attente : date limite = création + délai actuel
update public.inscriptions i
   set paiement_avant = i.created_at + make_interval(hours => coalesce(
         (select r.delai_paiement_heures from public.reglages_inscriptions r where r.id = 1), 48))
 where i.statut = 'en_attente' and i.paiement_avant is null;

-- Comptage rapide des places tenues
create index if not exists inscriptions_tenues_idx on public.inscriptions (statut) where statut in ('paye','paiement_declare');
create index if not exists inscriptions_attente_idx on public.inscriptions (paiement_avant) where statut = 'en_attente';
-- Contrôle « 6 inscriptions au plus par numéro » sans parcourir toute la table (fait sous verrou)
create index if not exists inscriptions_tel_chiffres_idx on public.inscriptions (public._chiffres(telephone));

-- Une inscription tient-elle une place ? Payée ou paiement déclaré : oui.
-- En attente : seulement avant sa date limite. (Fonction simple, en ligne dans les requêtes.)
drop function if exists public._place_tenue(text, timestamptz);
create function public._place_tenue(p_statut text, p_paiement_avant timestamptz)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select p_statut in ('paye','paiement_declare')
      or (p_statut = 'en_attente' and coalesce(p_paiement_avant > now(), false));
$$;

create or replace function public._places_prises()
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select ((select count(*) from public.inscriptions where statut in ('paye','paiement_declare'))
        + (select count(*) from public.inscriptions where statut = 'en_attente' and paiement_avant > now()))::integer;
$$;

-- Création d'une inscription : quota et anti-doublons sur les places tenues, date limite enregistrée
create or replace function public.creer_inscription(p jsonb)
returns table (reference text, montant integer, don integer)
language plpgsql volatile security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
declare
  v_dist    text := p ->> 'distance';
  v_cat     text := p ->> 'categorie';
  v_don_txt text := coalesce(p ->> 'don', '0');
  v_ddn_txt text := p ->> 'date_naissance';
  v_version text := p ->> 'consentement_version';
  v_cle_txt text := p ->> 'cle_envoi';
  v_tel     text := public._texte(p, 'telephone', 20, true);
  v_urg     text := public._texte(p, 'urgence_tel', 20, true);
  v_mail    text := lower(public._texte(p, 'email', 120, true));
  v_nom     text := public._texte(p, 'nom', 80, true);
  v_prenom  text := public._texte(p, 'prenom', 80, true);
  v_cle     uuid;
  v_don     integer;
  v_ddn     date;
  v_mineur  boolean;
  v_parent  boolean;
  v_mont    integer;
  v_ref     text;
  v_reg     public.reglages_inscriptions;
  v_deja    public.inscriptions;
  v_actives integer;
begin
  -- Clé d'envoi obligatoire (l'appli la fournit toujours)
  if v_cle_txt is null or v_cle_txt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Version de l''appli trop ancienne. Rechargez la page.';
  end if;
  v_cle := v_cle_txt::uuid;

  if v_dist is null or v_dist not in ('3','5','10') then raise exception 'Distance invalide'; end if;
  if v_cat is null or v_cat not in ('etudiant','travailleur') then raise exception 'Catégorie invalide'; end if;
  if not public._tel_valide(v_tel) or not public._tel_valide(v_urg) then
    raise exception 'Numéro de téléphone invalide';
  end if;
  if v_mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if v_don_txt !~ '^[0-9]{1,7}$' then raise exception 'Montant du don invalide'; end if;
  v_don := least(v_don_txt::integer, 1000000);
  if v_ddn_txt is null or v_ddn_txt !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Date de naissance invalide'; end if;
  begin
    v_ddn := v_ddn_txt::date;
  exception when others then
    raise exception 'Date de naissance invalide';
  end;
  if v_ddn > (public._date_course() - interval '10 years')::date or v_ddn < date '1920-01-01' then
    raise exception 'Date de naissance invalide';
  end if;
  if coalesce(p ->> 'consentement', '') <> 'true' then
    raise exception 'Le consentement est obligatoire';
  end if;
  if v_version is null or not exists (select 1 from public.consentements_textes c where c.version = v_version) then
    raise exception 'Version du texte de consentement inconnue. Rechargez la page.';
  end if;
  v_mineur := v_ddn > (public._date_course() - interval '18 years')::date;
  v_parent := coalesce(p ->> 'consentement_parental', '') = 'true';
  if v_mineur and not v_parent then
    raise exception 'L''accord d''un parent ou représentant légal est obligatoire pour les moins de 18 ans';
  end if;

  -- Verrou : une création à la fois, pour que le quota et la clé d'envoi soient exacts
  select * into v_reg from public.reglages_inscriptions where id = 1 for update;

  -- Même envoi répété : on renvoie l'inscription déjà créée, sans en créer une seconde,
  -- à condition que ce soit bien le même formulaire (mêmes données essentielles).
  select * into v_deja from public.inscriptions i where i.cle_envoi = v_cle;
  if v_deja.id is not null then
    if public._chiffres(v_deja.telephone) <> public._chiffres(v_tel) then
      raise exception 'Envoi refusé. Rechargez la page et recommencez.';
    end if;
    if lower(btrim(v_deja.nom)) <> lower(v_nom) or lower(btrim(v_deja.prenom)) <> lower(v_prenom)
       or v_deja.date_naissance <> v_ddn or v_deja.distance <> v_dist or v_deja.categorie <> v_cat then
      -- Seul l'appareil qui a tiré cette clé peut arriver ici : il peut connaître sa propre référence.
      raise exception 'Une inscription a déjà été enregistrée depuis ce formulaire (référence %), avec d''autres informations. Pour la corriger, contactez l''organisation avec cette référence.', v_deja.reference;
    end if;
    return query select v_deja.reference, v_deja.montant, v_deja.don;
    return;
  end if;

  if v_reg.id is null or not v_reg.ouvertes then
    raise exception '%', coalesce(nullif(btrim(v_reg.message), ''), 'Les inscriptions ne sont pas ouvertes pour le moment.');
  end if;
  v_actives := public._places_prises();
  if v_actives >= v_reg.quota then
    raise exception 'Complet : toutes les places de cette vague sont prises. Suivez nos annonces pour la prochaine ouverture.';
  end if;

  -- Même personne déjà inscrite (hors annulées)
  if exists (select 1 from public.inscriptions i
              where lower(btrim(i.nom)) = lower(v_nom) and lower(btrim(i.prenom)) = lower(v_prenom)
                and i.date_naissance = v_ddn and public._place_tenue(i.statut, i.paiement_avant)) then
    raise exception 'Cette personne est déjà inscrite (même nom, prénom et date de naissance). Retrouvez l''inscription dans « Mon dossard » avec sa référence, ou contactez l''organisation.';
  end if;
  if (select count(*) from public.inscriptions i
        where public._chiffres(i.telephone) = public._chiffres(v_tel) and public._place_tenue(i.statut, i.paiement_avant)) >= 6 then
    raise exception 'Trop d''inscriptions avec ce numéro. Contactez l''organisation.';
  end if;

  select t.montant into v_mont from public.tarifs t where t.distance = v_dist and t.categorie = v_cat;
  v_ref := public._nouvelle_reference('ODY', 'inscriptions');

  insert into public.inscriptions (reference, cle_envoi, nom, prenom, telephone, email, date_naissance, sexe, ville,
                                   distance, categorie, urgence_nom, urgence_tel, consentement,
                                   consentement_parental, consentement_version, consentement_at,
                                   montant, don, taille_tshirt, paiement_avant)
  values (v_ref, v_cle, v_nom, v_prenom, v_tel, v_mail, v_ddn,
          case when p ->> 'sexe' in ('F','M') then p ->> 'sexe' else null end,
          null, v_dist, v_cat,
          public._texte(p, 'urgence_nom', 80, true),
          v_urg, true,
          v_mineur and v_parent,
          v_version, now(),
          v_mont, v_don,
          case when p ->> 'taille_tshirt' in ('XS','S','M','L','XL','XXL') then p ->> 'taille_tshirt' else null end,
          now() + make_interval(hours => v_reg.delai_paiement_heures));

  return query select v_ref, v_mont, v_don;
end $$;

-- ---------------------------------------------------------------------
-- 2. Déclarer un paiement
--    Ordre des verrous identique à la création : réglages, puis l'inscription.
--    Une inscription hors délai ne reprend une place que s'il en reste et si
--    la même personne n'a pas déjà une autre inscription qui tient une place.
-- ---------------------------------------------------------------------
create or replace function public.declarer_paiement(p_reference text, p_telephone text,
                                                    p_operateur text, p_transaction text)
returns text language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_statut text; v_ins public.inscriptions; v_reg public.reglages_inscriptions;
begin
  if p_operateur is null or p_operateur not in ('mtn','orange') then raise exception 'Opérateur invalide'; end if;
  if char_length(btrim(coalesce(p_transaction,''))) not between 4 and 60 then
    raise exception 'Identifiant de transaction invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext('transaction-' || p_operateur || '-' || lower(btrim(p_transaction))));
  if public._transaction_deja_utilisee(p_operateur, p_transaction, p_reference) then
    raise exception 'Cet identifiant de transaction est déjà déclaré pour un autre paiement. Vérifiez-le ou contactez l''organisation.';
  end if;

  select * into v_reg from public.reglages_inscriptions where id = 1 for update;
  select * into v_ins from public.inscriptions i
   where i.reference = upper(btrim(p_reference))
     and public._chiffres(i.telephone) = public._chiffres(p_telephone)
   for update;
  if v_ins.id is null or v_ins.statut not in ('en_attente','paiement_declare') then
    raise exception 'Inscription introuvable ou déjà traitée';
  end if;

  if not public._place_tenue(v_ins.statut, v_ins.paiement_avant) then
    if exists (select 1 from public.inscriptions i
                where i.id <> v_ins.id
                  and lower(btrim(i.nom)) = lower(btrim(v_ins.nom)) and lower(btrim(i.prenom)) = lower(btrim(v_ins.prenom))
                  and i.date_naissance = v_ins.date_naissance
                  and public._place_tenue(i.statut, i.paiement_avant)) then
      raise exception 'Le délai de paiement de cette inscription est dépassé et vous avez une inscription plus récente : payez avec sa référence (« Mon dossard »).';
    end if;
    if public._places_prises() >= coalesce(v_reg.quota, 0) then
      raise exception 'Le délai de paiement de cette inscription est dépassé et toutes les places sont prises. Si vous avez déjà payé, contactez l''organisation avec votre référence.';
    end if;
  end if;

  begin
    update public.inscriptions i
       set statut = 'paiement_declare', operateur = p_operateur,
           transaction_id = btrim(p_transaction), paiement_declare_at = now()
     where i.id = v_ins.id and i.statut in ('en_attente','paiement_declare')
    returning i.statut into v_statut;
  exception when unique_violation then
    raise exception 'Cet identifiant de transaction est déjà déclaré pour un autre paiement. Vérifiez-le ou contactez l''organisation.';
  end;
  if v_statut is null then raise exception 'Inscription introuvable ou déjà traitée'; end if;
  return v_statut;
end $$;

-- « Mon dossard » : la date limite de paiement en plus (le type de retour change)
drop function if exists public.consulter_inscription(text, text);
create function public.consulter_inscription(p_reference text, p_telephone text)
returns table (reference text, prenom text, nom text, distance text, categorie text, montant integer,
               don integer, statut text, dossard integer, retire boolean, created_at timestamptz, taille_tshirt text,
               paiement_avant timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select i.reference, i.prenom, i.nom, i.distance, i.categorie, i.montant, i.don, i.statut,
         i.dossard, i.retire, i.created_at, i.taille_tshirt, i.paiement_avant
  from public.inscriptions i
  where i.reference = upper(btrim(p_reference))
    and public._chiffres(i.telephone) = public._chiffres(p_telephone)
  limit 1;
$$;

-- Compteurs publics : places réellement tenues
create or replace function public._etat_inscriptions()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'ouvertes', r.ouvertes,
    'quota', r.quota,
    'restantes', greatest(0, r.quota - public._places_prises()),
    'delai_paiement_heures', r.delai_paiement_heures,
    'message', r.message)
  from public.reglages_inscriptions r where r.id = 1;
$$;

create or replace function public.etat_public()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with tenues as (
    select i.distance from public.inscriptions i where i.statut in ('paye','paiement_declare')
    union all
    select i.distance from public.inscriptions i where i.statut = 'en_attente' and i.paiement_avant > now()
  ), par as (select distance, count(*) n from tenues group by distance)
  select jsonb_build_object(
    'fonds', (select jsonb_build_object('objectif', f.objectif, 'collecte', f.collecte,
                                        'donateurs', f.donateurs, 'maj', f.maj)
              from public.fonds f where f.id = 1),
    'inscrits', jsonb_build_object(
      '3',  coalesce((select n from par where distance = '3'), 0),
      '5',  coalesce((select n from par where distance = '5'), 0),
      '10', coalesce((select n from par where distance = '10'), 0)),
    'inscriptions', public._etat_inscriptions(),
    'resultats', (select count(*) from public.resultats)
  );
$$;

-- L'équipe règle le délai ; il s'applique aux inscriptions créées ensuite
create or replace function public.regler_delai_paiement(p_heures integer)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public._exiger_staff();
  if p_heures is null or p_heures not between 1 and 720 then raise exception 'Délai invalide (1 à 720 heures)'; end if;
  update public.reglages_inscriptions set delai_paiement_heures = p_heures where id = 1;
  return public._etat_inscriptions();
end $$;

-- ---------------------------------------------------------------------
-- 3. Droits
--    Supabase accorde par défaut TOUT sur les tables (y compris TRUNCATE,
--    que la RLS ne filtre pas) à anon et authenticated : on ne garde que SELECT.
--    PostgreSQL donne EXECUTE à PUBLIC sur toute nouvelle fonction : on retire
--    ce droit implicite pour le rôle qui applique les migrations.
-- ---------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges revoke execute on functions from public;

-- Stockage : pas de dépôt anonyme de photos (fonction communautaire v2)
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    drop policy if exists depot_photos_publications on storage.objects;
  end if;
end $$;

-- Droits d'exécution des fonctions de cette migration
revoke all on function public._place_tenue(text, timestamptz)                   from public, anon, authenticated;
revoke all on function public._places_prises()                                  from public, anon, authenticated;
revoke all on function public.regler_delai_paiement(integer)                    from public, anon, authenticated;
revoke all on function public.declarer_paiement(text, text, text, text)         from public, anon, authenticated;
revoke all on function public.creer_inscription(jsonb)                         from public, anon, authenticated;
revoke all on function public.consulter_inscription(text, text)                 from public, anon, authenticated;
revoke all on function public._etat_inscriptions()                              from public, anon, authenticated;
revoke all on function public.etat_public()                                     from public, anon, authenticated;
grant execute on function public.declarer_paiement(text, text, text, text)      to anon, authenticated;
grant execute on function public.creer_inscription(jsonb)                       to anon, authenticated;
grant execute on function public.consulter_inscription(text, text)              to anon, authenticated;
grant execute on function public.etat_public()                                  to anon, authenticated;
grant execute on function public.regler_delai_paiement(integer)                 to authenticated;
