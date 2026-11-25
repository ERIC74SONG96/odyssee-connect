/*
 * Odyssée Connect · réglages
 * C'est le seul fichier à modifier pour la mise en ligne.
 * Laisser supabaseUrl vide = mode démonstration (données gardées dans le navigateur).
 */
window.ODC_CONFIG = {
  // Connexion à la base (Supabase > Project Settings > API)
  supabaseUrl: '',
  supabaseAnonKey: '',

  // Événement
  evenement: {
    nom: '10 KM de Yaoundé 2027',
    depart: '2027-07-10T08:00:00+01:00',
    dateTexte: 'Samedi 10 juillet 2027',
    heureTexte: '8 h',
    dateProvisoire: true,
    lieu: 'Yaoundé, Cameroun'
  },

  // Parcours : les tracés proposés sont dans js/parcours.js.
  // Pour afficher une image à la place, par exemple '10': { image: 'images/parcours-10km.jpg' }
  parcours: {},

  // Fond de carte (écran Carte). OpenStreetMap convient aux essais, mais sa politique d'usage
  // interdit un trafic important : pour le jour J, mettre ici l'adresse d'un fournisseur
  // choisi par l'association (issue #8), avec sa clé publique si besoin, et son attribution.
  carte: {
    tuiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© contributeurs OpenStreetMap',
    zoomMax: 19
  },

  // Tarifs affichés (les montants réellement facturés sont fixés dans la base, table tarifs)
  distances: [
    // Tarif du 3 km : provisoire (même montant que le 5 km), à confirmer par l'association
    { id: '3',  km: '3 km',  nom: 'Marche écologique et familiale', public: 'Accessible au plus grand nombre · en marchant, en famille', couleur: 'vert',  tarifs: { etudiant: 500, travailleur: 500 } },
    { id: '5',  km: '5 km',  nom: 'Course populaire',               public: 'Adaptée aux débutants et aux étudiants',                     couleur: 'jaune', tarifs: { etudiant: 500, travailleur: 500 } },
    { id: '10', km: '10 km', nom: 'Défi sportif',                   public: 'Pour les coureurs plus entraînés',                          couleur: 'rouge', tarifs: { etudiant: 500, travailleur: 1000 } }
  ],
  dons: [0, 500, 1000, 2000, 5000],

  // Paiement Mobile Money (numéros marchands de l'association, à compléter)
  mobileMoney: {
    beneficiaire: "L'Odyssée de l'environnement au Cameroun",
    mtn:    { nom: 'MTN Mobile Money', numero: '', code: '*126#' },
    orange: { nom: 'Orange Money',     numero: '', code: '#150#' }
  },

  // Fonds de solidarité environnementale
  fonds: { objectif: 5000000 },

  // Boutique : prix en FCFA, null = prix à venir
  boutique: {
    catalogueUrl: 'https://claude.ai/artifact/HB7WJa4Tqp4qRRhiFfWp6H',
    articles: [
      { id: 'pack',      nom: 'Pack coureur',          detail: 'T-shirt technique + casquette, retrait avec le dossard', prix: null, tailles: true,  vedette: true },
      { id: 'tshirt',    nom: 'T-shirt technique Odyssée',   detail: 'Tissu respirant, logo et drapeau',                        prix: null, tailles: true },
      { id: 'short',     nom: 'Short de course',             detail: 'Coupe ample, poche à clés',                               prix: null, tailles: true },
      { id: 'casquette', nom: 'Casquette Odyssée',           detail: 'Protège du soleil de Yaoundé',                            prix: null, tailles: false },
      { id: 'gourde',    nom: 'Gourde réutilisable',         detail: 'Moins de bouteilles plastiques',                          prix: null, tailles: false },
      { id: 'sac',       nom: 'Sac écologique',              detail: 'Toile résistante, logo Odyssée',                          prix: null, tailles: false }
    ]
  },

  // Produits partenaires. exemple: true affiche un badge « Exemple » tant que l'accord n'est pas signé.
  partenaires: [
    { nom: 'Koumé Water',        badge: 'Boisson officielle', texte: "Eau minérale pour l'hydratation des coureurs.", icone: 'eau',   exemple: true },
    { nom: 'Gel pour les mains', badge: '',                   texte: "Produit d'hygiène pour une course saine et sécurisée.", icone: 'gel', exemple: true },
    { nom: 'Mouchoirs Hygienix', badge: '',                   texte: "Pour l'hygiène et le séchage des mains.", icone: 'mouchoir', exemple: true }
  ],

  // Contact organisation
  contact: { email: '', telephone: '' },
  siteUrl: 'https://claude.ai/artifact/LQ9rMdGWZ5YexymWivpiZw'
};
