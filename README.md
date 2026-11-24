# Odyssée Connect · version 2 (plateforme communautaire)

Application officielle de **L'Odyssée de l'environnement au Cameroun** pour les **10 KM de Yaoundé 2027**.

Elle s'ouvre dans le navigateur du téléphone et s'installe sur l'écran d'accueil comme une application. Il n'y a rien à télécharger depuis un magasin d'applications.

## Ce que fait la plateforme

Odyssée Connect est la plateforme de la communauté Odyssée, pas seulement l'application de la course. Elle a cinq onglets : **Accueil, Événements, Actions, Communauté, Profil**.

**Les 12 modules, accessibles depuis l'accueil**

| Module | Ce qu'on y fait |
|---|---|
| Événements | Les 10 KM de Yaoundé, le Brussels Green Hackathon, les forums, les ateliers. Filtres « à venir » et « passés », inscription dans l'appli ou par un lien externe. |
| Inscription 10 KM | Distance, profil, paiement Mobile Money, dossard avec QR code. Plusieurs inscriptions possibles sur un même téléphone. |
| Parcours | Carte de chaque distance, publiée dès que le tracé est validé (`config.parcours`). |
| Actions | Collectes, reboisement, recyclage, sensibilisation. Bouton « Je participe », avec un nombre de places si besoin. |
| Communauté | Ambassadeurs, bénévoles, groupes locaux, propositions de projets, demandes de partenariat. |
| Résultats | Classements par distance, chez les hommes et chez les femmes, et recherche par dossard ou par nom. |
| Impact | Déchets collectés, arbres plantés, personnes sensibilisées, participants, bénévoles, Fonds. **Uniquement des chiffres saisis par l'équipe, jamais estimés.** |
| Boutique | Précommande de la tenue et produits partenaires. |
| Partenaires | Sponsoring, mécénat, appel à projets, produits partenaires. |
| Solidarité | Jauge du Fonds, publics aidés, dons. |
| Formations | Guides, vidéos et quiz. Un quiz réussi à 70 % donne une attestation. |
| Actualités | Annonces de l'équipe. |

**Profil**
- Mes inscriptions et mon dossard, mes participations, mes résultats.
- Les badges : coureur solidaire, éco-citoyen, cœur généreux, esprit vert, engagé.
- Mes formations et attestations.
- Paramètres.

Les données du profil sont gardées sur le téléphone. Les comptes en ligne viendront plus tard.

**Espace organisateurs** : 14 rubriques.
- Tableau de bord.
- Événements et actions : création, publication, et bilan à remplir après l'action.
- Participations : suivi des présences.
- Inscriptions 10 KM et validation des paiements.
- Retrait des dossards, avec scan du QR code.
- Dons.
- Boutique.
- Bénévoles.
- Ambassadeurs et demandes.
- Groupes locaux.
- Formations, avec un éditeur de quiz simple.
- Actualités.
- Résultats.
- Fonds.

La plupart des listes s'exportent en CSV.

### Carte interactive
- **En production**, la carte s'appuie sur OpenStreetMap (bibliothèque Leaflet, fournie dans `js/vendor/leaflet`). Elle affiche :
  - les événements et les actions à venir qui ont une latitude et une longitude (onglet « Événements et actions ») ;
  - les points de collecte (onglet « Carte et suivi ») ;
  - les coureurs en direct.
- **Suivi en direct :** l'équipe l'ouvre le jour de la course (onglet « Carte et suivi »).
  - Il se ferme tout seul après 8 heures, et toutes les positions sont alors effacées.
  - Un coureur ne partage sa position que s'il coche l'accord et appuie sur « Partager ma position ». Seuls son prénom et son numéro de dossard sont affichés.
  - Les positions sont envoyées toutes les 20 secondes et disparaissent de la carte au bout de 3 minutes sans mise à jour.
- **Fond de carte :** les serveurs d'OpenStreetMap sont gratuits mais réservés à un usage modéré. Pour le jour de la course, avec beaucoup de visiteurs, prévoyez un fournisseur de fond de carte, par exemple MapTiler ou Stadia Maps, qui ont des offres gratuites ou peu chères. Il suffit de changer l'adresse des tuiles dans `js/app.js` (recherchez `tile.openstreetmap.org`).
- **En démonstration**, un plan simulé avec des coureurs animés remplace la carte, car claude.ai bloque les images venant d'autres sites.

