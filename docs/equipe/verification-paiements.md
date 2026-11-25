# Vérifier les paiements Mobile Money (issue #27)

Tant que le paiement automatique n'existe pas (v1.1), **chaque paiement est vérifié à la main**.
Le coureur paie sur le numéro Mobile Money de l'association, puis déclare dans l'appli
l'identifiant de transaction reçu par SMS. Sa place reste réservée pendant la vérification.

## Chaque jour (au moins une fois, idéalement matin et soir)
1. Espace organisateurs → **Paiements à vérifier**. Les plus anciens sont en haut ; au-delà de 24 h ils passent en rouge
   et une alerte s'affiche sur le tableau de bord.
2. Ouvrir le relevé du compte Mobile Money de l'association (MTN MoMo ou Orange Money) sur le téléphone ou le portail marchand.
3. Pour chaque ligne : chercher l'identifiant de transaction (champ de recherche de l'appli, ou sur le relevé).
   - **Trouvé, bon montant, reçu sur le numéro de l'association** → **Valider le paiement** : le dossard est attribué.
   - **Introuvable, montant différent, autre numéro** → **Refuser…**, choisir le motif → le coureur voit le motif,
     l'identifiant déclaré est effacé et il a de nouveau 48 h pour déclarer le bon.
4. En cas de doute (montant partiel, double paiement), **ne rien valider** : appeler le coureur au numéro affiché.

## Règles
- On ne valide jamais sur la seule foi d'une capture d'écran envoyée par WhatsApp : seul le relevé de l'association fait foi.
- Un même identifiant de transaction ne peut servir qu'une fois (l'appli le refuse).
- Les remboursements se font hors appli, par l'équipe, avec trace écrite.
- Deux personnes au moins doivent savoir faire cette vérification (remplacement, absence).
