# Migrations de la base de données

Chaque fichier modifie la base Supabase. On les applique **dans l'ordre des numéros**,
dans *Supabase > SQL Editor*, d'abord sur la base de **test**, puis sur la **production**.

Projet Supabase : `nuqmvkutljogqjuhtqrj` (Londres, eu-west-2, offre gratuite). Migrations 001 → 006 appliquées le 26/11/2026 (commit e9981c1), contrôles de la liste de mise en production passés : aucun droit d'écriture public, RLS sur toutes les tables, dépôt de photos réservé à l'équipe, inscriptions fermées (quota 3 000).

| Fichier | Contenu | Appliqué en production |
|---|---|---|
| `001_schema_initial.sql` | Schéma complet : tables, règles de sécurité, fonctions, dossier de photos | 26/11/2026 |
| `002_donnees_personnelles.sql` | E-mail obligatoire, accord parental des mineurs, version du consentement, anonymisation après la course | 26/11/2026 |
| `003_ouverture_et_doublons.sql` | Interrupteur d'ouverture et quota (fermé par défaut), clé d'envoi anti-doublon, même personne refusée, identifiant de transaction unique | 26/11/2026 |
| `004_audit_securite.sql` | Audit #26 : délai de paiement (48 h) avant qu'une inscription non payée libère sa place, droits limités à la lecture sur les tables, plus de dépôt anonyme de photos | 26/11/2026 |
| `005_verification_paiements.sql` | #27 : l'équipe peut refuser un paiement déclaré introuvable, avec un motif visible par le coureur (identifiant effacé, nouveau délai de paiement) | 26/11/2026 |
| `006_fil_equipe.sql` | Seule l'équipe publie des photos dans le fil (publication immédiate) ; dépôt de photos réservé à l'équipe connectée | 26/11/2026 |

Règles :
- ne jamais modifier un fichier déjà appliqué en production : écrire le suivant (`002_…`) ;
- chaque fichier doit pouvoir être relancé sans erreur ;
- tester avec `tests/verifier_sql.sh` avant la Pull Request ;
- compléter le tableau ci-dessus (date) à chaque mise en production.

Après la migration 003, les inscriptions sont **fermées** : les ouvrir depuis l'espace organisateurs (tableau de bord → Ouverture des inscriptions) le jour J, après les vérifications de l'issue #25.
