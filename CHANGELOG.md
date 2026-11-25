# Journal des versions

Toutes les modifications notables de l'application, de la plus récente à la plus ancienne.
Format : chaque version liste ce qui a été **ajouté**, **modifié**, **corrigé**, et les **migrations** de base de données à appliquer.
Numérotation : `vMAJEUR.MINEUR.CORRECTIF` (par exemple v1.1.2 = deuxième correctif de la version 1.1).

## [Non publié]

Ce qui est fusionné dans `develop` mais pas encore en production. Chaque Pull Request ajoute sa ligne ici.

### Ajouté (documentation uniquement, aucun déploiement)
- Décision d'architecture ADR 001 : Supabase comme backend de la v1 (`docs/decisions/`).
- Règles de l'équipe, procédure d'incident et fiche de passation pour les assistants d'IA (`docs/equipe/`).

### Modifié
- Feuille de route : ouverture des inscriptions visée le 1er décembre 2026, sous conditions (juridique, sécurité, protocole de paiement, répétition générale) ; plan de repli ; paiement automatique visé pour février 2027.

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
