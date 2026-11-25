# Feuille de route — Odyssée Connect

Où en est l'application, et où elle va. À mettre à jour à la fin de chaque jalon.
Le détail des tâches est dans les *issues* GitHub, rangées par jalon (*milestones*).

**Repères du 10 KM de Yaoundé 2027** (date provisoire) :
- course : samedi 10 juillet 2027, départ à 8 h ;
- ouverture des inscriptions : **mardi 1er décembre 2026** ;
- gel des changements : deux semaines avant la course, vers le 26 juin 2027. Après cette date, seuls les correctifs urgents (`hotfix/*`) passent.

Les dates des jalons sont des cibles de travail, à ajuster en réunion d'équipe.
Les choix d'architecture sont dans [`docs/decisions/`](docs/decisions/) ; l'organisation de l'équipe dans [`docs/equipe/`](docs/equipe/).

---

## ✅ v0.9 — Prototype complet (fait, novembre 2026)

Version actuelle. Tout fonctionne en **mode démonstration** (données gardées dans le navigateur).

- Accueil, compte à rebours, 5 onglets : Accueil, Événements, Actions, Communauté, Profil
- Inscription aux trois épreuves (3 km marche écologique et familiale, 5 km course populaire, 10 km défi sportif), tarifs étudiant / travailleur, taille de t-shirt, don
- Paiement Mobile Money **validé à la main** par l'équipe ; dossard numérique avec QR code, impression en PDF
- Parcours proposés des trois épreuves (boulevard du 20 Mai → Musée national), fichiers GPX
- Carte (OpenStreetMap), suivi des coureurs en direct (avec accord, pendant la course seulement)
- Fil photos avec mentions « j'aime », commentaires, signalement et modération préalable
- Résultats et classements, Fonds de solidarité, dons, boutique, bénévoles, formations et quiz, impact
- Espace organisateurs : 16 onglets (inscriptions, retrait des dossards par scan, paiements, modération…)
- Base Supabase : tables, règles de sécurité (RLS), fonctions — `supabase/migrations/001_schema_initial.sql`

## 🔜 v1.0 — Ouverture des inscriptions (1er décembre 2026)

Mettre la v0.9 en ligne pour de vrai. Backend : Supabase ([ADR 001](docs/decisions/001-supabase-backend.md)).
Le paiement reste **validé à la main** par l'équipe à l'ouverture ; le paiement automatique arrive avec la v1.1.

- **Date cible d'ouverture publique :** mardi 1er décembre 2026.
- **Condition d'ouverture :** la liste ci-dessous est validée, y compris la validation juridique et la répétition générale. La date ne doit pas obliger à lancer un système insuffisamment testé.
- **Plan de repli :** si une condition manque, le 1er décembre ouvre une page d'information ou une liste d'attente **sans collecte de données personnelles sensibles**, et les inscriptions ouvrent dès que les conditions sont remplies.
- **Règle :** pas de collecte réelle tant que le parcours inscription → référence → paiement en attente → vérification par l'équipe → confirmation n'a pas été testé en production contrôlée.

- [ ] Créer les projets Supabase **test** et **production**, appliquer les migrations
- [ ] Héberger l'appli sur un nom de domaine (production et test)
- [ ] Renseigner `js/config.js` : numéros Mobile Money, contact, prix de la boutique
- [ ] Confirmer les tarifs (le 3 km est provisoire) et les plages de dossards
- [ ] Créer les comptes de l'équipe organisatrice (table `staff`)
- [ ] **Condition** — Conformité à la loi camerounaise n° 2024/017 vérifiée par un juriste : information des participants, registre des traitements, contrat avec Supabase, transfert hors du Cameroun (autorisation préalable de l'autorité de protection des données ?), analyse d'impact, consentement parental pour les mineurs
- [ ] **Condition** — Audit de sécurité du SQL : règles RLS, fonctions `security definer` (droits, `search_path`), règles du stockage des photos ; clé `service_role` jamais dans le navigateur
- [ ] **Condition** — Protocole de paiement manuel écrit : qui vérifie, à partir de quelle preuve (transaction vue sur le compte marchand, jamais une simple capture), qui valide, double validation impossible, paiements non identifiés et remboursements
- [ ] **Condition** — Pas de double inscription ni double paiement (double clic, réseau coupé pendant l'envoi)
- [ ] **Condition** — Interrupteur pour ouvrir ou suspendre les inscriptions et quota du premier palier (3 000 places)
- [ ] **Condition** — Procédure d'incident : suspendre les inscriptions, revenir à la version précédente, restaurer une sauvegarde, prévenir en cas de fuite de données ; export des inscriptions pour travailler hors ligne
- [ ] Données collectées réduites au nécessaire (contact d'urgence protégé, aucune donnée médicale)
- [ ] Séparation stricte test / production ; comptes de l'équipe nominatifs, sans mot de passe partagé
- [ ] Répétition générale depuis le Cameroun (MTN et Orange, petit téléphone Android, connexion instable)
- [ ] Test de charge : quelques milliers d'inscriptions simultanées sur la base de test
- [ ] Choisir la région Supabase (Paris, Francfort ou Londres) après mesures depuis Yaoundé sur MTN et Orange, à plusieurs moments et plusieurs jours → ADR 002
- [ ] Choisir un fournisseur de tuiles de carte pour le jour J (la politique d'OpenStreetMap limite l'usage de ses serveurs)

## 🔜 v1.1 — Paiement automatique (cible : février 2027)

- [ ] Choisir un agrégateur de paiement Mobile Money camerounais (contrat marchand au nom de l'association)
- [ ] Paiement automatique MTN MoMo et Orange Money, confirmation sans validation manuelle
- [ ] SMS de confirmation (référence ODY…, numéro de dossard)
- [ ] Ouverture des paliers suivants (5 000, puis 10 000 places) depuis l'espace organisateurs

## 🔜 v1.2 — Jour J (cible : mi-juin 2027, avant le gel)

- [ ] Import des temps du chronométreur dans les résultats
- [ ] Parcours définitifs après mesure officielle et validation des autorités
- [ ] Carte en direct testée en conditions réelles (répétition sur le parcours) ; consentement distinct, durée limitée, accès restreint
- [ ] Photos publiques : autorisation, modération, procédure de retrait, protection des mineurs
- [ ] Plan B hors ligne : listes papier, dossards préimprimés
- [ ] Astreinte technique le jour J (deux personnes)

## 💡 v2 — Plateforme communautaire (après la course)

- [ ] Vrais comptes en ligne (aujourd'hui le profil est gardé sur le téléphone)
- [ ] Version anglaise
- [ ] Événements dans d'autres villes et pays
- [ ] Badges et éco-actions reliés aux participations réelles
- [ ] Bilan d'impact publié depuis l'appli
