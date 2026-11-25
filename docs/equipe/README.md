# L'équipe et ses règles de travail

## Qui fait quoi

| Membre | Rôle |
|---|---|
| **Gédéon** (humain) | Product Owner et Tech Lead : choisit les tâches, tranche les décisions, lance le code, **fusionne** les Pull Requests. Seul à pouvoir fusionner. |
| **Claude** | Développement de l'appli et de la base (migrations, règles de sécurité), tests. |
| **ChatGPT** | Relecture des Pull Requests, cas de test, documentation utilisateur. |
| **Gemini** | Deuxième relecture sur les sujets sensibles (sécurité, paiement, données personnelles), recherches, relecture des textes. |

La répartition peut changer d'une tâche à l'autre. La règle fixe : **celui qui écrit ne relit pas son propre travail.**

## Les règles

1. **Une seule source de vérité : ce dépôt.** Ce qui n'est pas dans le dépôt (issue, Pull Request, ADR, ROADMAP) n'existe pas pour l'équipe.
2. **Les assistants ne se parlent pas et n'ont pas de mémoire commune.** Chaque conversation commence par la [fiche de passation](fiche-de-passation.md).
3. **Une tâche = une issue = un assistant = une branche.** Deux assistants ne modifient pas les mêmes fichiers en même temps.
4. **Les décisions d'architecture sont dans [`docs/decisions/`](../decisions/).** Un assistant ne les remet pas en cause dans le code ; il propose une nouvelle ADR.
5. **Les vérifications automatiques tranchent.** Rouge = pas de fusion, quel que soit l'auteur.
6. **Un humain relit et assume** chaque ligne qui part en production.
7. **Aucune donnée réelle de participant et aucune clé secrète** ne sont données à un assistant ni écrites dans le dépôt.

## Le circuit d'une tâche

```
Issue (Gédéon choisit)
  → fiche de passation à l'assistant qui développe
  → branche feature/<n°>-<sujet>, code, tests
  → Pull Request vers develop
  → vérifications automatiques
  → relecture par un autre assistant (Gédéon lui donne le lien ou le diff)
  → corrections
  → Gédéon teste et fusionne
  → test sur l'adresse de test, carte déplacée dans le tableau
```