### Fil d'actualité
- Chaque membre peut :
  - publier une photo, prise avec l'appareil ou choisie dans la galerie, avec une description, un lieu, une catégorie et un événement lié ;
  - aimer une publication, la commenter, la partager ou la signaler.
- **Modération :** toute photo est vérifiée par l'équipe avant d'apparaître (onglet « Fil et photos »). La personne qui publie voit sa photo avec la mention « En attente ». Trois signalements masquent automatiquement une publication en attendant l'équipe.
- **Photos :** elles sont réduites dans le téléphone (1 600 pixels maximum, JPEG) puis stockées dans Supabase Storage, dans un dossier public nommé `photos`. la migration `001_schema_initial.sql` crée ce dossier et ses règles.
- **Limites :** 10 publications par jour et 20 commentaires par heure par téléphone.
- **Charte :** pas d'enfant reconnaissable sans l'accord de ses parents, pas de photo d'une personne qui ne l'a pas accepté. La case à cocher le rappelle avant chaque publication.

### Écrire un quiz

```
? Que faire des épluchures ?
- Les brûler
* Les composter
> Le compost devient un engrais naturel.
```
Le « ? » marque une question, le « - » une mauvaise réponse, le « * » la bonne réponse et le « > » l'explication affichée après la réponse.

### Saisir l'impact
Après chaque action, ouvrez l'événement dans « Événements et actions » et remplissez le bloc **Bilan** :
- les kilos de déchets, pesés sur place ;
- les arbres plantés ;
- les personnes sensibilisées ;
- un court compte rendu.

Les compteurs de l'écran « Impact » se mettent à jour tout seuls. Les participants présents, les bénévoles retenus et les ambassadeurs acceptés sont comptés à partir des suivis faits dans l'espace organisateurs.

## Deux modes

| Mode | Quand | Données |
|---|---|---|
| **Démonstration** | `supabaseUrl` vide dans `js/config.js` | Gardées dans le navigateur de chaque appareil. Mot de passe de l'équipe : `odyssee2027`. |
| **Production** | `supabaseUrl` et `supabaseAnonKey` remplis | Base Supabase partagée, sécurisée, avec de vrais comptes pour l'équipe. |

## Mise en ligne (environ une heure)

### 1. Créer la base de données
1. Créer un compte sur supabase.com, de préférence avec l'adresse e-mail de l'association.
2. Créer un projet « odyssee-connect ». Le plan gratuit suffit pour démarrer.
   Choisir la région la plus proche. **Attention :** la loi camerounaise n° 2024/017 demande une autorisation de l'Autorité de protection des données pour stocker des données personnelles hors du Cameroun. Faites cette démarche avant d'ouvrir les inscriptions.
3. Ouvrir *SQL Editor* puis *New query*. Coller le contenu de chaque fichier de `supabase/migrations/`, dans l'ordre des numéros, et cliquer sur *Run* pour chacun.

### 2. Créer les comptes de l'équipe
1. Ouvrir *Authentication*, puis *Sign In / Providers*, puis *Email*. **Désactiver « Allow new users to sign up »**, pour que personne d'autre ne puisse créer de compte.
2. Ouvrir *Authentication*, puis *Users*, puis *Add user*. Créer un compte par membre de l'équipe, avec un mot de passe solide.
3. Dans *SQL Editor*, donner l'accès à chaque membre :
   ```sql
   insert into public.staff (user_id, nom)
   select id, 'Gédéon' from auth.users where email = 'adresse@exemple.org';
   ```

### 3. Régler l'application
Dans `js/config.js` :
- `supabaseUrl` et `supabaseAnonKey` : à copier depuis Supabase (*Project Settings*, puis *API*). La clé « anon » est faite pour être publique : la sécurité repose sur les règles de la base.
- `mobileMoney.mtn.numero` et `mobileMoney.orange.numero` : les numéros marchands de l'association.
- `boutique.articles[].prix` : les prix en FCFA. Laisser `null` affiche « Prix à venir ».
- `partenaires` : passer `exemple: false` seulement quand l'accord écrit du partenaire est signé.
- `contact` : l'e-mail et le téléphone de l'organisation.

Les tarifs réellement facturés se règlent dans la base, table `tarifs`. Si vous les changez, modifiez aussi `distances[].tarifs` dans `config.js` pour que l'affichage corresponde.

