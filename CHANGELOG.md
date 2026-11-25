# Journal des versions

Toutes les modifications notables de l'application, de la plus récente à la plus ancienne.
Format : chaque version liste ce qui a été **ajouté**, **modifié**, **corrigé**, et les **migrations** de base de données à appliquer.
Numérotation : `vMAJEUR.MINEUR.CORRECTIF` (par exemple v1.1.2 = deuxième correctif de la version 1.1).

## [Non publié]

Ce qui est fusionné dans `develop` mais pas encore en production. Chaque Pull Request ajoute sa ligne ici.

### Ouverture des inscriptions et anti-doublons — #29, #28
- Interrupteur d'ouverture dans l'espace organisateurs (tableau de bord) : ouvertes / fermées, quota de la vague, message affiché quand c'est fermé. **Fermées par défaut** à l'installation. Sert aussi à suspendre en cas d'incident.
- Quota exact même sous forte affluence (créations sérialisées par un verrou) ; « Complet » affiché quand il est atteint ; « Plus que N places » sous 300 places.
- Clé d'envoi tirée par l'appli pour chaque formulaire : un double clic ou un nouvel essai après une coupure réseau renvoie la même référence au lieu de créer une seconde inscription.
- Même personne (nom, prénom, date de naissance, sans tenir compte de la casse ni des espaces) refusée si elle a déjà une inscription non annulée.
- Un identifiant de transaction Mobile Money ne peut être déclaré qu'une fois (inscriptions et dons confondus, par opérateur) ; index uniques en dernier recours.
- Tests SQL `tests/verifier_003.sql` et scénarios de démonstration ajoutés à `tests/verifier_demo.py`.
- Migration `003_ouverture_et_doublons.sql`.

### Données personnelles (loi n° 2024/017) — #6
- Inscription : e-mail obligatoire, ville plus demandée.
- Texte de consentement complet (finalités, hébergement en Europe, prestataires, effacement des coordonnées au plus tard trois mois après la course, données gardées pour les résultats, contact) ; chaque version conservée (`consentements_textes`), version et horodatage enregistrés avec l'inscription ; version inconnue refusée.
- Accord d'un parent ou représentant légal obligatoire pour les moins de 18 ans le jour de la course (appli et base) ; âge minimum de 10 ans apprécié le jour de la course.
- Effacement des coordonnées après la course : par l'équipe depuis l'espace organisateurs, ou automatiquement le 10 octobre 2027 si `pg_cron` est activé.
- Entrées malformées (date, don) refusées avec un message clair ; droits des fonctions explicites ; `search_path = public, pg_temp`.
- Tests SQL `tests/verifier_002.sql` : dates frontières de la majorité, compte non-staff refusé, droits effectifs.
- Migration `002_donnees_personnelles.sql`.

## [v0.9.0] — 2026-11-25

Premier prototype complet, en mode démonstration.

### Ajouté
- Appli web installable (PWA), sans étape de construction : `index.html`, `css/app.css`, `js/`.
- Deux moteurs de données avec la même interface : Supabase (production) et démonstration (stockage du navigateur).
- Inscription, paiement Mobile Money validé par l'équipe, dossard avec QR code, retrait par scan.
- Trois épreuves : 3 km marche écologique et familiale, 5 km course populaire, 10 km défi sportif.
- Parcours proposés (boulevard du 20 Mai → Musée national) : `js/parcours.js`, fichiers GPX et GeoJSON dans `parcours/`.
- Carte OpenStreetMap (Leaflet), suivi en direct avec accord, fil photos modéré.
- Résultats, Fonds de solidarité, dons, boutique, bénévoles, formations, impact, espace organisateurs.
- Tests : `tests/verifier_demo.py` (écrans sans erreur), `tests/verifier_sql.sh` (migrations).

### Modifié
- L'événement s'appelle désormais **10 KM de Yaoundé 2027** (au lieu de 20 KM) ; les distances passent de 5 / 10 / 20 km à 3 / 5 / 10 km.

### Migrations
- `001_schema_initial.sql` : schéma complet (tables, sécurité, fonctions, dossier de photos).
