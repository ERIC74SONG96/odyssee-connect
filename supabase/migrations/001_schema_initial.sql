-- =====================================================================
-- Odyssée Connect · base de données (Supabase / PostgreSQL)
-- Plateforme de L'Odyssée de l'environnement au Cameroun
--
-- À exécuter une seule fois dans Supabase > SQL Editor > New query.
-- Principe : le public ne touche jamais directement aux tables.
-- Il passe par des fonctions (RPC) qui contrôlent chaque champ.
-- Seuls les membres de l'équipe (table staff) lisent les données.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Équipe organisatrice
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nom        text,
  created_at timestamptz not null default now()
);

create or replace function public.est_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 2. Tarifs (modifiables ici, jamais par le téléphone du coureur)
-- ---------------------------------------------------------------------
create table if not exists public.tarifs (
  distance  text not null check (distance in ('3','5','10')),
  categorie text not null check (categorie in ('etudiant','travailleur')),
  montant   integer not null check (montant >= 0),
  primary key (distance, categorie)
);

insert into public.tarifs (distance, categorie, montant) values
  ('3','etudiant',500), ('3','travailleur',500),   -- tarif du 3 km provisoire, à confirmer
  ('5','etudiant',500), ('5','travailleur',500),
  ('10','etudiant',500), ('10','travailleur',1000)
on conflict (distance, categorie) do nothing;

-- Plages de dossards par distance
create table if not exists public.plages_dossards (
  distance text primary key check (distance in ('3','5','10')),
  debut    integer not null,
  fin      integer not null
);

insert into public.plages_dossards (distance, debut, fin) values
  ('10', 1, 4999), ('5', 5001, 9999), ('3', 10001, 19999)
on conflict (distance) do nothing;

-- ---------------------------------------------------------------------
-- 3. Inscriptions
-- ---------------------------------------------------------------------
create table if not exists public.inscriptions (
  id                  uuid primary key default gen_random_uuid(),
  reference           text unique not null,
  created_at          timestamptz not null default now(),
  nom                 text not null,
  prenom              text not null,
  telephone           text not null,
  email               text,
  date_naissance      date not null,
  sexe                text not null check (sexe in ('F','M')),
  ville               text,
  distance            text not null check (distance in ('3','5','10')),
  categorie           text not null check (categorie in ('etudiant','travailleur')),
  urgence_nom         text not null,
  urgence_tel         text not null,
  consentement        boolean not null,
  montant             integer not null,
  don                 integer not null default 0 check (don >= 0),
  statut              text not null default 'en_attente'
                      check (statut in ('en_attente','paiement_declare','paye','annule')),
  operateur           text check (operateur in ('mtn','orange')),
  transaction_id      text,
  paiement_declare_at timestamptz,
  paye_at             timestamptz,
  dossard             integer unique,
  retire              boolean not null default false,
  retire_at           timestamptz
);

create index if not exists inscriptions_tel_idx on public.inscriptions (telephone);
alter table public.inscriptions add column if not exists taille_tshirt text check (taille_tshirt in ('XS','S','M','L','XL','XXL'));

-- ---------------------------------------------------------------------
-- 4. Dons au Fonds de solidarité environnementale
-- ---------------------------------------------------------------------
create table if not exists public.dons (
  id                  uuid primary key default gen_random_uuid(),
  reference           text unique not null,
  created_at          timestamptz not null default now(),
  nom                 text,
  telephone           text not null,
  montant             integer not null check (montant between 100 and 10000000),
  statut              text not null default 'en_attente'
                      check (statut in ('en_attente','paiement_declare','valide','annule')),
  operateur           text check (operateur in ('mtn','orange')),
  transaction_id      text,
  paiement_declare_at timestamptz,
  valide_at           timestamptz
);

-- ---------------------------------------------------------------------
-- 5. Précommandes de la boutique
-- ---------------------------------------------------------------------
create table if not exists public.commandes (
  id              uuid primary key default gen_random_uuid(),
  reference       text unique not null,
  created_at      timestamptz not null default now(),
  nom             text not null,
  telephone       text not null,
  inscription_ref text,
  articles        jsonb not null,
  statut          text not null default 'nouvelle'
                  check (statut in ('nouvelle','confirmee','payee','livree','annulee'))
);

-- ---------------------------------------------------------------------
-- 6. Fonds (une seule ligne)
-- ---------------------------------------------------------------------
create table if not exists public.fonds (
  id         integer primary key default 1 check (id = 1),
  objectif   integer not null default 5000000,
  collecte   integer not null default 0,
  donateurs  integer not null default 0,
  maj        timestamptz not null default now()
);
insert into public.fonds (id) values (1) on conflict (id) do nothing;

