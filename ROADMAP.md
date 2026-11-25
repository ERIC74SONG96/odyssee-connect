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

Mettre la v0.9 en ligne pour de vrai, sans nouvelle fonction. Backend : Supabase ([ADR 001](docs/decisions/001-supabase-backend.md)).
Le paiement reste **validé à la main** par l'équipe à l'ouverture ; le paiement automatique arrive avec la v1.1.

- [ ] Créer les projets Supabase **test** et **production**, appliquer les migrations
- [ ] Héberger l'appli sur un nom de domaine (production et test)
- [ ] Renseigner `js/config.js` : numéros Mobile Money, contact, prix de la boutique
- [ ] Confirmer les tarifs (le 3 km est provisoire) et les plages de dossards
- [ ] Créer les comptes de l'équipe organisatrice (table `staff`)
- [ ] Mentions légales et protection des données (loi camerounaise) relues
- [ ] Test de charge : quelques milliers d'inscriptions simultanées sur la base de test
- [ ] Choisir un fournisseur de tuiles de carte pour le jour J (la politique d'OpenStreetMap limite l'usage de ses serveurs)

## 🔜 v1.1 — Paiement automatique (cible : février 2027)

- [ ] Choisir un agrégateur de paiement Mobile Money camerounais (contrat marchand au nom de l'association)
- [ ] Paiement automatique MTN MoMo et Orange Money, confirmation sans validation manuelle
- [ ] SMS de confirmation (référence ODY…, numéro de dossard)
- [ ] Ouverture des paliers suivants (5 000, puis 10 000 places) depuis l'espace organisateurs

## 🔜 v1.2 — Jour J (cible : mi-juin 2027, avant le gel)

- [ ] Import des temps du chronométreur dans les résultats
- [ ] Parcours définitifs après mesure officielle et validation des autorités
- [ ] Carte en direct testée en conditions réelles (répétition sur le parcours)
- [ ] Plan B hors ligne : listes papier, dossards préimprimés
- [ ] Astreinte technique le jour J (deux personnes)

## 💡 v2 — Plateforme communautaire (après la course)

- [ ] Vrais comptes en ligne (aujourd'hui le profil est gardé sur le téléphone)
- [ ] Version anglaise
- [ ] Événements dans d'autres villes et pays
- [ ] Badges et éco-actions reliés aux participations réelles
- [ ] Bilan d'impact publié depuis l'appli
