-- =====================================================================
-- Migration 011 : Odyris — gestion du personnel depuis l'interface.
--
-- Quatre fonctions réservées aux ADMINISTRATEURS pour gérer l'équipe :
--   - odyris_personnel_lister()  : la liste du personnel (nom, e-mail, rôle).
--   - odyris_personnel_ajouter() : ajoute un compte EXISTANT à l'équipe (par
--     e-mail) et lui donne un rôle. Le compte doit déjà exister (la personne
--     crée son accès elle-même au préalable) — on n'invente pas d'identifiant.
--   - odyris_personnel_role()    : change le rôle (agent/admin).
--   - odyris_personnel_retirer() : retire une personne de l'équipe (son
--     compte de connexion reste, mais elle perd l'accès à Odyris).
--
-- Garde-fous :
--   - admin uniquement (refus « Accès réservé aux administrateurs ») ;
--   - double authentification RÉCENTE exigée pour toute modification ;
--   - il doit toujours rester au moins un administrateur ;
--   - on ne peut pas se retirer soi-même ;
--   - chaque modification est tracée au journal d'audit.
--
-- Toutes SECURITY DEFINER, search_path fixé, révoquées de PUBLIC/anon/
-- authenticated. Aucune donnée des participants n'est touchée. Relançable.
-- =====================================================================

-- Liste du personnel (lecture, admin).
create or replace function public.odyris_personnel_lister()
returns table (user_id uuid, email text, nom text, role text, created_at timestamptz, est_moi boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé aux administrateurs'; end if;
  return query
    select s.user_id, u.email, s.nom, s.role, s.created_at, (s.user_id = auth.uid())
      from public.staff s
      left join auth.users u on u.id = s.user_id
     order by s.created_at asc;
end $$;
revoke all on function public.odyris_personnel_lister() from public, anon, authenticated;
grant execute on function public.odyris_personnel_lister() to authenticated;

-- Ajoute un compte existant à l'équipe (par e-mail) avec un rôle.
create or replace function public.odyris_personnel_ajouter(p_email text, p_nom text, p_role text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid; v_role text := lower(coalesce(p_role, 'agent')); v_mail text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.est_admin() then raise exception 'Accès réservé aux administrateurs'; end if;
  perform public._odyris_exiger_mfa_fraiche(15);
  if v_role not in ('agent','admin') then raise exception 'Rôle invalide'; end if;
  if v_mail = '' then raise exception 'E-mail requis'; end if;
  select id into v_uid from auth.users where lower(email) = v_mail;
  if v_uid is null then
    raise exception 'Aucun compte pour % : la personne doit d''abord créer son accès sur Odyris, puis vous l''ajoutez.', v_mail;
  end if;
  insert into public.staff (user_id, nom, role)
       values (v_uid, nullif(btrim(coalesce(p_nom, '')), ''), v_role)
  on conflict (user_id) do update
       set nom  = coalesce(nullif(btrim(coalesce(p_nom, '')), ''), public.staff.nom),
           role = excluded.role;
  perform public._odyris_log('personnel_ajouter', v_mail, jsonb_build_object('role', v_role));
  return jsonb_build_object('ok', true, 'user_id', v_uid, 'role', v_role);
end $$;
revoke all on function public.odyris_personnel_ajouter(text, text, text) from public, anon, authenticated;
grant execute on function public.odyris_personnel_ajouter(text, text, text) to authenticated;

-- Change le rôle d'un membre.
create or replace function public.odyris_personnel_role(p_user_id uuid, p_role text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_role text := lower(coalesce(p_role, '')); v_actuel text;
begin
  if not public.est_admin() then raise exception 'Accès réservé aux administrateurs'; end if;
  perform public._odyris_exiger_mfa_fraiche(15);
  if v_role not in ('agent','admin') then raise exception 'Rôle invalide'; end if;
  select role into v_actuel from public.staff where user_id = p_user_id;
  if v_actuel is null then raise exception 'Membre introuvable'; end if;
  if v_actuel = 'admin' and v_role = 'agent'
     and (select count(*) from public.staff where role = 'admin') <= 1 then
    raise exception 'Impossible : il doit rester au moins un administrateur.';
  end if;
  update public.staff set role = v_role where user_id = p_user_id;
  perform public._odyris_log('personnel_role',
    (select lower(email) from auth.users where id = p_user_id), jsonb_build_object('role', v_role));
end $$;
revoke all on function public.odyris_personnel_role(uuid, text) from public, anon, authenticated;
grant execute on function public.odyris_personnel_role(uuid, text) to authenticated;

-- Retire une personne de l'équipe (son compte de connexion reste).
create or replace function public.odyris_personnel_retirer(p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_role text; v_mail text;
begin
  if not public.est_admin() then raise exception 'Accès réservé aux administrateurs'; end if;
  perform public._odyris_exiger_mfa_fraiche(15);
  if p_user_id = auth.uid() then raise exception 'Vous ne pouvez pas vous retirer vous-même.'; end if;
  select role into v_role from public.staff where user_id = p_user_id;
  if v_role is null then raise exception 'Membre introuvable'; end if;
  if v_role = 'admin' and (select count(*) from public.staff where role = 'admin') <= 1 then
    raise exception 'Impossible : il doit rester au moins un administrateur.';
  end if;
  select lower(email) into v_mail from auth.users where id = p_user_id;
  delete from public.staff where user_id = p_user_id;
  perform public._odyris_log('personnel_retirer', v_mail, '{}'::jsonb);
end $$;
revoke all on function public.odyris_personnel_retirer(uuid) from public, anon, authenticated;
grant execute on function public.odyris_personnel_retirer(uuid) to authenticated;
