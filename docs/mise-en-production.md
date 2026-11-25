# Liste de contrôle — mise en production (ouverture du 1er décembre 2026)

À dérouler dans l'ordre sur le projet Supabase de **test**, puis sur celui de **production**.
Chaque case cochée est notée dans l'issue #25 avec la date et le nom de la personne.

## 1. Base de données
- [ ] Région choisie selon l'ADR 002 (mesures depuis Yaoundé, MTN et Orange) — elle ne pourra plus changer.
- [ ] Migrations 001 → 004 appliquées dans l'ordre (SQL Editor), **sans** `tests/mock_supabase.sql`.
- [ ] Inscriptions publiques par e-mail **désactivées** (Authentication → Providers → Email → « Allow new users to sign up » : off).
- [ ] Comptes de l'équipe créés (#5) et ajoutés à la table `staff`.
- [ ] Contrôle des droits réels (doit renvoyer **0 ligne**) :
  ```sql
  select c.relname, p.privilege_type from information_schema.role_table_grants p
  join pg_class c on c.relname = p.table_name
  where p.table_schema = 'public' and p.grantee in ('anon','authenticated')
    and p.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
  ```
- [ ] Politiques du stockage (aucune ne doit permettre un dépôt à `anon`) :
  ```sql
  select policyname, cmd, roles, with_check from pg_policies where schemaname = 'storage';
  ```
- [ ] Sauvegardes activées (offre payante : sauvegarde quotidienne) ; noter comment restaurer.

## 2. Application
- [ ] `js/config.js` : URL du projet et clé **publishable / anon** uniquement (jamais la clé service_role).
- [ ] Numéros Mobile Money de l'association, nom du titulaire, contact (#3).
- [ ] Tarifs définitifs (#4) identiques dans `js/config.js` et dans la table `tarifs`.
- [ ] Site en ligne sur LWS (`inscription.odyssee-env.com`) en HTTPS, ouvert depuis Yaoundé (MTN et Orange).

## 3. Essai complet (base de test)
- [ ] Inscription → paiement Mobile Money réel d'un petit montant → déclaration → validation par l'équipe → dossard.
- [ ] Annulation par l'équipe ; inscription non payée qui expire (régler le délai à 1 h pour l'essai, puis remettre 48 h).
- [ ] « Mon dossard » retrouvé avec la référence et le téléphone.
- [ ] Test de charge `tests/test_de_charge.sh` sur la base de test **vide**, puis vider la base.

## 4. Ouverture
- [ ] Quota de la première vague réglé (3 000 par défaut) ; délai de paiement 48 h.
- [ ] Interrupteur sur « Ouvertes » à l'heure annoncée.
- [ ] Personne de garde désignée pour valider les paiements chaque jour (#27) et fermer en cas d'incident (#30).

## Retour arrière
- Incident : fermer les inscriptions depuis l'espace organisateurs (les inscriptions faites restent consultables).
- Problème de données : restaurer la dernière sauvegarde Supabase ; prévenir les inscrits concernés.

## Fil d'actualité (photos publiées par l'équipe)
- Seuls les comptes de l'équipe publient (contrôlé par la base et par le stockage, pas seulement par l'appli).
- Avant de publier : pas d'enfant reconnaissable sans l'accord de ses parents, personnes d'accord pour être photographiées.
- **Masquer** une publication la retire du fil, mais la photo reste accessible par son adresse directe (le seau `photos` est public).
  Pour retirer vraiment une photo problématique : la masquer, puis la supprimer dans Supabase → Storage → `photos/publications/`.
