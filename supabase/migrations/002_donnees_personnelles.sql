-- =====================================================================
-- 002 — Données personnelles des inscriptions (loi camerounaise n° 2024/017)
-- - e-mail obligatoire, ville non collectée ;
-- - accord d'un parent ou représentant légal pour les moins de 18 ans
--   le jour de la course (samedi 10 juillet 2027) ;
-- - version du texte de consentement enregistrée ;
-- - anonymisation des inscriptions après la course, par l'équipe.
-- Relançable sans erreur.
-- =====================================================================

alter table public.inscriptions add column if not exists consentement_parental boolean not null default false;
alter table public.inscriptions add column if not exists consentement_version text;
alter table public.inscriptions add column if not exists anonymise_at timestamptz;

-- Date de la course : sert à savoir si le participant sera mineur ce jour-là
create or replace function public._date_course() returns date
language sql immutable as $$ select date '2027-07-10' $$;

create or replace function public.creer_inscription(p jsonb)
returns table (reference text, montant integer, don integer)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_dist  text := p ->> 'distance';
  v_cat   text := p ->> 'categorie';
  v_don   integer := greatest(0, least(coalesce((p ->> 'don')::integer, 0), 1000000));
  v_tel   text := public._texte(p, 'telephone', 20, true);
  v_urg   text := public._texte(p, 'urgence_tel', 20, true);
  v_mail  text := lower(public._texte(p, 'email', 120, true));
  v_ddn   date := (p ->> 'date_naissance')::date;
  v_mineur boolean;
  v_mont  integer;
  v_ref   text;
begin
  if v_dist not in ('3','5','10') then raise exception 'Distance invalide'; end if;
  if v_cat not in ('etudiant','travailleur') then raise exception 'Catégorie invalide'; end if;
  if not public._tel_valide(v_tel) or not public._tel_valide(v_urg) then
    raise exception 'Numéro de téléphone invalide';
  end if;
  if v_mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse e-mail invalide';
  end if;
  if coalesce((p ->> 'consentement')::boolean, false) is not true then
    raise exception 'Le consentement est obligatoire';
  end if;
  if v_ddn is null or v_ddn > current_date - interval '10 years' or v_ddn < date '1920-01-01' then
    raise exception 'Date de naissance invalide';
  end if;
  v_mineur := v_ddn > (public._date_course() - interval '18 years')::date;
  if v_mineur and coalesce((p ->> 'consentement_parental')::boolean, false) is not true then
    raise exception 'L''accord d''un parent ou représentant légal est obligatoire pour les moins de 18 ans';
  end if;
  if (select count(*) from public.inscriptions i
        where public._chiffres(i.telephone) = public._chiffres(v_tel) and i.statut <> 'annule') >= 6 then
    raise exception 'Trop d''inscriptions avec ce numéro. Contactez l''organisation.';
  end if;

  select t.montant into v_mont from public.tarifs t where t.distance = v_dist and t.categorie = v_cat;
  v_ref := public._nouvelle_reference('ODY', 'inscriptions');

  insert into public.inscriptions (reference, nom, prenom, telephone, email, date_naissance, sexe, ville,
                                   distance, categorie, urgence_nom, urgence_tel, consentement,
                                   consentement_parental, consentement_version, montant, don, taille_tshirt)
  values (v_ref,
          public._texte(p, 'nom', 80, true),
          public._texte(p, 'prenom', 80, true),
          v_tel, v_mail, v_ddn,
          case when p ->> 'sexe' in ('F','M') then p ->> 'sexe' else null end,
          null,
          v_dist, v_cat,
          public._texte(p, 'urgence_nom', 80, true),
          v_urg, true, v_mineur, left(coalesce(p ->> 'consentement_version', ''), 20),
          v_mont, v_don,
          case when p ->> 'taille_tshirt' in ('XS','S','M','L','XL','XXL') then p ->> 'taille_tshirt' else null end);

  return query select v_ref, v_mont, v_don;
end $$;

-- Anonymisation après la course : efface les coordonnées, garde le prénom,
-- l'initiale du nom, l'année de naissance, le sexe, l'épreuve et le dossard (résultats).
create or replace function public.anonymiser_inscriptions()
returns integer
language plpgsql volatile security definer set search_path = public as $$
declare n integer;
begin
  if not public.est_staff() then raise exception 'Accès réservé à l''équipe organisatrice'; end if;
  if current_date <= public._date_course() then
    raise exception 'L''anonymisation n''est possible qu''après la course';
  end if;
  update public.inscriptions set
    nom = left(nom, 1) || '.',
    telephone = 'anonymise-' || left(id::text, 8),
    email = null,
    date_naissance = make_date(extract(year from date_naissance)::integer, 1, 1),
    ville = null,
    urgence_nom = '—',
    urgence_tel = '—',
    transaction_id = null,
    anonymise_at = now()
  where anonymise_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.anonymiser_inscriptions() from public, anon;
grant execute on function public.anonymiser_inscriptions() to authenticated;
grant execute on function public.creer_inscription(jsonb) to anon, authenticated;
