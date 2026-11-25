# ADR 001 — Supabase comme backend de la v1

- **Statut :** acceptée
- **Date :** 25 novembre 2026
- **Décidée par :** Gédéon (Product Owner et Tech Lead)

## Contexte

Odyssée Connect vise l'ouverture des inscriptions au 10 KM de Yaoundé 2027 **le 1er décembre 2026 (date cible, sous conditions)**, pour une course le samedi 10 juillet 2027.
Jusqu'à 10 000 participants sont visés, par paliers à partir de 3 000.

L'équipe compte un seul développeur humain, étudiant à côté du projet, aidé par trois assistants d'IA (Claude, ChatGPT, Gemini).
Le prototype v0.9 fonctionne déjà avec Supabase : base PostgreSQL, règles de sécurité (RLS), fonctions appelées par l'appli, stockage des photos.

Deux autres options ont été étudiées :
- réécrire le backend en **Java Spring Boot** ;
- garder Supabase et ajouter plus tard un **service Spring Boot séparé** pour le paiement.

## Décision

**Le backend de la v1 est Supabase.** Aucun serveur applicatif n'est écrit pour la course de 2027.

- Les données, la sécurité et la logique métier restent dans PostgreSQL : tables, règles RLS, fonctions `security definer`.
- Toute modification de la base passe par une migration numérotée dans `supabase/migrations/`.
- L'appli reste une application web installable (PWA), sans étape de construction.
- Le paiement automatique Mobile Money (jalon v1.1) sera écrit avec les outils de Supabase (fonctions Edge ou fonctions SQL appelées par l'agrégateur), sauf nouvelle décision.

## Raisons

1. **Le délai** : l'ouverture des inscriptions est visée pour le 1er décembre 2026. Le backend Supabase est écrit et testé ; une réécriture ne tiendrait pas ce délai.
2. **Une seule personne peut le tenir**, en parallèle de ses études : pas de serveur à louer, sécuriser, mettre à jour ou surveiller.
3. **La sécurité est appliquée au niveau de la base**, grâce aux règles RLS et à des fonctions contrôlées. Cette protection dépend de la configuration des politiques, des privilèges SQL (droits `EXECUTE`, `search_path` des fonctions `security definer`) et des règles du stockage des photos : elle doit être **auditée avant la mise en production**.
4. **Le coût est faible et maîtrisable** : offre Pro à partir de 25 $ par mois, hors éventuels coûts supplémentaires (calcul, stockage, trafic), avec plafond de dépenses et sauvegardes quotidiennes conservées 7 jours. Vérifier le coût réel avant la production.
5. **Ce choix ne ferme aucune porte** : la base est du PostgreSQL standard. Un backend Java pourra s'y brancher plus tard sans migrer les données.

## Conséquences

- ✅ La v1.0 se limite à la mise en ligne : projets Supabase test et production, hébergement, configuration.
- ✅ Les relectures portent surtout sur le SQL des migrations et les règles RLS : c'est là que se trouve la sécurité.
- ⚠️ La logique métier complexe en SQL demande de la rigueur : chaque fonction est testée par `tests/verifier_sql.sh` et relue avant fusion.
- ⚠️ Le projet dépend d'un prestataire (Supabase). En cas de besoin, la base peut être exportée (PostgreSQL standard).
- ⚠️ Les données sont hébergées hors du Cameroun (aucune région Supabase en Afrique). La loi camerounaise n° 2024/017 du 23 décembre 2024 sur les données personnelles encadre ces transferts : **aucune donnée réelle n'est collectée avant validation juridique** (issue dédiée). Le choix de la région fera l'objet de l'ADR 002, après mesures depuis Yaoundé.
- 🔁 **À revoir après la course** (v2) : un backend Spring Boot, complet ou par modules, pourra être proposé par une nouvelle décision (ADR 00X), qui remplacera celle-ci.

## Ce que les assistants d'IA doivent retenir

Ne pas proposer de réécrire le backend (Spring Boot, Node, Firebase…) pendant la v1.
Toute proposition contraire passe par une nouvelle ADR soumise au Tech Lead, pas par du code.