-- Résultats de la course (temps en secondes)
create table if not exists public.resultats (
  dossard    integer primary key,
  secondes   integer not null check (secondes between 60 and 36000),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Sécurité : lecture réservée à l'équipe, aucune écriture directe
-- ---------------------------------------------------------------------
alter table public.staff            enable row level security;
alter table public.tarifs           enable row level security;
alter table public.plages_dossards  enable row level security;
alter table public.inscriptions     enable row level security;
alter table public.dons             enable row level security;
alter table public.commandes        enable row level security;
alter table public.fonds            enable row level security;

drop policy if exists staff_lit_staff on public.staff;
create policy staff_lit_staff on public.staff for select using (public.est_staff());

drop policy if exists tous_lisent_tarifs on public.tarifs;
create policy tous_lisent_tarifs on public.tarifs for select using (true);

drop policy if exists staff_lit_inscriptions on public.inscriptions;
create policy staff_lit_inscriptions on public.inscriptions for select using (public.est_staff());

drop policy if exists staff_lit_dons on public.dons;
create policy staff_lit_dons on public.dons for select using (public.est_staff());

drop policy if exists staff_lit_commandes on public.commandes;
create policy staff_lit_commandes on public.commandes for select using (public.est_staff());

drop policy if exists tous_lisent_fonds on public.fonds;
create policy tous_lisent_fonds on public.fonds for select using (true);

-- ---------------------------------------------------------------------
-- 8. Outils internes
-- ---------------------------------------------------------------------
create or replace function public._chiffres(t text) returns text
language sql immutable as $$ select regexp_replace(coalesce(t,''), '\D', '', 'g') $$;

create or replace function public._tel_valide(t text) returns boolean
language sql immutable as $$ select char_length(public._chiffres(t)) between 8 and 15 $$;

create or replace function public._texte(p jsonb, cle text, maxi integer, obligatoire boolean)
returns text language plpgsql immutable as $$
declare v text := nullif(btrim(coalesce(p ->> cle, '')), '');
begin
  if v is null and obligatoire then raise exception 'Champ manquant : %', cle; end if;
  if v is not null and char_length(v) > maxi then raise exception 'Champ trop long : %', cle; end if;
  return v;
end $$;

create or replace function public._nouvelle_reference(prefixe text, table_nom text)
returns text language plpgsql volatile security definer set search_path = public as $$
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

-- ---------------------------------------------------------------------
-- 9. Fonctions publiques (coureurs, donateurs, acheteurs)
-- ---------------------------------------------------------------------

-- Créer une inscription. Le montant est calculé ici, jamais envoyé par l'appli.
create or replace function public.creer_inscription(p jsonb)
returns table (reference text, montant integer, don integer)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_dist text := p ->> 'distance';
  v_cat  text := p ->> 'categorie';
  v_don  integer := greatest(0, least(coalesce((p ->> 'don')::integer, 0), 1000000));
  v_tel  text := public._texte(p, 'telephone', 20, true);
  v_urg  text := public._texte(p, 'urgence_tel', 20, true);
  v_ddn  date := (p ->> 'date_naissance')::date;
  v_mont integer;
  v_ref  text;
begin
  if v_dist not in ('3','5','10') then raise exception 'Distance invalide'; end if;
  if v_cat not in ('etudiant','travailleur') then raise exception 'Catégorie invalide'; end if;
  if not public._tel_valide(v_tel) or not public._tel_valide(v_urg) then
    raise exception 'Numéro de téléphone invalide';
  end if;
  if coalesce((p ->> 'consentement')::boolean, false) is not true then
    raise exception 'Le consentement est obligatoire';
  end if;
  if v_ddn is null or v_ddn > current_date - interval '10 years' or v_ddn < date '1920-01-01' then
    raise exception 'Date de naissance invalide';
  end if;
  if (select count(*) from public.inscriptions i
        where public._chiffres(i.telephone) = public._chiffres(v_tel) and i.statut <> 'annule') >= 6 then
    raise exception 'Trop d''inscriptions avec ce numéro. Contactez l''organisation.';
  end if;

  select t.montant into v_mont from public.tarifs t where t.distance = v_dist and t.categorie = v_cat;
  v_ref := public._nouvelle_reference('ODY', 'inscriptions');

  insert into public.inscriptions (reference, nom, prenom, telephone, email, date_naissance, sexe, ville,
                                   distance, categorie, urgence_nom, urgence_tel, consentement, montant, don, taille_tshirt)
  values (v_ref,
          public._texte(p, 'nom', 80, true),
          public._texte(p, 'prenom', 80, true),
          v_tel,
          public._texte(p, 'email', 120, false),
          v_ddn,
          case when p ->> 'sexe' in ('F','M') then p ->> 'sexe' else null end,
          public._texte(p, 'ville', 80, false),
          v_dist, v_cat,
          public._texte(p, 'urgence_nom', 80, true),
          v_urg, true, v_mont, v_don,
          case when p ->> 'taille_tshirt' in ('XS','S','M','L','XL','XXL') then p ->> 'taille_tshirt' else null end);

  return query select v_ref, v_mont, v_don;
end $$;

-- Consulter son inscription (référence + téléphone)
drop function if exists public.consulter_inscription(text, text);
create or replace function public.consulter_inscription(p_reference text, p_telephone text)
returns table (reference text, prenom text, nom text, distance text, categorie text, montant integer,
               don integer, statut text, dossard integer, retire boolean, created_at timestamptz, taille_tshirt text)
language sql stable security definer set search_path = public as $$
  select i.reference, i.prenom, i.nom, i.distance, i.categorie, i.montant, i.don, i.statut,
         i.dossard, i.retire, i.created_at, i.taille_tshirt
  from public.inscriptions i
  where i.reference = upper(btrim(p_reference))
    and public._chiffres(i.telephone) = public._chiffres(p_telephone)
  limit 1;
$$;

-- Le coureur déclare avoir payé par Mobile Money (l'équipe vérifie ensuite)
create or replace function public.declarer_paiement(p_reference text, p_telephone text,
                                                    p_operateur text, p_transaction text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_statut text;
begin
  if p_operateur not in ('mtn','orange') then raise exception 'Opérateur invalide'; end if;
  if char_length(btrim(coalesce(p_transaction,''))) not between 4 and 60 then
    raise exception 'Identifiant de transaction invalide';
  end if;
  update public.inscriptions i
     set statut = 'paiement_declare', operateur = p_operateur,
         transaction_id = btrim(p_transaction), paiement_declare_at = now()
   where i.reference = upper(btrim(p_reference))
     and public._chiffres(i.telephone) = public._chiffres(p_telephone)
     and i.statut in ('en_attente','paiement_declare')
  returning i.statut into v_statut;
  if v_statut is null then raise exception 'Inscription introuvable ou déjà traitée'; end if;
  return v_statut;
end $$;

-- Faire un don
create or replace function public.creer_don(p jsonb)
returns table (reference text, montant integer)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare v_m integer := coalesce((p ->> 'montant')::integer, 0);
        v_tel text := public._texte(p, 'telephone', 20, true);
        v_ref text;
begin
  if v_m < 100 or v_m > 10000000 then raise exception 'Montant invalide'; end if;
  if not public._tel_valide(v_tel) then raise exception 'Numéro de téléphone invalide'; end if;
  v_ref := public._nouvelle_reference('DON', 'dons');
  insert into public.dons (reference, nom, telephone, montant)
  values (v_ref, public._texte(p, 'nom', 80, false), v_tel, v_m);
  return query select v_ref, v_m;
end $$;

create or replace function public.declarer_don(p_reference text, p_telephone text,
                                               p_operateur text, p_transaction text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_statut text;
begin
  if p_operateur not in ('mtn','orange') then raise exception 'Opérateur invalide'; end if;
  if char_length(btrim(coalesce(p_transaction,''))) not between 4 and 60 then
    raise exception 'Identifiant de transaction invalide';
  end if;
  update public.dons d
     set statut = 'paiement_declare', operateur = p_operateur,
         transaction_id = btrim(p_transaction), paiement_declare_at = now()
   where d.reference = upper(btrim(p_reference))
     and public._chiffres(d.telephone) = public._chiffres(p_telephone)
     and d.statut in ('en_attente','paiement_declare')
  returning d.statut into v_statut;
  if v_statut is null then raise exception 'Don introuvable ou déjà traité'; end if;
  return v_statut;
end $$;

-- Précommande boutique
create or replace function public.creer_commande(p jsonb)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_art jsonb := p -> 'articles'; v_tel text := public._texte(p, 'telephone', 20, true); v_ref text; a jsonb;
begin
  if jsonb_typeof(v_art) <> 'array' or jsonb_array_length(v_art) not between 1 and 12 then
    raise exception 'Panier invalide';
  end if;
  for a in select * from jsonb_array_elements(v_art) loop
    if char_length(coalesce(a ->> 'id','')) not between 1 and 40
       or coalesce((a ->> 'qte')::integer, 0) not between 1 and 10 then
      raise exception 'Article invalide';
    end if;
  end loop;
  if not public._tel_valide(v_tel) then raise exception 'Numéro de téléphone invalide'; end if;
  v_ref := public._nouvelle_reference('CMD', 'commandes');
  insert into public.commandes (reference, nom, telephone, inscription_ref, articles)
  values (v_ref, public._texte(p, 'nom', 80, true), v_tel,
          upper(public._texte(p, 'inscription_ref', 20, false)), v_art);
  return v_ref;
end $$;

-- Chiffres publics : jauge du Fonds et nombre d'inscrits
create or replace function public.etat_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'fonds', (select jsonb_build_object('objectif', f.objectif, 'collecte', f.collecte,
                                        'donateurs', f.donateurs, 'maj', f.maj)
              from public.fonds f where f.id = 1),
    'inscrits', jsonb_build_object(
      '3',  (select count(*) from public.inscriptions where distance = '3'  and statut <> 'annule'),
      '5',  (select count(*) from public.inscriptions where distance = '5'  and statut <> 'annule'),
      '10', (select count(*) from public.inscriptions where distance = '10' and statut <> 'annule')),
    'resultats', (select count(*) from public.resultats)
  );
$$;

-- ---------------------------------------------------------------------
-- 10. Fonctions de l'équipe
-- ---------------------------------------------------------------------
create or replace function public._exiger_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_staff() then raise exception 'Accès réservé à l''équipe organisatrice'; end if;
end $$;

-- Valider un paiement : attribue le dossard et verse le don au Fonds
create or replace function public.valider_paiement(p_id uuid)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare v public.inscriptions; v_num integer; v_plage public.plages_dossards;
begin
  perform public._exiger_staff();
  select * into v from public.inscriptions where id = p_id for update;
  if v.id is null then raise exception 'Inscription introuvable'; end if;
  if v.statut = 'paye' then return v.dossard; end if;
  if v.statut = 'annule' then raise exception 'Inscription annulée'; end if;

  perform pg_advisory_xact_lock(hashtext('dossard-' || v.distance));
  select * into v_plage from public.plages_dossards where distance = v.distance;
  select coalesce(max(dossard) + 1, v_plage.debut) into v_num
    from public.inscriptions where distance = v.distance and dossard is not null;
  if v_num > v_plage.fin then raise exception 'Plus de dossards disponibles pour cette distance'; end if;

  update public.inscriptions set statut = 'paye', paye_at = now(), dossard = v_num where id = p_id;
  if v.don > 0 then
    update public.fonds set collecte = collecte + v.don, donateurs = donateurs + 1, maj = now() where id = 1;
  end if;
  return v_num;
end $$;

create or replace function public.annuler_inscription(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  update public.inscriptions set statut = 'annule' where id = p_id and statut <> 'paye';
  if not found then raise exception 'Impossible : inscription introuvable ou déjà payée'; end if;
end $$;

create or replace function public.marquer_retrait(p_id uuid, p_retire boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  update public.inscriptions
     set retire = p_retire, retire_at = case when p_retire then now() else null end
   where id = p_id and statut = 'paye';
  if not found then raise exception 'Le dossard n''est remis qu''après paiement validé'; end if;
end $$;

create or replace function public.valider_don(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v public.dons;
begin
  perform public._exiger_staff();
  select * into v from public.dons where id = p_id for update;
  if v.id is null then raise exception 'Don introuvable'; end if;
  if v.statut = 'valide' then return; end if;
  if v.statut = 'annule' then raise exception 'Don annulé'; end if;
  update public.dons set statut = 'valide', valide_at = now() where id = p_id;
  update public.fonds set collecte = collecte + v.montant, donateurs = donateurs + 1, maj = now() where id = 1;
end $$;

create or replace function public.annuler_don(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  update public.dons set statut = 'annule' where id = p_id and statut <> 'valide';
  if not found then raise exception 'Impossible : don introuvable ou déjà validé'; end if;
end $$;

create or replace function public.maj_commande(p_id uuid, p_statut text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  if p_statut not in ('nouvelle','confirmee','payee','livree','annulee') then raise exception 'Statut invalide'; end if;
  update public.commandes set statut = p_statut where id = p_id;
end $$;

-- Ajustement manuel du Fonds (espèces, virement d'un sponsor…)
create or replace function public.maj_fonds(p_collecte integer, p_donateurs integer)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  if p_collecte < 0 or p_donateurs < 0 then raise exception 'Valeurs invalides'; end if;
  update public.fonds set collecte = p_collecte, donateurs = p_donateurs, maj = now() where id = 1;
end $$;


-- ---------------------------------------------------------------------
-- 10 bis. Bénévoles, actualités, résultats
-- ---------------------------------------------------------------------
create table if not exists public.benevoles (
  id             uuid primary key default gen_random_uuid(),
  reference      text unique not null,
  created_at     timestamptz not null default now(),
  nom            text not null,
  prenom         text not null,
  telephone      text not null,
  email          text,
  ville          text,
  missions       text[] not null,
  disponibilites text,
  taille_tshirt  text check (taille_tshirt in ('XS','S','M','L','XL','XXL')),
  statut         text not null default 'nouveau' check (statut in ('nouveau','contacte','retenu','decline'))
);

create table if not exists public.annonces (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  titre      text not null check (char_length(titre) between 1 and 120),
  texte      text not null check (char_length(texte) between 1 and 2000)
);

alter table public.benevoles enable row level security;
alter table public.annonces  enable row level security;
alter table public.resultats enable row level security;

drop policy if exists staff_lit_benevoles on public.benevoles;
create policy staff_lit_benevoles on public.benevoles for select using (public.est_staff());
drop policy if exists staff_lit_annonces on public.annonces;
create policy staff_lit_annonces on public.annonces for select using (public.est_staff());
drop policy if exists staff_lit_resultats on public.resultats;
create policy staff_lit_resultats on public.resultats for select using (public.est_staff());

-- Devenir bénévole
create or replace function public.creer_benevole(p jsonb)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_tel text := public._texte(p, 'telephone', 20, true);
  v_m   text[];
  v_ref text;
  v_t   text := nullif(p ->> 'taille_tshirt', '');
begin
  select array_agg(distinct m) into v_m
    from jsonb_array_elements_text(coalesce(p -> 'missions', '[]'::jsonb)) m
   where m in ('ravitaillement','retrait','securite','dechets','village','animation');
  if v_m is null then raise exception 'Choisissez au moins une mission'; end if;
  if not public._tel_valide(v_tel) then raise exception 'Numéro de téléphone invalide'; end if;
  if v_t is not null and v_t not in ('XS','S','M','L','XL','XXL') then raise exception 'Taille invalide'; end if;
  if (select count(*) from public.benevoles b where public._chiffres(b.telephone) = public._chiffres(v_tel)) >= 3 then
    raise exception 'Ce numéro est déjà inscrit comme bénévole';
  end if;
  v_ref := public._nouvelle_reference('BEN', 'benevoles');
  insert into public.benevoles (reference, nom, prenom, telephone, email, ville, missions, disponibilites, taille_tshirt)
  values (v_ref, public._texte(p, 'nom', 80, true), public._texte(p, 'prenom', 80, true), v_tel,
          public._texte(p, 'email', 120, false), public._texte(p, 'ville', 80, false), v_m,
          public._texte(p, 'disponibilites', 300, false), v_t);
  return v_ref;
end $$;

create or replace function public.maj_benevole(p_id uuid, p_statut text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  if p_statut not in ('nouveau','contacte','retenu','decline') then raise exception 'Statut invalide'; end if;
  update public.benevoles set statut = p_statut where id = p_id;
end $$;

-- Actualités
create or replace function public.annonces_publiques()
returns table (id uuid, created_at timestamptz, titre text, texte text)
language sql stable security definer set search_path = public as $$
  select a.id, a.created_at, a.titre, a.texte from public.annonces a order by a.created_at desc limit 20;
$$;

create or replace function public.publier_annonce(p_titre text, p_texte text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public._exiger_staff();
  insert into public.annonces (titre, texte) values (btrim(p_titre), btrim(p_texte)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.supprimer_annonce(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  delete from public.annonces where id = p_id;
end $$;

-- Résultats : classement général et par sexe, pour chaque distance
create or replace function public.resultats_publics(p_q text)
returns table (dossard integer, prenom text, nom_initiale text, distance text, sexe text,
               temps text, rang integer, rang_sexe integer, classes integer)
language sql stable security definer set search_path = public as $$
  with r as (
    select i.dossard, i.prenom, i.nom, upper(left(i.nom, 1)) || '.' as nom_initiale, i.distance, i.sexe, s.secondes,
           rank() over (partition by i.distance order by s.secondes)          as rang,
           rank() over (partition by i.distance, i.sexe order by s.secondes)  as rang_sexe,
           count(*) over (partition by i.distance)                            as classes
      from public.resultats s
      join public.inscriptions i on i.dossard = s.dossard and i.statut = 'paye'
  )
  select r.dossard, r.prenom, r.nom_initiale, r.distance, r.sexe,
         to_char(make_interval(secs => r.secondes), 'HH24:MI:SS'),
         r.rang::integer, r.rang_sexe::integer, r.classes::integer
    from r
   where btrim(coalesce(p_q, '')) = '*'
      or (coalesce(btrim(p_q), '') = '' and r.rang <= 10)
      or (coalesce(btrim(p_q), '') <> '' and (r.dossard::text = btrim(p_q)
          or (char_length(btrim(p_q)) >= 2 and (r.prenom ilike '%' || btrim(p_q) || '%' or r.nom ilike '%' || btrim(p_q) || '%'))))
   order by r.distance::integer desc, r.rang
   limit case when btrim(coalesce(p_q, '')) = '*' then 5000 else 60 end;
$$;

create or replace function public.importer_resultats(p jsonb)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare n integer;
begin
  perform public._exiger_staff();
  if jsonb_typeof(p) <> 'array' then raise exception 'Format invalide'; end if;
  insert into public.resultats (dossard, secondes)
  select (e ->> 'dossard')::integer, (e ->> 'secondes')::integer from jsonb_array_elements(p) e
  on conflict (dossard) do update set secondes = excluded.secondes, created_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.vider_resultats()
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  delete from public.resultats where true;
end $$;


-- ---------------------------------------------------------------------
-- 10 ter. Plateforme : événements, actions, communauté, formations, impact
-- ---------------------------------------------------------------------
-- Événements (hackathon, forum, atelier…) et actions environnementales
-- (collecte, reboisement, recyclage, sensibilisation) dans une même table.
create table if not exists public.evenements (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  rubrique      text not null check (rubrique in ('evenement','action')),
  type          text not null check (type in ('course','hackathon','forum','atelier','collecte','reboisement','recyclage','sensibilisation','autre')),
  titre         text not null check (char_length(titre) between 1 and 140),
  resume        text check (char_length(resume) <= 300),
  description   text check (char_length(description) <= 5000),
  date_debut    date,
  date_fin      date,
  date_texte    text check (char_length(date_texte) <= 80),
  lieu          text check (char_length(lieu) <= 140),
  ville         text check (char_length(ville) <= 80),
  inscription   text not null default 'participation' check (inscription in ('course20km','participation','externe','aucune')),
  lien          text check (lien is null or lien ~ '^https://'),
  places        integer check (places is null or places > 0),
  publie        boolean not null default false,
  -- Bilan saisi par l'équipe après l'action
  dechets_kg    numeric not null default 0 check (dechets_kg >= 0),
  arbres        integer not null default 0 check (arbres >= 0),
  sensibilises  integer not null default 0 check (sensibilises >= 0),
  bilan         text check (char_length(bilan) <= 2000)
);
alter table public.evenements add column if not exists image text check (image is null or image ~ '^https://');
alter table public.evenements add column if not exists recycles_kg numeric not null default 0 check (recycles_kg >= 0);
alter table public.evenements add column if not exists lat double precision check (lat between -90 and 90);
alter table public.evenements add column if not exists lng double precision check (lng between -180 and 180);

create table if not exists public.participations (
  id           uuid primary key default gen_random_uuid(),
  reference    text unique not null,
  created_at   timestamptz not null default now(),
  evenement_id uuid not null references public.evenements(id) on delete cascade,
  nom          text not null,
  prenom       text not null,
  telephone    text not null,
  email        text,
  personnes    integer not null default 1 check (personnes between 1 and 20),
  message      text,
  statut       text not null default 'inscrit' check (statut in ('inscrit','present','absent','annule'))
);

-- Candidatures : ambassadeurs, propositions de projets, demandes de partenariat
create table if not exists public.candidatures (
  id           uuid primary key default gen_random_uuid(),
  reference    text unique not null,
  created_at   timestamptz not null default now(),
  type         text not null check (type in ('ambassadeur','projet','partenaire')),
  nom          text not null,
  prenom       text,
  organisation text,
  telephone    text not null,
  email        text,
  ville        text,
  titre        text,
  message      text not null,
  statut       text not null default 'nouveau' check (statut in ('nouveau','en_cours','accepte','refuse'))
);

create table if not exists public.groupes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  nom         text not null check (char_length(nom) between 1 and 100),
  ville       text not null check (char_length(ville) between 1 and 80),
  description text check (char_length(description) <= 500),
  lien        text check (lien is null or lien ~ '^https://'),
  publie      boolean not null default true
);

-- Formations : guides, vidéos et quiz
create table if not exists public.contenus (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type       text not null check (type in ('guide','video','quiz')),
  theme      text check (char_length(theme) <= 60),
  titre      text not null check (char_length(titre) between 1 and 140),
  resume     text check (char_length(resume) <= 300),
  corps      text check (char_length(corps) <= 20000),
  lien       text check (lien is null or lien ~ '^https://'),
  quiz       jsonb,
  publie     boolean not null default false
);

alter table public.evenements     enable row level security;
alter table public.participations enable row level security;
alter table public.candidatures   enable row level security;
alter table public.groupes        enable row level security;
alter table public.contenus       enable row level security;

drop policy if exists staff_lit_evenements on public.evenements;
create policy staff_lit_evenements on public.evenements for select using (public.est_staff());
drop policy if exists staff_lit_participations on public.participations;
create policy staff_lit_participations on public.participations for select using (public.est_staff());
drop policy if exists staff_lit_candidatures on public.candidatures;
create policy staff_lit_candidatures on public.candidatures for select using (public.est_staff());
drop policy if exists staff_lit_groupes on public.groupes;
create policy staff_lit_groupes on public.groupes for select using (public.est_staff());
drop policy if exists staff_lit_contenus on public.contenus;
create policy staff_lit_contenus on public.contenus for select using (public.est_staff());

-- Lectures publiques
drop function if exists public.evenements_publics();
create or replace function public.evenements_publics()
returns table (id uuid, rubrique text, type text, titre text, resume text, description text, date_debut date, date_fin date,
               date_texte text, lieu text, ville text, inscription text, lien text, places integer, inscrits integer,
               dechets_kg numeric, arbres integer, sensibilises integer, bilan text, image text, recycles_kg numeric, lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select e.id, e.rubrique, e.type, e.titre, e.resume, e.description, e.date_debut, e.date_fin, e.date_texte, e.lieu, e.ville,
         e.inscription, e.lien, e.places,
         coalesce((select sum(p.personnes) from public.participations p where p.evenement_id = e.id and p.statut <> 'annule'), 0)::integer,
         e.dechets_kg, e.arbres, e.sensibilises, e.bilan, e.image, e.recycles_kg, e.lat, e.lng
    from public.evenements e
   where e.publie
   order by e.date_debut nulls last, e.created_at;
$$;

create or replace function public.groupes_publics()
returns table (id uuid, nom text, ville text, description text, lien text)
language sql stable security definer set search_path = public as $$
  select g.id, g.nom, g.ville, g.description, g.lien from public.groupes g where g.publie order by g.ville, g.nom;
$$;

create or replace function public.contenus_publics()
returns table (id uuid, type text, theme text, titre text, resume text, corps text, lien text, quiz jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.type, c.theme, c.titre, c.resume, c.corps, c.lien, c.quiz, c.created_at
    from public.contenus c where c.publie order by c.created_at desc;
$$;

-- Tableau d'impact : uniquement des chiffres saisis ou comptés, jamais estimés
create or replace function public.impact_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'dechets_kg',   (select coalesce(sum(dechets_kg), 0) from public.evenements where publie),
    'recycles_kg',  (select coalesce(sum(recycles_kg), 0) from public.evenements where publie),
    'arbres',       (select coalesce(sum(arbres), 0) from public.evenements where publie),
    'sensibilises', (select coalesce(sum(sensibilises), 0) from public.evenements where publie),
    'actions',      (select count(*) from public.evenements where publie and rubrique = 'action' and (bilan is not null or dechets_kg > 0 or arbres > 0 or sensibilises > 0)),
    'participants', (select coalesce(sum(personnes), 0) from public.participations where statut = 'present'),
    'benevoles',    (select count(*) from public.benevoles where statut = 'retenu'),
    'ambassadeurs', (select count(*) from public.candidatures where type = 'ambassadeur' and statut = 'accepte'),
    'fonds',        (select collecte from public.fonds where id = 1),
    'bilans', (select coalesce(jsonb_agg(jsonb_build_object('titre', e.titre, 'date', coalesce(e.date_texte, e.date_debut::text), 'ville', e.ville,
                     'dechets_kg', e.dechets_kg, 'recycles_kg', e.recycles_kg, 'arbres', e.arbres, 'sensibilises', e.sensibilises, 'bilan', e.bilan) order by e.date_debut desc nulls last), '[]'::jsonb)
                 from public.evenements e where e.publie and (e.bilan is not null or e.dechets_kg > 0 or e.recycles_kg > 0 or e.arbres > 0 or e.sensibilises > 0))
  );
$$;

-- Participer à un événement ou à une action
create or replace function public.creer_participation(p jsonb)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_ev public.evenements; v_tel text := public._texte(p, 'telephone', 20, true);
        v_n integer := greatest(1, least(coalesce((p ->> 'personnes')::integer, 1), 20)); v_ref text; v_pris integer;
begin
  select * into v_ev from public.evenements where id = (p ->> 'evenement_id')::uuid and publie;
  if v_ev.id is null then raise exception 'Événement introuvable'; end if;
  if v_ev.inscription <> 'participation' then raise exception 'L''inscription à cet événement se fait ailleurs'; end if;
  if v_ev.date_fin is not null and v_ev.date_fin < current_date or v_ev.date_fin is null and v_ev.date_debut < current_date then
    raise exception 'Cet événement est terminé';
  end if;
  if not public._tel_valide(v_tel) then raise exception 'Numéro de téléphone invalide'; end if;
  perform pg_advisory_xact_lock(hashtext('participation-' || v_ev.id::text));
  if exists (select 1 from public.participations x where x.evenement_id = v_ev.id and x.statut <> 'annule'
              and public._chiffres(x.telephone) = public._chiffres(v_tel) and lower(x.prenom) = lower(btrim(p ->> 'prenom'))) then
    raise exception 'Vous êtes déjà inscrit à cet événement';
  end if;
  if v_ev.places is not null then
    select coalesce(sum(personnes), 0) into v_pris from public.participations where evenement_id = v_ev.id and statut <> 'annule';
    if v_pris + v_n > v_ev.places then raise exception 'Il ne reste plus assez de places'; end if;
  end if;
  v_ref := public._nouvelle_reference('PAR', 'participations');
  insert into public.participations (reference, evenement_id, nom, prenom, telephone, email, personnes, message)
  values (v_ref, v_ev.id, public._texte(p, 'nom', 80, true), public._texte(p, 'prenom', 80, true), v_tel,
          public._texte(p, 'email', 120, false), v_n, public._texte(p, 'message', 500, false));
  return v_ref;
end $$;

create or replace function public.creer_candidature(p jsonb)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_type text := p ->> 'type'; v_tel text := public._texte(p, 'telephone', 20, true); v_ref text;
begin
  if v_type not in ('ambassadeur','projet','partenaire') then raise exception 'Type invalide'; end if;
  if not public._tel_valide(v_tel) then raise exception 'Numéro de téléphone invalide'; end if;
  if (select count(*) from public.candidatures c where c.type = v_type and public._chiffres(c.telephone) = public._chiffres(v_tel)
        and c.created_at > now() - interval '1 day') >= 3 then
    raise exception 'Trop de demandes envoyées aujourd''hui avec ce numéro';
  end if;
  v_ref := public._nouvelle_reference(case v_type when 'ambassadeur' then 'AMB' when 'projet' then 'PRJ' else 'PTN' end, 'candidatures');
  insert into public.candidatures (reference, type, nom, prenom, organisation, telephone, email, ville, titre, message)
  values (v_ref, v_type, public._texte(p, 'nom', 80, true), public._texte(p, 'prenom', 80, false),
          public._texte(p, 'organisation', 120, false), v_tel, public._texte(p, 'email', 120, false),
          public._texte(p, 'ville', 80, false), public._texte(p, 'titre', 140, false), public._texte(p, 'message', 3000, true));
  return v_ref;
end $$;

-- Gestion par l'équipe (création ou modification : id absent = création)
create or replace function public.enregistrer_evenement(p jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  perform public._exiger_staff();
  if v_id is null then
    insert into public.evenements (rubrique, type, titre) values (p ->> 'rubrique', p ->> 'type', p ->> 'titre') returning id into v_id;
  end if;
  update public.evenements set
    rubrique = p ->> 'rubrique', type = p ->> 'type', titre = btrim(p ->> 'titre'),
    resume = nullif(btrim(p ->> 'resume'), ''), description = nullif(btrim(p ->> 'description'), ''),
    date_debut = nullif(p ->> 'date_debut', '')::date, date_fin = nullif(p ->> 'date_fin', '')::date,
    date_texte = nullif(btrim(p ->> 'date_texte'), ''), lieu = nullif(btrim(p ->> 'lieu'), ''), ville = nullif(btrim(p ->> 'ville'), ''),
    inscription = coalesce(nullif(p ->> 'inscription', ''), 'participation'), lien = nullif(btrim(p ->> 'lien'), ''),
    places = nullif(p ->> 'places', '')::integer, publie = coalesce((p ->> 'publie')::boolean, false),
    dechets_kg = coalesce(nullif(p ->> 'dechets_kg', '')::numeric, 0), arbres = coalesce(nullif(p ->> 'arbres', '')::integer, 0),
    sensibilises = coalesce(nullif(p ->> 'sensibilises', '')::integer, 0), bilan = nullif(btrim(p ->> 'bilan'), ''),
    recycles_kg = coalesce(nullif(p ->> 'recycles_kg', '')::numeric, 0), image = nullif(btrim(p ->> 'image'), ''),
    lat = nullif(p ->> 'lat', '')::double precision, lng = nullif(p ->> 'lng', '')::double precision
  where id = v_id;
  return v_id;
end $$;

create or replace function public.supprimer_evenement(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin perform public._exiger_staff(); delete from public.evenements where id = p_id; end $$;

create or replace function public.maj_participation(p_id uuid, p_statut text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  if p_statut not in ('inscrit','present','absent','annule') then raise exception 'Statut invalide'; end if;
  update public.participations set statut = p_statut where id = p_id;
end $$;

create or replace function public.maj_candidature(p_id uuid, p_statut text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  if p_statut not in ('nouveau','en_cours','accepte','refuse') then raise exception 'Statut invalide'; end if;
  update public.candidatures set statut = p_statut where id = p_id;
end $$;

create or replace function public.enregistrer_groupe(p jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  perform public._exiger_staff();
  if v_id is null then insert into public.groupes (nom, ville) values (p ->> 'nom', p ->> 'ville') returning id into v_id; end if;
  update public.groupes set nom = btrim(p ->> 'nom'), ville = btrim(p ->> 'ville'), description = nullif(btrim(p ->> 'description'), ''),
         lien = nullif(btrim(p ->> 'lien'), ''), publie = coalesce((p ->> 'publie')::boolean, true) where id = v_id;
  return v_id;
end $$;

create or replace function public.supprimer_groupe(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin perform public._exiger_staff(); delete from public.groupes where id = p_id; end $$;

create or replace function public.enregistrer_contenu(p jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid; q jsonb := p -> 'quiz'; e jsonb;
begin
  perform public._exiger_staff();
  if p ->> 'type' = 'quiz' then
    if jsonb_typeof(q) <> 'array' or jsonb_array_length(q) not between 1 and 30 then raise exception 'Quiz : 1 à 30 questions'; end if;
    for e in select * from jsonb_array_elements(q) loop
      if jsonb_typeof(e -> 'choix') <> 'array' or jsonb_array_length(e -> 'choix') not between 2 and 6
         or (e ->> 'bonne')::integer not between 0 and jsonb_array_length(e -> 'choix') - 1 then
        raise exception 'Quiz : chaque question a 2 à 6 réponses et une bonne réponse';
      end if;
    end loop;
  else q := null; end if;
  if v_id is null then insert into public.contenus (type, titre) values (p ->> 'type', p ->> 'titre') returning id into v_id; end if;
  update public.contenus set type = p ->> 'type', theme = nullif(btrim(p ->> 'theme'), ''), titre = btrim(p ->> 'titre'),
         resume = nullif(btrim(p ->> 'resume'), ''), corps = nullif(btrim(p ->> 'corps'), ''), lien = nullif(btrim(p ->> 'lien'), ''),
         quiz = q, publie = coalesce((p ->> 'publie')::boolean, false) where id = v_id;
  return v_id;
end $$;

create or replace function public.supprimer_contenu(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin perform public._exiger_staff(); delete from public.contenus where id = p_id; end $$;


-- ---------------------------------------------------------------------
-- 10 quater. Carte (points de collecte, suivi en direct) et fil d'actualité
-- ---------------------------------------------------------------------
create table if not exists public.points_collecte (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom        text not null check (char_length(nom) between 1 and 120),
  type       text not null default 'collecte' check (type in ('collecte','tri','compost','depot')),
  adresse    text check (char_length(adresse) <= 200),
  horaires   text check (char_length(horaires) <= 200),
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  publie     boolean not null default true
);

-- Suivi en direct : actif seulement quand l'équipe l'ouvre (le jour de la course)
create table if not exists public.suivi_direct (
  id       integer primary key default 1 check (id = 1),
  actif    boolean not null default false,
  jusqu_a  timestamptz
);
insert into public.suivi_direct (id) values (1) on conflict (id) do nothing;

create table if not exists public.positions (
  appareil  text primary key check (char_length(appareil) between 16 and 64),
  prenom    text not null check (char_length(prenom) between 1 and 40),
  dossard   integer,
  lat       double precision not null check (lat between -90 and 90),
  lng       double precision not null check (lng between -180 and 180),
  maj       timestamptz not null default now()
);

create table if not exists public.publications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  appareil     text not null,
  auteur       text not null check (char_length(auteur) between 1 and 80),
  ville        text check (char_length(ville) <= 80),
  categorie    text not null check (categorie in ('collecte','reboisement','evenement','communaute','autre')),
  evenement_id uuid references public.evenements(id) on delete set null,
  texte        text check (char_length(texte) <= 1000),
  lieu         text check (char_length(lieu) <= 120),
  photo        text not null check (photo ~ '^publications/[a-z0-9-]{8,64}\.jpg$'),
  statut       text not null default 'en_attente' check (statut in ('en_attente','publie','masque'))
);

create table if not exists public.commentaires (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  publication_id uuid not null references public.publications(id) on delete cascade,
  appareil       text not null,
  auteur         text not null check (char_length(auteur) between 1 and 80),
  texte          text not null check (char_length(texte) between 1 and 500),
  statut         text not null default 'publie' check (statut in ('publie','masque'))
);

create table if not exists public.reactions (
  publication_id uuid not null references public.publications(id) on delete cascade,
  appareil       text not null,
  created_at     timestamptz not null default now(),
  primary key (publication_id, appareil)
);

create table if not exists public.signalements (
  publication_id uuid not null references public.publications(id) on delete cascade,
  appareil       text not null,
  created_at     timestamptz not null default now(),
  primary key (publication_id, appareil)
);

alter table public.points_collecte enable row level security;
alter table public.suivi_direct    enable row level security;
alter table public.positions       enable row level security;
alter table public.publications    enable row level security;
alter table public.commentaires    enable row level security;
alter table public.reactions       enable row level security;
alter table public.signalements    enable row level security;

drop policy if exists staff_lit_points on public.points_collecte;
create policy staff_lit_points on public.points_collecte for select using (public.est_staff());
drop policy if exists staff_lit_publications on public.publications;
create policy staff_lit_publications on public.publications for select using (public.est_staff());
drop policy if exists staff_lit_commentaires on public.commentaires;
create policy staff_lit_commentaires on public.commentaires for select using (public.est_staff());

-- Stockage des photos (Supabase Storage) : dépôt public dans publications/, lecture publique
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('photos', 'photos', true, 2000000, array['image/jpeg'])
    on conflict (id) do nothing;
    drop policy if exists depot_photos_publications on storage.objects;
    create policy depot_photos_publications on storage.objects for insert to anon, authenticated
      with check (bucket_id = 'photos' and name like 'publications/%');
  end if;
end $$;

create or replace function public._appareil_valide(a text) returns boolean
language sql immutable as $$ select coalesce(a, '') ~ '^[A-Za-z0-9-]{16,64}$' $$;

-- Carte
create or replace function public.points_publics()
returns table (id uuid, nom text, type text, adresse text, horaires text, lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select p.id, p.nom, p.type, p.adresse, p.horaires, p.lat, p.lng from public.points_collecte p where p.publie order by p.nom;
$$;

create or replace function public.suivi_etat()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('actif', s.actif and (s.jusqu_a is null or s.jusqu_a > now()), 'jusqu_a', s.jusqu_a)
  from public.suivi_direct s where s.id = 1;
$$;

create or replace function public.partager_position(p_appareil text, p_prenom text, p_dossard integer,
                                                    p_lat double precision, p_lng double precision)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not (select (suivi_etat() ->> 'actif')::boolean) then raise exception 'Le suivi en direct n''est pas ouvert'; end if;
  if not public._appareil_valide(p_appareil) then raise exception 'Appareil invalide'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Position invalide'; end if;
  insert into public.positions (appareil, prenom, dossard, lat, lng, maj)
  values (p_appareil, left(btrim(p_prenom), 40), p_dossard, p_lat, p_lng, now())
  on conflict (appareil) do update set prenom = excluded.prenom, dossard = excluded.dossard,
    lat = excluded.lat, lng = excluded.lng, maj = now();
end $$;

create or replace function public.arreter_position(p_appareil text)
returns void language sql volatile security definer set search_path = public as $$
  delete from public.positions where appareil = p_appareil;
$$;

create or replace function public.positions_publiques()
returns table (prenom text, dossard integer, lat double precision, lng double precision, maj timestamptz)
language sql stable security definer set search_path = public as $$
  select p.prenom, p.dossard, p.lat, p.lng, p.maj from public.positions p
   where p.maj > now() - interval '3 minutes' and (select (suivi_etat() ->> 'actif')::boolean)
   order by p.maj desc limit 2000;
$$;

-- Fil d'actualité
create or replace function public.creer_publication(p jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid; v_app text := p ->> 'appareil';
begin
  if not public._appareil_valide(v_app) then raise exception 'Appareil invalide'; end if;
  if (select count(*) from public.publications where appareil = v_app and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Limite de 10 publications par jour atteinte';
  end if;
  insert into public.publications (appareil, auteur, ville, categorie, evenement_id, texte, lieu, photo)
  values (v_app, public._texte(p, 'auteur', 80, true), public._texte(p, 'ville', 80, false),
          coalesce(nullif(p ->> 'categorie', ''), 'communaute'), nullif(p ->> 'evenement_id', '')::uuid,
          public._texte(p, 'texte', 1000, false), public._texte(p, 'lieu', 120, false), p ->> 'photo')
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.fil_public(p_categorie text, p_appareil text)
returns table (id uuid, created_at timestamptz, auteur text, ville text, categorie text, evenement_id uuid, texte text,
               lieu text, photo text, statut text, aimes integer, commentaires integer, j_aime boolean, a_moi boolean)
language sql stable security definer set search_path = public as $$
  select x.id, x.created_at, x.auteur, x.ville, x.categorie, x.evenement_id, x.texte, x.lieu, x.photo, x.statut,
         (select count(*) from public.reactions r where r.publication_id = x.id)::integer,
         (select count(*) from public.commentaires c where c.publication_id = x.id and c.statut = 'publie')::integer,
         exists (select 1 from public.reactions r where r.publication_id = x.id and r.appareil = p_appareil),
         x.appareil = p_appareil
    from public.publications x
   where (x.statut = 'publie' or (x.statut = 'en_attente' and x.appareil = p_appareil))
     and (coalesce(p_categorie, '') = '' or x.categorie = p_categorie)
   order by x.created_at desc limit 100;
$$;

create or replace function public.commentaires_publics(p_publication uuid)
returns table (id uuid, created_at timestamptz, auteur text, texte text)
language sql stable security definer set search_path = public as $$
  select c.id, c.created_at, c.auteur, c.texte from public.commentaires c
    join public.publications x on x.id = c.publication_id and x.statut = 'publie'
   where c.publication_id = p_publication and c.statut = 'publie' order by c.created_at limit 200;
$$;

create or replace function public.aimer(p_publication uuid, p_appareil text)
returns integer language plpgsql volatile security definer set search_path = public as $$
begin
  if not public._appareil_valide(p_appareil) then raise exception 'Appareil invalide'; end if;
  if not exists (select 1 from public.publications where id = p_publication and statut = 'publie') then raise exception 'Publication introuvable'; end if;
  if exists (select 1 from public.reactions where publication_id = p_publication and appareil = p_appareil) then
    delete from public.reactions where publication_id = p_publication and appareil = p_appareil;
  else
    insert into public.reactions (publication_id, appareil) values (p_publication, p_appareil);
  end if;
  return (select count(*) from public.reactions where publication_id = p_publication);
end $$;

create or replace function public.commenter(p_publication uuid, p_appareil text, p_auteur text, p_texte text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._appareil_valide(p_appareil) then raise exception 'Appareil invalide'; end if;
  if not exists (select 1 from public.publications where id = p_publication and statut = 'publie') then raise exception 'Publication introuvable'; end if;
  if char_length(btrim(coalesce(p_texte, ''))) not between 1 and 500 then raise exception 'Commentaire vide ou trop long'; end if;
  if (select count(*) from public.commentaires where appareil = p_appareil and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Trop de commentaires en peu de temps';
  end if;
  insert into public.commentaires (publication_id, appareil, auteur, texte)
  values (p_publication, p_appareil, left(btrim(coalesce(nullif(p_auteur, ''), 'Membre')), 80), btrim(p_texte)) returning id into v_id;
  return v_id;
end $$;

-- Trois signalements masquent la publication en attendant la décision de l'équipe
create or replace function public.signaler(p_publication uuid, p_appareil text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not public._appareil_valide(p_appareil) then raise exception 'Appareil invalide'; end if;
  insert into public.signalements (publication_id, appareil) values (p_publication, p_appareil) on conflict do nothing;
  if (select count(*) from public.signalements where publication_id = p_publication) >= 3 then
    update public.publications set statut = 'masque' where id = p_publication and statut = 'publie';
  end if;
end $$;

-- Équipe
create or replace function public.moderer_publication(p_id uuid, p_statut text)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  if p_statut not in ('en_attente','publie','masque') then raise exception 'Statut invalide'; end if;
  update public.publications set statut = p_statut where id = p_id;
end $$;

create or replace function public.masquer_commentaire(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin perform public._exiger_staff(); update public.commentaires set statut = 'masque' where id = p_id; end $$;

create or replace function public.publications_admin()
returns table (id uuid, created_at timestamptz, auteur text, ville text, categorie text, texte text, lieu text, photo text,
               statut text, signalements integer, commentaires jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  return query select x.id, x.created_at, x.auteur, x.ville, x.categorie, x.texte, x.lieu, x.photo, x.statut,
    (select count(*) from public.signalements s where s.publication_id = x.id)::integer,
    coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'auteur', c.auteur, 'texte', c.texte, 'statut', c.statut) order by c.created_at)
              from public.commentaires c where c.publication_id = x.id), '[]'::jsonb)
    from public.publications x order by (x.statut = 'en_attente') desc, x.created_at desc limit 500;
end $$;

create or replace function public.regler_suivi(p_actif boolean, p_heures integer)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._exiger_staff();
  update public.suivi_direct set actif = p_actif,
    jusqu_a = case when p_actif then now() + make_interval(hours => greatest(1, least(coalesce(p_heures, 8), 24))) else null end where id = 1;
  if not p_actif then delete from public.positions where true; end if;
end $$;

create or replace function public.enregistrer_point(p jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  perform public._exiger_staff();
  if v_id is null then
    insert into public.points_collecte (nom, lat, lng) values (p ->> 'nom', (p ->> 'lat')::double precision, (p ->> 'lng')::double precision) returning id into v_id;
  end if;
  update public.points_collecte set nom = btrim(p ->> 'nom'), type = coalesce(nullif(p ->> 'type', ''), 'collecte'),
    adresse = nullif(btrim(p ->> 'adresse'), ''), horaires = nullif(btrim(p ->> 'horaires'), ''),
    lat = (p ->> 'lat')::double precision, lng = (p ->> 'lng')::double precision, publie = coalesce((p ->> 'publie')::boolean, true)
  where id = v_id;
  return v_id;
end $$;

create or replace function public.supprimer_point(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
begin perform public._exiger_staff(); delete from public.points_collecte where id = p_id; end $$;

-- ---------------------------------------------------------------------
-- 11. Droits d'exécution
-- ---------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function public.creer_inscription(jsonb)                        to anon, authenticated;
grant execute on function public.consulter_inscription(text, text)               to anon, authenticated;
grant execute on function public.declarer_paiement(text, text, text, text)       to anon, authenticated;
grant execute on function public.creer_don(jsonb)                                to anon, authenticated;
grant execute on function public.declarer_don(text, text, text, text)            to anon, authenticated;
grant execute on function public.creer_commande(jsonb)                           to anon, authenticated;
grant execute on function public.etat_public()                                   to anon, authenticated;
grant execute on function public.est_staff()                                     to anon, authenticated;
grant execute on function public.valider_paiement(uuid)                          to authenticated;
grant execute on function public.annuler_inscription(uuid)                       to authenticated;
grant execute on function public.marquer_retrait(uuid, boolean)                  to authenticated;
grant execute on function public.valider_don(uuid)                               to authenticated;
grant execute on function public.annuler_don(uuid)                               to authenticated;
grant execute on function public.maj_commande(uuid, text)                        to authenticated;
grant execute on function public.maj_fonds(integer, integer)                     to authenticated;
grant execute on function public.creer_benevole(jsonb)                           to anon, authenticated;
grant execute on function public.annonces_publiques()                            to anon, authenticated;
grant execute on function public.resultats_publics(text)                         to anon, authenticated;
grant execute on function public.maj_benevole(uuid, text)                        to authenticated;
grant execute on function public.publier_annonce(text, text)                     to authenticated;
grant execute on function public.supprimer_annonce(uuid)                         to authenticated;
grant execute on function public.importer_resultats(jsonb)                       to authenticated;
grant execute on function public.vider_resultats()                               to authenticated;
grant execute on function public.evenements_publics()                            to anon, authenticated;
grant execute on function public.groupes_publics()                               to anon, authenticated;
grant execute on function public.contenus_publics()                              to anon, authenticated;
grant execute on function public.impact_public()                                 to anon, authenticated;
grant execute on function public.creer_participation(jsonb)                      to anon, authenticated;
grant execute on function public.creer_candidature(jsonb)                        to anon, authenticated;
grant execute on function public.enregistrer_evenement(jsonb)                    to authenticated;
grant execute on function public.supprimer_evenement(uuid)                       to authenticated;
grant execute on function public.maj_participation(uuid, text)                   to authenticated;
grant execute on function public.maj_candidature(uuid, text)                     to authenticated;
grant execute on function public.enregistrer_groupe(jsonb)                       to authenticated;
grant execute on function public.supprimer_groupe(uuid)                          to authenticated;
grant execute on function public.enregistrer_contenu(jsonb)                      to authenticated;
grant execute on function public.supprimer_contenu(uuid)                         to authenticated;
grant execute on function public.points_publics()                                to anon, authenticated;
grant execute on function public.suivi_etat()                                    to anon, authenticated;
grant execute on function public.partager_position(text, text, integer, double precision, double precision) to anon, authenticated;
grant execute on function public.arreter_position(text)                          to anon, authenticated;
grant execute on function public.positions_publiques()                           to anon, authenticated;
grant execute on function public.creer_publication(jsonb)                        to anon, authenticated;
grant execute on function public.fil_public(text, text)                          to anon, authenticated;
grant execute on function public.commentaires_publics(uuid)                      to anon, authenticated;
grant execute on function public.aimer(uuid, text)                               to anon, authenticated;
grant execute on function public.commenter(uuid, text, text, text)               to anon, authenticated;
grant execute on function public.signaler(uuid, text)                            to anon, authenticated;
grant execute on function public.moderer_publication(uuid, text)                 to authenticated;
grant execute on function public.masquer_commentaire(uuid)                       to authenticated;
grant execute on function public.publications_admin()                            to authenticated;
grant execute on function public.regler_suivi(boolean, integer)                  to authenticated;
grant execute on function public.enregistrer_point(jsonb)                        to authenticated;
grant execute on function public.supprimer_point(uuid)                           to authenticated;

-- ---------------------------------------------------------------------
-- 12. Ajouter un membre de l'équipe (après sa création dans Authentication > Users)
-- ---------------------------------------------------------------------
-- insert into public.staff (user_id, nom)
-- select id, 'Gédéon' from auth.users where email = 'adresse@exemple.org';