### 4. Héberger
Le dossier est un site statique. Il n'y a rien à compiler. Trois façons de l'héberger :
- **Netlify Drop** (app.netlify.com/drop) : glisser le dossier. L'adresse est en ligne en une minute.
- **L'hébergement de odyssee-env.org** : envoyer le dossier par FTP, par exemple dans `/app`.
- Tout autre hébergeur de sites statiques : GitHub Pages, Cloudflare Pages, etc.

Le **HTTPS est obligatoire** pour que l'application s'installe sur l'écran d'accueil et fonctionne hors connexion.

### 5. Vérifier avant l'ouverture
- [ ] Faire une inscription test sur un vrai téléphone.
- [ ] Payer 100 FCFA, déclarer le paiement, le valider dans l'espace organisateurs, vérifier que le dossard s'affiche.
- [ ] Faire un don test, le valider, vérifier que la jauge monte.
- [ ] Faire une précommande test.
- [ ] Exporter les inscriptions en CSV.
- [ ] Supprimer les données de test (*Table Editor*), puis remettre le Fonds à zéro (onglet *Fonds*).

## Fichiers

```
index.html               page de l'application
css/app.css              styles
js/config.js             réglages (seul fichier à modifier)
js/data.js               accès aux données (Supabase ou démonstration)
js/app.js                écrans et logique
js/vendor/qrcode.min.js  génération des QR codes (licence MIT)
js/vendor/jsQR.js        lecture des QR codes par la caméra (licence Apache 2.0)
js/vendor/leaflet/       carte interactive (licence BSD-2)
images/, icons/          visuels
manifest.webmanifest     installation sur l'écran d'accueil
sw.js                    fonctionnement hors connexion
supabase/migrations/     base de données, règles de sécurité et fonctions (fichiers numérotés)
tests/                   vérifications (écrans en mode démo, migrations)
ROADMAP.md               où en est le projet et où il va
CHANGELOG.md             ce qui a changé, version par version
CONTRIBUTING.md          branches, commits, revues, mises en production
```

## Sécurité

- Le public ne lit jamais les tables. Il passe par des fonctions qui contrôlent chaque champ : téléphone, dates, montants, longueurs.
- **Le montant d'une inscription est calculé par la base**, jamais envoyé par le téléphone.
- Un coureur ne voit son inscription qu'avec sa référence **et** son téléphone.
- Seuls les comptes listés dans `staff` lisent les données et valident les paiements.
- Un même numéro est limité à 6 inscriptions, pour les familles.

## Limites de la version 1, et suite prévue

1. **Paiement :** l'équipe vérifie chaque paiement à la main, avec l'identifiant de transaction, dans l'historique Mobile Money de l'association. Prochaine étape : brancher un agrégateur de paiement camerounais pour confirmer les paiements automatiquement. Il faudra un contrat marchand au nom de l'association.
2. **SMS :** aucun SMS n'est envoyé. Le coureur garde sa référence, qui s'affiche aussi dans « Mon dossard » sur son téléphone.
3. **Chronométrage :** l'appli publie les temps mais ne les mesure pas. Ils viennent du chronométreur (puces ou relevé manuel) et sont importés après la course.
4. **Langue :** la plateforme est en français. La version anglaise suivra.
5. **Comptes en ligne :** pour l'instant, le profil est gardé sur le téléphone. Les comptes, avec connexion par code SMS ou par e-mail, permettront de retrouver son historique sur un autre appareil. Les SMS ont un coût par envoi.
6. **Forums :** ils ne sont pas encore inclus, car il faut prévoir la modération. En attendant, les groupes locaux (WhatsApp, Telegram) servent de lieu d'échange.
7. **Suivi GPS des coureurs en direct :** il demande des puces de chronométrage ou l'application du coureur ouverte pendant toute la course, ce qui vide la batterie. Mieux vaut le prévoir avec le prestataire de chronométrage.
8. **Magasins d'applications :** la même application peut être publiée sur Google Play, puis sur l'App Store. Il faut d'abord des comptes développeur au nom de l'association.

## Travailler à plusieurs

Lire [`CONTRIBUTING.md`](CONTRIBUTING.md) avant de commencer, et [`ROADMAP.md`](ROADMAP.md) pour savoir où en est le projet.
