\set n random(1, 999999999)
\set t random(10000000, 99999999)
\set d random(1, 3)
set role anon;
select * from public.creer_inscription(jsonb_build_object(
  'nom','Charge'||:n, 'prenom','P'||:n, 'telephone','+2376'||:t, 'email','c'||:n||'@exemple.cm', 'sexe','F',
  'distance', (array['3','5','10'])[:d], 'categorie','etudiant', 'urgence_nom','U', 'urgence_tel','+237699000000',
  'consentement', true, 'consentement_version','2026-11-25', 'date_naissance','1995-03-01', 'cle_envoi', gen_random_uuid()));
reset role;
