# Migrations de la base de données

Chaque fichier modifie la base Supabase. On les applique **dans l'ordre des numéros**,
dans *Supabase > SQL Editor*, d'abord sur la base de **test**, puis sur la **production**.

| Fichier | Contenu | Appliqué en production |
|---|---|---|
| `001_schema_initial.sql` | Schéma complet : tables, règles de sécurité, fonctions, dossier de photos | — |
| `002_donnees_personnelles.sql` | E-mail obligatoire, accord parental des mineurs, version du consentement, anonymisation après la course | — |
| `003_ouverture_et_doublons.sql` | Interrupteur d'ouverture et quota (fermé par défaut), clé d'envoi anti-doublon, même personne refusée, identifiant de transaction unique | — |
| `004_audit_securite.sql` | Audit #26 : délai de paiement (48 h) avant qu'une inscription non payée libère sa place, droits limités à la lecture sur les tables, plus de dépôt anonyme de photos | — |

Règles :
- ne jamais modifier un fichier déjà appliqué en production : écrire le suivant (`002_…`) ;
- chaque fichier doit pouvoir être relancé sans erreur ;
- tester avec `tests/verifier_sql.sh` avant la Pull Request ;
- compléter le tableau ci-dessus (date) à chaque mise en production.

Après la migration 003, les inscriptions sont **fermées** : les ouvrir depuis l'espace organisateurs (tableau de bord → Ouverture des inscriptions) le jour J, après les vérifications de l'issue #25.
