# Migrations de la base de données

Chaque fichier modifie la base Supabase. On les applique **dans l'ordre des numéros**,
dans *Supabase > SQL Editor*, d'abord sur la base de **test**, puis sur la **production**.

| Fichier | Contenu | Appliqué en production |
|---|---|---|
| `001_schema_initial.sql` | Schéma complet : tables, règles de sécurité, fonctions, dossier de photos | — |
| `002_donnees_personnelles.sql` | E-mail obligatoire, accord parental des mineurs, version du consentement, anonymisation après la course | — |

Règles :
- ne jamais modifier un fichier déjà appliqué en production : écrire le suivant (`002_…`) ;
- chaque fichier doit pouvoir être relancé sans erreur ;
- tester avec `tests/verifier_sql.sh` avant la Pull Request ;
- compléter le tableau ci-dessus (date) à chaque mise en production.
