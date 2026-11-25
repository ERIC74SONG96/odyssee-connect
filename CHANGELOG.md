# Journal des versions

Toutes les modifications notables de l'application, de la plus récente à la plus ancienne.
Format : chaque version liste ce qui a été **ajouté**, **modifié**, **corrigé**, et les **migrations** de base de données à appliquer.
Numérotation : `vMAJEUR.MINEUR.CORRECTIF` (par exemple v1.1.2 = deuxième correctif de la version 1.1).

## [Non publié]

Ce qui est fusionné dans `develop` mais pas encore en production. Chaque Pull Request ajoute sa ligne ici.

### Audit de sécurité du SQL — #26
- Une inscription non payée ne garde sa place que jusqu'à sa **date limite de paiement** (création + 48 h par défaut, réglable dans l'espace organisateurs pour les inscriptions suivantes). Sans cela, des inscriptions abandonnées ou envoyées en masse pouvaient remplir le quota sans payer.
- Déclaration de paiement : verrous dans le même ordre que la création ; une inscription annulée ou payée ne peut plus repasser en « paiement déclaré » ; une ancienne référence expirée ne peut pas être payée si la même personne s'est réinscrite.
- Test de charge `tests/test_de_charge.sh` (#7) et index pour tenir la charge : 3 000 places sous 4 000 envois simultanés, ~500 inscriptions/s en local.
- Écran de paiement : « Votre place est réservée pendant 48 h : payez avant le… » ; message clair si le délai est dépassé.
- Espace organisateurs : places tenues, inscriptions hors délai signalées, réglage du délai.
- Tables : `anon` et `authenticated` n'ont plus que la lecture (filtrée par la RLS) ; plus de droit sur les séquences ; plus de dépôt anonyme de photos.
- Rapport : `docs/securite/audit-sql-2026-11-25.md`. Tests `tests/verifier_004.sql` (avec les droits par défaut de Supabase reproduits dans `tests/mock_supabase.sql`) et scénario ajouté à `tests/verifier_demo.py`.
- Migration `004_audit_securite.sql`.

### Ouverture des inscriptions et anti-doublons — #29, #28
- Interrupteur d'ouverture dans l'espace organisateurs (tableau de bord) : ouvertes / fermées, quota de la vague, message affiché quand c'est fermé. **Fermées par défaut** à l'installation. Sert aussi à suspendre en cas d'incident.
- Quota exact même sous forte affluence (créations sérialisées par un verrou) ; « Complet » affiché quand il est atteint ; « Plus que N places » sous 300 places.
- Clé d'envoi tirée par l'appli pour chaque formulaire : un double clic ou un nouvel essai après une coupure réseau renvoie la même référence au lieu de créer une seconde inscription.
- Même personne (nom, prénom, date de naissance, sans tenir compte de la casse ni des espaces) refusée si elle a déjà une inscription non annulée.
- Un identifiant de transaction Mobile Money ne peut être déclaré qu'une fois (inscriptions et dons confondus, par opérateur) ; index uniques en dernier recours.
- Même clé d'envoi avec des données modifiées : refus avec la référence déjà créée (seul l'appareil qui a rempli le formulaire la connaît) ; clé gardée pour la session de l'onglet ; effacée avec les coordonnées après la course.
- Avertissement dans l'espace organisateurs si le quota est inférieur aux inscriptions déjà faites.
- Tests SQL `tests/verifier_003.sql`, test de concurrence réel `tests/verifier_concurrence.sh` (20 envois simultanés pour 5 places ; même transaction déclarée en parallèle pour une inscription et un don), scénarios de démonstration ajoutés à `tests/verifier_demo.py`.
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
