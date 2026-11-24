# Travailler sur Odyssée Connect

Ce guide dit comment l'équipe s'organise : branches, commits, revues, base de données et mises en production.
Pour savoir **où en est le projet**, lire [`ROADMAP.md`](ROADMAP.md) et le tableau du projet sur GitHub.
Pour savoir **ce qui a changé**, lire [`CHANGELOG.md`](CHANGELOG.md).

## 1. Lancer l'appli sur son ordinateur

Aucune installation n'est nécessaire : l'appli est faite de fichiers HTML, CSS et JavaScript.

```bash
git clone <adresse du dépôt>
cd odyssee-connect
python3 -m http.server 8765
```

Ouvrir http://localhost:8765. Avec `supabaseUrl` vide dans `js/config.js`, l'appli tourne en **mode démonstration** :
les données restent dans le navigateur, rien n'est envoyé. C'est le mode à utiliser pour développer.

> Ne jamais mettre dans un commit les clés du projet Supabase de **production** ni de vraies données de participants.

## 2. Les branches

| Branche | Rôle | Qui y écrit |
|---|---|---|
| `main` | Version en ligne, utilisée par les participants. Chaque mise en production porte une étiquette (`v1.0.0`…). | Personne directement : fusion depuis `develop` par Pull Request |
| `develop` | Prochaine version, déployée sur l'adresse de **test** avec la base Supabase de test. | Fusion des branches de travail par Pull Request |
| `feature/<sujet>` | Une nouvelle fonction. Part de `develop`. | Le développeur |
| `fix/<sujet>` | Une correction non urgente. Part de `develop`. | Le développeur |
| `hotfix/<sujet>` | Une urgence en production. Part de `main`, refusionnée dans `main` **et** `develop`. | Le responsable technique |
| `docs/<sujet>` | Documentation seulement. | Tout le monde |

Règles :
- **une tâche = une issue = une branche**. Le nom de la branche reprend le numéro de l'issue : `feature/42-paiement-mobile-money` ;
- une branche vit **deux semaines au plus** ; au-delà, découper la tâche ;
- mettre sa branche à jour souvent : `git pull --rebase origin develop` ;
- noms en minuscules, sans accents, mots séparés par des tirets.

```bash
git switch develop && git pull
git switch -c feature/42-paiement-mobile-money
# … travail, commits …
git push -u origin feature/42-paiement-mobile-money   # puis ouvrir une Pull Request vers develop
```

## 3. Les messages de commit

Format : `type(module): ce qui change`, à l'infinitif ou au présent, en français.

| Type | Usage |
|---|---|
| `feat` | nouvelle fonction |
| `fix` | correction |
| `db` | migration de base de données |
| `ui` | apparence, textes, mise en page |
| `docs` | documentation |
| `test` | tests |
| `chore` | maintenance (outils, dépendances) |

Modules : `inscription`, `paiement`, `dossard`, `parcours`, `carte`, `fil`, `resultats`, `fonds`, `boutique`, `admin`, `communaute`, `formations`, `config`.

Exemples :
```
feat(paiement): confirmer le paiement MTN MoMo via l'agrégateur
fix(dossard): agrandir le QR code à l'impression
db(inscriptions): ajouter la colonne club
```

## 4. Les Pull Requests

- Ouvrir la Pull Request **tôt**, en brouillon, pour que l'équipe voie le travail en cours.
- Remplir le modèle : quoi, pourquoi, comment tester, captures d'écran.
- Au moins **une relecture** par une autre personne avant la fusion.
- Les vérifications automatiques (onglet *Actions*) doivent être vertes.
- Ajouter une ligne dans `CHANGELOG.md`, rubrique *Non publié*.
- Fusionner en *Squash and merge* vers `develop` : un commit propre par tâche.

## 5. La base de données

Toutes les modifications de la base passent par des fichiers numérotés dans `supabase/migrations/` :

```
001_schema_initial.sql
002_<sujet>.sql
003_<sujet>.sql
```

- **Ne jamais modifier une migration déjà appliquée en production.** Pour changer quelque chose, écrire une nouvelle migration.
- Une migration doit pouvoir être relancée sans erreur (`create … if not exists`, `create or replace`, `drop … if exists`).
- La tester localement et en intégration continue avec `tests/verifier_sql.sh`.
- L'appliquer d'abord sur la base de **test**, puis sur la **production** au moment de la mise en production.
- Pour une base neuve : exécuter tous les fichiers dans l'ordre.

## 6. Tester avant de demander une revue

```bash
# Syntaxe JavaScript
for f in js/*.js sw.js; do node --check "$f"; done

# Écrans en mode démonstration (Playwright)
pip install playwright && python3 -m playwright install chromium
python3 -m http.server 8765 &
python3 tests/verifier_demo.py

# Migrations (sur un PostgreSQL local vide)
PGDATABASE=odyssee_test tests/verifier_sql.sh
```

Penser aussi à :
- vider le cache de l'appli quand on change un fichier : augmenter le numéro `CACHE` dans `sw.js` ;
- tester sur un **petit téléphone Android** avec une connexion lente, comme beaucoup de participants.

## 7. Mettre en production

1. Vérifier que `develop` fonctionne sur l'adresse de test.
2. Ouvrir une Pull Request `develop` → `main` intitulée « Version vX.Y.Z ».
3. Dans `CHANGELOG.md`, renommer *Non publié* en `[vX.Y.Z] — date`.
4. Appliquer les nouvelles migrations sur la base de **production**.
5. Fusionner, puis poser l'étiquette :
   ```bash
   git switch main && git pull
   git tag -a v1.0.0 -m "Ouverture des inscriptions"
   git push origin v1.0.0
   ```
6. Cocher les cases du jalon dans `ROADMAP.md` et fermer le jalon sur GitHub.

**Gel des changements** : deux semaines avant la course, seules les branches `hotfix/*` sont acceptées.

## 8. Le tableau du projet sur GitHub

Colonnes : *À faire* → *En cours* → *En revue* → *Testé sur develop* → *En production*.

- Chaque carte est une issue, rattachée à un **jalon** (v1.0, v1.1, v1.2, v2) et à une **étiquette de module**.
- Une issue *En cours* a toujours une personne assignée et une branche.
- En réunion du lundi : on choisit les issues de la semaine dans le jalon en cours.
