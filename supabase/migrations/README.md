# Migrations de la base de données

Chaque fichier modifie la base Supabase. On les applique **dans l'ordre des numéros**,
dans *Supabase > SQL Editor*, après le passage des tests automatiques (base locale jetable).

**Projet de production** Supabase : `nuqmvkutljogqjuhtqrj` (Londres, eu-west-2, offre gratuite, organisation « Odyssée de l'environnement »), relié à l'appli par `js/config.js`. L'association a retenu ce projet pour l'ouverture : il n'y a pas d'autre projet Supabase. Les tests automatiques utilisent une base locale jetable (`tests/verifier_sql.sh`).

Migrations 001 → 006 appliquées le 26/11/2026 (commit e9981c1). Contrôle sur la base de production le 26/11/2026 :
- 25 tables dans `public`, **RLS active sur toutes** ; 20 règles RLS ;
- **0 droit d'écriture** (INSERT/UPDATE/DELETE/TRUNCATE) pour `anon`, `authenticated` ou `PUBLIC` sur les tables ;
- 72 fonctions ; fonctions `SECURITY DEFINER` avec `search_path` fixé, aucune exécutable par `PUBLIC` ; les fonctions réservées à l'équipe vérifient `est_staff()` ;
- dossier `photos` en lecture publique (fil d'actualité), dépôt réservé à l'équipe connectée (`depot_photos_equipe` : `publications/%` et `est_staff()`) ;
- 1 compte équipe ; inscription libre désactivée dans l'authentification Supabase ;
- inscriptions **fermées** (`ouvertes = false`, quota 3 000), 0 inscription en base.

| Fichier | Contenu | Production (`nuqmvkutljogqjuhtqrj`) |
|---|---|---|
| `001_schema_initial.sql` | Schéma complet : tables, règles de sécurité, fonctions, dossier de photos | 26/11/2026 |
| `002_donnees_personnelles.sql` | E-mail obligatoire, accord parental des mineurs, version du consentement, anonymisation après la course | 26/11/2026 |
| `003_ouverture_et_doublons.sql` | Interrupteur d'ouverture et quota (fermé par défaut), clé d'envoi anti-doublon, même personne refusée, identifiant de transaction unique | 26/11/2026 |
| `004_audit_securite.sql` | Audit #26 : délai de paiement (48 h) avant qu'une inscription non payée libère sa place, droits limités à la lecture sur les tables, plus de dépôt anonyme de photos | 26/11/2026 |
| `005_verification_paiements.sql` | #27 : l'équipe peut refuser un paiement déclaré introuvable, avec un motif visible par le coureur (identifiant effacé, nouveau délai de paiement) | 26/11/2026 |
| `006_fil_equipe.sql` | Seule l'équipe publie des photos dans le fil (publication immédiate) ; dépôt de photos réservé à l'équipe connectée | 26/11/2026 |
| `007_reference_search_path.sql` | Correctif production : search_path de `_nouvelle_reference` élargi à `public, extensions` (pgcrypto est dans `extensions` sur Supabase) — sans quoi `gen_random_bytes` est introuvable et aucune inscription/don/commande ne peut être créé | 27/11/2026 |
| `008_odyris_fiche_personne.sql` | Odyris (console interne) : fonctions de **lecture** `odyris_personnes()` et `odyris_fiche()` réservées au staff, qui réunissent une personne à travers toutes les tables (clé = téléphone normalisé). Ne touche à aucune donnée | à appliquer |

Règles :
- ne jamais modifier un fichier déjà appliqué en production : écrire le suivant (`002_…`) ;
- chaque fichier doit pouvoir être relancé sans erreur ;
- tester avec `tests/verifier_sql.sh` avant la Pull Request ;
- compléter le tableau ci-dessus (date) à chaque mise en production.

Après la migration 003, les inscriptions sont **fermées** : les ouvrir depuis l'espace organisateurs (tableau de bord → Ouverture des inscriptions) le jour J, après les vérifications de l'issue #25.
