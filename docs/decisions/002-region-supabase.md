# ADR 002 — Région d'hébergement des projets Supabase

- **Statut :** proposée — à accepter après les mesures depuis Yaoundé (issue #31)
- **Date :** 25 novembre 2026
- **Décidée par :** Gédéon (Product Owner et Tech Lead), sur la base des mesures

## Contexte

L'ADR 001 retient Supabase. Les coureurs s'inscriront surtout depuis Yaoundé, sur téléphone, par MTN ou Orange.

Faits vérifiés le 25 novembre 2026 sur la documentation de Supabase (*Platform › Regions*) :
- **aucune région en Afrique** : les plus proches sont en Europe (Paris `eu-west-3`, Francfort `eu-central-1`, Londres `eu-west-2`, Irlande `eu-west-1`, Zurich `eu-central-2`, Stockholm `eu-north-1`), puis São Paulo (`sa-east-1`) ;
- **la région ne peut pas être changée** après la création d'un projet : il faudrait migrer vers un nouveau projet ;
- la région fixe aussi l'endroit où les données sont stockées ; les régions « générales » (« Europe ») peuvent tomber à Londres ou Zurich, hors UE.

Le Cameroun est relié à l'Europe par plusieurs câbles sous-marins (WACS, SAT-3, et d'autres liaisons via Kribi), mais la route réelle dépend de chaque opérateur : seule une mesure depuis Yaoundé le dit.

Côté droit, la loi n° 2024/017 soumet le transfert de données hors du Cameroun à une autorisation préalable de l'APDP, **quelle que soit la région européenne choisie** (voir #6). La région ne change donc pas la démarche juridique, mais un pays de l'UE (RGPD) donne un cadre de protection plus facile à présenter.

## Décision proposée

1. **Une région précise de l'UE, jamais une région générale** : Paris, Francfort ou Irlande. Londres, Zurich et São Paulo sont écartées sauf écart de mesure très important.
2. **Règle de choix, fixée avant les mesures** : on retient la région de l'UE dont la **médiane** mesurée depuis Yaoundé est la plus basse, MTN et Orange confondus, sur au moins **6 mesures** (deux opérateurs, trois moments de la journée). Si deux régions sont à moins de **20 ms** l'une de l'autre, on retient **Paris** : c'est la plus proche de Bruxelles, où se trouve l'équipe technique.
3. **Valeur par défaut si les mesures n'arrivent pas à temps : Paris (`eu-west-3`).**
4. **La même région pour le projet de test et pour la production**, pour que les tests de charge (#7) mesurent ce que vivront les coureurs.

## Comment mesurer

Outil : **`outils/latence.html`**, publié avec l'appli (aperçu de la PR, puis site de test) :
<https://eric74song96.github.io/odyssee-connect/outils/latence.html> (après fusion).

Une personne à Yaoundé l'ouvre sur son téléphone, sans VPN, choisit son opérateur et lance la mesure (une minute). L'outil interroge le service « ping » public d'AWS dans chaque région (même méthode que cloudping.info), garde la médiane de 8 essais, puis propose de copier le résultat pour WhatsApp. On reporte chaque résultat dans l'issue #31.

Limites : la mesure porte sur l'aller-retour réseau jusqu'à la région, pas sur le temps de réponse de Supabase lui-même ; un test d'inscription réel sur le projet de test complète la mesure avant la production.

## Conséquences

- ✅ Le choix est rapide à trancher et vérifiable par n'importe qui (la règle est écrite avant les chiffres).
- ✅ La demande à l'APDP (#6) peut déjà nommer le pays d'hébergement par défaut, et sera mise à jour si les mesures en désignent un autre.
- ⚠️ Irréversible sans migration : la création du projet de production (#1) attend l'acceptation de cette ADR.
- ⚠️ Les coupures de câbles sous-marins (déjà survenues en 2020 et 2024) touchent toutes les régions de la même façon : c'est le plan B hors ligne (#16) et la procédure d'incident (#30) qui y répondent, pas le choix de la région.
