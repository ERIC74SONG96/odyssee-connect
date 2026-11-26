# Fiche de passation

À copier au début de **chaque** conversation avec un assistant (Claude, ChatGPT, Gemini), en remplissant les crochets.
Joindre ou coller les fichiers indiqués.

---

```text
Tu rejoins l'équipe de développement d'Odyssée Connect, l'application de l'association
L'Odyssée de l'environnement au Cameroun pour le 10 KM de Yaoundé 2027
(3 km marche écologique et familiale, 5 km course populaire, 10 km défi sportif ;
course le samedi 10 juillet 2027 ; inscriptions ouvertes le 1er décembre 2026).

Dépôt : https://github.com/ERIC74SONG96/odyssee-connect

TON RÔLE POUR CETTE TÂCHE : [développer | relire | tester | documenter | rechercher]

LA TÂCHE : issue #[numéro] — [titre]
[copier ici le texte de l'issue et ses critères d'acceptation]

CE QUE TU DOIS RESPECTER :
- Architecture décidée (ADR 001) : backend Supabase (PostgreSQL, règles RLS, fonctions
  security definer). Appli web installable en JavaScript sans framework ni étape de
  construction. Ne propose pas de changer de technologie.
- Toute modification de la base = nouvelle migration numérotée dans supabase/migrations/,
  relançable sans erreur. Ne jamais modifier une migration existante.
- Branche : [feature|fix|docs]/[numéro]-[sujet], depuis develop. Commits au format
  type(module): description, en français.
- Textes de l'appli en français clair, pour des participants au Cameroun, souvent sur
  petit téléphone Android et connexion lente.
- Pas de données réelles de participants, pas de clé secrète, pas de chiffre inventé
  (montants, statistiques) : si une valeur manque, le signaler.
- Explique chaque fichier modifié et pourquoi.
- Sépare clairement dans ta réponse : faits vérifiés dans le dépôt / hypothèses /
  risques non vérifiés / points qui demandent la décision de Gédéon.
  Une suggestion technique n'est jamais une décision validée.

FICHIERS JOINTS : CONTRIBUTING.md, ROADMAP.md, docs/decisions/001-supabase-backend.md,
[fichiers concernés par la tâche]

[SI TU RELIS] Voici le diff de la Pull Request #[numéro] : [coller le diff ou le lien].
Cherche : bogues, cas oubliés, failles de sécurité (RLS, données personnelles),
écarts avec l'ADR 001 et CONTRIBUTING.md. Classe tes remarques : bloquant / à corriger / suggestion.
```

---

## Astuces

- Pour obtenir le diff d'une Pull Request à coller : ajouter `.diff` à la fin de son adresse, par exemple `https://github.com/ERIC74SONG96/odyssee-connect/pull/1.diff`.
- Garder la conversation sur **une seule tâche**. Nouvelle tâche = nouvelle conversation = nouvelle fiche.
- Si un assistant propose quelque chose de contraire à une ADR, ne pas l'appliquer : en discuter et, si c'est justifié, écrire une nouvelle ADR.
