/*
 * Odyssée Connect · application
 * Écrans : accueil, course, inscription, paiement, dossard, fonds, don,
 * boutique, produits partenaires, espace organisateurs.
 */
{
  const C = window.ODC_CONFIG;
  const D = window.ODC_DATA.creer();
  const vue = document.getElementById('vue');

  // ---------------------------------------------------------------
  // Outils
  // ---------------------------------------------------------------
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fcfa = (n) => (Number(n) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' FCFA';
  const dateFr = (d, h) => { try { return new Date(d).toLocaleDateString('fr-FR', h ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
  // Version du texte de consentement affiché à l'inscription (enregistrée avec chaque inscription)
  const CONSENTEMENT_VERSION = '2026-11-25';
  const dateLimiteEffacement = () => { const j = new Date(C.evenement.depart); j.setMonth(j.getMonth() + 3); return j.toISOString().slice(0, 10); };
  // Mineur le jour de la course ? (accord parental obligatoire)
  // Âge minimum de 10 ans apprécié le jour de la course
  const dateMaxNaissance = () => { const j = new Date(C.evenement.depart); j.setFullYear(j.getFullYear() - 10); return j.toISOString().slice(0, 10); };
  const mineurLeJourJ = (ddn) => {
    if (!ddn) return false;
    const jour = new Date(C.evenement.depart); const n = new Date(ddn);
    if (isNaN(n)) return false;
    const majorite = new Date(n); majorite.setFullYear(n.getFullYear() + 18);
    return majorite > jour;
  };
  const distance = (id) => C.distances.find((d) => d.id === id) || C.distances[C.distances.length - 1];
  const CAT = { etudiant: 'Étudiant', travailleur: 'Travailleur' };
  const STATUT_PAR = { inscrit: 'Inscrit', present: 'Présent', absent: 'Absent', annule: 'Annulé' };
  const STATUT_CAND = { nouveau: 'Nouveau', en_cours: 'En cours', accepte: 'Accepté', refuse: 'Refusé' };
  const STATUT_BEN = { nouveau: 'Nouveau', contacte: 'Contacté', retenu: 'Retenu', decline: 'Non retenu' };
  const STATUT = { en_attente: 'Paiement à effectuer', paiement_declare: 'Paiement en vérification', paye: 'Inscription validée', annule: 'Annulée', valide: 'Validé', nouvelle: 'Nouvelle', confirmee: 'Confirmée', payee: 'Payée', livree: 'Livrée', annulee: 'Annulée' };
  const stockage = {
    lire(cle) { try { return JSON.parse(localStorage.getItem(cle)); } catch (e) { return null; } },
    ecrire(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* navigateur sans stockage */ } },
    effacer(cle) { try { localStorage.removeItem(cle); } catch (e) { /* idem */ } }
  };

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
  }

  const I = {
    retour: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    lieu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    coeur: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/></svg>',
    coureur: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="14" cy="4" r="2"/><path d="m6 22 4-7 3 2v5M8 11l3-3 4 2 3 3M11 8l-1 5"/></svg>',
    dossard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M7 14h10"/></svg>',
    sac: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    bouclier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    maillot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c0 1.7-1.8 3-4 3S8 4.7 8 3z"/></svg>',
    short: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14l1 15-6 1-2-8-2 8-6-1z"/></svg>',
    casquette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M3 15c0-5 4-9 9-9s9 4 9 9H3zM3 15h18l-2 3H3z"/></svg>',
    eau: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3z"/><path d="M8 12h8"/></svg>',
    gel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2h5M12 2v4M9 6h6v3"/><path d="M8 9h8l1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/></svg>',
    mouchoir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M9 10c0-3 1-6 3-7 2 1 3 4 3 7"/></svg>',
    feuille: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/></svg>',
    groupe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 21a6 6 0 0 1 12 0M14 21a4 4 0 0 1 7 0"/></svg>',
    coupe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
    graphe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-9"/></svg>',
    poignee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.9-3.9a2 2 0 0 0-2.8 0l-.9.9a1 1 0 1 1-3-3l2.8-2.8a5 5 0 0 1 6 .8L21 7"/><path d="m21 3 1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8"/></svg>',
    livre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z"/></svg>',
    journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>',
    lecture: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    cloche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    chapeau: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 10-10-5-10 5 10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    chariot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 7H6"/></svg>',
    telephone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>',
    carte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
    banque: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10h18L12 4zM5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/></svg>',
    cadenas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    fleche: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    personne: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    partage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    telecharger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
    arbre: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22v-7M8 15h8a4 4 0 0 0 1-7.9A5 5 0 0 0 7.1 7 4 4 0 0 0 8 15z"/></svg>',
    recycle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7L7.2 9.6M11 19h8.2a1.8 1.8 0 0 0 1.6-2.7l-1.2-2M14 16l-3 3 3 3M8.3 13.6 7.2 9.6l-4 1.1M9.3 5.6l1.1-1.8a1.8 1.8 0 0 1 3.1 0l3.9 6.8M13.4 10.4l4-1.1-1.1-4"/></svg>',
    reglages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    crayon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>',
    logoGrand: '<svg width="56" height="56" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="57" fill="none" stroke="#f7c51e" stroke-width="5"/><circle cx="60" cy="60" r="47" fill="#f7c51e"/><path d="M36 84c0-30 21-46 49-49-3 30-21 49-49 49z" fill="#0b4d2c"/><path d="M42 78l34-34" stroke="#f7c51e" stroke-width="5" stroke-linecap="round"/></svg>',
    coeurPlein: '<svg viewBox="0 0 24 24" fill="#c62828" stroke="#c62828" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/></svg>',
    bulle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/></svg>',
    drapeau: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V4M4 4h13l-2 4 2 4H4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    appareil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
    carteIco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></svg>',
    logo: '<svg width="40" height="40" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="17" fill="#f7c51e"/><path d="M10 26c0-10 7-15 16-16-1 10-7 16-16 16z" fill="#0b4d2c"/><path d="M12 24l11-11" stroke="#f7c51e" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };

  // ---------------------------------------------------------------
  // État
  // ---------------------------------------------------------------
  const S = {
    etat: null,
    choix: { distance: '10', categorie: 'etudiant', don: 0, taille: null },
    moi: null,                              // inscription affichée { reference, telephone, prenom }
    mes: (() => { const l = stockage.lire('odc_mes'); if (Array.isArray(l)) return l; const m = stockage.lire('odc_moi'); return m ? [m] : []; })(),
    annonces: [],
    evs: null, evFiltre: 'avenir', acFiltre: 'toutes', resDist: '10', resSexe: 'tous', resTout: false, rapport: false, insEtape: 1, insData: null, fmFiltre: 'tous', evSel: null, contSel: null,
    impact: null, groupes: null, contenus: null, quiz: null,
    profil: stockage.lire('odc_profil'),
    couches: { evenements: true, actions: true, points: true, coureurs: true }, points: null, suiviEtat: null,
    fil: null, filCat: '', coms: {}, comOuvert: null, pubApercu: null, pubPhoto: null,
    parts: stockage.lire('odc_parts') || [], cands: stockage.lire('odc_cands') || [], quizFaits: stockage.lire('odc_quiz') || {},
    don: stockage.lire('odc_don'),          // { reference, telephone, montant }
    op: 'mtn',
    panier: {},
    staff: false,
    adm: { onglet: 'tableau', ins: [], dons: [], cmd: [], ben: [], ann: [], evs: [], par: [], cand: [], grs: [], cts: [], q: '', statut: '', dist: '' }
  };
  S.moi = S.mes[0] || null;

  function ajouterMoi(m) {
    S.mes = [m].concat(S.mes.filter((x) => x.reference !== m.reference)).slice(0, 10);
    S.moi = m; S.recherche = false; stockage.ecrire('odc_mes', S.mes); stockage.effacer('odc_moi');
  }
  function retirerMoi() {
    if (S.moi) S.mes = S.mes.filter((x) => x.reference !== S.moi.reference);
    S.moi = S.mes[0] || null; S.consult = null; stockage.ecrire('odc_mes', S.mes);
  }

  // Ouverture des inscriptions (réglée par l'équipe). Sans réponse du serveur, on laisse essayer :
  // c'est le serveur qui refuse avec un message clair.
  function etatInscriptions() {
    const e = S.etat && S.etat.inscriptions;
    if (!e) return { ouvert: true, complet: false, restantes: null, message: '' };
    return { ouvert: !!e.ouvertes, complet: e.ouvertes && e.restantes <= 0, restantes: e.restantes, quota: e.quota,
             message: (e.message || '').trim() || "Les inscriptions ne sont pas encore ouvertes. Suivez nos annonces." };
  }
  function boutonInscription(d, classe) {
    const e = etatInscriptions();
    if (!e.ouvert) return `<button class="btn ${classe}" disabled>Inscriptions fermées</button><p class="note" style="margin:6px 0 0;text-align:center">${esc(e.message)}</p>`;
    if (e.complet) return `<button class="btn ${classe}" disabled>Complet</button><p class="note" style="margin:6px 0 0;text-align:center">Toutes les places de cette vague sont prises. Suivez nos annonces pour la prochaine ouverture.</p>`;
    const peu = e.restantes != null && e.restantes <= 300 ? `<p class="note" style="margin:6px 0 0;text-align:center">Plus que ${e.restantes.toLocaleString('fr-FR')} place${e.restantes > 1 ? 's' : ''} dans cette vague.</p>` : '';
    return `<a class="btn ${classe}" href="#inscription" data-action="ins-debut">S'inscrire au ${esc(d.km)}${classe === 'vert-fonce' ? ' ' + I.fleche : ''}</a>${peu}`;
  }
  // Clé d'envoi : la même pour toutes les tentatives d'un même formulaire (évite les doubles inscriptions).
  // Gardée pour la session de l'onglet : après un rechargement, les mêmes informations renvoient la même référence.
  const CLE_ENVOI = 'odc_cle_envoi';
  const cleSession = {
    lire() { try { return sessionStorage.getItem(CLE_ENVOI); } catch (e) { return null; } },
    ecrire(v) { try { sessionStorage.setItem(CLE_ENVOI, v); } catch (e) { /* stockage indisponible : mémoire seule */ } },
    effacer() { try { sessionStorage.removeItem(CLE_ENVOI); } catch (e) { /* idem */ } }
  };
  function cleEnvoi() {
    if (!S.cleEnvoi) S.cleEnvoi = cleSession.lire() || nouvelleCle();
    cleSession.ecrire(S.cleEnvoi);
    return S.cleEnvoi;
  }
  function nouvelleCle() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  async function chargerEtat() {
    try {
      const [etat, ann, evs] = await Promise.all([D.etatPublic(), D.annonces().catch(() => S.annonces), D.evenements().catch(() => S.evs || [])]);
      S.etat = etat; S.annonces = ann || []; S.evs = evs || [];
      const v = route();
      if (['accueil', 'fonds', 'course', 'actualites', 'resultats', 'evenements', 'actions', 'evenement'].includes(v)) rendre(false);
    } catch (e) { /* hors ligne : les écrans affichent sans chiffres */ }
  }

  // ---------------------------------------------------------------
  // Morceaux réutilisables
  // ---------------------------------------------------------------
  const entete = (titre, retour, sous) => `
    <header class="entete">
      ${retour ? `<a class="rond" href="#${retour}" aria-label="Retour">${I.retour}</a>` : I.logo}
      <h1>${esc(titre)}${sous ? `<small>${esc(sous)}</small>` : ''}</h1>
    </header>`;

  const etapes = (n) => `<ol class="etapes2" aria-label="Étape ${n} sur 4">${['Profil', 'Course', 'Paiement', 'Confirmation'].map((t, i) =>
    `<li class="${i + 1 < n ? 'fait' : i + 1 === n ? 'actuel' : ''}"><span>${i + 1 < n ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol>`;

  const compte = () => `
    <div class="compte" role="timer" aria-label="Compte à rebours avant le départ" data-cd="${esc(C.evenement.depart)}">
      <div><b class="j" data-u="j">–</b><span>Jours</span></div>
      <div><b data-u="h">–</b><span>Heures</span></div>
      <div><b data-u="m">–</b><span>Min</span></div>
      <div><b data-u="s">–</b><span>Sec</span></div>
    </div>`;

  const dateCourse = () => `${C.evenement.dateTexte} · départ à ${C.evenement.heureTexte}${C.evenement.dateProvisoire ? ' · date provisoire' : ''}`;

  function jaugeFonds(clair) {
    const f = (S.etat && S.etat.fonds) || { collecte: 0, objectif: C.fonds.objectif, donateurs: 0 };
    const pct = Math.min(100, Math.round((f.collecte / (f.objectif || 1)) * 1000) / 10);
    return { f, pct, html: `<div class="jauge" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Fonds collectés"><i style="width:${pct}%"></i></div>` };
  }

  function blocPaiement(type, ref, tel, montant) {
    const mm = C.mobileMoney; const o = mm[S.op];
    return `
      <div class="pad pile">
        <h2 class="titre-centre">${type === 'don' ? 'Montant du don' : 'Frais d’inscription'}</h2>
        <div class="frais"><span>${fcfa(montant)}</span><small>Référence <b>${esc(ref)}</b></small></div>
        <h2 class="titre-centre">Choisissez un moyen de paiement</h2>
        <div class="pile" role="radiogroup" aria-label="Moyen de paiement">
          <div class="moyen actif" role="radio" aria-checked="true"><span class="m-ico">${I.telephone}</span><span class="pile" style="gap:0;flex:1"><b>Mobile Money</b><span>MTN, Orange</span></span><span class="radio-o on"></span></div>
          <div class="moyen bientot" role="radio" aria-checked="false" aria-disabled="true"><span class="m-ico">${I.carte}</span><span class="pile" style="gap:0;flex:1"><b>Carte bancaire</b><span>Visa, Mastercard · bientôt</span></span><span class="radio-o"></span></div>
          <div class="moyen bientot" role="radio" aria-checked="false" aria-disabled="true"><span class="m-ico">${I.banque}</span><span class="pile" style="gap:0;flex:1"><b>Paiement en agence</b><span>Partenaires agréés · bientôt</span></span><span class="radio-o"></span></div>
        </div>
        <div class="carte pile" style="gap:10px">
          <div class="ops" role="radiogroup" aria-label="Opérateur">${['mtn', 'orange'].map((k) => `<button type="button" class="op-choix" data-action="op" data-op="${k}" role="radio" aria-checked="${S.op === k}"><span class="op ${k}">${k === 'mtn' ? 'MoMo' : 'OM'}</span>${esc(mm[k].nom)}</button>`).join('')}</div>
          <ol class="etp">
            <li>Composez <b>${esc(o.code)}</b> sur votre téléphone.</li>
            <li>Envoyez <b>${fcfa(montant)}</b> ${o.numero ? `au <b>${esc(o.numero)}</b> (${esc(mm.beneficiaire)})` : `au numéro de l'association <b>(communiqué à l'ouverture des inscriptions)</b>`}.</li>
            <li>En motif, indiquez <span class="ref">${esc(ref)}</span>.</li>
            <li>Recopiez l'identifiant reçu par SMS.</li>
          </ol>
          <form data-form="declarer" data-type="${type}" data-ref="${esc(ref)}" data-tel="${esc(tel)}" class="pile" novalidate>
            <label class="champ">Identifiant de la transaction <small>Exemple : MP261124.1532.A12345</small>
              <input name="tx" required minlength="4" maxlength="60" autocomplete="off"></label>
            <p class="erreur" role="alert"></p>
            <button class="btn vert-fonce" type="submit">${I.cadenas} Payer ${fcfa(montant)}</button>
          </form>
        </div>
        <p class="note" style="text-align:center;margin:0">L'équipe vérifie chaque paiement avant de valider ${type === 'don' ? 'le don' : 'le dossard'}.</p>
      </div>`;
  }

  // ---------------------------------------------------------------
  // Écrans
  // ---------------------------------------------------------------
  const V = {};

  const couleurDist = { vert: ['#e6f2e3', '#0b4d2c'], jaune: ['#fdf3cf', '#13241a'], rouge: ['#fde8e8', '#c62828'] };
  function lignesDistances(choisi, action) {
    return `<div class="pile" role="radiogroup" aria-label="Distance">${C.distances.map((d) => {
      const [fond, enc] = couleurDist[d.couleur] || couleurDist.vert; const on = d.id === choisi;
      return `<button type="button" class="dist-ligne${on ? ' on' : ''}" data-action="${action}" data-id="${d.id}" role="radio" aria-checked="${on}" style="background:${fond};--c:${enc}">
        <img class="dist-ico" src="images/coureur-vert.png" alt="">
        <span class="pile" style="gap:0;flex:1;text-align:left"><b>${esc(d.km.toUpperCase())} – ${esc(d.nom)}</b><span>${esc(d.public)}</span></span>
        <span class="radio-o${on ? ' on' : ''}" style="--c:${enc}"></span></button>`;
    }).join('')}</div>`;
  }

  const prenomActuel = () => (S.profil && S.profil.prenom) || (S.moi && S.moi.prenom) || '';

  V.accueil = () => {
    const { f, pct, html } = jaugeFonds();
    const prochains = S.evs ? S.evs.filter((e) => !passe(e)) : [];
    const course = prochains.find((e) => e.inscription === 'course20km');
    const jours = Math.max(0, Math.floor((new Date(C.evenement.depart) - Date.now()) / 86400000));
    const tuiles = [
      ['evenements', 'Événements', I.cal, 't1'], ['actions', 'Actions environnementales', I.feuille, 't2'], ['communaute', 'Communauté', I.groupe, 't3'],
      ['formations', 'Formations', I.chapeau, 't4'], ['boutique', 'Boutique', I.chariot, 't5'], ['impact', 'Impact', I.graphe, 't6']
    ];
    return `
      <header class="barre-acc">
        <a class="rond-clair" href="#services" aria-label="Tous les services">${I.menu}</a>
        <h1>Accueil</h1>
        <a class="rond-clair" href="#actualites" aria-label="Actualités">${I.cloche}${S.annonces.length ? '<i class="pastille-rouge"></i>' : ''}</a>
      </header>
      <section class="hero-acc" aria-label="${esc(C.evenement.nom)}">
        <img src="images/hero-accueil.jpg" alt="Coureurs aux couleurs de L'Odyssée de l'environnement devant le monument de la Réunification" width="900" height="574">
        <div class="hero-bas">
          <svg class="hero-courbe" viewBox="0 0 390 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60 L0 34 C120 4 260 -6 390 22 L390 60 Z" fill="#0b4d2c"/><path d="M0 40 C130 8 260 2 390 26" fill="none" stroke="#f7c51e" stroke-width="6" stroke-linecap="round"/></svg>
          <div class="hero-titre">
            <img class="hero-coureur" src="images/coureur-blanc.png" alt="" width="336" height="338">
            <p><span class="t-grand">10 KM</span><span class="t-moyen">de Yaoundé</span><span class="t-grand">2027</span></p>
          </div>
          <p class="hero-tag">Sport <i>•</i> Environnement <i>•</i> Solidarité</p>
        </div>
      </section>
      <nav class="tuiles" aria-label="Services principaux">${tuiles.map(([h, t, ico, c]) => `<a href="#${h}" class="${c}"><span>${ico}</span>${t}</a>`).join('')}</nav>
      <a class="tous-services" href="#services">Tous les services ›</a>
      <h2 class="titre" style="margin-top:6px">Prochain événement</h2>
      <div style="padding:0 16px">
        <a class="carte prochain" href="#course">
          <span class="vignette-course"><img src="images/coureur-blanc-petit.png" alt=""></span>
          <span class="pile" style="gap:1px;flex:1">
            <b>${esc(C.evenement.nom)}</b>
            <span>3 KM • 5 KM • 10 KM</span>
            <span class="note">${esc(C.evenement.dateTexte)}${C.evenement.dateProvisoire ? ' (provisoire)' : ''}</span>
          </span>
          <span class="j-moins">J-${jours}</span>
          <span aria-hidden="true" class="chevron">›</span>
        </a>
      </div>
      ${S.fil && S.fil.filter((x) => x.statut === 'publie').length ? `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:0 16px"><h2 class="titre" style="margin:14px 0 8px">Dernières photos</h2><a href="#fil" style="font-weight:700;font-size:14px">Voir le fil</a></div>
      <div class="bande-photos">${S.fil.filter((x) => x.statut === 'publie').slice(0, 6).map((x) => `<a href="#fil"><img src="${esc(D.urlPhoto(x.photo))}" alt="${esc(x.texte || 'Photo de ' + x.auteur)}" loading="lazy"><span>${esc(x.auteur)}</span></a>`).join('')}</div>` : ''}
      <div class="pad pile">
        ${compte()}
        <a class="btn j" href="#course">Je m'inscris aux 10 KM</a>
        ${prochains.filter((e) => e !== course).length ? `<h2 class="titre" style="margin:10px 0 0">À venir</h2>${prochains.filter((e) => e !== course).slice(0, 3).map(carteEv).join('')}` : ''}
        <a class="carte pile" href="#fonds" style="text-decoration:none;color:inherit;gap:8px">
          <span style="display:flex;justify-content:space-between;gap:8px"><b>Fonds de solidarité environnementale</b><span style="color:var(--vert);font-weight:700;font-size:14px">Voir</span></span>
          ${html}
          <span class="note">${fcfa(f.collecte)} collectés sur ${fcfa(f.objectif)} · ${pct} %</span>
        </a>
        ${S.etat && S.etat.resultats ? `<a class="carte lien-carte" href="#resultats" style="background:var(--jaune);border-color:var(--jaune)"><b>Résultats de la course</b><span>Voir</span></a>` : ''}
        ${S.annonces.length ? `
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px"><h2 class="titre" style="margin:0">Actualités</h2><a href="#actualites" style="font-weight:700;font-size:14px">Tout voir</a></div>
        ${S.annonces.slice(0, 2).map((a) => carteAnnonce(a, true)).join('')}` : ''}
        <p class="note" style="text-align:center;margin-top:6px"><a href="${esc(C.siteUrl)}" rel="noopener">Site officiel des 10 KM</a> · <a href="#admin">Espace organisateurs</a></p>
      </div>`;
  };

  V.services = () => `${entete('Tous les services', 'accueil')}
    <nav class="modules" aria-label="Services" style="padding-top:16px">${MODULES.map(([h, t, ico, c]) => `<a href="#${h}" class="m-${c}"><span>${ico}</span>${t}</a>`).join('')}</nav>
    <div class="pad pile">
      <a class="carte lien-carte" href="#dossard"><b>Mon dossard</b><span>Voir</span></a>
      <a class="carte lien-carte" href="#benevoles"><b>Devenir bénévole</b><span>Voir</span></a>
      <a class="carte lien-carte" href="#produits"><b>Produits de la course</b><span>Voir</span></a>
    </div>`;

  // Écran d'ouverture
  V.bienvenue = () => `
    <section class="ouverture">
      <div class="ouv-haut">
        <svg class="ouv-logo" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="57" fill="none" stroke="#f7c51e" stroke-width="4"/><circle cx="60" cy="60" r="48" fill="#f7c51e"/><path d="M36 84c0-30 21-46 49-49-3 30-21 49-49 49z" fill="#0b4d2c"/><path d="M42 78l34-34" stroke="#f7c51e" stroke-width="5" stroke-linecap="round"/></svg>
        <h1><span>L'ODYSSÉE</span><small>DE L'ENVIRONNEMENT</small></h1>
        <svg class="ouv-trait" viewBox="0 0 220 24" aria-hidden="true"><path d="M6 18 C70 2 150 0 214 8" fill="none" stroke="#f7c51e" stroke-width="5" stroke-linecap="round"/></svg>
        <p class="ouv-slogan">Ensemble, agissons<br>pour un avenir durable.</p>
      </div>
      <svg class="ouv-paysage" viewBox="0 0 390 170" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <g fill="#2f7a46" opacity=".55"><rect x="196" y="58" width="18" height="70"/><rect x="218" y="38" width="22" height="90"/><rect x="244" y="66" width="16" height="62"/><rect x="264" y="48" width="20" height="80"/><rect x="288" y="72" width="14" height="56"/><rect x="306" y="56" width="18" height="72"/></g>
        <path d="M0 120 C80 96 160 104 230 112 C300 120 350 104 390 98 L390 170 L0 170 Z" fill="#3d8b3d"/>
        <path d="M0 140 C90 120 200 128 270 136 C330 142 360 130 390 126 L390 170 L0 170 Z" fill="#5aa83f"/>
        <g fill="#1f5f33"><path d="M40 118 C10 116 6 92 30 86 C30 66 66 64 72 80 C96 78 100 104 80 112 Z"/><rect x="50" y="108" width="6" height="26"/><path d="M110 124 C92 122 92 104 106 100 C108 88 130 88 132 100 C146 102 144 122 128 124 Z"/><rect x="117" y="120" width="4" height="16"/></g>
        <g fill="#1f5f33"><path d="M330 120 c-6-20 6-40 14-46 c8 6 20 26 14 46 z"/><rect x="342" y="116" width="4" height="18"/></g>
        <path d="M0 158 C120 146 260 150 390 160" fill="none" stroke="#f7c51e" stroke-width="5" opacity=".9"/>
      </svg>
      <div class="ouv-boutons">
        <a class="btn j" href="#compte" data-action="vu">Créer un compte</a>
        <a class="btn ouv-contour" href="#connexion" data-action="vu">Se connecter</a>
        <a class="ouv-passer" href="#accueil" data-action="vu">Découvrir l'application</a>
      </div>
    </section>`;

  V.compte = () => `${entete('Créer un compte', 'bienvenue')}
    <div class="pad">
      <form data-form="profil" novalidate>
        <p class="note" style="margin:0">Votre profil sert à préremplir vos inscriptions, vos participations et vos attestations.</p>
        <div class="grille2"><label class="champ">Prénom<input name="prenom" required maxlength="80" autocomplete="given-name" value="${esc(S.profil ? S.profil.prenom : '')}"></label>
        <label class="champ">Nom<input name="nom" required maxlength="80" autocomplete="family-name" value="${esc(S.profil ? S.profil.nom : '')}"></label></div>
        <label class="champ">Téléphone<input name="telephone" required type="tel" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="+237" value="${esc(S.profil ? S.profil.telephone : '')}"></label>
        <label class="champ">Ville<input name="ville" maxlength="80" value="${esc(S.profil ? S.profil.ville : 'Yaoundé')}"></label>
        <p class="erreur" role="alert"></p>
        <button class="btn" type="submit">Créer mon compte</button>
        <div class="info">${I.info}<span>Votre compte est enregistré sur ce téléphone. La connexion depuis un autre appareil arrivera dans une prochaine version.</span></div>
      </form>
    </div>`;

  V.connexion = () => `${entete('Se connecter', 'bienvenue')}
    <div class="pad pile">
      <p class="note" style="margin:0">Déjà inscrit aux 10 KM ? Retrouvez votre inscription avec votre référence (elle commence par ODY) et votre téléphone.</p>
      <form data-form="retrouver" class="carte" novalidate>
        <label class="champ">Référence<input name="reference" required placeholder="ODY-XXXXXX" maxlength="20" autocapitalize="characters" autocomplete="off"></label>
        <label class="champ">Téléphone<input name="telephone" required type="tel" inputmode="tel" maxlength="20"></label>
        <p class="erreur" role="alert"></p>
        <button class="btn" type="submit">Se connecter</button>
      </form>
      <a class="btn contour" href="#compte">Pas encore de compte ? En créer un</a>
    </div>`;

  V.course = () => {
    const n = (S.etat && S.etat.inscrits) || {};
    const d = distance(S.choix.distance);
    const total = Object.values(n).reduce((a, b) => a + b, 0);
    return `
      ${entete(C.evenement.nom, 'evenements')}
      <img src="images/hero-accueil.jpg" alt="" style="width:100%;height:170px;object-fit:cover;object-position:50% 25%">
      <div class="pad pile">
        <div class="carte pile" style="margin-top:-40px;position:relative;box-shadow:var(--ombre);gap:8px">
          <span style="display:flex;gap:10px;align-items:center;color:var(--vert)">${I.cal}<span style="color:var(--encre)">${esc(dateCourse())}</span></span>
          <span style="display:flex;gap:10px;align-items:center;color:var(--vert)">${I.lieu}<span style="color:var(--encre)">${esc(C.evenement.lieu)}</span></span>
          <span style="display:flex;gap:10px;align-items:center;color:var(--rouge)">${I.coeur}<span style="color:var(--encre)">Au profit du Fonds de solidarité environnementale</span></span>
          ${total ? `<span style="display:flex;gap:10px;align-items:center;color:var(--vert)">${I.groupe}<span style="color:var(--encre)">${total.toLocaleString('fr-FR')} inscrit${total > 1 ? 's' : ''}</span></span>` : ''}
        </div>
        <h2 class="titre-centre" style="margin-top:6px">Choisissez votre distance</h2>
        ${lignesDistances(d.id, 'distance')}
        <div class="carte pile" style="gap:4px"><b>Tarif ${esc(d.km)}</b><span class="note">${d.tarifs.etudiant === d.tarifs.travailleur ? `${fcfa(d.tarifs.etudiant)} pour tous` : `Étudiants ${fcfa(d.tarifs.etudiant)} · Travailleurs ${fcfa(d.tarifs.travailleur)}`}. Tarifs provisoires jusqu'à la validation de la course.</span></div>
        <a class="carte lien-carte" href="#parcours"><b>Voir le parcours</b><span>Voir</span></a>
      </div>
      <div class="barre-bas">${boutonInscription(d, 'vert-fonce')}</div>`;
  };

  V.inscription = () => {
    const ei = etatInscriptions();
    if (!ei.ouvert || ei.complet) {
      return `${entete('Inscription', 'course')}<div class="pad pile">
        <div class="info r">${I.info}<span>${esc(!ei.ouvert ? ei.message : 'Complet : toutes les places de cette vague sont prises. Suivez nos annonces pour la prochaine ouverture.')}</span></div>
        <a class="btn contour" href="#dossard">Retrouver mon inscription</a><a class="btn contour" href="#actualites">Voir les annonces</a></div>`;
    }
    const D0 = S.insData || {};
    const pf = S.profil || {};
    const val = (k, def) => esc(D0[k] != null ? D0[k] : (pf[k] != null ? pf[k] : (def || '')));
    if ((S.insEtape || 1) === 1) {
      return `${entete('Inscription', 'course')}
        ${etapes(1)}
        <div class="pad">
          <form data-form="ins1" novalidate>
            <h2 class="titre-form">Mes informations</h2>
            <label class="champ ico-champ"><span class="i">${I.personne}</span><span class="pile" style="gap:4px;flex:1">Nom *<input name="nom" required maxlength="80" autocomplete="family-name" value="${val('nom')}"></span></label>
            <label class="champ ico-champ"><span class="i">${I.personne}</span><span class="pile" style="gap:4px;flex:1">Prénom *<input name="prenom" required maxlength="80" autocomplete="given-name" value="${val('prenom')}"></span></label>
            <label class="champ ico-champ"><span class="i">${I.cal}</span><span class="pile" style="gap:4px;flex:1">Date de naissance *<input name="date_naissance" required type="date" max="${dateMaxNaissance()}" value="${val('date_naissance')}"></span></label>
            <fieldset class="champ ico-champ" style="border:0;margin:0;padding:0"><span class="i">${I.personne}</span><span class="pile" style="gap:4px;flex:1"><span>Sexe *</span>
              <span class="radios" role="radiogroup" aria-label="Sexe">${[['M', 'Homme'], ['F', 'Femme']].map(([k, t]) => `<label><input type="radio" name="sexe" value="${k}" required ${D0.sexe === k ? 'checked' : ''}> ${t}</label>`).join('')}</span></span></fieldset>
            <label class="champ ico-champ"><span class="i">${I.telephone}</span><span class="pile" style="gap:4px;flex:1">Téléphone Mobile Money *<input name="telephone" required type="tel" inputmode="tel" autocomplete="tel" placeholder="+237 6XX XX XX XX" maxlength="20" value="${val('telephone')}"></span></label>
            <label class="champ ico-champ"><span class="i">${I.info}</span><span class="pile" style="gap:4px;flex:1">E-mail *<input name="email" required type="email" inputmode="email" autocomplete="email" maxlength="120" value="${val('email')}"></span></label>
            <div class="grille2">
              <label class="champ">Contact d'urgence *<input name="urgence_nom" required maxlength="80" placeholder="Nom" value="${val('urgence_nom')}"></label>
              <label class="champ">Son téléphone *<input name="urgence_tel" required type="tel" inputmode="tel" maxlength="20" placeholder="+237" value="${val('urgence_tel')}"></label>
            </div>
            <p class="erreur" role="alert"></p>
            <button class="btn vert-fonce" type="submit">Suivant ${I.fleche}</button>
          </form>
        </div>`;
    }
    const d = distance(S.choix.distance);
    const prix = d.tarifs[S.choix.categorie];
    const autre = !C.dons.includes(S.choix.don);
    const tailles = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    return `${entete('Choix de la course', null)}
      ${etapes(2)}
      <div class="pad">
        <form data-form="inscription" novalidate>
          <h2 class="titre-centre">Choisissez votre distance</h2>
          ${lignesDistances(d.id, 'distance')}
          <h2 class="titre-form">Je m'inscris en tant que</h2>
          <div class="grille2">${['etudiant', 'travailleur'].map((c) => `
            <button type="button" class="choix" data-action="categorie" data-cat="${c}" aria-pressed="${S.choix.categorie === c}" style="flex-direction:column;align-items:flex-start;gap:2px">
              <b>${CAT[c]}</b><span class="note">${fcfa(d.tarifs[c])}</span></button>`).join('')}</div>
          ${S.choix.categorie === 'etudiant' ? `<div class="info j">${I.info}<span>Carte d'étudiant à présenter au retrait du dossard.</span></div>` : ''}
          <h2 class="titre-form">Taille du t-shirt</h2>
          <div class="tailles-ins" role="radiogroup" aria-label="Taille du t-shirt">${tailles.map((t) => `<button type="button" data-action="taille-ins" data-t="${t}" role="radio" aria-checked="${S.choix.taille === t}">${t}</button>`).join('')}</div>
          <h2 class="titre-form">Un don au Fonds de solidarité ? <span class="note" style="font-weight:500">facultatif</span></h2>
          <div class="puces">${C.dons.map((v) => `<button type="button" class="puce" data-action="don" data-v="${v}" aria-pressed="${S.choix.don === v}">${v ? fcfa(v).replace(' FCFA', '') : 'Non'}</button>`).join('')}
            <button type="button" class="puce" data-action="don-autre" aria-pressed="${autre}">Autre</button></div>
          ${autre ? `<label class="champ">Montant du don (FCFA)<input name="don_autre" type="number" min="100" max="1000000" step="100" inputmode="numeric" value="${S.choix.don || ''}"></label>` : ''}
          <label class="case"><input type="checkbox" name="reglement" required> <span>J'accepte le règlement de la course et je certifie être apte à la course à pied.</span></label>
          ${mineurLeJourJ((S.insData || {}).date_naissance) ? `<label class="case"><input type="checkbox" name="consentement_parental" required> <span><b>Moins de 18 ans le jour de la course :</b> un parent ou représentant légal autorise cette inscription et le traitement de ces données.</span></label>` : ''}
          <label class="case"><input type="checkbox" name="consentement" required> <span>J'accepte que L'Odyssée de l'environnement au Cameroun utilise mes données pour organiser la course (inscription, paiement, dossard, sécurité, résultats), conformément à la loi n° 2024/017. Elles sont hébergées sur des serveurs en Europe (Supabase). Elles ne sont jamais vendues ni louées, et ne sont communiquées qu'aux prestataires techniques nécessaires (hébergement, paiement). Mes coordonnées (nom complet, téléphone, e-mail, contact d'urgence, date de naissance précise) sont effacées au plus tard trois mois après la course. Sont alors conservés : pour les résultats, mon prénom, l'initiale de mon nom, mon année de naissance, mon sexe, mon épreuve, ma catégorie, mon dossard et mon résultat ; pour la comptabilité, la référence de l'inscription, son statut, les montants payés et leurs dates. Pour consulter, corriger ou faire supprimer mes données : contact@odyssee-env.org.</span></label>
          <p class="erreur" role="alert"></p>
          <div class="barre-bas" style="margin:0 -16px;bottom:72px">
            <div class="recap"><span>${esc(d.km)} · ${CAT[S.choix.categorie]}${S.choix.taille ? ' · ' + S.choix.taille : ''}${S.choix.don ? ' + don' : ''}</span><b data-total>${fcfa(prix + (S.choix.don || 0))}</b></div>
            <div style="display:flex;gap:8px"><button class="btn contour" type="button" data-action="ins-retour" style="flex:0 0 auto;width:auto">${I.retour}</button><button class="btn vert-fonce" type="submit">Continuer ${I.fleche}</button></div>
          </div>
        </form>
      </div>`;
  };

  // Délai pendant lequel une inscription non payée garde sa place (réglé par l'équipe)
  const delaiPaiementH = () => Number(S.etat && S.etat.inscriptions && S.etat.inscriptions.delai_paiement_heures) || 48;
  const limitePaiement = (x) => new Date(x.paiement_avant || (new Date(x.created_at).getTime() + delaiPaiementH() * 3600e3));
  const delaiDepasse = (x) => x.statut === 'en_attente' && (x.paiement_avant || x.created_at) && limitePaiement(x) < new Date();

  V.paiement = () => {
    if (!S.moi) return `${entete('Paiement', 'accueil')}<div class="pad pile"><p class="vide">Aucune inscription en cours sur ce téléphone.</p><a class="btn" href="#course">S'inscrire</a><a class="btn contour" href="#dossard">Retrouver mon inscription</a></div>`;
    const x = S.consult;
    if (!x) { consulterMoi().then(() => route() === 'paiement' && rendre(false)); return `${entete('Paiement', 'dossard')}<p class="vide">Chargement…</p>`; }
    if (x.statut !== 'en_attente') { location.hash = x.statut === 'paiement_declare' ? 'confirmation' : 'dossard'; return ''; }
    const lim = (x.paiement_avant || x.created_at) ? limitePaiement(x) : null;
    const avis = !lim ? '' : delaiDepasse(x)
      ? `<div class="pad" style="padding-bottom:0"><div class="info r">${I.info}<span>Le délai de paiement est dépassé : votre place n'est plus réservée. Vous pouvez encore payer s'il reste des places.</span></div></div>`
      : `<div class="pad" style="padding-bottom:0"><div class="info">${I.info}<span>Votre place est réservée jusqu'au ${esc(lim.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}.</span></div></div>`;
    return `${entete('Paiement', 'dossard')}${etapes(3)}${avis}${blocPaiement('inscription', x.reference, S.moi.telephone, x.montant + x.don)}`;
  };

  V.confirmation = () => {
    if (!S.moi) { location.hash = 'dossard'; return ''; }
    const x = S.consult;
    if (!x) { consulterMoi().then(() => route() === 'confirmation' && rendre(false)); return `${entete('Inscription confirmée', 'accueil')}<p class="vide">Chargement…</p>`; }
    const d = distance(x.distance);
    const debut = new Date(C.evenement.depart);
    const fmt = (t) => t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const agenda = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(C.evenement.nom + ' · ' + d.km)
      + '&dates=' + fmt(debut) + '/' + fmt(new Date(debut.getTime() + 4 * 3600e3)) + '&location=' + encodeURIComponent(C.evenement.lieu)
      + '&details=' + encodeURIComponent('Dossard : référence ' + x.reference + '. Date provisoire.');
    return `${entete('Inscription confirmée', 'accueil')}
      ${etapes(4)}
      <div class="pad pile" style="align-items:stretch">
        <div class="bravo">
          <svg class="confettis" viewBox="0 0 300 70" aria-hidden="true">${[[20,30,'#c62828',20],[48,12,'#f7c51e',-30],[70,44,'#0b4d2c',45],[230,14,'#c62828',-20],[256,40,'#f7c51e',30],[280,20,'#0b4d2c',-45],[96,18,'#f7c51e',15],[204,50,'#0b4d2c',60]].map(([x0, y0, c, r]) => `<rect x="${x0}" y="${y0}" width="12" height="5" rx="2" fill="${c}" transform="rotate(${r} ${x0} ${y0})"/>`).join('')}</svg>
          <span class="bravo-ok">${I.ok}</span>
          <h2>Félicitations !</h2>
          <p>Votre inscription au ${esc(C.evenement.nom)} est ${x.statut === 'paye' ? 'confirmée' : 'enregistrée'}.</p>
        </div>
        <div class="recap-liste">
          <span>${I.personne}<b>${esc(x.prenom)} ${esc(x.nom)}</b></span>
          <span>${I.coureur}Distance : ${esc(d.km.toUpperCase())}</span>
          <span>${I.maillot}Taille : ${esc(x.taille_tshirt || 'non indiquée')}</span>
          <span>${I.cal}${esc(C.evenement.dateTexte)}${C.evenement.dateProvisoire ? ' (provisoire)' : ''}</span>
        </div>
        ${x.statut === 'paiement_declare' ? `<div class="info">${I.info}<span>Paiement en cours de vérification. Votre dossard s'active dès validation par l'équipe.</span></div>` : ''}
        <a class="btn clair" href="${esc(agenda)}" rel="noopener">${I.cal} Ajouter au calendrier</a>
        <button class="btn clair" data-action="partager">${I.partage} Partager</button>
        <a class="btn vert-fonce" href="#dossard">Voir mon dossard</a>
      </div>`;
  };

  async function consulterMoi() {
    if (!S.moi) { S.consult = null; return null; }
    try {
      S.consult = await D.consulter(S.moi.reference, S.moi.telephone);
      if (!S.consult) S.consult = { introuvable: true };
      else if (S.consult.dossard && S.moi.dossard !== S.consult.dossard) { S.moi.dossard = S.consult.dossard; S.moi.distance = S.consult.distance; stockage.ecrire('odc_mes', S.mes); }
    } catch (e) { S.consult = { erreur: e.message }; }
    return S.consult;
  }

  V.dossard = () => {
    const recherche = `
      <form data-form="retrouver" class="carte" novalidate>
        <b>Retrouver une inscription</b>
        <label class="champ">Référence<input name="reference" required placeholder="ODY-XXXXXX" maxlength="20" autocapitalize="characters" autocomplete="off"></label>
        <label class="champ">Téléphone utilisé à l'inscription<input name="telephone" required type="tel" inputmode="tel" maxlength="20"></label>
        <p class="erreur" role="alert"></p>
        <button class="btn" type="submit">Afficher</button>
      </form>`;
    if (!S.moi || S.recherche) return `${entete('Mon dossard', 'accueil')}<div class="pad pile"><p class="note">Votre référence commence par ODY. Elle s'affiche à la fin de l'inscription.</p>${recherche}${S.moi ? '<button class="btn contour" data-action="annuler-recherche">Retour à mes inscriptions</button>' : '<a class="btn contour" href="#course">Je ne suis pas encore inscrit</a>'}</div>`;
    const x = S.consult;
    if (!x) { consulterMoi().then(() => route() === 'dossard' && rendre(false)); return `${entete('Mon dossard', 'accueil')}<p class="vide">Chargement…</p>`; }
    if (x.erreur) return `${entete('Mon dossard', 'accueil')}<div class="pad pile"><div class="info r">${I.info}<span>${esc(x.erreur)}</span></div><button class="btn" data-action="recharger">Réessayer</button></div>`;
    if (x.introuvable) return `${entete('Mon dossard', 'accueil')}<div class="pad pile"><div class="info r">${I.info}<span>Inscription introuvable. Vérifiez la référence et le téléphone.</span></div>${recherche}</div>`;
    const d = distance(x.distance);
    const oublier = `
      <div class="pile" style="gap:8px">
        <a class="btn contour" href="#course">Inscrire une autre personne</a>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
          <button class="btn contour petit" data-action="ajout">Retrouver une autre inscription</button>
          <button class="btn contour petit" data-action="oublier">Retirer de ce téléphone</button>
        </div>
      </div>`;
    const selecteur = S.mes.length > 1 ? `<div class="pad" style="padding-bottom:0"><p class="note" style="margin:0 0 6px">Mes inscriptions sur ce téléphone</p><div class="puces">${S.mes.map((m) => `<button type="button" class="puce" data-action="choisir-moi" data-ref="${esc(m.reference)}" aria-pressed="${m.reference === S.moi.reference}">${esc(m.prenom || m.reference)}</button>`).join('')}</div></div>` : '';
    if (x.statut !== 'paye') {
      return `${entete('Mon inscription', 'accueil')}${selecteur}
        <div class="pad pile">
          <div class="carte pile" style="gap:6px">
            <span class="statut s-${esc(x.statut)}">${esc(STATUT[x.statut] || x.statut)}</span>
            <b style="font-size:20px">${esc(x.prenom)} ${esc(x.nom)}</b>
            <span class="note">${esc(d.km)} · ${esc(d.nom)} · ${CAT[x.categorie] || ''}</span>
            <span class="note">Référence <span class="ref">${esc(x.reference)}</span></span>
            <span class="note">Montant : ${fcfa(x.montant + x.don)}${x.don ? ` dont ${fcfa(x.don)} de don` : ''}</span>
          </div>
          ${x.statut === 'en_attente' ? `<a class="btn j" href="#paiement">Payer maintenant</a>` : ''}
          ${x.statut === 'paiement_declare' ? `<div class="info">${I.info}<span>Votre paiement est en cours de vérification. Revenez plus tard : votre numéro de dossard s'affichera ici.</span></div><button class="btn contour" data-action="recharger">Actualiser</button>` : ''}
          ${x.statut === 'annule' ? `<div class="info r">${I.info}<span>Cette inscription a été annulée. Contactez l'organisation si c'est une erreur.</span></div>` : ''}
          ${oublier}
        </div>`;
    }
    return `
      ${entete('Mon dossard', 'accueil')}
      ${selecteur}
      <div class="pad pile">
        <div class="dossard2" id="dossard-imprimable">
          <div class="d2-logo">${I.logoGrand}<span><b>L'ODYSSÉE</b><small>DE L'ENVIRONNEMENT</small></span></div>
          <span class="d2-numero">${esc(x.dossard)}</span>
          <b class="d2-nom">${esc(x.nom.toUpperCase())} ${esc(x.prenom)}</b>
          <span class="d2-dist">${esc(d.km.toUpperCase())} – ${esc(d.nom)}</span>
          <div id="qr" role="img" aria-label="QR code du dossard ${esc(x.dossard)}"></div>
          <span class="d2-note">Présentez ce QR code le jour de la course.</span>
          <span class="note">Réf. ${esc(x.reference)}${x.retire ? ' · dossard retiré' : ''}</span>
          <svg class="d2-bandes" viewBox="0 0 360 46" preserveAspectRatio="none" aria-hidden="true"><path d="M0 46 L0 18 L150 46 Z" fill="#0b4d2c"/><path d="M120 46 L360 6 L360 26 L230 46 Z" fill="#f7c51e"/><path d="M250 46 L360 28 L360 46 Z" fill="#c62828"/></svg>
        </div>
        <button class="btn clair" data-action="pdf">${I.telecharger} Télécharger (PDF)</button>
        ${oublier}
      </div>`;
  };

  V.fonds = () => {
    const { f, pct, html } = jaugeFonds();
    const publics = [
      ['Veuves', 'Femmes ayant perdu leur conjoint dans une catastrophe'],
      ['Enfants et orphelins', 'Scolarité et soins des plus jeunes'],
      ['Familles sinistrées', 'Inondations, glissements de terrain'],
      ['Malades de la pollution', 'Accès aux soins des personnes touchées']
    ];
    return `
      <div class="fonds-tete" style="padding:0 0 22px">
        ${entete('Fonds de solidarité', 'accueil')}
        <div class="pile" style="padding:6px 20px 0;gap:8px">
          <span style="color:var(--pale);font-size:14px">Nous courons pour celles et ceux que la dégradation de l'environnement a frappés.</span>
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="gros">${fcfa(f.collecte)}</span><span style="color:var(--jaune);font-weight:700;font-size:14px">objectif ${fcfa(f.objectif)}</span></div>
          ${html}
          <span style="color:var(--pale);font-size:13px">${pct} % · ${(f.donateurs || 0).toLocaleString('fr-FR')} donateur${f.donateurs > 1 ? 's' : ''}${f.maj ? ` · mis à jour le ${dateFr(f.maj)}` : ''}</span>
        </div>
      </div>
      <h2 class="titre">Qui le Fonds soutient</h2>
      <div class="grille2" style="padding:0 16px">${publics.map(([t, d]) => `<div class="carte pile" style="gap:4px"><b>${t}</b><span class="note">${d}</span></div>`).join('')}</div>
      <div class="pad pile">
        <div class="info">${I.bouclier}<span>Chaque don est vérifié avant d'entrer dans la jauge. L'association publiera l'usage des fonds après la course.</span></div>
        <a class="btn r" href="#don">Faire un don</a>
      </div>`;
  };

  V.don = () => {
    if (S.don && S.don.etape === 'payer') {
      return `${entete('Faire un don', 'fonds')}${blocPaiement('don', S.don.reference, S.don.telephone, S.don.montant)}
        <div class="pad"><button class="btn contour petit" data-action="nouveau-don">Faire un autre don</button></div>`;
    }
    if (S.don && S.don.etape === 'fait') {
      return `${entete('Merci !', 'fonds')}<div class="pad pile"><div class="info">${I.ok}<span>Votre don de ${fcfa(S.don.montant)} (référence ${esc(S.don.reference)}) est enregistré. Il apparaîtra dans la jauge dès que l'équipe aura vérifié le paiement.</span></div>
        <a class="btn" href="#fonds">Voir le Fonds</a><button class="btn contour" data-action="nouveau-don">Faire un autre don</button></div>`;
    }
    const m = S.donMontant || 2000;
    const vals = [1000, 2000, 5000, 10000, 25000];
    return `
      ${entete('Faire un don', 'fonds', 'Fonds de solidarité environnementale')}
      <div class="pad">
        <form data-form="don" novalidate>
          <fieldset style="border:0;padding:0;margin:0" class="pile"><legend style="font-size:13px;font-weight:700;margin-bottom:6px">Montant</legend>
            <div class="puces">${vals.map((v) => `<button type="button" class="puce" data-action="don-montant" data-v="${v}" aria-pressed="${m === v}">${fcfa(v).replace(' FCFA', '')}</button>`).join('')}</div>
            <label class="champ">Ou un autre montant (FCFA)<input name="montant" type="number" min="100" max="10000000" step="100" inputmode="numeric" value="${m}"></label>
          </fieldset>
          <label class="champ">Votre nom <small>facultatif, jamais publié</small><input name="nom" maxlength="80" autocomplete="name"></label>
          <label class="champ">Téléphone Mobile Money<input name="telephone" required type="tel" inputmode="tel" maxlength="20" value="${esc(S.moi ? S.moi.telephone : '')}"></label>
          <p class="erreur" role="alert"></p>
          <button class="btn r" type="submit">Continuer vers le paiement</button>
        </form>
      </div>`;
  };

  function prixPanier() {
    let total = 0; let inconnu = false; let n = 0;
    for (const [id, l] of Object.entries(S.panier)) {
      const a = C.boutique.articles.find((x) => x.id === id); if (!a || !l.qte) continue;
      n += l.qte; if (a.prix == null) inconnu = true; else total += a.prix * l.qte;
    }
    return { total, inconnu, n };
  }

  V.boutique = () => {
    if (S.commandeFaite) {
      return `<div style="background:var(--vert)">${entete('Boutique Odyssée', 'accueil')}</div><div class="pad pile">
        <div class="info">${I.ok}<span>Précommande enregistrée, référence <span class="ref">${esc(S.commandeFaite)}</span>. L'équipe vous appelle pour confirmer le prix, le paiement et le retrait.</span></div>
        <button class="btn" data-action="nouvelle-commande">Faire une autre commande</button></div>`;
    }
    const tailles = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const cartes = C.boutique.articles.map((a) => {
      const l = S.panier[a.id] || { qte: 0, taille: 'M' };
      return `<div class="produit">
        <div class="p-visuel">${VISUELS[a.visuel || a.id] || VISUELS.tshirt}</div>
        <b>${esc(a.nom)}</b>
        <div class="p-bas"><span>${a.prix == null ? 'Prix à venir' : fcfa(a.prix)}</span>
          ${l.qte ? `<span class="qte petit-qte"><button type="button" data-action="qte" data-id="${a.id}" data-d="-1" aria-label="Retirer">−</button><output>${l.qte}</output><button type="button" data-action="qte" data-id="${a.id}" data-d="1" aria-label="Ajouter">+</button></span>`
            : `<button type="button" class="p-panier" data-action="qte" data-id="${a.id}" data-d="1" aria-label="Ajouter ${esc(a.nom)} au panier">${I.chariot}</button>`}</div>
        ${a.tailles && l.qte ? `<div class="tailles" role="group" aria-label="Taille">${tailles.map((t) => `<button type="button" data-action="taille" data-id="${a.id}" data-t="${t}" aria-pressed="${l.taille === t}">${t}</button>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
    const p = prixPanier();
    return `
      <div style="background:var(--vert);padding-bottom:2px">${entete('Boutique Odyssée', 'accueil')}
        <nav class="onglets" aria-label="Rayons"><a class="onglet" href="#boutique" aria-current="page">Tenue et goodies</a><a class="onglet" href="#produits">Produits partenaires</a></nav></div>
      <div class="grille-produits">${cartes}</div>
      <p class="note pad" style="padding-bottom:0">Achat facultatif, séparé de l'inscription. <a href="${esc(C.boutique.catalogueUrl)}" rel="noopener">Voir toute la collection</a></p>
      ${p.n ? `
      <div class="pad">
        <form data-form="commande" class="carte" novalidate>
          <b>Mon panier · ${p.n} article${p.n > 1 ? 's' : ''}</b>
          <label class="champ">Nom<input name="nom" required maxlength="80" value="${esc(prenomActuel())}"></label>
          <label class="champ">Téléphone<input name="telephone" required type="tel" inputmode="tel" maxlength="20" value="${esc((S.profil && S.profil.telephone) || (S.moi ? S.moi.telephone : ''))}"></label>
          <label class="champ">Référence d'inscription <small>facultatif, pour un retrait avec le dossard</small><input name="inscription_ref" maxlength="20" value="${esc(S.moi ? S.moi.reference : '')}"></label>
          <p class="erreur" role="alert"></p>
          <div class="recap"><span>Total</span><b>${p.inconnu ? 'Prix à confirmer' : fcfa(p.total)}</b></div>
          <button class="btn" type="submit">Envoyer ma précommande</button>
        </form>
      </div>` : ''}`;
  };

  const VISUELS = {
    tshirt: '<svg viewBox="0 0 120 100" aria-hidden="true"><path d="M38 10 14 24l10 20 10-5v52h52V39l10 5 10-20-24-14c0 8-9 14-22 14S38 18 38 10z" fill="#fff" stroke="#0b4d2c" stroke-width="3"/><path d="M14 24l10 20 10-5" fill="#c62828"/><circle cx="60" cy="50" r="10" fill="#f7c51e"/><path d="M55 55c0-6 4-9 10-10-1 6-4 10-10 10z" fill="#0b4d2c"/></svg>',
    pack: '<svg viewBox="0 0 120 100" aria-hidden="true"><path d="M30 14 10 26l8 16 8-4v46h40V38l8 4 8-16-20-12c0 6-7 11-18 11S30 20 30 14z" fill="#0b4d2c"/><circle cx="48" cy="48" r="8" fill="#f7c51e"/><path d="M70 66c0-14 11-24 25-24s25 10 25 24z" fill="#f7c51e" transform="translate(-14 4)"/><path d="M56 70h52l-6 6H56z" fill="#0b4d2c" transform="translate(-14 4)"/></svg>',
    short: '<svg viewBox="0 0 120 100" aria-hidden="true"><path d="M30 14h60l8 70-28 4-10-38-10 38-28-4z" fill="#13241a"/><path d="M30 14h60v10H30z" fill="#f7c51e"/></svg>',
    casquette: '<svg viewBox="0 0 120 100" aria-hidden="true"><path d="M24 64c0-24 16-40 36-40s36 16 36 40z" fill="#0b4d2c"/><path d="M14 64h92l-10 12H14z" fill="#0b4d2c" opacity=".8"/><circle cx="60" cy="48" r="9" fill="#f7c51e"/></svg>',
    gourde: '<svg viewBox="0 0 120 100" aria-hidden="true"><rect x="46" y="6" width="28" height="12" rx="3" fill="#13241a"/><path d="M42 18h36v8c6 4 8 10 8 16v44a8 8 0 0 1-8 8H42a8 8 0 0 1-8-8V42c0-6 2-12 8-16z" fill="#0b4d2c"/><rect x="40" y="48" width="40" height="18" fill="#f7c51e"/></svg>',
    sac: '<svg viewBox="0 0 120 100" aria-hidden="true"><path d="M40 32c0-14 8-22 20-22s20 8 20 22" fill="none" stroke="#c9a35a" stroke-width="5"/><path d="M26 32h68l-6 60H32z" fill="#efe4cc"/><circle cx="60" cy="60" r="10" fill="#f7c51e"/><path d="M55 65c0-6 4-9 10-10-1 6-4 10-10 10z" fill="#0b4d2c"/></svg>'
  };

  V.produits = () => `
    <div style="background:var(--vert);padding-bottom:2px">${entete('Boutique Odyssée', 'accueil')}
      <nav class="onglets" aria-label="Rayons"><a class="onglet" href="#boutique">Tenue de course</a><a class="onglet" href="#produits" aria-current="page">Produits partenaires</a></nav></div>
    <h2 class="titre">Les produits de la course</h2>
    <p class="sous">Proposés par nos partenaires, au village de la course et aux ravitaillements.</p>
    <div class="pile" style="padding:0 16px">${C.partenaires.map((p) => `
      <div class="carte article">
        <span class="vignette" style="background:${p.icone === 'eau' ? '#e3f0fb' : p.icone === 'gel' ? 'var(--vert-c)' : 'var(--jaune-c)'};color:${p.icone === 'eau' ? '#1d5f99' : p.icone === 'gel' ? 'var(--vert)' : '#7a5b00'}">${I[p.icone] || I.sac}</span>
        <div style="flex:1;display:flex;flex-direction:column;gap:4px">
          <span style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><b>${esc(p.nom)}</b>${p.badge ? `<span class="tag">${esc(p.badge)}</span>` : ''}${p.exemple ? '<span class="tag ex">Exemple</span>' : ''}</span>
          <span class="note">${esc(p.texte)}</span>
        </div>
      </div>`).join('')}</div>
    <div class="pad pile">
      <div class="info">${I.lieu}<span>Retrouvez ces produits au village de la course, sur les ravitaillements et dans le sac du coureur.</span></div>
      <a class="btn contour" href="${esc(C.siteUrl)}#partenaires" rel="noopener">Devenir partenaire de la course</a>
    </div>`;


  // ---------------------------------------------------------------
  // Actualités, bénévoles, résultats
  // ---------------------------------------------------------------
  function carteAnnonce(a, court) {
    return `<article class="carte pile annonce${court ? ' court' : ''}" style="gap:4px">
      <span class="note">${dateFr(a.created_at)}</span><b>${esc(a.titre)}</b><p>${esc(a.texte)}</p></article>`;
  }

  V.actualites = () => `${entete('Actualités', 'accueil')}
    <div class="pad pile">${S.annonces.length ? S.annonces.map((a) => carteAnnonce(a)).join('') : '<p class="vide">Aucune actualité pour le moment.</p>'}</div>`;

  const MISSIONS = [
    ['ravitaillement', 'Ravitaillement des coureurs', "Servir l'eau et les fruits sur le parcours"],
    ['retrait', 'Accueil et retrait des dossards', 'Remettre les dossards la veille et le matin'],
    ['securite', 'Sécurité du parcours', 'Signaleur aux carrefours, avec un gilet'],
    ['dechets', 'Tri et ramassage des déchets', 'Pour une course zéro déchet'],
    ['village', 'Village de la course', 'Accueil du public, stands, boutique'],
    ['animation', 'Animation et ambiance', 'Encourager les coureurs, musique']
  ];

  V.benevoles = () => {
    if (S.benevoleFait) return `${entete('Merci !', 'accueil')}<div class="pad pile">
      <div class="info">${I.ok}<span>Votre candidature est enregistrée, référence <span class="ref">${esc(S.benevoleFait)}</span>. L'équipe vous appellera avant la course pour confirmer votre mission.</span></div>
      <a class="btn" href="#accueil">Retour à l'accueil</a></div>`;
    return `${entete('Devenir bénévole', 'accueil', C.evenement.nom)}
      <div class="pad">
        <form data-form="benevole" novalidate>
          <p class="note" style="margin:0">Sans les bénévoles, pas de course. Choisissez une ou plusieurs missions : l'équipe vous forme et vous équipe.</p>
          <fieldset style="border:0;padding:0;margin:0" class="pile"><legend style="font-size:13px;font-weight:700;margin-bottom:6px">Missions qui m'intéressent</legend>
            ${MISSIONS.map(([id, t, d]) => `<label class="case carte" style="padding:12px"><input type="checkbox" name="missions" value="${id}"><span><b>${t}</b><br><span class="note">${d}</span></span></label>`).join('')}
          </fieldset>
          <fieldset style="border:0;padding:0;margin:0" class="pile"><legend style="font-size:13px;font-weight:700;margin-bottom:6px">Mes disponibilités</legend>
            ${['La veille (retrait des dossards)', 'Le jour J, le matin', 'Le jour J, toute la journée'].map((t) => `<label class="case"><input type="checkbox" name="dispo" value="${esc(t)}"><span>${t}</span></label>`).join('')}
          </fieldset>
          <div class="grille2">
            <label class="champ">Nom<input name="nom" required maxlength="80" autocomplete="family-name"></label>
            <label class="champ">Prénom<input name="prenom" required maxlength="80" autocomplete="given-name"></label>
          </div>
          <label class="champ">Téléphone<input name="telephone" required type="tel" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="+237"></label>
          <div class="grille2">
            <label class="champ">E-mail <small>facultatif</small><input name="email" type="email" maxlength="120" autocomplete="email"></label>
            <label class="champ">Taille de t-shirt<select name="taille_tshirt"><option value="">Choisir</option>${['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((t) => `<option>${t}</option>`).join('')}</select></label>
          </div>
          <label class="champ">Ville ou quartier<input name="ville" maxlength="80" value="Yaoundé"></label>
          <label class="case"><input type="checkbox" name="consentement" required> <span>J'accepte que L'Odyssée de l'environnement au Cameroun garde mes coordonnées pour organiser les bénévoles de la course, selon la loi n° 2024/017.</span></label>
          <p class="erreur" role="alert"></p>
          <button class="btn" type="submit">Envoyer ma candidature</button>
        </form>
      </div>`;
  };

  async function chercherResultats(q) {
    S.resQ = q === '*' ? '' : q; S.resChargement = true; if (route() === 'resultats') majResultats();
    try { S.res = await D.resultats(q); S.resErreur = null; } catch (e) { S.resErreur = e.message; S.res = []; }
    S.resChargement = false; if (route() === 'resultats') majResultats();
  }
  function majResultats() { const el = document.getElementById('res-liste'); if (el) el.innerHTML = listeResultats(); }
  function listeResultats() {
    if (S.resChargement) return '<p class="vide">Chargement…</p>';
    if (S.resErreur) return `<div class="info r">${I.info}<span>${esc(S.resErreur)}</span></div>`;
    const mesDossards = S.mes.map((m) => m.dossard).filter(Boolean);
    let res = (S.res || []).filter((r) => r.distance === S.resDist);
    if (S.resSexe !== 'tous') res = res.filter((r) => r.sexe === S.resSexe);
    if (!res.length) return `<p class="vide">${S.resQ ? 'Aucun coureur trouvé.' : 'Aucun résultat pour cette distance.'}</p>`;
    const rangDe = (r) => (S.resSexe === 'tous' ? r.rang : r.rang_sexe);
    const med = (n) => (n <= 3 ? `<span class="medaille m${n}">${n}</span>` : `<span class="rang-num">${n}</span>`);
    const top = res.filter((r) => S.resTout || S.resQ || rangDe(r) <= 10);
    const moi = res.filter((r) => mesDossards.includes(r.dossard) && !top.includes(r));
    const ligne = (r) => `<div class="cl-ligne${mesDossards.includes(r.dossard) ? ' moi' : ''}">${med(rangDe(r))}<span class="cl-nom">${esc(r.prenom)} ${esc(r.nom_initiale)}<small>Dossard ${esc(r.dossard)}</small></span><span class="cl-temps">${esc(r.temps)}</span></div>`;
    return `<div class="carte cl">${top.map(ligne).join('')}${moi.length ? '<div class="cl-sep"></div>' + moi.map(ligne).join('') : ''}</div>
      ${!S.resTout && !S.resQ ? '<button class="btn clair" data-action="res-complet">Voir le classement complet</button>' : ''}`;
  }

  V.resultats = () => {
    const publie = S.etat && S.etat.resultats;
    const d = distance(S.resDist);
    return `${entete('Classement – ' + d.km.toUpperCase(), 'evenements')}
      <div class="pad pile">
        <div class="onglets-dist">${C.distances.map((x) => `<button type="button" data-action="res-dist" data-id="${x.id}" aria-pressed="${x.id === S.resDist}" class="od-${x.couleur}">${esc(x.km.toUpperCase())}</button>`).join('')}</div>
        ${publie || (S.res && S.res.length) ? `
        ${segments('resSexe', [['tous', 'Général'], ['M', 'Hommes'], ['F', 'Femmes']])}
        <form data-form="resultats" class="filtres" role="search" novalidate>
          <input name="q" type="search" placeholder="Dossard, prénom ou nom" value="${esc(S.resQ || '')}" aria-label="Rechercher un coureur">
          <button class="btn petit" type="submit">Chercher</button>
          ${S.resQ ? '<button class="btn contour petit" type="button" data-action="res-tout">Effacer</button>' : ''}
        </form>
        <div id="res-liste" class="pile">${listeResultats()}</div>` : `
        <div class="info">${I.info}<span>Le classement sera publié ici après la course. Votre ligne sera surlignée en jaune.</span></div>`}
      </div>`;
  };

  // ---------------------------------------------------------------
  // Scan des QR codes (retrait des dossards)
  // ---------------------------------------------------------------
  let scan = null;
  function chargerScript(src) {
    return new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = ko; document.head.appendChild(sc); });
  }
  async function demarrerScan() {
    const zone = document.getElementById('scan-zone'); if (!zone) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { zone.innerHTML = `<div class="info r">${I.info}<span>Caméra indisponible sur cet appareil. Tapez la référence ou le numéro.</span></div>`; return; }
    zone.innerHTML = `<div class="scanner"><video playsinline muted></video><span class="cadre"></span></div><button class="btn contour petit" data-action="scan-stop">Arrêter la caméra</button>`;
    const video = zone.querySelector('video');
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = flux; await video.play();
      let detecteur = null;
      if ('BarcodeDetector' in window) { try { detecteur = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detecteur = null; } }
      if (!detecteur && !window.jsQR) await chargerScript('js/vendor/jsQR.js');
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
      scan = { flux, actif: true };
      const boucle = async () => {
        if (!scan || !scan.actif) return;
        let texte = null;
        try {
          if (detecteur) { const r = await detecteur.detect(video); if (r.length) texte = r[0].rawValue; }
          else if (video.videoWidth) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height); const r = window.jsQR(img.data, img.width, img.height); if (r) texte = r.data;
          }
        } catch (e) { /* image suivante */ }
        if (texte) { surQR(texte); return; }
        setTimeout(boucle, 250);
      };
      boucle();
    } catch (e) {
      arreterScan();
      const z = document.getElementById('scan-zone');
      if (z) z.innerHTML = `<div class="info r">${I.info}<span>La caméra n'a pas pu s'ouvrir (autorisation refusée ou non disponible ici). Tapez la référence ou le numéro.</span></div>`;
    }
  }
  function arreterScan() {
    if (scan) { scan.actif = false; scan.flux.getTracks().forEach((t) => t.stop()); scan = null; }
    const z = document.getElementById('scan-zone'); if (z) z.innerHTML = boutonScan();
  }
  function surQR(texte) {
    arreterScan();
    const m = /^ODC\|([A-Z0-9-]+)\|/.exec(String(texte));
    const cle = m ? m[1] : String(texte).trim();
    S.adm.r = cle;
    const champ = document.querySelector('[data-filtre=retrait]'); if (champ) champ.value = cle;
    const liste = document.getElementById('adm-liste'); if (liste) liste.innerHTML = admRetrait();
    if (navigator.vibrate) { try { navigator.vibrate(120); } catch (e) { /* sans vibreur */ } }
    toast(m ? 'QR code lu' : 'Ce QR code ne vient pas de l’appli');
  }
  const boutonScan = () => `<button class="btn j" data-action="scan">Scanner le QR code du coureur</button>`;

  // ---------------------------------------------------------------
  // Plateforme communautaire : modules
  // ---------------------------------------------------------------
  const TYPES = {
    course: ['Course', I.coureur], hackathon: ['Hackathon', I.info], forum: ['Forum', I.info], atelier: ['Atelier', I.info],
    collecte: ['Collecte de déchets', I.sac], reboisement: ['Reboisement', I.feuille], recyclage: ['Recyclage', I.feuille],
    sensibilisation: ['Sensibilisation', I.info], autre: ['Autre', I.info]
  };
  const MODULES = [
    ['evenements', 'Événements', I.cal, 'vert'], ['course', 'Inscription 10 KM', '<img src="images/coureur-vert.png" alt="" class="m-coureur">', 'jaune'], ['parcours', 'Parcours', I.lieu, 'clair'],
    ['actions', 'Actions', I.feuille, 'clair'], ['communaute', 'Communauté', I.groupe, 'clair'], ['resultats', 'Résultats', I.coupe, 'clair'],
    ['impact', 'Impact', I.graphe, 'clair'], ['boutique', 'Boutique', I.sac, 'jaune'], ['partenaires', 'Partenaires', I.poignee, 'clair'],
    ['fonds', 'Solidarité', I.coeur, 'rouge'], ['formations', 'Formations', I.livre, 'clair'], ['actualites', 'Actualités', I.journal, 'clair'],
    ['carte', 'Carte', I.carteIco, 'vert'], ['fil', 'Fil photos', I.appareil, 'jaune']
  ];
  const aujourdhui = () => new Date().toISOString().slice(0, 10);
  const passe = (e) => { const f = e.date_fin || e.date_debut; return !!f && f < aujourdhui(); };
  const quand = (e) => e.date_texte || (e.date_debut ? dateFr(e.date_debut) + (e.date_fin && e.date_fin !== e.date_debut ? ' au ' + dateFr(e.date_fin) : '') : 'Date à confirmer');

  async function chargerListe(cle, fn) {
    try { S[cle] = await fn(); } catch (e) { S[cle + 'Err'] = e.message; }
    rendre(false);
  }

  const BANNIERES = { course: ['#0b4d2c', '#f7c51e'], hackathon: ['#1d4f80', '#f7c51e'], forum: ['#5b3f99', '#f7c51e'], atelier: ['#0b4d2c', '#fdf1c4'],
    collecte: ['#0b4d2c', '#f7c51e'], reboisement: ['#2f7a46', '#e7f3dc'], recyclage: ['#1f6b5a', '#dcf0ec'], sensibilisation: ['#7a5b00', '#fdf1c4'], autre: ['#0b4d2c', '#e3f1e6'] };
  function visuelEv(e, cls) {
    if (e.image) return `<img class="${cls}" src="${esc(e.image)}" alt="" loading="lazy">`;
    if (e.type === 'course') return `<img class="${cls}" src="images/hero-accueil.jpg" alt="" loading="lazy">`;
    const [fond, clair] = BANNIERES[e.type] || BANNIERES.autre;
    return `<span class="${cls} ev-motif" style="background:${fond};color:${clair}">${(TYPES[e.type] || TYPES.autre)[1]}</span>`;
  }
  const enCours = (e) => { const t = aujourdhui(); return !!e.date_debut && e.date_debut <= t && (e.date_fin || e.date_debut) >= t; };
  function carteEv(e, style) {
    const [lib] = TYPES[e.type] || TYPES.autre;
    const plein = e.places && e.inscrits >= e.places;
    const sous = e.type === 'course' ? '3 KM • 5 KM • 10 KM' : `${lib}${e.ville ? ' · ' + e.ville : ''}`;
    if (style === 'banniere') {
      return `<button type="button" class="carte ev-banniere" data-action="ouvrir-ev" data-id="${esc(e.id)}">${visuelEv(e, 'ev-img')}
        <span class="ev-texte"><span class="pile" style="gap:1px;flex:1;text-align:left"><b>${esc(e.titre)}</b><span>${esc(sous)}</span><span class="note">${esc(quand(e))}</span></span><span class="chevron" aria-hidden="true">›</span></span></button>`;
    }
    return `<button type="button" class="carte ev" data-action="ouvrir-ev" data-id="${esc(e.id)}">
      ${visuelEv(e, 'ev-vignette')}
      <span class="pile" style="gap:2px;flex:1;text-align:left">
        <b>${esc(e.titre)}</b>
        <span class="note">${esc([e.ville, quand(e)].filter(Boolean).join(' – '))}${e.places ? ` · ${plein ? 'complet' : `${Math.max(0, e.places - e.inscrits)} places`}` : ''}</span>
      </span>
      <span class="chevron" aria-hidden="true">›</span>
    </button>`;
  }

  function listeEvs(rubrique, filtre, style) {
    if (!S.evs) return '<p class="vide">Chargement…</p>';
    let l = S.evs.filter((e) => e.rubrique === rubrique);
    if (filtre === 'avenir') l = l.filter((e) => !passe(e) && !enCours(e));
    if (filtre === 'encours') l = l.filter(enCours);
    if (filtre === 'passes') l = l.filter(passe).reverse();
    if (filtre === 'realisees') l = l.filter((e) => passe(e) || e.bilan || e.dechets_kg > 0 || e.arbres > 0 || e.sensibilises > 0).reverse();
    return l.length ? l.map((e) => carteEv(e, style)).join('') : `<p class="vide">${filtre === 'avenir' ? 'Rien de prévu pour le moment. Revenez bientôt.' : filtre === 'encours' ? 'Rien en cours aujourd’hui.' : 'Aucun élément.'}</p>`;
  }

  function segments(cle, opts) {
    return `<div class="segments" role="group">${opts.map(([v, t]) => `<button type="button" data-action="segment" data-cle="${cle}" data-v="${v}" aria-pressed="${S[cle] === v}">${t}</button>`).join('')}</div>`;
  }

  V.evenements = () => `${entete('Événements', 'accueil')}
    <div class="pad pile">
      ${segments('evFiltre', [['avenir', 'À venir'], ['encours', 'En cours'], ['passes', 'Passés']])}
      ${listeEvs('evenement', S.evFiltre, 'banniere')}
    </div>`;

  V.actions = () => `${entete('Nos actions', 'accueil')}
    <div class="pad pile">
      ${segments('acFiltre', [['toutes', 'Toutes'], ['encours', 'En cours'], ['realisees', 'Réalisées']])}
      ${listeEvs('action', S.acFiltre === 'toutes' ? 'toutes' : S.acFiltre)}
      <a class="carte lien-carte" href="#impact" style="background:var(--vert);border-color:var(--vert);color:#fff"><span class="pile" style="gap:2px"><b>Notre impact</b><span style="color:var(--pale);font-size:13px">Déchets collectés, arbres plantés, personnes sensibilisées</span></span><span style="color:var(--jaune)">Voir</span></a>
      <a class="btn contour" href="#projet">Proposer une action</a>
    </div>`;

  V.evenement = () => {
    const e = S.evs && S.evs.find((x) => x.id === S.evSel);
    const retour = e && e.rubrique === 'action' ? 'actions' : 'evenements';
    if (!e) return `${entete('Événement', retour)}<p class="vide">${S.evs ? 'Événement introuvable.' : 'Chargement…'}</p>`;
    const [lib] = TYPES[e.type] || TYPES.autre;
    const fini = passe(e); const plein = e.places && e.inscrits >= e.places;
    const deja = S.parts.find((p) => p.evenement_id === e.id);
    let action = '';
    if (e.inscription === 'course20km') action = `<a class="btn j" href="#course">S'inscrire à la course</a>`;
    else if (e.inscription === 'externe' && e.lien) action = `<a class="btn" href="${esc(e.lien)}" rel="noopener">S'inscrire sur le site de l'événement</a>`;
    else if (e.inscription === 'participation' && !fini) {
      if (S.partFaite === e.id) action = `<div class="info">${I.ok}<span>C'est noté ! Référence <span class="ref">${esc(deja ? deja.reference : '')}</span>. L'équipe vous contactera avant l'action.</span></div>`;
      else if (plein) action = `<div class="info j">${I.info}<span>Complet. Suivez les actualités pour la prochaine date.</span></div>`;
      else action = `${deja ? `<div class="info">${I.ok}<span>Vous êtes inscrit (${esc(deja.reference)}). Vous pouvez inscrire une autre personne.</span></div>` : ''}
        <form data-form="participation" class="carte" novalidate>
          <b>Je participe</b>
          <div class="grille2"><label class="champ">Prénom<input name="prenom" required maxlength="80" value="${esc(S.moi && !deja ? S.moi.prenom || '' : '')}"></label><label class="champ">Nom<input name="nom" required maxlength="80"></label></div>
          <label class="champ">Téléphone<input name="telephone" required type="tel" inputmode="tel" maxlength="20" value="${esc(S.moi ? S.moi.telephone : '')}"></label>
          <div class="grille2"><label class="champ">Nombre de personnes<input name="personnes" type="number" min="1" max="20" value="1" inputmode="numeric"></label><label class="champ">E-mail <small>facultatif</small><input name="email" type="email" maxlength="120"></label></div>
          <label class="champ">Message <small>facultatif</small><input name="message" maxlength="500" placeholder="École, association, matériel apporté…"></label>
          <label class="case"><input type="checkbox" name="consentement" required> <span>J'accepte que L'Odyssée de l'environnement au Cameroun garde mes coordonnées pour organiser cette action (loi n° 2024/017).</span></label>
          <p class="erreur" role="alert"></p>
          <button class="btn" type="submit">Confirmer ma participation</button>
        </form>`;
    } else if (!fini) action = `<div class="info">${I.info}<span>Pas d'inscription nécessaire. Les informations pratiques seront publiées dans les actualités.</span></div>`;
    const bilan = e.bilan || e.dechets_kg > 0 || e.arbres > 0 || e.sensibilises > 0;
    return `${entete(lib, retour)}
      <div class="pad pile">
        <h2 style="margin:0;font-size:24px;line-height:1.2">${esc(e.titre)}</h2>
        ${e.resume ? `<p style="margin:0;color:var(--doux)">${esc(e.resume)}</p>` : ''}
        <div class="carte pile" style="gap:8px">
          <span style="display:flex;gap:10px;align-items:center;color:var(--vert)">${I.cal}<span style="color:var(--encre)">${esc(quand(e))}</span></span>
          ${e.lieu || e.ville ? `<span style="display:flex;gap:10px;align-items:center;color:var(--vert)">${I.lieu}<span style="color:var(--encre)">${esc([e.lieu, e.ville].filter(Boolean).join(', '))}</span></span>` : ''}
          ${e.places ? `<span style="display:flex;gap:10px;align-items:center;color:var(--vert)">${I.groupe}<span style="color:var(--encre)">${esc(e.inscrits)} inscrit${e.inscrits > 1 ? 's' : ''} sur ${esc(e.places)} places</span></span>` : ''}
        </div>
        ${e.description ? `<p style="margin:0;white-space:pre-line">${esc(e.description)}</p>` : ''}
        ${bilan ? `<div class="carte pile" style="gap:6px;border-color:var(--vert)"><b>Bilan</b>
          <div class="stats">${e.dechets_kg > 0 ? `<div class="stat"><b>${esc(fmtKg(e.dechets_kg))}</b><span>de déchets collectés</span></div>` : ''}${e.arbres > 0 ? `<div class="stat"><b>${esc(e.arbres)}</b><span>arbres plantés</span></div>` : ''}${e.sensibilises > 0 ? `<div class="stat"><b>${esc(e.sensibilises)}</b><span>personnes sensibilisées</span></div>` : ''}</div>
          ${e.bilan ? `<p style="margin:0;white-space:pre-line">${esc(e.bilan)}</p>` : ''}</div>` : ''}
        ${action}
      </div>`;
  };

  const fmtKg = (kg) => (kg >= 1000 ? (Math.round(kg / 100) / 10).toLocaleString('fr-FR') + ' t' : Math.round(kg).toLocaleString('fr-FR') + ' kg');

  V.impact = () => {
    const m = S.impact;
    if (!m) { if (!S.impactCharge) { S.impactCharge = true; chargerListe('impact', D.impact); } return `${entete('Notre impact', 'actions')}<p class="vide">Chargement…</p>`; }
    const nb = (v) => Number(v || 0).toLocaleString('fr-FR');
    const lignes = [
      [fmtKg(m.dechets_kg), 'de déchets collectés', I.feuille], [nb(m.arbres), 'arbres plantés', I.arbre],
      [nb(m.sensibilises), 'citoyens sensibilisés', I.groupe], [fmtKg(m.recycles_kg || 0), 'de déchets recyclés', I.recycle]
    ];
    const petits = [[m.actions, 'actions réalisées'], [m.participants, 'participants présents'], [m.benevoles, 'bénévoles mobilisés'], [m.ambassadeurs, 'ambassadeurs'], [fcfa(m.fonds), 'au Fonds de solidarité']];
    return `${entete('Notre impact', 'actions')}
      <div class="pad pile">
        ${lignes.map(([v, t, ico]) => `<div class="imp-ligne"><span class="imp-ico">${ico}</span><span class="pile" style="gap:0"><b>${esc(v)}</b><span>${t}</span></span></div>`).join('')}
        <div class="imp-petits">${petits.map(([v, t]) => `<div><b>${esc(v)}</b><span>${t}</span></div>`).join('')}</div>
        <button class="btn clair" data-action="rapport">${S.rapport ? 'Masquer le rapport' : 'Voir le rapport complet'} ${I.fleche}</button>
        ${S.rapport ? `<div class="pile" id="rapport">
          <div class="info">${I.bouclier}<span>Chaque chiffre est saisi par l'équipe après une action, à partir des pesées et des comptages sur le terrain. Aucune estimation.</span></div>
          ${m.bilans && m.bilans.length ? m.bilans.map((b) => `<div class="carte pile" style="gap:4px"><b>${esc(b.titre)}</b><span class="note">${esc(b.date ? (String(b.date).length === 10 ? dateFr(b.date) : b.date) : '')}${b.ville ? ' · ' + esc(b.ville) : ''}</span>
            <span class="note">${[b.dechets_kg > 0 ? fmtKg(b.dechets_kg) + ' collectés' : '', b.recycles_kg > 0 ? fmtKg(b.recycles_kg) + ' recyclés' : '', b.arbres > 0 ? b.arbres + ' arbres' : '', b.sensibilises > 0 ? b.sensibilises + ' personnes sensibilisées' : ''].filter(Boolean).map(esc).join(' · ')}</span>
            ${b.bilan ? `<p style="margin:0;white-space:pre-line">${esc(b.bilan)}</p>` : ''}</div>`).join('') : '<p class="vide">Les premiers bilans apparaîtront après les premières actions.</p>'}
        </div>` : ''}
        <svg class="foret" viewBox="0 0 390 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><path d="M0 70 C90 50 200 56 280 62 C330 66 360 58 390 54 L390 90 L0 90 Z" fill="#5aa83f"/><g fill="#2f7a46"><path d="M60 64c-16 0-20-18-6-22 0-12 22-12 24 0 14 4 10 22-6 22z"/><rect x="64" y="60" width="4" height="14"/><path d="M300 60c-6-18 4-34 10-40 6 6 16 22 10 40z"/><rect x="308" y="56" width="4" height="12"/><path d="M150 66c-10 0-12-12-4-14 0-8 14-8 16 0 8 2 6 14-4 14z"/></g></svg>
      </div>`;
  };

  V.communaute = () => `${entete('Communauté', 'accueil')}
    <div class="pad pile">
      <p style="margin:0;color:var(--doux)">Rejoignez celles et ceux qui agissent pour l'environnement, à Yaoundé, Douala, Bruxelles et ailleurs.</p>
      ${[['fil', "Fil d'actualité", 'Les photos des membres : collectes, plantations, événements', I.appareil],
         ['carte', 'Carte', 'Événements, actions et points de collecte près de chez vous', I.carteIco],
         ['ambassadeurs', 'Ambassadeurs Odyssée', 'Représenter Odyssée dans votre ville ou votre école', I.groupe],
         ['benevoles', 'Bénévolat', 'Aider pendant la course et les actions', I.coeur],
         ['groupes', 'Groupes locaux', 'Échanger avec les membres près de chez vous', I.lieu],
         ['projet', 'Proposer un projet', 'Une idée d’action ? Présentez-la à l’équipe', I.feuille],
         ['partenariat', 'Devenir partenaire', 'Entreprises et institutions : soutenir Odyssée', I.poignee]]
        .map(([h, t, d, ico]) => `<a class="carte module-ligne" href="#${h}"><span class="vignette v-ev">${ico}</span><span class="pile" style="gap:2px;flex:1"><b>${t}</b><span class="note">${d}</span></span><span aria-hidden="true" style="color:var(--vert);font-size:22px">›</span></a>`).join('')}
    </div>`;

  function formCandidature(type) {
    const champs = {
      ambassadeur: `<div class="grille2"><label class="champ">Prénom<input name="prenom" required maxlength="80"></label><label class="champ">Nom<input name="nom" required maxlength="80"></label></div>
        <label class="champ">Ville ou école<input name="ville" required maxlength="80"></label>
        <label class="champ">Pourquoi voulez-vous devenir ambassadeur ?<textarea name="message" required maxlength="3000" rows="4"></textarea></label>`,
      projet: `<div class="grille2"><label class="champ">Prénom<input name="prenom" required maxlength="80"></label><label class="champ">Nom<input name="nom" required maxlength="80"></label></div>
        <label class="champ">Titre du projet<input name="titre" required maxlength="140"></label>
        <label class="champ">Ville<input name="ville" maxlength="80"></label>
        <label class="champ">Décrivez votre projet : objectif, lieu, besoins<textarea name="message" required maxlength="3000" rows="6"></textarea></label>`,
      partenaire: `<label class="champ">Entreprise ou institution<input name="organisation" required maxlength="120"></label>
        <div class="grille2"><label class="champ">Nom du contact<input name="nom" required maxlength="80"></label><label class="champ">Fonction <small>facultatif</small><input name="titre" maxlength="140"></label></div>
        <label class="champ">Votre intérêt : sponsoring, mécénat, dons en nature, appel à projets…<textarea name="message" required maxlength="3000" rows="5"></textarea></label>`
    }[type];
    return `<form data-form="candidature" data-type="${type}" class="pile" novalidate>
      ${champs}
      <label class="champ">Téléphone<input name="telephone" required type="tel" inputmode="tel" maxlength="20" value="${esc(S.moi ? S.moi.telephone : '')}"></label>
      <label class="champ">E-mail <small>${type === 'partenaire' ? '' : 'facultatif'}</small><input name="email" type="email" maxlength="120" ${type === 'partenaire' ? 'required' : ''}></label>
      <label class="case"><input type="checkbox" name="consentement" required> <span>J'accepte que L'Odyssée de l'environnement au Cameroun garde ces informations pour traiter ma demande (loi n° 2024/017).</span></label>
      <p class="erreur" role="alert"></p>
      <button class="btn" type="submit">Envoyer</button>
    </form>`;
  }
  const merciCandidature = (t) => `<div class="info">${I.ok}<span>Demande envoyée, référence <span class="ref">${esc(S.candFaite.reference)}</span>. ${t}</span></div><a class="btn" href="#communaute">Retour à la communauté</a>`;

  V.ambassadeurs = () => `${entete('Ambassadeurs Odyssée', 'communaute')}
    <div class="pad pile">${S.candFaite && S.candFaite.type === 'ambassadeur' ? merciCandidature("L'équipe vous rappelle pour un premier échange.") : `
      <p style="margin:0">Un ambassadeur fait vivre Odyssée près de chez lui : il relaie les actions, mobilise son quartier ou son école et organise des activités avec l'équipe.</p>
      ${formCandidature('ambassadeur')}`}</div>`;

  V.projet = () => `${entete('Proposer un projet', 'communaute')}
    <div class="pad pile">${S.candFaite && S.candFaite.type === 'projet' ? merciCandidature("L'équipe étudie chaque proposition et vous répond.") : `
      <p style="margin:0">Collecte, reboisement, atelier dans une école, idée innovante… Présentez votre projet : les plus solides peuvent être accompagnés par Odyssée.</p>
      ${formCandidature('projet')}`}</div>`;

  V.partenariat = () => `${entete('Devenir partenaire', 'communaute')}
    <div class="pad pile">${S.candFaite && S.candFaite.type === 'partenaire' ? merciCandidature("L'équipe vous envoie le dossier de partenariat.") : `
      <p style="margin:0">Soutenez les 10 KM de Yaoundé, le Fonds de solidarité et les actions environnementales d'Odyssée : sponsoring, mécénat, dons en nature ou appel à projets.</p>
      <a class="carte lien-carte" href="${esc(C.siteUrl)}#partenaires" rel="noopener"><b>Voir les offres de partenariat</b><span>Ouvrir</span></a>
      ${formCandidature('partenaire')}`}</div>`;

  V.groupes = () => {
    if (!S.groupes && !S.groupesCharge) { S.groupesCharge = true; chargerListe('groupes', D.groupes); }
    const l = S.groupes || [];
    return `${entete('Groupes locaux', 'communaute')}
      <div class="pad pile">
        ${!S.groupes ? '<p class="vide">Chargement…</p>' : l.length ? l.map((g) => `<div class="carte pile" style="gap:6px"><span class="note">${esc(g.ville)}</span><b>${esc(g.nom)}</b>${g.description ? `<span class="note">${esc(g.description)}</span>` : ''}${g.lien ? `<a class="btn petit" href="${esc(g.lien)}" rel="noopener" style="align-self:flex-start">Rejoindre le groupe</a>` : ''}</div>`).join('')
          : `<p class="vide">Les groupes locaux seront annoncés ici.</p><a class="btn contour" href="#ambassadeurs">Lancer un groupe dans ma ville</a>`}
        <div class="info">${I.info}<span>Les forums de discussion arriveront dans une prochaine version. En attendant, les groupes locaux servent de lieu d'échange.</span></div>
      </div>`;
  };

  V.partenaires = () => `${entete('Partenaires et financement', 'accueil')}
    <div class="pad pile">
      <div class="info">${I.poignee}<span>Les partenaires d'Odyssée seront présentés ici dès la signature des conventions.</span></div>
      ${[['produits', 'Produits de la course', 'Les produits proposés au village et aux ravitaillements'],
         ['partenariat', 'Sponsoring et mécénat', 'Soutenir la course, le Fonds et les actions'],
         ['projet', 'Appel à projets', 'Proposer une action à financer ou accompagner']]
        .map(([h, t, d]) => `<a class="carte lien-carte" href="#${h}"><span class="pile" style="gap:2px"><b>${t}</b><span class="note">${d}</span></span><span>Voir</span></a>`).join('')}
    </div>`;

  V.parcours = () => {
    const pc = C.parcours || {};
    const d = distance(S.choix.distance);
    const infos = pc[d.id] || {};
    const trace = (window.ODC_TRACES || {})[d.id];
    return `${entete('Parcours', 'course', C.evenement.nom)}
      <div class="pad pile">
        <div class="onglets-dist">${C.distances.map((x) => `<button type="button" data-action="distance" data-id="${x.id}" aria-pressed="${x.id === d.id}" class="od-${x.couleur}">${esc(x.km.toUpperCase())}</button>`).join('')}</div>
        ${trace ? planTrace(trace) : infos.image ? `<img src="${esc(infos.image)}" alt="Carte du parcours ${esc(d.km)}" style="border-radius:16px;width:100%">` : `
        <div class="carte-parcours">
          <svg viewBox="0 0 360 230" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect width="360" height="230" fill="#dfe8d8"/>
            <g fill="#c9dcbd"><path d="M0 0h120v70H0z"/><path d="M210 140h150v90H210z"/><path d="M40 150h90v80H40z"/></g>
            <g fill="#b7d3a8"><circle cx="300" cy="50" r="38"/><circle cx="70" cy="110" r="26"/></g>
            <g stroke="#ffffff" stroke-width="7" fill="none" stroke-linecap="round"><path d="M0 120 C80 110 140 130 220 112 S330 90 360 96"/><path d="M150 0 C160 70 140 140 170 230"/><path d="M260 0 C250 60 280 120 250 230"/></g>
            <g stroke="#f3f6f1" stroke-width="3" fill="none"><path d="M0 40 L360 60"/><path d="M0 190 L360 170"/><path d="M60 0 L90 230"/><path d="M320 0 L300 230"/></g>
          </svg>
          <div class="cp-voile"><span>${I.lieu}</span><b>Tracé du ${esc(d.km)} en préparation</b><small>Il sera affiché ici après validation par les autorités de Yaoundé.</small></div>
          <div class="cp-legende"><span><i class="l-arrivee"></i>Départ</span><span><i class="l-croix"></i>Arrivée</span><span><i class="l-eau"></i>Ravitaillement</span><span><i class="l-croix"></i>Poste médical</span></div>
        </div>`}
        <div class="cp-stats">
          <div>${I.lieu}<b>${esc(d.km)}</b><span>Distance</span></div>
          <div>${I.graphe}<b>${esc(infos.denivele || '—')}</b><span>Dénivelé</span></div>
          <div>${I.cal}<b>Yaoundé</b><span>Ville</span></div>
        </div>
        ${trace ? `
        <div class="info j">${I.info}<span><b>${esc(trace.statut)}.</b> Longueur calculée : ${(trace.longueur_m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km sur les rues, calculée avec OSRM et OpenStreetMap. La distance officielle sera fixée par un mesureur agréé, et le tracé par les autorités de Yaoundé.</span></div>
        <h2 class="titre" style="margin:6px 0 0">Itinéraire</h2>
        <ol class="etapes-tr">${trace.etapes.map((e, i) => `<li class="${i === 0 ? 'dep' : i === trace.etapes.length - 1 ? 'arr' : ''}"><span class="km-tr">${e.km.toLocaleString('fr-FR')} km</span><span class="pile" style="gap:1px"><b>${esc(e.nom)}</b><span class="note">${esc(e.par)}</span></span></li>`).join('')}</ol>
        <p class="note">${!trace.ravitaillements.length ? 'Pas de ravitaillement sur le parcours : eau au départ et au village d’arrivée.' : trace.ravitaillements.length > 1 ? `Ravitaillements prévus aux km ${trace.ravitaillements.join(', ')} (emplacements indicatifs).` : `Ravitaillement prévu au km ${trace.ravitaillements[0]} (emplacement indicatif).`}</p>
        <a class="btn contour" href="#carte">${I.lieu} Voir sur la carte</a>
        <a class="btn contour" href="parcours/parcours-${esc(d.id)}km.gpx" download>Télécharger le tracé (GPX)</a>` : `
        <button class="btn vert-fonce" ${infos.detail ? `data-action="lien" data-url="${esc(infos.detail)}"` : 'disabled'}>Voir le détail du parcours</button>`}
        ${boutonInscription(d, 'j')}
      </div>`;
  };

  // Dessin du tracé à partir des vraies coordonnées (sans fond de carte)
  function projeter(coords, W, H, marge) {
    let la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
    for (const [la, lo] of coords) { la0 = Math.min(la0, la); la1 = Math.max(la1, la); lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); }
    const kx = Math.cos(((la0 + la1) / 2) * Math.PI / 180);
    const e = Math.min((W - 2 * marge) / ((lo1 - lo0) * kx), (H - 2 * marge) / (la1 - la0));
    const ox = (W - (lo1 - lo0) * kx * e) / 2, oy = (H - (la1 - la0) * e) / 2;
    return ([la, lo]) => [ox + (lo - lo0) * kx * e, H - oy - (la - la0) * e];
  }
  function planTrace(t) {
    const W = 360, H = 300; const xy = projeter(t.coords, W, H, 26);
    const d = t.coords.map((p, i) => { const [x, y] = xy(p); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ');
    const [dx, dy] = xy(t.coords[0]); const [ax, ay] = xy(t.coords[t.coords.length - 1]);
    const bornes = Object.entries(t.km).map(([k, p]) => { const [x, y] = xy(p); const r = t.ravitaillements.includes(+k);
      return r ? `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="9" fill="#1d5f99" stroke="#fff" stroke-width="2"/><text y="3.5" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">${k}</text></g>`
        : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="#0b4d2c"/>`; }).join('');
    return `<div class="carte-parcours trace-reel" style="height:auto">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tracé proposé du ${esc(t.id)} km, de ${esc(t.depart)} à ${esc(t.arrivee)}" style="position:static;display:block">
        <rect width="${W}" height="${H}" fill="#eef3ea"/>
        <path d="${d}" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="${d}" fill="none" stroke="#f7c51e" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="${d}" fill="none" stroke="#0b4d2c" stroke-width="1.4" stroke-dasharray="5 5"/>
        ${bornes}
        <g transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)})"><circle r="11" fill="#0b4d2c" stroke="#fff" stroke-width="2.5"/><text y="4" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">${t.boucle ? 'D/A' : 'D'}</text></g>
        ${t.boucle ? '' : `<g transform="translate(${ax.toFixed(1)} ${ay.toFixed(1)})"><circle r="11" fill="#c62828" stroke="#fff" stroke-width="2.5"/><text y="4" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">A</text></g>`}
        <text x="10" y="${H - 10}" font-size="9" fill="#5b6b5f">Données © contributeurs OpenStreetMap</text>
        <g transform="translate(${W - 30} 30)"><path d="M0 -14 L6 4 L0 0 L-6 4Z" fill="#0b4d2c"/><text y="16" text-anchor="middle" font-size="9" font-weight="700" fill="#0b4d2c">N</text></g>
      </svg>
      <div class="cp-legende" style="position:static">${t.boucle ? `<span><i style="background:#0b4d2c"></i>Départ et arrivée · ${esc(t.depart)}</span>` : `<span><i style="background:#0b4d2c"></i>Départ · ${esc(t.depart)}</span><span><i style="background:#c62828"></i>Arrivée · ${esc(t.arrivee)}</span>`}${t.ravitaillements.length ? '<span><i style="background:#1d5f99"></i>Ravitaillement</span>' : ''}</div>
    </div>`;
  }

  V.formations = () => {
    if (!S.contenus && !S.contenusCharge) { S.contenusCharge = true; chargerListe('contenus', D.contenus); }
    const l = (S.contenus || []).filter((c) => S.fmFiltre === 'tous' || c.type === S.fmFiltre);
    const lib = { guide: 'Guide', video: 'Vidéo', quiz: 'Quiz' };
    return `${entete('Formations et sensibilisation', 'accueil')}
      <div class="pad pile">
        <p style="margin:0;color:var(--doux)">Guides pratiques, vidéos et quiz pour agir au quotidien. Réussissez un quiz pour obtenir votre attestation.</p>
        ${segments('fmFiltre', [['tous', 'Tout'], ['guide', 'Guides'], ['video', 'Vidéos'], ['quiz', 'Quiz']])}
        ${!S.contenus ? '<p class="vide">Chargement…</p>' : l.length ? l.map((c) => `<button type="button" class="carte ev" data-action="ouvrir-contenu" data-id="${esc(c.id)}">
          <span class="vignette v-ev">${c.type === 'quiz' ? I.coupe : c.type === 'video' ? I.lecture : I.livre}</span>
          <span class="pile" style="gap:2px;flex:1;text-align:left"><span class="note">${lib[c.type]}${c.theme ? ' · ' + esc(c.theme) : ''}${S.quizFaits[c.id] ? ` · ${S.quizFaits[c.id].score}/${S.quizFaits[c.id].total}` : ''}</span><b>${esc(c.titre)}</b>${c.resume ? `<span class="note">${esc(c.resume)}</span>` : ''}</span>
          <span aria-hidden="true" style="color:var(--vert);font-size:22px">›</span></button>`).join('') : '<p class="vide">Les premiers contenus arrivent bientôt.</p>'}
      </div>`;
  };

  V.contenu = () => {
    const c = S.contenus && S.contenus.find((x) => x.id === S.contSel);
    if (!c) return `${entete('Formation', 'formations')}<p class="vide">Contenu introuvable.</p>`;
    if (c.type === 'guide') return `${entete('Guide', 'formations')}<div class="pad pile"><h2 style="margin:0;font-size:24px;line-height:1.2">${esc(c.titre)}</h2>${c.resume ? `<p class="note" style="margin:0">${esc(c.resume)}</p>` : ''}<div class="carte" style="white-space:pre-line;line-height:1.6">${esc(c.corps || '')}</div>${c.lien ? `<a class="btn contour" href="${esc(c.lien)}" rel="noopener">En savoir plus</a>` : ''}</div>`;
    if (c.type === 'video') return `${entete('Vidéo', 'formations')}<div class="pad pile"><h2 style="margin:0;font-size:24px;line-height:1.2">${esc(c.titre)}</h2>${c.resume ? `<p style="margin:0">${esc(c.resume)}</p>` : ''}${c.corps ? `<div class="carte" style="white-space:pre-line">${esc(c.corps)}</div>` : ''}${c.lien ? `<a class="btn" href="${esc(c.lien)}" rel="noopener">${I.lecture} Regarder la vidéo</a>` : ''}</div>`;
    // Quiz
    const Q = S.quiz && S.quiz.id === c.id ? S.quiz : (S.quiz = { id: c.id, i: 0, score: 0, rep: null, fini: false });
    const total = c.quiz.length;
    if (Q.fini) {
      const reussi = Q.score / total >= 0.7;
      return `${entete('Quiz', 'formations')}<div class="pad pile">
        <div class="carte pile" style="align-items:center;text-align:center;gap:6px"><span class="gros">${Q.score} / ${total}</span><b>${reussi ? 'Bravo, quiz réussi !' : 'Encore un effort'}</b><span class="note">${reussi ? 'Vous obtenez votre attestation.' : 'Il faut 70 % de bonnes réponses pour l’attestation.'}</span></div>
        ${reussi ? `<div class="attestation" id="attestation">
          <div class="bandes"><i style="background:var(--vert)"></i><i style="background:var(--rouge)"></i><i style="background:var(--jaune)"></i></div>
          <div class="pile" style="align-items:center;text-align:center;gap:6px;padding:18px">${I.logo}<span class="note" style="text-transform:uppercase;letter-spacing:.06em;font-weight:800;color:var(--vert)">Attestation de réussite</span>
          <b style="font-size:22px" data-nom-attestation>${esc(S.nomAttestation || prenomActuel() || 'Votre nom')}</b><span>a réussi le quiz</span><b>${esc(c.titre)}</b><span class="note">Score ${Q.score}/${total} · ${dateFr(new Date())}</span>
          <span class="note">L'Odyssée de l'environnement au Cameroun</span></div></div>` : ''}
        ${reussi ? `<label class="champ">Nom à inscrire sur l'attestation<input name="nom_attestation" maxlength="80" value="${esc(S.nomAttestation || prenomActuel() || '')}"></label>
        <p class="note" style="margin:0">Faites une capture d'écran pour garder votre attestation.</p>` : ''}
        <button class="btn" data-action="quiz-recommencer">Recommencer</button><a class="btn contour" href="#formations">Autres formations</a></div>`;
    }
    const q = c.quiz[Q.i];
    return `${entete('Quiz', 'formations', c.titre)}
      <div class="pad pile">
        <div class="jauge" aria-hidden="true"><i style="width:${Math.round((Q.i / total) * 100)}%"></i></div>
        <span class="note">Question ${Q.i + 1} sur ${total}</span>
        <h2 style="margin:0;font-size:20px;line-height:1.3">${esc(q.q)}</h2>
        <div class="pile">${q.choix.map((t, k) => {
          const etat = Q.rep == null ? '' : k === q.bonne ? 'bonne' : k === Q.rep ? 'fausse' : '';
          return `<button type="button" class="choix reponse ${etat}" data-action="quiz-rep" data-k="${k}" ${Q.rep != null ? 'disabled' : ''}><span class="txt"><b>${esc(t)}</b></span></button>`;
        }).join('')}</div>
        ${Q.rep != null ? `<div class="info ${Q.rep === q.bonne ? '' : 'r'}">${Q.rep === q.bonne ? I.ok : I.info}<span><b>${Q.rep === q.bonne ? 'Bonne réponse.' : 'Pas tout à fait.'}</b> ${esc(q.explication || '')}</span></div>
          <button class="btn" data-action="quiz-suivant">${Q.i + 1 < total ? 'Question suivante' : 'Voir mon résultat'}</button>` : ''}
      </div>`;
  };

  function badgesListe() {
    return [
      ['Coureur solidaire', 'Inscrit aux 10 KM', S.mes.length > 0],
      ['Éco-citoyen', 'A participé à une action', S.parts.length > 0],
      ['Cœur généreux', 'A fait un don au Fonds', !!(S.don && S.don.etape === 'fait')],
      ['Esprit vert', 'A réussi un quiz', Object.values(S.quizFaits).some((q) => q.score / q.total >= 0.7)],
      ['Engagé', 'Bénévole, ambassadeur ou porteur de projet', S.cands.length > 0 || !!S.benevoleFait]
    ];
  }

  V.profil = () => {
    const prenom = prenomActuel();
    const nom = (S.profil && S.profil.nom) || '';
    const photo = stockage.lire('odc_photo');
    const course = S.mes[0] ? distance(S.mes[0].distance || S.choix.distance) : null;
    const items = [
      ['dossard', 'Mes inscriptions', I.dossard], ['dossard', 'Mon dossard', I.cal], ['resultats', 'Mes résultats', I.graphe],
      ['badges', 'Mes badges', I.coupe], ['ecoactions', 'Mes éco-actions', I.feuille], ['parametres', 'Paramètres', I.reglages]
    ];
    return `<div class="profil-tete">${entete('Mon profil', 'accueil')}<svg class="profil-vague" viewBox="0 0 390 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 H390 V18 C300 42 90 42 0 18 Z" fill="#0b4d2c"/></svg></div>
      <div class="profil-id">
        <label class="avatar2" title="Changer ma photo">${photo ? `<img src="${esc(photo)}" alt="Ma photo">` : `<span>${esc(prenom ? prenom.charAt(0).toUpperCase() : '?')}</span>`}
          <span class="crayon">${I.crayon}</span><input type="file" accept="image/*" data-photo hidden></label>
        <b>${prenom ? esc((nom ? nom + ' ' : '') + prenom) : 'Bienvenue'}</b>
        <span>${course ? `Coureur – ${esc(course.km.toUpperCase())}` : S.profil ? 'Membre de la communauté Odyssée' : '<a href="#compte">Créer mon compte</a>'}</span>
      </div>
      <div class="pad" style="padding-top:6px">
        <nav class="menu-profil">${items.map(([h, t, ico]) => `<a href="#${h}"><span class="mp-ico">${ico}</span>${t}<span class="chevron">›</span></a>`).join('')}</nav>
      </div>`;
  };

  V.badges = () => `${entete('Mes badges', 'profil')}
    <div class="pad"><div class="badges">${badgesListe().map(([t, d, ok]) => `<div class="badge ${ok ? 'ok' : ''}"><span>${ok ? I.ok : I.coupe}</span><b>${t}</b><small>${d}</small></div>`).join('')}</div>
    <p class="note">Les badges se débloquent en participant à la vie de la communauté.</p></div>`;

  V.ecoactions = () => `${entete('Mes éco-actions', 'profil')}
    <div class="pad pile">
      ${S.parts.length ? S.parts.map((p) => `<button type="button" class="carte ev" data-action="ouvrir-ev" data-id="${esc(p.evenement_id)}"><span class="ev-vignette ev-motif" style="background:var(--vert);color:var(--jaune)">${I.feuille}</span><span class="pile" style="gap:2px;flex:1;text-align:left"><b>${esc(p.titre)}</b><span class="note">${esc(p.reference)}</span></span><span class="chevron">›</span></button>`).join('')
        : '<p class="vide">Vous n’avez pas encore participé à une action.</p>'}
      <a class="btn" href="#actions">Voir les actions</a>
      ${Object.keys(S.quizFaits).length ? `<a class="carte lien-carte" href="#formations"><b>Mes quiz et attestations</b><span>${Object.keys(S.quizFaits).length}</span></a>` : ''}
    </div>`;

  V.parametres = () => `${entete('Paramètres', 'profil')}
    <div class="pad pile">
      ${S.profil ? `<a class="carte lien-carte" href="#compte"><span class="pile" style="gap:2px"><b>Modifier mon compte</b><span class="note">${esc(S.profil.prenom)} ${esc(S.profil.nom)} · ${esc(S.profil.telephone)}</span></span><span>Modifier</span></a>` : '<a class="btn j" href="#compte">Créer mon compte</a>'}
      <a class="carte lien-carte" href="#boutique"><b>Boutique Odyssée</b><span>Voir</span></a>
      <a class="carte lien-carte" href="#don"><b>Faire un don</b><span>Voir</span></a>
      <div class="carte pile" style="gap:8px"><b>Mes données</b>
        <span class="note">Votre compte, vos inscriptions et vos badges sont gardés sur ce téléphone. La connexion depuis un autre appareil arrivera dans une prochaine version.</span>
        <button class="btn contour petit" style="align-self:flex-start" data-action="effacer-local">Effacer mes données de ce téléphone</button></div>
      <a href="#admin" style="font-size:14px;text-align:center">Espace organisateurs</a>
    </div>`;


  // ---------------------------------------------------------------
  // Carte interactive
  // ---------------------------------------------------------------
  const appareil = (() => {
    let a = stockage.lire('odc_appareil');
    if (!a) { a = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^A-Za-z0-9-]/g, '').slice(0, 40).padEnd(16, '0'); stockage.ecrire('odc_appareil', a); }
    return a;
  })();
  const CARTE = { centre: [3.868, 11.515], zoom: 14, bbox: [3.845, 11.489, 3.895, 11.548] };
  const COUCHES = [['evenements', 'Événements', '#0b4d2c'], ['actions', 'Actions', '#2f7a46'], ['points', 'Points de collecte', '#c9a400'], ['coureurs', 'Coureurs en direct', '#c62828']];
  const TYPES_POINT = { collecte: 'Point de collecte', tri: 'Bac de tri', compost: 'Compostage', depot: 'Dépôt de déchets' };
  let carteEtat = { leaflet: null, calques: null, minuterie: null, anim: null, suivi: null };

  function arreterCarte() {
    if (carteEtat.minuterie) clearInterval(carteEtat.minuterie);
    if (carteEtat.anim) cancelAnimationFrame(carteEtat.anim);
    if (carteEtat.leaflet) { try { carteEtat.leaflet.remove(); } catch (e) { /* déjà retirée */ } }
    carteEtat = { leaflet: null, calques: null, minuterie: null, anim: null, suivi: carteEtat.suivi };
  }

  V.carte = () => {
    if (!S.points && !S.pointsCharge) { S.pointsCharge = true; D.points().then((l) => { S.points = l; if (route() === 'carte') rendre(false); }).catch(() => { S.points = []; }); }
    if (!S.suiviEtat) D.suiviEtat().then((e) => { S.suiviEtat = e || { actif: false }; if (route() === 'carte') majPanneauPosition(); }).catch(() => {});
    const demo = D.mode === 'demo';
    const elements = elementsCarte();
    return `${entete('Carte', 'accueil', demo ? 'Plan de démonstration · positions simulées' : 'OpenStreetMap')}
      <div class="couches" role="group" aria-label="Afficher sur la carte">${COUCHES.map(([k, t, c]) => `<button type="button" data-action="couche" data-k="${k}" aria-pressed="${S.couches[k]}" style="--c:${c}"><i></i>${t}</button>`).join('')}</div>
      <div class="carte-boite"><div id="carte" class="carte-zone" role="application" aria-label="Carte interactive"></div>
        ${demo ? '<span class="badge-simu">Simulation</span>' : ''}</div>
      <div class="pad pile">
        <div id="panneau-position">${panneauPosition()}</div>
        <h2 class="titre" style="margin:6px 0 0">Sur la carte</h2>
        ${elements.length ? elements.map((e) => `<button type="button" class="carte ev" data-action="${e.action}" data-id="${esc(e.id)}"><span class="pastille-carte" style="background:${e.couleur}">${e.ico}</span><span class="pile" style="gap:1px;flex:1;text-align:left"><b>${esc(e.titre)}</b><span class="note">${esc(e.sous)}</span></span><span class="chevron">›</span></button>`).join('')
          : '<p class="vide">Aucun lieu à afficher. Activez une couche ci-dessus.</p>'}
        ${demo ? '<div class="info j">' + I.info + '<span>Démonstration : le fond de plan et les coureurs sont simulés ; le tracé jaune est la proposition du 10 km (boulevard du 20 Mai → Musée national). Sur votre site, la vraie carte OpenStreetMap s’affiche avec les lieux saisis par l’équipe et les positions réelles des coureurs qui l’acceptent.</span></div>' : ''}
      </div>`;
  };

  function elementsCarte() {
    const l = [];
    if (S.evs) for (const e of S.evs) {
      if (e.lat == null || e.lng == null || passe(e)) continue;
      const k = e.rubrique === 'action' ? 'actions' : 'evenements'; if (!S.couches[k]) continue;
      l.push({ id: e.id, action: 'ouvrir-ev', titre: e.titre, sous: `${(TYPES[e.type] || TYPES.autre)[0]} · ${quand(e)}`, lat: e.lat, lng: e.lng, couleur: k === 'actions' ? '#2f7a46' : '#0b4d2c', ico: e.type === 'course' ? I.coureur : (TYPES[e.type] || TYPES.autre)[1] });
    }
    if (S.couches.points && S.points) for (const p of S.points) l.push({ id: p.id, action: 'voir-point', titre: p.nom, sous: [TYPES_POINT[p.type], p.horaires].filter(Boolean).join(' · '), lat: p.lat, lng: p.lng, couleur: '#c9a400', ico: I.recycle });
    return l;
  }

  function panneauPosition() {
    const e = S.suiviEtat || {};
    if (!e.actif) return `<div class="carte pile" style="gap:4px"><b>Suivi des coureurs en direct</b><span class="note">Il sera ouvert le jour de la course. Les coureurs qui le souhaitent pourront partager leur position pendant la course uniquement.</span></div>`;
    if (carteEtat.suivi) return `<div class="carte pile suivi-on" style="gap:8px"><b><i class="point-vivant"></i> Vous partagez votre position</b><span class="note">Visible par les autres sous le nom « ${esc(prenomPublic())} ». Le partage s'arrête quand vous touchez le bouton, quand vous fermez l'appli, ou à la fin du suivi.</span><button class="btn contour" data-action="stop-position">Arrêter le partage</button></div>`;
    return `<div class="carte pile" style="gap:8px"><b>Suivi des coureurs en direct</b>
      <span class="note">Partagez votre position pendant la course : vos proches vous suivent sur la carte. Seuls votre prénom et votre numéro de dossard sont affichés.</span>
      <label class="case"><input type="checkbox" id="accord-position"> <span>J'accepte de partager ma position pendant la course. Je peux l'arrêter à tout moment.</span></label>
      <button class="btn vert-fonce" data-action="partager-position">${I.lieu} Partager ma position</button></div>`;
  }
  function majPanneauPosition() { const el = document.getElementById('panneau-position'); if (el) el.innerHTML = panneauPosition(); }
  const prenomPublic = () => { const p = prenomActuel() || 'Coureur'; return p; };

  async function initCarte() {
    arreterCarte();
    const zone = document.getElementById('carte'); if (!zone) return;
    if (D.mode === 'demo') return planSimule(zone);
    try {
      if (!window.L) {
        const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'js/vendor/leaflet/leaflet.css'; document.head.appendChild(css);
        await chargerScript('js/vendor/leaflet/leaflet.js');
      }
      const L = window.L;
      const m = L.map(zone, { zoomControl: true, attributionControl: true }).setView(CARTE.centre, CARTE.zoom);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© contributeurs OpenStreetMap' }).addTo(m);
      carteEtat.leaflet = m; carteEtat.calques = L.layerGroup().addTo(m); const coureurs = L.layerGroup().addTo(m);
      const tr = (window.ODC_TRACES || {})['10'];
      if (tr && S.couches.evenements) {
        L.polyline(tr.coords, { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(carteEtat.calques);
        L.polyline(tr.coords, { color: '#e0a800', weight: 5 }).addTo(carteEtat.calques).bindPopup(`<b>${esc(tr.nom)}</b><br>${esc(tr.statut)}`);
        L.circleMarker(tr.coords[0], { radius: 9, color: '#fff', weight: 2, fillColor: '#0b4d2c', fillOpacity: 1 }).bindTooltip('Départ · ' + tr.depart).addTo(carteEtat.calques);
        L.circleMarker(tr.coords[tr.coords.length - 1], { radius: 9, color: '#fff', weight: 2, fillColor: '#c62828', fillOpacity: 1 }).bindTooltip('Arrivée · Musée national').addTo(carteEtat.calques);
        for (const k of tr.ravitaillements) L.circleMarker(tr.km[k], { radius: 7, color: '#fff', weight: 2, fillColor: '#1d5f99', fillOpacity: 1 }).bindTooltip(`Ravitaillement km ${k}`).addTo(carteEtat.calques);
      }
      const icone = (couleur, ico) => L.divIcon({ className: 'repere', html: `<span style="background:${couleur}">${ico}</span>`, iconSize: [34, 34], iconAnchor: [17, 34] });
      for (const e of elementsCarte()) {
        L.marker([e.lat, e.lng], { icon: icone(e.couleur, e.ico), title: e.titre }).addTo(carteEtat.calques)
          .bindPopup(`<b>${esc(e.titre)}</b><br>${esc(e.sous)}`);
      }
      const majCoureurs = async () => {
        coureurs.clearLayers(); if (!S.couches.coureurs) return;
        try {
          const ps = await D.positions();
          for (const p of ps) L.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#c62828', fillOpacity: 1 })
            .bindTooltip(`${esc(p.prenom)}${p.dossard ? ' · ' + esc(p.dossard) : ''}`).addTo(coureurs);
        } catch (e) { /* réseau */ }
      };
      majCoureurs(); carteEtat.minuterie = setInterval(majCoureurs, 15000);
    } catch (e) {
      zone.innerHTML = `<div class="info r" style="margin:16px">${I.info}<span>La carte n'a pas pu se charger. Vérifiez votre connexion.</span></div>`;
    }
  }

  // Plan simulé pour la démonstration (aucune donnée géographique réelle)
  function planSimule(zone) {
    const [la0, lo0, la1, lo1] = CARTE.bbox; const W = 390, H = 330;
    const xy = (lat, lng) => [((lng - lo0) / (lo1 - lo0)) * W, H - ((lat - la0) / (la1 - la0)) * H];
    const tr = (window.ODC_TRACES || {})['10'];
    const route = tr ? tr.coords.map((p, i) => { const [x, y] = xy(p[0], p[1]); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ') : 'M70 240 C70 150 130 90 200 80 S330 90 330 160 S280 270 200 270 S90 290 70 240 Z';
    const [rdx, rdy] = tr ? xy(tr.coords[0][0], tr.coords[0][1]) : [70, 240];
    const [rax, ray] = tr ? xy(tr.coords[tr.coords.length - 1][0], tr.coords[tr.coords.length - 1][1]) : [70, 240];
    const reperes = elementsCarte().map((e) => { const [x, y] = xy(e.lat, e.lng); return `<g class="repere-svg" data-action="${e.action}" data-id="${esc(e.id)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" role="button" tabindex="0" aria-label="${esc(e.titre)}"><path d="M0 0 C-12 -14 -14 -20 -14 -26 a14 14 0 0 1 28 0 c0 6 -2 12 -14 26z" fill="${e.couleur}" stroke="#fff" stroke-width="2"/><circle cy="-26" r="6" fill="#fff"/></g>`; }).join('');
    zone.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" class="plan">
      <rect width="${W}" height="${H}" fill="#e8efe3"/>
      <g fill="#d3e5c8"><rect x="10" y="10" width="90" height="60" rx="8"/><rect x="250" y="210" width="120" height="100" rx="8"/><circle cx="300" cy="60" r="40"/><rect x="20" y="270" width="80" height="50" rx="8"/></g>
      <path d="M0 200 C80 210 120 180 180 190 S300 230 390 210" fill="none" stroke="#9cc5e8" stroke-width="10" opacity=".7"/>
      <g stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"><path d="M0 120 L390 100"/><path d="M150 0 L170 330"/><path d="M0 300 L390 280"/><path d="M280 0 L250 330"/></g>
      <g stroke="#fff" stroke-width="4" fill="none"><path d="M0 50 L390 40"/><path d="M60 0 L80 330"/><path d="M350 0 L330 330"/><path d="M0 170 L390 160"/><path d="M215 0 L210 330"/></g>
      ${S.couches.evenements ? `<path id="trace" d="${route}" fill="none" stroke="#f7c51e" stroke-width="6" stroke-linejoin="round"/><path d="${route}" fill="none" stroke="#0b4d2c" stroke-width="2" stroke-dasharray="6 6"/>
      <g transform="translate(${rdx.toFixed(1)} ${rdy.toFixed(1)})"><circle r="9" fill="#0b4d2c" stroke="#fff" stroke-width="2"/><text y="4" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">D</text></g>
      <g transform="translate(${rax.toFixed(1)} ${ray.toFixed(1)})"><circle r="9" fill="#c62828" stroke="#fff" stroke-width="2"/><text y="4" text-anchor="middle" font-size="9" font-weight="800" fill="#fff">A</text></g>` : `<path id="trace" d="${route}" fill="none" stroke="none"/>`}
      ${reperes}
      <g id="coureurs-simu"></g>
    </svg>`;
    const trace = zone.querySelector('#trace'); const g = zone.querySelector('#coureurs-simu');
    if (!S.couches.coureurs || !trace.getTotalLength) return;
    const long = trace.getTotalLength(); const noms = ['Thierry', 'Alice', 'Michel', 'Carine', 'Paul', 'Awa', 'Joël', 'Linda', 'Eric', 'Sandrine', 'Moi'];
    const vit = noms.map((_, i) => 0.012 + (i % 5) * 0.002); const pos = noms.map((_, i) => (i * 0.07) % 1);
    g.innerHTML = noms.map((n, i) => `<g class="coureur-simu"><circle r="${n === 'Moi' ? 7 : 5}" fill="${n === 'Moi' ? '#1d5f99' : '#c62828'}" stroke="#fff" stroke-width="2"/>${n === 'Moi' ? '<text y="-10" text-anchor="middle" font-size="10" font-weight="800" fill="#1d5f99">Moi</text>' : ''}</g>`).join('');
    const pts = [...g.children]; let t0 = performance.now();
    const pas = (t) => {
      const dt = (t - t0) / 1000; t0 = t;
      pts.forEach((el, i) => { pos[i] = (pos[i] + vit[i] * dt) % 1; const p = trace.getPointAtLength(pos[i] * long); el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); });
      carteEtat.anim = requestAnimationFrame(pas);
    };
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) carteEtat.anim = requestAnimationFrame(pas);
    else pas(performance.now());
  }

  async function demarrerPosition() {
    const accord = document.getElementById('accord-position');
    if (!accord || !accord.checked) { toast('Cochez d’abord la case pour accepter le partage.'); return; }
    if (D.mode === 'demo') { carteEtat.suivi = { demo: true }; majPanneauPosition(); toast('Démonstration : votre position est simulée (point bleu).'); return; }
    if (!navigator.geolocation) { toast('La localisation n’est pas disponible sur cet appareil.'); return; }
    let dernier = 0;
    const id = navigator.geolocation.watchPosition(async (p) => {
      if (Date.now() - dernier < 20000) return; dernier = Date.now();
      try { await D.partagerPosition(appareil, prenomPublic(), (S.mes.find((m) => m.dossard) || {}).dossard, p.coords.latitude, p.coords.longitude); }
      catch (e) { toast(e.message); arreterPosition(); }
    }, () => { toast('Autorisez la localisation dans les réglages du téléphone.'); arreterPosition(); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    carteEtat.suivi = { id }; majPanneauPosition();
  }
  async function arreterPosition() {
    if (carteEtat.suivi && carteEtat.suivi.id != null && navigator.geolocation) navigator.geolocation.clearWatch(carteEtat.suivi.id);
    carteEtat.suivi = null; majPanneauPosition();
    try { await D.arreterPosition(appareil); } catch (e) { /* hors ligne */ }
  }

  // ---------------------------------------------------------------
  // Fil d'actualité
  // ---------------------------------------------------------------
  const CATS = [['', 'Tout'], ['collecte', 'Collectes'], ['reboisement', 'Reboisement'], ['evenement', 'Événements'], ['communaute', 'Communauté']];
  const LIB_CAT = { collecte: 'Collecte', reboisement: 'Reboisement', evenement: 'Événement', communaute: 'Communauté', autre: 'Autre' };
  const ilya = (d) => {
    const s2 = Math.max(0, (Date.now() - new Date(d)) / 1000);
    if (s2 < 60) return 'à l’instant'; if (s2 < 3600) return `il y a ${Math.floor(s2 / 60)} min`;
    if (s2 < 86400) return `il y a ${Math.floor(s2 / 3600)} h`; if (s2 < 7 * 86400) return `il y a ${Math.floor(s2 / 86400)} j`;
    return dateFr(d);
  };

  async function chargerFil() {
    try { S.fil = await D.fil(S.filCat, appareil); S.filErr = null; } catch (e) { S.filErr = e.message; S.fil = S.fil || []; }
    if (route() === 'fil') rendre(false); else if (route() === 'accueil' || route() === 'communaute') rendre(false);
  }

  function cartePublication(x) {
    const ouvert = S.comOuvert === x.id;
    return `<article class="pub" data-id="${esc(x.id)}">
      <header class="pub-tete"><span class="pub-av">${esc((x.auteur || '?').charAt(0).toUpperCase())}</span>
        <span class="pile" style="gap:0;flex:1"><b>${esc(x.auteur)}</b><span class="note">${esc([x.ville, ilya(x.created_at)].filter(Boolean).join(' · '))}</span></span>
        <span class="tag pub-cat">${esc(LIB_CAT[x.categorie] || x.categorie)}</span></header>
      ${x.statut === 'en_attente' ? `<div class="pub-attente">${I.info} En attente de validation par l'équipe. Vous seul la voyez.</div>` : ''}
      <img class="pub-photo" src="${esc(D.urlPhoto(x.photo))}" alt="${esc(x.texte || 'Photo publiée par ' + x.auteur)}" loading="lazy">
      ${x.statut === 'publie' ? `<div class="pub-actions">
        <button type="button" data-action="aimer" data-id="${esc(x.id)}" aria-pressed="${!!x.j_aime}" aria-label="J'aime">${x.j_aime ? I.coeurPlein : I.coeur}<span>${x.aimes || 0}</span></button>
        <button type="button" data-action="commentaires" data-id="${esc(x.id)}" aria-expanded="${ouvert}" aria-label="Commentaires">${I.bulle}<span>${x.commentaires || 0}</span></button>
        <button type="button" data-action="partager-pub" data-id="${esc(x.id)}" aria-label="Partager">${I.partage}</button>
        <button type="button" data-action="signaler" data-id="${esc(x.id)}" class="pub-signaler" aria-label="Signaler cette publication">${I.drapeau}</button>
      </div>` : ''}
      ${x.texte ? `<p class="pub-texte"><b>${esc(x.auteur)}</b> ${esc(x.texte)}</p>` : ''}
      ${x.lieu ? `<p class="pub-lieu">${I.lieu}${esc(x.lieu)}</p>` : ''}
      ${ouvert ? `<div class="pub-coms" id="coms-${esc(x.id)}">${(S.coms[x.id] || []).map((c) => `<p><b>${esc(c.auteur)}</b> ${esc(c.texte)} <span class="note">${ilya(c.created_at)}</span></p>`).join('') || '<p class="note">Soyez le premier à commenter.</p>'}
        <form data-form="commentaire" data-id="${esc(x.id)}" class="com-form" novalidate><input name="texte" maxlength="500" placeholder="Ajouter un commentaire…" aria-label="Votre commentaire" required><button class="btn petit" type="submit">Envoyer</button><p class="erreur" role="alert"></p></form></div>` : ''}
    </article>`;
  }

  V.fil = () => {
    if (!S.fil && !S.filCharge) { S.filCharge = true; chargerFil(); }
    return `<header class="barre-acc"><a class="rond-clair" href="#communaute" aria-label="Retour">${I.retour}</a><h1>Fil d'actualité</h1><a class="rond-clair" href="#publier" aria-label="Publier une photo">${I.plus}</a></header>
      <div class="cats" role="group" aria-label="Catégories">${CATS.map(([k, t]) => `<button type="button" data-action="fil-cat" data-k="${k}" aria-pressed="${S.filCat === k}">${t}</button>`).join('')}</div>
      <div class="pile fil-liste">
        <a class="publier-cta" href="#publier"><span class="pub-av">${esc((prenomActuel() || '+').charAt(0).toUpperCase())}</span><span>Partagez une photo de votre action…</span>${I.appareil}</a>
        ${!S.fil ? '<p class="vide">Chargement…</p>' : S.filErr ? `<div class="info r">${I.info}<span>${esc(S.filErr)}</span></div>` : S.fil.length ? S.fil.map(cartePublication).join('') : '<p class="vide">Aucune publication dans cette catégorie pour l’instant.</p>'}
      </div>`;
  };

  V.publier = () => {
    if (S.pubFaite) return `${entete('Publier', 'fil')}<div class="pad pile"><div class="info">${I.ok}<span>Merci ! Votre photo est envoyée. Elle apparaîtra dans le fil dès que l'équipe l'aura validée.</span></div><a class="btn" href="#fil" data-action="pub-retour">Retour au fil</a></div>`;
    const evs = (S.evs || []).filter((e) => !passe(e) || e.bilan);
    return `${entete('Publier une photo', 'fil')}
      <div class="pad">
        <form data-form="publication" novalidate>
          <div class="photo-choix">
            ${S.pubApercu ? `<img src="${esc(S.pubApercu)}" alt="Aperçu de la photo">` : `<span class="photo-vide">${I.appareil}<b>Ajoutez une photo</b><small>Collecte, plantation, événement…</small></span>`}
          </div>
          <div class="grille2">
            <label class="btn clair fichier">${I.appareil} Prendre une photo<input type="file" accept="image/*" capture="environment" data-photo-pub hidden></label>
            <label class="btn clair fichier">${I.image} Galerie<input type="file" accept="image/*" data-photo-pub hidden></label>
          </div>
          <label class="champ">Description<textarea name="texte" rows="3" maxlength="1000" placeholder="Que s'est-il passé ? Combien de sacs ramassés, d'arbres plantés ?"></textarea></label>
          <div class="grille2">
            <label class="champ">Catégorie<select name="categorie">${CATS.slice(1).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>
            <label class="champ">Lieu<input name="lieu" maxlength="120" placeholder="Quartier, ville"></label>
          </div>
          ${evs.length ? `<label class="champ">Événement ou action <small>facultatif</small><select name="evenement_id"><option value="">Aucun</option>${evs.map((e) => `<option value="${esc(e.id)}">${esc(e.titre)}</option>`).join('')}</select></label>` : ''}
          <div class="grille2">
            <label class="champ">Votre nom<input name="auteur" required maxlength="80" value="${esc(prenomActuel())}"></label>
            <label class="champ">Ville<input name="ville" maxlength="80" value="${esc((S.profil && S.profil.ville) || '')}"></label>
          </div>
          <label class="case"><input type="checkbox" name="accord" required> <span>Les personnes reconnaissables sur la photo sont d'accord pour être publiées. Pour un enfant, l'accord de ses parents a été donné.</span></label>
          <p class="erreur" role="alert"></p>
          <button class="btn vert-fonce" type="submit">Publier</button>
          <p class="note" style="margin:0;text-align:center">Chaque photo est vérifiée par l'équipe avant d'apparaître dans le fil.</p>
        </form>
      </div>`;
  };

  async function preparerPhoto(fichier) {
    const url = URL.createObjectURL(fichier);
    try {
      const img = new Image(); await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
      const max = D.mode === 'demo' ? 900 : 1600; const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const qualite = D.mode === 'demo' ? 0.7 : 0.82;
      const dataUrl = c.toDataURL('image/jpeg', qualite);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', qualite));
      return { dataUrl, blob };
    } finally { URL.revokeObjectURL(url); }
  }

  // ---------------------------------------------------------------
  // Espace organisateurs
  // ---------------------------------------------------------------
  V.admin = () => {
    if (!S.staff) {
      return `${entete('Espace organisateurs', 'accueil')}
        <div class="pad">
          <form data-form="connexion" class="carte" novalidate>
            <b>Connexion de l'équipe</b>
            <label class="champ">Adresse e-mail<input name="email" type="email" required autocomplete="username"></label>
            <label class="champ">Mot de passe<input name="mdp" type="password" required autocomplete="current-password"></label>
            <p class="erreur" role="alert"></p>
            <button class="btn" type="submit">Se connecter</button>
            ${D.mode === 'demo' ? '<p class="note">Démonstration : n’importe quelle adresse, mot de passe <b>odyssee2027</b>.</p>' : ''}
          </form>
        </div>`;
    }
    const tabs = [['tableau', 'Tableau de bord'], ['evenements', 'Événements et actions'], ['participations', 'Participations'], ['inscriptions', 'Inscriptions 10 KM'], ['retrait', 'Retrait dossards'], ['dons', 'Dons'], ['commandes', 'Boutique'], ['benevoles', 'Bénévoles'], ['candidatures', 'Ambassadeurs et demandes'], ['groupes', 'Groupes locaux'], ['contenus', 'Formations'], ['fil', 'Fil et photos'], ['carte', 'Carte et suivi'], ['annonces', 'Actualités'], ['resultats', 'Résultats'], ['fonds', 'Fonds']];
    return `${entete('Espace organisateurs', 'accueil', D.mode === 'demo' ? 'Mode démonstration' : 'Connecté')}
      <div class="onglets-adm" role="group" aria-label="Rubriques">${tabs.map(([k, t]) => `<button type="button" data-action="adm-onglet" data-k="${k}" aria-pressed="${S.adm.onglet === k}">${t}</button>`).join('')}</div>
      <div class="pad pile" id="adm">${admContenu()}</div>
      <div class="pad" style="display:flex;gap:8px;flex-wrap:wrap;padding-top:0">
        <button class="btn contour petit" data-action="adm-charger">Actualiser</button>
        <button class="btn contour petit" data-action="deconnexion">Se déconnecter</button>
      </div>`;
  };

  function admContenu() {
    const A = S.adm;
    if (A.chargement) return '<p class="vide">Chargement…</p>';
    if (A.erreur) return `<div class="info r">${I.info}<span>${esc(A.erreur)}</span></div>`;
    const ins = A.ins; const actifs = ins.filter((i) => i.statut !== 'annule');
    if (A.onglet === 'tableau') {
      const payes = ins.filter((i) => i.statut === 'paye');
      const par = (k) => `${payes.filter((i) => i.distance === k).length} / ${actifs.filter((i) => i.distance === k).length}`;
      const stat = (v, t) => `<div class="stat"><b>${v}</b><span>${t}</span></div>`;
      const ei = (S.etat && S.etat.inscriptions) || null;
      const expirees = ins.filter(delaiDepasse).length;
      const reglages = ei ? `
        <form data-form="reglages" class="carte pile" novalidate style="gap:6px;margin-bottom:12px">
          <b>Ouverture des inscriptions</b>
          <span class="note">${ei.ouvertes ? '<b style="color:var(--vert)">Ouvertes</b>' : '<b style="color:var(--rouge)">Fermées</b>'} · ${(ei.quota - ei.restantes).toLocaleString('fr-FR')} places tenues sur ${ei.quota.toLocaleString('fr-FR')} · ${ei.restantes.toLocaleString('fr-FR')} restantes${expirees ? ` · ${expirees.toLocaleString('fr-FR')} inscription${expirees > 1 ? 's' : ''} non payée${expirees > 1 ? 's' : ''} hors délai (place libérée)` : ''}.</span>
          ${actifs.length > ei.quota ? `<div class="info r">${I.info}<span>Le quota est inférieur au nombre d'inscriptions déjà faites (${actifs.length.toLocaleString('fr-FR')}) : aucune nouvelle inscription ne passera, celles déjà faites sont conservées.</span></div>` : ''}
          <span class="radios" role="radiogroup" aria-label="Inscriptions">
            <label><input type="radio" name="ouvertes" value="oui" ${ei.ouvertes ? 'checked' : ''}> Ouvertes</label>
            <label><input type="radio" name="ouvertes" value="non" ${ei.ouvertes ? '' : 'checked'}> Fermées</label></span>
          <label class="champ">Quota de la vague (places, annulées non comptées)<input name="quota" type="number" min="0" max="100000" step="1" inputmode="numeric" required value="${esc(ei.quota)}"></label>
          <label class="champ">Délai pour payer (heures) <span class="note">au-delà, une inscription non payée libère sa place</span><input name="delai" type="number" min="1" max="720" step="1" inputmode="numeric" required value="${esc(ei.delai_paiement_heures || 48)}"></label>
          <label class="champ">Message affiché quand c'est fermé <span class="note">facultatif</span><textarea name="message" maxlength="300" rows="2" placeholder="Ex. : Inscriptions suspendues pour maintenance, reprise à 18 h.">${esc(ei.message || '')}</textarea></label>
          <p class="note">En cas d'incident (paiements anormaux, panne), fermer ici suspend aussitôt les nouvelles inscriptions ; celles déjà faites restent consultables et payables.</p>
          <p class="erreur" role="alert"></p>
          <button class="btn petit" type="submit">Enregistrer</button>
        </form>` : '';
      return `${reglages}
        <div class="stats">
          ${stat(actifs.length, 'inscriptions (hors annulées)')}
          ${stat(payes.length, 'validées, dossard attribué')}
          ${stat(ins.filter((i) => i.statut === 'paiement_declare').length, 'paiements à vérifier')}
          ${stat(ins.filter((i) => i.statut === 'en_attente').length, 'en attente de paiement')}
          ${stat(par('3'), '3 km : validées / total')}
          ${stat(par('5'), '5 km : validées / total')}
          ${stat(par('10'), '10 km : validées / total')}
          ${stat(payes.filter((i) => i.retire).length, 'dossards retirés')}
          ${stat(fcfa(payes.reduce((a, i) => a + i.montant, 0)), 'inscriptions encaissées')}
          ${stat(fcfa((S.etat && S.etat.fonds.collecte) || 0), 'Fonds de solidarité')}
          ${stat(A.ben.filter((b) => b.statut !== 'decline').length, 'bénévoles candidats')}
          ${stat(A.ben.filter((b) => b.statut === 'retenu').length, 'bénévoles retenus')}
          ${stat(A.evs.filter((e) => e.publie).length, 'événements et actions publiés')}
          ${stat(A.par.filter((p) => p.statut !== 'annule').reduce((s2, p) => s2 + p.personnes, 0), 'participants aux actions')}
          ${stat(A.cand.filter((c) => c.type === 'ambassadeur').length, 'candidatures ambassadeur')}
          ${stat(A.cand.filter((c) => c.statut === 'nouveau').length, 'demandes à traiter')}
          ${stat((A.pubs || []).filter((x) => x.statut === 'en_attente').length, 'photos à valider')}
        </div>
        <div class="carte pile"><b>Exporter</b>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn petit" data-action="csv" data-k="ins">Inscriptions (CSV)</button>
            <button class="btn petit" data-action="csv" data-k="dons">Dons (CSV)</button>
            <button class="btn petit" data-action="csv" data-k="cmd">Boutique (CSV)</button>
            <button class="btn petit" data-action="csv" data-k="ben">Bénévoles (CSV)</button>
          </div>
          <p class="note">Le fichier s'ouvre dans Excel ou Google Sheets.</p>
        </div>`;
    }
    if (A.onglet === 'inscriptions') {
      return `
        <div class="filtres">
          <input type="search" data-filtre="q" placeholder="Nom, référence, téléphone, dossard" value="${esc(A.q)}" aria-label="Rechercher">
          <select data-filtre="statut" aria-label="Statut"><option value="">Tous les statuts</option>${['paiement_declare', 'en_attente', 'paye', 'annule'].map((s) => `<option value="${s}" ${A.statut === s ? 'selected' : ''}>${STATUT[s]}</option>`).join('')}</select>
          <select data-filtre="dist" aria-label="Distance"><option value="">Toutes distances</option>${C.distances.map((d) => `<option value="${d.id}" ${A.dist === d.id ? 'selected' : ''}>${d.km}</option>`).join('')}</select>
        </div>
        <div id="adm-liste" class="pile">${admListe()}</div>
        <div class="carte pile" style="gap:6px;margin-top:12px"><b>Après la course : effacer les coordonnées</b>
          <span class="note">Efface noms complets, téléphones, e-mails, contacts d'urgence, dates de naissance précises et identifiants de transaction. Garde, pour les résultats : prénom, initiale du nom, année de naissance, sexe, épreuve, catégorie, dossard et résultat ; pour la comptabilité : référence, statut, montants et dates. Irréversible. Possible seulement après le jour de la course ; à faire <b>au plus tard le ${esc(dateFr(dateLimiteEffacement()))}</b> (fait automatiquement ce jour-là si la planification est activée dans Supabase).</span>
          ${A.anonConfirm ? `<div class="info r">${I.info}<span>Confirmer l'effacement des coordonnées de toutes les inscriptions ? Cette action ne peut pas être annulée.</span></div>
          <div style="display:flex;gap:8px"><button class="btn petit" data-action="adm-anonymiser-ok">Oui, effacer</button><button class="btn contour petit" data-action="adm-anonymiser-non">Annuler</button></div>`
          : `<button class="btn contour petit" data-action="adm-anonymiser" ${new Date() <= new Date(C.evenement.depart) ? 'disabled' : ''}>Effacer les coordonnées…</button>`}</div>`;
    }
    if (A.onglet === 'retrait') {
      return `
        <div class="carte pile"><b>Retrait des dossards</b>
          <label class="champ">Référence, numéro de dossard ou téléphone<input type="search" data-filtre="retrait" value="${esc(A.r || '')}" inputmode="search" autocomplete="off"></label>
          <p class="note">Scannez le QR code affiché sur le téléphone du coureur, ou tapez sa référence, son numéro ou son téléphone.</p>
          <div id="scan-zone" class="pile">${boutonScan()}</div></div>
        <div id="adm-liste" class="pile">${admRetrait()}</div>`;
    }
    if (A.onglet === 'dons') {
      if (!A.dons.length) return '<p class="vide">Aucun don pour l’instant.</p>';
      return A.dons.slice(0, 300).map((d) => `
        <div class="carte ligne-adm">
          <div class="haut"><b>${fcfa(d.montant)}</b><span class="statut s-${esc(d.statut)}">${esc(STATUT[d.statut] || d.statut)}</span></div>
          <span class="meta">${esc(d.reference)} · ${esc(d.nom || 'Anonyme')} · ${esc(d.telephone)} · ${dateFr(d.created_at, true)}</span>
          ${d.transaction_id ? `<span class="meta">${d.operateur === 'orange' ? 'Orange Money' : 'MTN MoMo'} · transaction <b>${esc(d.transaction_id)}</b></span>` : ''}
          <div class="actions">${['en_attente', 'paiement_declare'].includes(d.statut) ? `<button class="btn petit" data-action="valider-don" data-id="${esc(d.id)}">Valider le don</button><button class="btn contour petit" data-action="annuler-don" data-id="${esc(d.id)}">Annuler</button>` : ''}</div>
        </div>`).join('');
    }
    if (A.onglet === 'commandes') {
      if (!A.cmd.length) return '<p class="vide">Aucune précommande pour l’instant.</p>';
      return A.cmd.slice(0, 300).map((c) => `
        <div class="carte ligne-adm">
          <div class="haut"><b>${esc(c.nom)}</b><span class="statut s-${esc(c.statut)}">${esc(STATUT[c.statut] || c.statut)}</span></div>
          <span class="meta">${esc(c.reference)} · ${esc(c.telephone)}${c.inscription_ref ? ` · inscription ${esc(c.inscription_ref)}` : ''} · ${dateFr(c.created_at, true)}</span>
          <span>${(c.articles || []).map((a) => { const art = C.boutique.articles.find((x) => x.id === a.id); return `${esc(a.qte)} × ${esc(art ? art.nom : a.id)}${a.taille ? ` (${esc(a.taille)})` : ''}`; }).join(' · ')}</span>
          <label class="champ" style="max-width:240px">Statut<select data-action-change="statut-commande" data-id="${esc(c.id)}">${['nouvelle', 'confirmee', 'payee', 'livree', 'annulee'].map((s) => `<option value="${s}" ${c.statut === s ? 'selected' : ''}>${STATUT[s]}</option>`).join('')}</select></label>
        </div>`).join('');
    }


    if (A.onglet === 'evenements') {
      const edit = A.evEdit && (A.evEdit === 'nouveau' ? { rubrique: 'action', type: 'collecte', inscription: 'participation', publie: false } : A.evs.find((e) => e.id === A.evEdit));
      if (edit) {
        const opt = (liste, v) => liste.map(([k, t]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${t}</option>`).join('');
        return `<form data-form="evenement" data-id="${esc(edit.id || '')}" class="carte" novalidate>
          <b>${edit.id ? 'Modifier' : 'Créer'} un événement ou une action</b>
          <div class="grille2">
            <label class="champ">Rubrique<select name="rubrique">${opt([['evenement', 'Événement'], ['action', 'Action environnementale']], edit.rubrique)}</select></label>
            <label class="champ">Type<select name="type">${opt(Object.entries(TYPES).map(([k, [t]]) => [k, t]), edit.type)}</select></label>
          </div>
          <label class="champ">Titre<input name="titre" required maxlength="140" value="${esc(edit.titre || '')}"></label>
          <label class="champ">Résumé <small>une phrase</small><input name="resume" maxlength="300" value="${esc(edit.resume || '')}"></label>
          <label class="champ">Description<textarea name="description" rows="4" maxlength="5000">${esc(edit.description || '')}</textarea></label>
          <div class="grille2">
            <label class="champ">Date de début<input name="date_debut" type="date" value="${esc(edit.date_debut || '')}"></label>
            <label class="champ">Date de fin <small>facultatif</small><input name="date_fin" type="date" value="${esc(edit.date_fin || '')}"></label>
          </div>
          <label class="champ">Date en texte <small>remplace l'affichage, ex. « Date à confirmer »</small><input name="date_texte" maxlength="80" value="${esc(edit.date_texte || '')}"></label>
          <div class="grille2">
            <label class="champ">Lieu<input name="lieu" maxlength="140" value="${esc(edit.lieu || '')}"></label>
            <label class="champ">Ville<input name="ville" maxlength="80" value="${esc(edit.ville || '')}"></label>
          </div>
          <div class="grille2">
            <label class="champ">Inscription<select name="inscription">${opt([['participation', 'Dans l’appli'], ['externe', 'Lien externe'], ['aucune', 'Pas d’inscription'], ['course20km', 'Course 10 KM']], edit.inscription)}</select></label>
            <label class="champ">Places <small>vide = illimité</small><input name="places" type="number" min="1" value="${esc(edit.places || '')}"></label>
          </div>
          <label class="champ">Lien externe <small>https://…</small><input name="lien" type="url" maxlength="300" value="${esc(edit.lien || '')}"></label>
          <label class="champ">Photo <small>adresse d'une image en ligne (https://…)</small><input name="image" type="url" maxlength="500" value="${esc(edit.image || '')}"></label>
          <div class="grille2"><label class="champ">Latitude <small>pour la carte</small><input name="lat" inputmode="decimal" value="${esc(edit.lat == null ? '' : edit.lat)}" placeholder="3.8667"></label>
          <label class="champ">Longitude<input name="lng" inputmode="decimal" value="${esc(edit.lng == null ? '' : edit.lng)}" placeholder="11.5167"></label></div>
          <fieldset class="carte pile" style="margin:0;gap:10px"><legend style="font-weight:800;font-size:14px;padding:0 4px">Bilan, après l'action</legend>
            <div class="grille2">
              <label class="champ">Déchets collectés (kg)<input name="dechets_kg" type="number" min="0" step="0.1" value="${esc(edit.dechets_kg || '')}"></label>
              <label class="champ">Arbres plantés<input name="arbres" type="number" min="0" value="${esc(edit.arbres || '')}"></label>
            </div>
            <label class="champ">Déchets recyclés (kg)<input name="recycles_kg" type="number" min="0" step="0.1" value="${esc(edit.recycles_kg || '')}"></label>
            <label class="champ">Personnes sensibilisées<input name="sensibilises" type="number" min="0" value="${esc(edit.sensibilises || '')}"></label>
            <label class="champ">Compte rendu<textarea name="bilan" rows="3" maxlength="2000">${esc(edit.bilan || '')}</textarea></label>
          </fieldset>
          <label class="case"><input type="checkbox" name="publie" ${edit.publie ? 'checked' : ''}> <span>Publier dans l'appli</span></label>
          <p class="erreur" role="alert"></p>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn petit" type="submit">Enregistrer</button><button class="btn contour petit" type="button" data-action="ev-annuler">Annuler</button></div>
        </form>`;
      }
      const nb = (id) => A.par.filter((p) => p.evenement_id === id && p.statut !== 'annule').reduce((s2, p) => s2 + p.personnes, 0);
      return `<button class="btn" data-action="ev-nouveau">Créer un événement ou une action</button>` + (A.evs.length ? A.evs.map((e) => `
        <div class="carte ligne-adm">
          <div class="haut"><b>${esc(e.titre)}</b><span class="statut ${e.publie ? 's-paye' : 's-nouvelle'}">${e.publie ? 'Publié' : 'Brouillon'}</span></div>
          <span class="meta">${e.rubrique === 'action' ? 'Action' : 'Événement'} · ${esc((TYPES[e.type] || TYPES.autre)[0])} · ${esc(quand(e))}${e.ville ? ' · ' + esc(e.ville) : ''}</span>
          <span class="meta">${nb(e.id)} inscrit(s)${e.places ? ' sur ' + esc(e.places) : ''}${e.dechets_kg > 0 || e.arbres > 0 || e.sensibilises > 0 ? ' · bilan saisi' : ''}</span>
          <div class="actions"><button class="btn petit" data-action="ev-modifier" data-id="${esc(e.id)}">Modifier</button><button class="btn contour petit" data-action="ev-participants" data-id="${esc(e.id)}">Participants</button><button class="btn contour petit" data-action="ev-supprimer" data-id="${esc(e.id)}">Supprimer</button></div>
        </div>`).join('') : '<p class="vide">Aucun événement.</p>');
    }
    if (A.onglet === 'participations') {
      const l = A.par.filter((p) => !A.parEv || p.evenement_id === A.parEv);
      const titre = (id) => { const e = A.evs.find((x) => x.id === id); return e ? e.titre : '—'; };
      return `<div class="filtres"><select data-filtre="parEv" aria-label="Événement"><option value="">Tous les événements</option>${A.evs.map((e) => `<option value="${esc(e.id)}" ${A.parEv === e.id ? 'selected' : ''}>${esc(e.titre)}</option>`).join('')}</select>
        <button class="btn petit" data-action="csv" data-k="par">Exporter (CSV)</button></div>
        <p class="note">${l.filter((p) => p.statut !== 'annule').reduce((s2, p) => s2 + p.personnes, 0)} personne(s) inscrite(s) · ${l.filter((p) => p.statut === 'present').reduce((s2, p) => s2 + p.personnes, 0)} présente(s)</p>
        <div id="adm-liste" class="pile">${l.length ? l.slice(0, 300).map((p) => `
        <div class="carte ligne-adm">
          <div class="haut"><b>${esc(p.prenom)} ${esc(p.nom)}${p.personnes > 1 ? ` + ${p.personnes - 1}` : ''}</b><span class="statut s-par-${esc(p.statut)}">${esc(STATUT_PAR[p.statut])}</span></div>
          <span class="meta">${esc(p.reference)} · ${esc(titre(p.evenement_id))} · ${esc(p.telephone)}${p.email ? ' · ' + esc(p.email) : ''}</span>
          ${p.message ? `<span class="meta">« ${esc(p.message)} »</span>` : ''}
          <label class="champ" style="max-width:240px">Présence<select data-action-change="statut-participation" data-id="${esc(p.id)}">${Object.entries(STATUT_PAR).map(([k, t]) => `<option value="${k}" ${p.statut === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        </div>`).join('') : '<p class="vide">Aucune participation.</p>'}</div>`;
    }
    if (A.onglet === 'candidatures') {
      const l = A.cand.filter((c) => !A.candType || c.type === A.candType);
      const LIB = { ambassadeur: 'Ambassadeur', projet: 'Projet', partenaire: 'Partenaire' };
      return `<div class="filtres"><select data-filtre="candType" aria-label="Type"><option value="">Toutes les demandes</option>${Object.entries(LIB).map(([k, t]) => `<option value="${k}" ${A.candType === k ? 'selected' : ''}>${t}s</option>`).join('')}</select>
        <button class="btn petit" data-action="csv" data-k="cand">Exporter (CSV)</button></div>
        <div id="adm-liste" class="pile">${l.length ? l.slice(0, 300).map((c) => `
        <div class="carte ligne-adm">
          <div class="haut"><b>${esc(c.organisation || [c.prenom, c.nom].filter(Boolean).join(' '))}</b><span class="statut s-cand-${esc(c.statut)}">${esc(STATUT_CAND[c.statut])}</span></div>
          <span class="meta">${LIB[c.type]} · ${esc(c.reference)} · ${esc(c.telephone)}${c.email ? ' · ' + esc(c.email) : ''}${c.ville ? ' · ' + esc(c.ville) : ''} · ${dateFr(c.created_at, true)}</span>
          ${c.titre ? `<b>${esc(c.titre)}</b>` : ''}<span style="white-space:pre-line">${esc(c.message)}</span>
          <label class="champ" style="max-width:240px">Suivi<select data-action-change="statut-candidature" data-id="${esc(c.id)}">${Object.entries(STATUT_CAND).map(([k, t]) => `<option value="${k}" ${c.statut === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        </div>`).join('') : '<p class="vide">Aucune demande.</p>'}</div>`;
    }
    if (A.onglet === 'groupes') {
      const g = A.grEdit && (A.grEdit === 'nouveau' ? { publie: true } : A.grs.find((x) => x.id === A.grEdit));
      return `${g ? `<form data-form="groupe" data-id="${esc(g.id || '')}" class="carte" novalidate><b>${g.id ? 'Modifier' : 'Créer'} un groupe local</b>
          <div class="grille2"><label class="champ">Nom<input name="nom" required maxlength="100" value="${esc(g.nom || '')}"></label><label class="champ">Ville<input name="ville" required maxlength="80" value="${esc(g.ville || '')}"></label></div>
          <label class="champ">Description<input name="description" maxlength="500" value="${esc(g.description || '')}"></label>
          <label class="champ">Lien pour rejoindre <small>groupe WhatsApp, Telegram… (https://)</small><input name="lien" type="url" maxlength="300" value="${esc(g.lien || '')}"></label>
          <label class="case"><input type="checkbox" name="publie" ${g.publie !== false ? 'checked' : ''}> <span>Afficher dans l'appli</span></label>
          <p class="erreur" role="alert"></p>
          <div style="display:flex;gap:8px"><button class="btn petit" type="submit">Enregistrer</button><button class="btn contour petit" type="button" data-action="gr-annuler">Annuler</button></div></form>`
        : '<button class="btn" data-action="gr-nouveau">Créer un groupe local</button>'}
        ${A.grs.map((x) => `<div class="carte ligne-adm"><div class="haut"><b>${esc(x.nom)}</b><span class="meta">${esc(x.ville)}</span></div>${x.lien ? `<span class="meta">${esc(x.lien)}</span>` : ''}
          <div class="actions"><button class="btn petit" data-action="gr-modifier" data-id="${esc(x.id)}">Modifier</button><button class="btn contour petit" data-action="gr-supprimer" data-id="${esc(x.id)}">Supprimer</button></div></div>`).join('')}`;
    }
    if (A.onglet === 'contenus') {
      const c = A.ctEdit && (A.ctEdit === 'nouveau' ? { type: 'guide', publie: false } : A.cts.find((x) => x.id === A.ctEdit));
      if (c) {
        return `<form data-form="contenu" data-id="${esc(c.id || '')}" class="carte" novalidate><b>${c.id ? 'Modifier' : 'Créer'} un contenu</b>
          <div class="grille2"><label class="champ">Type<select name="type">${[['guide', 'Guide'], ['video', 'Vidéo'], ['quiz', 'Quiz']].map(([k, t]) => `<option value="${k}" ${c.type === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="champ">Thème<input name="theme" maxlength="60" value="${esc(c.theme || '')}" placeholder="Déchets, climat, eau…"></label></div>
          <label class="champ">Titre<input name="titre" required maxlength="140" value="${esc(c.titre || '')}"></label>
          <label class="champ">Résumé<input name="resume" maxlength="300" value="${esc(c.resume || '')}"></label>
          <label class="champ">Texte <small>guide ou présentation de la vidéo</small><textarea name="corps" rows="6" maxlength="20000">${esc(c.corps || '')}</textarea></label>
          <label class="champ">Lien <small>vidéo YouTube, document… (https://)</small><input name="lien" type="url" maxlength="300" value="${esc(c.lien || '')}"></label>
          <label class="champ">Questions du quiz <small>« ? » question, « - » mauvaise réponse, « * » bonne réponse, « > » explication</small>
            <textarea name="quiz" rows="9" placeholder="? Que faire des épluchures ?&#10;- Les brûler&#10;* Les composter&#10;> Le compost devient un engrais naturel.">${esc(c.quiz ? quizTexte(c.quiz) : '')}</textarea></label>
          <label class="case"><input type="checkbox" name="publie" ${c.publie ? 'checked' : ''}> <span>Publier dans l'appli</span></label>
          <p class="erreur" role="alert"></p>
          <div style="display:flex;gap:8px"><button class="btn petit" type="submit">Enregistrer</button><button class="btn contour petit" type="button" data-action="ct-annuler">Annuler</button></div></form>`;
      }
      return `<button class="btn" data-action="ct-nouveau">Créer un guide, une vidéo ou un quiz</button>` + A.cts.map((x) => `<div class="carte ligne-adm"><div class="haut"><b>${esc(x.titre)}</b><span class="statut ${x.publie ? 's-paye' : 's-nouvelle'}">${x.publie ? 'Publié' : 'Brouillon'}</span></div>
        <span class="meta">${({ guide: 'Guide', video: 'Vidéo', quiz: 'Quiz' })[x.type]}${x.theme ? ' · ' + esc(x.theme) : ''}${x.quiz ? ` · ${x.quiz.length} question(s)` : ''}</span>
        <div class="actions"><button class="btn petit" data-action="ct-modifier" data-id="${esc(x.id)}">Modifier</button><button class="btn contour petit" data-action="ct-supprimer" data-id="${esc(x.id)}">Supprimer</button></div></div>`).join('');
    }

    if (A.onglet === 'fil') {
      const l = A.pubs || [];
      if (!l.length) return '<p class="vide">Aucune publication pour l’instant.</p>';
      const LIB = { en_attente: 'À valider', publie: 'Publiée', masque: 'Masquée' };
      return `<p class="note">${l.filter((x) => x.statut === 'en_attente').length} photo(s) à valider. Vérifiez qu'aucun enfant n'est reconnaissable sans accord et que le contenu respecte la charte.</p>` + l.map((x) => `
        <div class="carte ligne-adm">
          <div class="haut"><b>${esc(x.auteur)}${x.ville ? ' · ' + esc(x.ville) : ''}</b><span class="statut ${x.statut === 'publie' ? 's-paye' : x.statut === 'masque' ? 's-annule' : 's-en_attente'}">${LIB[x.statut]}</span></div>
          <img src="${esc(D.urlPhoto(x.photo))}" alt="" style="width:100%;max-height:260px;object-fit:cover;border-radius:12px">
          <span class="meta">${esc(LIB_CAT[x.categorie] || x.categorie)} · ${dateFr(x.created_at, true)}${x.lieu ? ' · ' + esc(x.lieu) : ''}${x.signalements ? ` · <b style="color:var(--rouge)">${esc(x.signalements)} signalement(s)</b>` : ''}</span>
          ${x.texte ? `<span>${esc(x.texte)}</span>` : ''}
          <div class="actions">${x.statut !== 'publie' ? `<button class="btn petit" data-action="moderer" data-id="${esc(x.id)}" data-v="publie">Publier</button>` : ''}${x.statut !== 'masque' ? `<button class="btn contour petit" data-action="moderer" data-id="${esc(x.id)}" data-v="masque">Masquer</button>` : ''}</div>
          ${(x.commentaires || []).length ? `<div class="pile" style="gap:4px;border-top:1px solid var(--ligne);padding-top:8px">${x.commentaires.map((c) => `<span class="meta" style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span><b>${esc(c.auteur)}</b> ${esc(c.texte)}${c.statut === 'masque' ? ' (masqué)' : ''}</span>${c.statut !== 'masque' ? `<button class="btn contour petit" data-action="masquer-com" data-id="${esc(c.id)}">Masquer</button>` : ''}</span>`).join('')}</div>` : ''}
        </div>`).join('');
    }
    if (A.onglet === 'carte') {
      const actif = A.suivi && A.suivi.actif;
      const pt = A.ptEdit && (A.ptEdit === 'nouveau' ? { type: 'collecte', publie: true } : (A.pts || []).find((x) => x.id === A.ptEdit));
      return `<div class="carte pile" style="gap:8px"><b>Suivi des coureurs en direct</b>
          <span class="note">${actif ? 'Ouvert : les coureurs qui l’acceptent partagent leur position.' : 'Fermé. Ouvrez-le le matin de la course : il se ferme tout seul après 8 heures, et les positions sont effacées à la fermeture.'}</span>
          <button class="btn ${actif ? 'contour' : ''} petit" style="align-self:flex-start" data-action="suivi" data-v="${actif ? 0 : 1}">${actif ? 'Fermer le suivi' : 'Ouvrir le suivi pour 8 heures'}</button></div>
        ${pt ? `<form data-form="point" data-id="${esc(pt.id || '')}" class="carte" novalidate><b>${pt.id ? 'Modifier' : 'Ajouter'} un point de collecte</b>
            <label class="champ">Nom<input name="nom" required maxlength="120" value="${esc(pt.nom || '')}"></label>
            <div class="grille2"><label class="champ">Type<select name="type">${Object.entries(TYPES_POINT).map(([k, t]) => `<option value="${k}" ${pt.type === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label class="champ">Horaires<input name="horaires" maxlength="200" value="${esc(pt.horaires || '')}"></label></div>
            <label class="champ">Adresse<input name="adresse" maxlength="200" value="${esc(pt.adresse || '')}"></label>
            <div class="grille2"><label class="champ">Latitude<input name="lat" required inputmode="decimal" value="${esc(pt.lat == null ? '' : pt.lat)}" placeholder="3.8667"></label>
            <label class="champ">Longitude<input name="lng" required inputmode="decimal" value="${esc(pt.lng == null ? '' : pt.lng)}" placeholder="11.5167"></label></div>
            <button type="button" class="btn clair petit" data-action="ma-position">${I.lieu} Utiliser ma position actuelle</button>
            <p class="note" style="margin:0">Ou sur openstreetmap.org : clic droit sur le lieu, « Afficher l'adresse », puis copiez les deux nombres.</p>
            <label class="case"><input type="checkbox" name="publie" ${pt.publie !== false ? 'checked' : ''}> <span>Afficher sur la carte</span></label>
            <p class="erreur" role="alert"></p>
            <div style="display:flex;gap:8px"><button class="btn petit" type="submit">Enregistrer</button><button class="btn contour petit" type="button" data-action="pt-annuler">Annuler</button></div></form>`
          : '<button class="btn" data-action="pt-nouveau">Ajouter un point de collecte</button>'}
        ${(A.pts || []).map((x) => `<div class="carte ligne-adm"><div class="haut"><b>${esc(x.nom)}</b><span class="meta">${esc(TYPES_POINT[x.type] || x.type)}</span></div>
          <span class="meta">${esc([x.adresse, x.horaires].filter(Boolean).join(' · '))} · ${esc(Number(x.lat).toFixed(5))}, ${esc(Number(x.lng).toFixed(5))}</span>
          <div class="actions"><button class="btn petit" data-action="pt-modifier" data-id="${esc(x.id)}">Modifier</button><button class="btn contour petit" data-action="pt-supprimer" data-id="${esc(x.id)}">Supprimer</button></div></div>`).join('')}
        <p class="note">Pour placer un événement ou une action sur la carte, renseignez sa latitude et sa longitude dans « Événements et actions ».</p>`;
    }
    if (A.onglet === 'benevoles') {
      if (!A.ben.length) return '<p class="vide">Aucune candidature pour l’instant.</p>';
      const lib = Object.fromEntries(MISSIONS.map(([id, t]) => [id, t]));
      const parMission = MISSIONS.map(([id, t]) => `${t} : ${A.ben.filter((b) => b.statut !== 'decline' && (b.missions || []).includes(id)).length}`).join(' · ');
      return `<p class="note">${parMission}</p>` + A.ben.slice(0, 300).map((b) => `
        <div class="carte ligne-adm">
          <div class="haut"><b>${esc(b.prenom)} ${esc(b.nom)}</b><span class="statut s-ben-${esc(b.statut)}">${esc(STATUT_BEN[b.statut] || b.statut)}</span></div>
          <span class="meta">${esc(b.reference)} · ${esc(b.telephone)}${b.email ? ' · ' + esc(b.email) : ''}${b.ville ? ' · ' + esc(b.ville) : ''}${b.taille_tshirt ? ' · t-shirt ' + esc(b.taille_tshirt) : ''}</span>
          <span>${(b.missions || []).map((m) => esc(lib[m] || m)).join(' · ')}</span>
          ${b.disponibilites ? `<span class="meta">${esc(b.disponibilites)}</span>` : ''}
          <label class="champ" style="max-width:240px">Statut<select data-action-change="statut-benevole" data-id="${esc(b.id)}">${Object.entries(STATUT_BEN).map(([k, t]) => `<option value="${k}" ${b.statut === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        </div>`).join('');
    }
    if (A.onglet === 'annonces') {
      return `
        <form data-form="annonce" class="carte" novalidate>
          <b>Publier une actualité</b>
          <label class="champ">Titre<input name="titre" required maxlength="120"></label>
          <label class="champ">Texte<textarea name="texte" required maxlength="2000" rows="5"></textarea></label>
          <p class="erreur" role="alert"></p>
          <button class="btn" type="submit">Publier</button>
          <p class="note">L'actualité apparaît tout de suite sur l'accueil de l'appli.</p>
        </form>
        ${A.ann.length ? A.ann.map((a) => `<div class="carte ligne-adm"><div class="haut"><b>${esc(a.titre)}</b><span class="meta">${dateFr(a.created_at, true)}</span></div><span style="white-space:pre-line">${esc(a.texte)}</span><div class="actions"><button class="btn contour petit" data-action="supprimer-annonce" data-id="${esc(a.id)}">Supprimer</button></div></div>`).join('') : '<p class="vide">Aucune actualité publiée.</p>'}`;
    }
    if (A.onglet === 'resultats') {
      const n = (S.etat && S.etat.resultats) || 0;
      return `
        <div class="info">${I.info}<span>${n ? `${n} temps publiés. Ils sont visibles dans l'écran « Résultats ».` : 'Aucun résultat publié.'}</span></div>
        <form data-form="import-resultats" class="carte" novalidate>
          <b>Importer les temps</b>
          <p class="note">Collez une ligne par coureur : numéro de dossard puis temps (h:mm:ss ou mm:ss), séparés par un point-virgule, une virgule, une tabulation ou une espace. Vous pouvez copier deux colonnes depuis Excel. Un dossard déjà importé est mis à jour.</p>
          <label class="champ">Dossards et temps<textarea name="lignes" rows="8" placeholder="1;1:05:42&#10;2;1:07:10&#10;5001;42:18"></textarea></label>
          <label class="champ">Ou un fichier CSV<input name="fichier" type="file" accept=".csv,.txt,text/csv,text/plain"></label>
          <p class="erreur" role="alert"></p>
          <button class="btn" type="submit">Importer</button>
        </form>
        ${n ? '<button class="btn contour petit" data-action="vider-resultats">Effacer tous les résultats</button>' : ''}`;
    }
    if (A.onglet === 'fonds') {
      const f = (S.etat && S.etat.fonds) || { collecte: 0, donateurs: 0, objectif: C.fonds.objectif };
      return `
        <form data-form="fonds" class="carte" novalidate>
          <b>Ajuster le Fonds</b>
          <p class="note">Les dons et les dons ajoutés aux inscriptions s'ajoutent tout seuls à la validation. Ce formulaire sert aux versements reçus autrement (espèces, virement d'un sponsor).</p>
          <label class="champ">Montant collecté (FCFA)<input name="collecte" type="number" min="0" step="1" required value="${esc(f.collecte)}"></label>
          <label class="champ">Nombre de donateurs<input name="donateurs" type="number" min="0" step="1" required value="${esc(f.donateurs)}"></label>
          <p class="erreur" role="alert"></p>
          <button class="btn" type="submit">Enregistrer</button>
        </form>`;
    }
    return '';
  }

  function carteInscription(i, retrait) {
    const d = distance(i.distance);
    const actions = [];
    if (['en_attente', 'paiement_declare'].includes(i.statut)) actions.push(`<button class="btn petit" data-action="valider" data-id="${esc(i.id)}">Valider le paiement</button>`, `<button class="btn contour petit" data-action="annuler" data-id="${esc(i.id)}">Annuler</button>`);
    if (i.statut === 'paye') actions.push(i.retire ? `<button class="btn contour petit" data-action="retrait" data-id="${esc(i.id)}" data-v="0">Annuler le retrait</button>` : `<button class="btn ${retrait ? 'j' : ''} petit" data-action="retrait" data-id="${esc(i.id)}" data-v="1">Remettre le dossard</button>`);
    return `
      <div class="carte ligne-adm">
        <div class="haut"><b>${esc(i.prenom)} ${esc(i.nom)}</b><span class="statut s-${esc(i.statut)}">${esc(STATUT[i.statut] || i.statut)}${delaiDepasse(i) ? ' · délai dépassé' : ''}</span></div>
        ${i.dossard ? `<span style="font-size:${retrait ? 40 : 20}px;font-weight:800;line-height:1.1">Dossard ${esc(i.dossard)}${i.retire ? ' · retiré' : ''}</span>` : ''}
        <span class="meta">${esc(i.reference)} · ${esc(d.km)} · ${CAT[i.categorie] || ''} · ${fcfa(i.montant)}${i.don ? ` + don ${fcfa(i.don)}` : ''}</span>
        <span class="meta">${esc(i.telephone)} · ${i.sexe === 'F' ? 'Femme' : 'Homme'} · né(e) le ${dateFr(i.date_naissance)} · urgence : ${esc(i.urgence_nom)} ${esc(i.urgence_tel)}</span>
        ${i.transaction_id ? `<span class="meta">${i.operateur === 'orange' ? 'Orange Money' : 'MTN MoMo'} · transaction <b>${esc(i.transaction_id)}</b></span>` : ''}
        ${i.categorie === 'etudiant' && retrait ? `<div class="info j">${I.info}<span>Vérifier la carte d'étudiant.</span></div>` : ''}
        <div class="actions">${actions.join('')}</div>
      </div>`;
  }

  function admListe() {
    const A = S.adm; const q = A.q.trim().toLowerCase(); const qn = window.ODC_DATA.chiffres(q);
    const res = A.ins.filter((i) => (!A.statut || i.statut === A.statut) && (!A.dist || i.distance === A.dist) && (!q ||
      `${i.nom} ${i.prenom} ${i.reference}`.toLowerCase().includes(q) || (qn && (window.ODC_DATA.chiffres(i.telephone).includes(qn) || String(i.dossard || '') === qn))));
    if (!res.length) return `<p class="vide">${A.ins.length ? 'Aucun résultat.' : 'Aucune inscription pour l’instant.'}</p>`;
    return `<p class="note">${res.length} résultat${res.length > 1 ? 's' : ''}${res.length > 200 ? ' · 200 premiers affichés' : ''}</p>` + res.slice(0, 200).map((i) => carteInscription(i)).join('');
  }

  function admRetrait() {
    const q = String(S.adm.r || '').trim(); if (!q) return '';
    const up = q.toUpperCase(); const qn = window.ODC_DATA.chiffres(q);
    const res = S.adm.ins.filter((i) => i.reference === up || (qn && (String(i.dossard || '') === qn || (qn.length >= 8 && window.ODC_DATA.chiffres(i.telephone).endsWith(qn.slice(-9))))));
    if (!res.length) return '<p class="vide">Aucun coureur trouvé.</p>';
    return res.slice(0, 10).map((i) => carteInscription(i, true)).join('');
  }

  async function admCharger() {
    S.adm.chargement = true; S.adm.erreur = null; majAdm();
    try {
      const [ins, dons, cmd, ben, ann, evs, par, cand, grs, cts] = await Promise.all([D.inscriptions(), D.dons(), D.commandes(), D.benevoles(), D.annonces(),
        D.evenementsAdmin(), D.participations(), D.candidatures(), D.groupesAdmin(), D.contenusAdmin()]);
      const [pubs, pts, suivi] = await Promise.all([D.publicationsAdmin(), D.pointsAdmin(), D.suiviEtat()]);
      Object.assign(S.adm, { ins, dons, cmd, ben, ann, evs, par, cand, grs, cts, pubs, pts, suivi });
      S.etat = await D.etatPublic(); S.annonces = ann;
    } catch (e) { S.adm.erreur = e.message; }
    S.adm.chargement = false; majAdm();
  }
  function majAdm() { const el = document.getElementById('adm'); if (el) el.innerHTML = admContenu(); else if (route() === 'admin') rendre(false); }


  // Quiz : format texte de l'espace organisateurs
  function lireQuiz(t) {
    const qs = []; let cur = null;
    for (const brut of String(t || '').split(/\r?\n/)) {
      const l = brut.trim(); if (!l) continue;
      if (l.startsWith('?')) { cur = { q: l.slice(1).trim(), choix: [], bonne: -1, explication: '' }; qs.push(cur); }
      else if (!cur) throw new Error('Commencez chaque question par « ? »');
      else if (l.startsWith('*')) { cur.bonne = cur.choix.length; cur.choix.push(l.slice(1).trim()); }
      else if (l.startsWith('-')) cur.choix.push(l.slice(1).trim());
      else if (l.startsWith('>')) cur.explication = l.slice(1).trim();
      else throw new Error('Ligne non comprise : ' + l);
    }
    qs.forEach((q, i) => { if (q.choix.length < 2 || q.bonne < 0) throw new Error(`Question ${i + 1} : il faut au moins 2 réponses dont une marquée « * »`); });
    return qs;
  }
  const quizTexte = (qs) => qs.map((q) => [`? ${q.q}`, ...q.choix.map((c, k) => `${k === q.bonne ? '*' : '-'} ${c}`), q.explication ? `> ${q.explication}` : ''].filter(Boolean).join('\n')).join('\n\n');

  // Lecture d'une liste « dossard ; temps »
  function lireTemps(texteBrut) {
    const lignes = []; const rejets = []; const vus = new Set();
    for (const brut of String(texteBrut).split(/\r?\n/)) {
      const l = brut.trim(); if (!l) continue;
      const m = /^(\d{1,5})[\s;,\t]+(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,]\d+)?$/.exec(l);
      if (!m) { if (!/dossard/i.test(l)) rejets.push(l); continue; }
      const sec = (Number(m[2] || 0) * 3600) + Number(m[3]) * 60 + Number(m[4]);
      if (Number(m[4]) > 59 || (m[2] && Number(m[3]) > 59) || sec < 60 || sec > 36000) { rejets.push(l); continue; }
      const dossard = Number(m[1]); if (vus.has(dossard)) { rejets.push(l + ' (doublon)'); continue; }
      vus.add(dossard); lignes.push({ dossard, secondes: sec });
    }
    return { lignes, rejets };
  }

  function csv(k) {
    const A = S.adm;
    const tables = {
      ins: [A.ins, ['reference', 'created_at', 'statut', 'dossard', 'retire', 'nom', 'prenom', 'sexe', 'date_naissance', 'telephone', 'email', 'ville', 'distance', 'categorie', 'montant', 'don', 'operateur', 'transaction_id', 'urgence_nom', 'urgence_tel']],
      dons: [A.dons, ['reference', 'created_at', 'statut', 'montant', 'nom', 'telephone', 'operateur', 'transaction_id']],
      cmd: [A.cmd, ['reference', 'created_at', 'statut', 'nom', 'telephone', 'inscription_ref', 'articles']],
      ben: [A.ben, ['reference', 'created_at', 'statut', 'nom', 'prenom', 'telephone', 'email', 'ville', 'missions', 'disponibilites', 'taille_tshirt']],
      par: [A.par.filter((p) => !A.parEv || p.evenement_id === A.parEv).map((p) => ({ ...p, evenement: (A.evs.find((e) => e.id === p.evenement_id) || {}).titre })), ['reference', 'created_at', 'evenement', 'statut', 'prenom', 'nom', 'telephone', 'email', 'personnes', 'message']],
      cand: [A.cand.filter((c) => !A.candType || c.type === A.candType), ['reference', 'created_at', 'type', 'statut', 'organisation', 'prenom', 'nom', 'telephone', 'email', 'ville', 'titre', 'message']]
    };
    const [rows, cols] = tables[k];
    const cell = (v) => { let s = v == null ? '' : Array.isArray(v) ? v.map((a) => (typeof a === 'object' ? `${a.qte}x ${a.id}${a.taille ? ' ' + a.taille : ''}` : a)).join(' | ') : String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const texte = '﻿' + [cols.join(';')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(';'))).join('\r\n');
    const nom = `odyssee-${({ ins: 'inscriptions', dons: 'dons', cmd: 'boutique', ben: 'benevoles', par: 'participations', cand: 'demandes' })[k]}-${new Date().toISOString().slice(0, 10)}.csv`;
    try {
      const url = URL.createObjectURL(new Blob([texte], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { /* téléchargement bloqué */ }
    if (navigator.clipboard) navigator.clipboard.writeText(texte.slice(1)).then(() => toast('Fichier téléchargé (et copié dans le presse-papiers).'), () => toast('Fichier téléchargé.'));
  }

  // ---------------------------------------------------------------
  // Rendu et navigation
  // ---------------------------------------------------------------
  const ROUTES = Object.keys(V);
  function route() { const h = location.hash.replace('#', ''); if (!h && !stockage.lire('odc_vu')) return 'bienvenue'; return ROUTES.includes(h) ? h : 'accueil'; }

  function rendre(haut) {
    const r = route();
    vue.innerHTML = V[r]();
    document.body.classList.toggle('plein-ecran', r === 'bienvenue');
    document.querySelectorAll('.tabs a').forEach((a) => {
      const groupes = { accueil: ['accueil', 'services', 'actualites', 'partenaires', 'formations', 'contenu', 'boutique', 'produits', 'fonds', 'don'],
        evenements: ['evenements', 'course', 'inscription', 'paiement', 'confirmation', 'parcours', 'resultats', 'carte'], actions: ['actions', 'impact'],
        communaute: ['communaute', 'benevoles', 'ambassadeurs', 'projet', 'groupes', 'partenariat', 'fil', 'publier'], profil: ['profil', 'dossard', 'admin', 'compte', 'connexion', 'badges', 'ecoactions', 'parametres'] };
      const t = a.dataset.tab; let actif = (groupes[t] || []).includes(r);
      if (r === 'evenement') { const e = S.evs && S.evs.find((x) => x.id === S.evSel); actif = t === (e && e.rubrique === 'action' ? 'actions' : 'evenements'); }
      if (actif) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const titres = { accueil: '', course: 'La course', inscription: 'Inscription', paiement: 'Paiement', dossard: 'Mon dossard', fonds: 'Fonds de solidarité', don: 'Faire un don', boutique: 'Boutique', produits: 'Produits partenaires', admin: 'Espace organisateurs', actualites: 'Actualités', benevoles: 'Bénévoles', resultats: 'Résultats', evenements: 'Événements', evenement: 'Événement', actions: 'Actions', impact: 'Impact', communaute: 'Communauté', ambassadeurs: 'Ambassadeurs', projet: 'Proposer un projet', partenariat: 'Devenir partenaire', groupes: 'Groupes locaux', partenaires: 'Partenaires', parcours: 'Parcours', formations: 'Formations', contenu: 'Formation', profil: 'Profil', services: 'Tous les services', bienvenue: 'Bienvenue', compte: 'Créer un compte', connexion: 'Se connecter', confirmation: 'Inscription confirmée', badges: 'Mes badges', ecoactions: 'Mes éco-actions', parametres: 'Paramètres', carte: 'Carte', fil: "Fil d'actualité", publier: 'Publier une photo' };
    document.title = (titres[r] ? titres[r] + ' · ' : '') + 'Odyssée Connect';
    if (haut) { window.scrollTo(0, 0); vue.focus({ preventScroll: true }); }
    apresRendu(r);
    tic();
  }

  function apresRendu(r) {
    if (r === 'carte') initCarte();
    if (r === 'admin') { const o = document.querySelector('.onglets-adm [aria-pressed=true]'); if (o) o.scrollIntoView({ inline: 'center', block: 'nearest' }); }
    if (r === 'dossard' && S.consult && S.consult.statut === 'paye') {
      const el = document.getElementById('qr');
      if (el && window.QRCode) {
        try { new window.QRCode(el, { text: `ODC|${S.consult.reference}|${S.consult.dossard}`, width: 170, height: 170, colorDark: '#13241a', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M }); }
        catch (e) { el.textContent = S.consult.reference; }
      } else if (el) { el.textContent = S.consult.reference; el.style.fontWeight = '800'; }
    }
  }

  window.addEventListener('hashchange', async () => {
    const r = route();
    if (scan) arreterScan();
    if (r !== 'carte') arreterCarte();
    if (r === 'fil' || r === 'accueil') { S.filCharge = true; chargerFil(); }
    if (r === 'carte') { S.pointsCharge = false; S.points = null; S.suiviEtat = null; }
    if (['dossard', 'paiement', 'confirmation'].includes(r)) S.consult = null;
    if (r === 'admin' && !S.staff) { try { S.staff = await D.session(); } catch (e) { S.staff = false; } }
    rendre(true);
    if (r === 'admin' && S.staff) admCharger();
    if (['accueil', 'fonds', 'course', 'actualites', 'resultats', 'evenements', 'actions', 'evenement'].includes(r)) chargerEtat();
    if (r === 'impact') { S.impact = null; S.impactCharge = false; rendre(false); }
    if (r === 'groupes') { S.groupesCharge = true; chargerListe('groupes', D.groupes); }
    if (r === 'formations') { S.contenusCharge = true; chargerListe('contenus', D.contenus); }
    if (r === 'resultats') chercherResultats(S.resQ || '');
  });

  // Compte à rebours
  function tic() {
    document.querySelectorAll('[data-cd]').forEach((el) => {
      const reste = Math.max(0, Math.floor((new Date(el.dataset.cd) - Date.now()) / 1000));
      const p = (n) => String(n).padStart(2, '0');
      const v = { j: Math.floor(reste / 86400), h: p(Math.floor((reste % 86400) / 3600)), m: p(Math.floor((reste % 3600) / 60)), s: p(reste % 60) };
      el.querySelectorAll('[data-u]').forEach((b) => { b.textContent = v[b.dataset.u]; });
    });
  }
  setInterval(tic, 1000);

  // ---------------------------------------------------------------
  // Actions (clics)
  // ---------------------------------------------------------------
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-action]'); if (!b) return;
    const a = b.dataset.action;
    const garderForm = () => { const f = vue.querySelector('form[data-form="inscription"]'); return f ? Object.fromEntries(new FormData(f)) : null; };
    const restaurer = (vals) => { if (!vals) return; const f = vue.querySelector('form[data-form="inscription"]'); if (!f) return; for (const [k, v] of Object.entries(vals)) { const el = f.elements[k]; if (!el) continue; if (el.type === 'checkbox') el.checked = v === 'on'; else el.value = v; } };
    if (a === 'distance') { const vals = garderForm(); S.choix.distance = b.dataset.id; rendre(false); restaurer(vals); }
    else if (a === 'categorie') { const vals = garderForm(); S.choix.categorie = b.dataset.cat; rendre(false); restaurer(vals); }
    else if (a === 'don') { const vals = garderForm(); S.choix.don = Number(b.dataset.v); rendre(false); restaurer(vals); }
    else if (a === 'don-autre') { const vals = garderForm(); S.choix.don = S.choix.don && !C.dons.includes(S.choix.don) ? S.choix.don : 10000; rendre(false); restaurer(vals); }
    else if (a === 'op') { const f = vue.querySelector('form[data-form="declarer"]'); const tx = f ? f.elements.tx.value : ''; S.op = b.dataset.op; rendre(false); const g = vue.querySelector('form[data-form="declarer"]'); if (g) g.elements.tx.value = tx; }
    else if (a === 'oublier') { retirerMoi(); rendre(true); }
    else if (a === 'ajout') { S.recherche = true; rendre(true); }
    else if (a === 'annuler-recherche') { S.recherche = false; rendre(true); }
    else if (a === 'choisir-moi') { const m = S.mes.find((x) => x.reference === b.dataset.ref); if (m) { S.moi = m; S.consult = null; rendre(false); } }
    else if (a === 'res-tout') { S.resQ = ''; S.resTout = false; chercherResultats(''); }
    else if (a === 'vu') { stockage.ecrire('odc_vu', true); }
    else if (a === 'couche') { S.couches[b.dataset.k] = !S.couches[b.dataset.k]; rendre(false); }
    else if (a === 'voir-point') { const p = (S.points || []).find((x) => x.id === b.dataset.id); if (p) toast([p.nom, TYPES_POINT[p.type], p.adresse, p.horaires].filter(Boolean).join(' · ')); }
    else if (a === 'partager-position') demarrerPosition();
    else if (a === 'stop-position') arreterPosition();
    else if (a === 'fil-cat') { S.filCat = b.dataset.k; S.fil = null; rendre(false); chargerFil(); }
    else if (a === 'aimer') {
      try { const n = await D.aimer(b.dataset.id, appareil); const x = S.fil.find((o) => o.id === b.dataset.id); if (x) { x.j_aime = !x.j_aime; x.aimes = n; } rendre(false); } catch (e) { toast(e.message); }
    }
    else if (a === 'commentaires') {
      const id = b.dataset.id; S.comOuvert = S.comOuvert === id ? null : id; rendre(false);
      if (S.comOuvert) { try { S.coms[id] = await D.commentaires(id); rendre(false); } catch (e) { toast(e.message); } }
    }
    else if (a === 'partager-pub') {
      const x = (S.fil || []).find((o) => o.id === b.dataset.id) || {};
      const texte = `${x.auteur} sur Odyssée Connect : ${x.texte || 'une action pour l’environnement'} ${C.siteUrl}`;
      try { if (navigator.share) { await navigator.share({ title: 'Odyssée Connect', text: texte }); return; } } catch (e) { /* annulé */ }
      try { await navigator.clipboard.writeText(texte); toast('Texte copié : collez-le dans WhatsApp ou Facebook.'); } catch (e) { toast(texte); }
    }
    else if (a === 'signaler') {
      if (b.dataset.confirme !== '1') { b.dataset.confirme = '1'; toast('Touchez encore le drapeau pour signaler cette publication à l’équipe.'); return; }
      try { await D.signaler(b.dataset.id, appareil); toast('Merci, l’équipe va vérifier cette publication.'); } catch (e) { toast(e.message); }
    }
    else if (a === 'pub-retour') { S.pubFaite = false; S.pubApercu = null; S.pubPhoto = null; }
    else if (a === 'moderer') { try { await D.modererPublication(b.dataset.id, b.dataset.v); toast('Publication mise à jour'); S.fil = null; await admCharger(); } catch (e) { toast(e.message); } }
    else if (a === 'masquer-com') { try { await D.masquerCommentaire(b.dataset.id); toast('Commentaire masqué'); await admCharger(); } catch (e) { toast(e.message); } }
    else if (a === 'suivi') { try { await D.reglerSuivi(b.dataset.v === '1', 8); toast(b.dataset.v === '1' ? 'Suivi en direct ouvert pour 8 heures' : 'Suivi en direct fermé'); await admCharger(); } catch (e) { toast(e.message); } }
    else if (a === 'pt-nouveau') { S.adm.ptEdit = 'nouveau'; majAdm(); }
    else if (a === 'pt-modifier') { S.adm.ptEdit = b.dataset.id; majAdm(); }
    else if (a === 'pt-annuler') { S.adm.ptEdit = null; majAdm(); }
    else if (a === 'pt-supprimer') {
      if (b.dataset.confirme !== '1') { b.dataset.confirme = '1'; b.textContent = 'Confirmer la suppression'; return; }
      try { await D.supprimerPoint(b.dataset.id); toast('Supprimé'); await admCharger(); } catch (e) { toast(e.message); }
    }
    else if (a === 'ma-position') {
      const f = b.closest('form'); if (!navigator.geolocation) { toast('Localisation indisponible'); return; }
      navigator.geolocation.getCurrentPosition((p) => { f.elements.lat.value = p.coords.latitude.toFixed(6); f.elements.lng.value = p.coords.longitude.toFixed(6); },
        () => toast('Autorisez la localisation, ou copiez les coordonnées depuis openstreetmap.org.'), { enableHighAccuracy: true, timeout: 15000 });
    }
    else if (a === 'ins-debut') { S.insEtape = 1; }
    else if (a === 'ins-retour') { const vals = garderForm(); S.insEtape = 1; rendre(true); restaurer(vals); }
    else if (a === 'taille-ins') { const vals = garderForm(); S.choix.taille = b.dataset.t; rendre(false); restaurer(vals); }
    else if (a === 'res-dist') { S.resDist = b.dataset.id; S.resTout = false; rendre(false); }
    else if (a === 'res-complet') { S.resTout = true; S.resQ = ''; chercherResultats('*'); }
    else if (a === 'rapport') { S.rapport = !S.rapport; rendre(false); }
    else if (a === 'lien') { window.open(b.dataset.url, '_blank', 'noopener'); }
    else if (a === 'pdf') {
      try { window.print(); } catch (e) { toast("Le téléchargement en PDF fonctionne dans l'application installée."); }
    }
    else if (a === 'partager') {
      const x = S.consult || {}; const texte = `Je cours les ${C.evenement.nom} (${distance(x.distance || S.choix.distance).km}) avec L'Odyssée de l'environnement ! Rejoins-moi : ${C.siteUrl}`;
      try { if (navigator.share) { await navigator.share({ title: C.evenement.nom, text: texte, url: C.siteUrl }); return; } } catch (e) { /* partage annulé */ }
      try { await navigator.clipboard.writeText(texte); toast('Message copié : collez-le dans WhatsApp ou Facebook.'); } catch (e) { toast(texte); }
    }
    else if (a === 'ouvrir-ev') {
      const e = S.evs && S.evs.find((x) => x.id === b.dataset.id);
      if (e && e.inscription === 'course20km') { location.hash = 'course'; return; }
      S.evSel = b.dataset.id; S.partFaite = null; if (location.hash === '#evenement') rendre(true); else location.hash = 'evenement';
    }
    else if (a === 'segment') { S[b.dataset.cle] = b.dataset.v; rendre(false); }
    else if (a === 'ouvrir-contenu') { S.contSel = b.dataset.id; S.quiz = null; location.hash = 'contenu'; }
    else if (a === 'quiz-rep') {
      const c = S.contenus.find((x) => x.id === S.contSel); const k = Number(b.dataset.k);
      S.quiz.rep = k; if (k === c.quiz[S.quiz.i].bonne) S.quiz.score += 1; rendre(false);
    }
    else if (a === 'quiz-suivant') {
      const c = S.contenus.find((x) => x.id === S.contSel);
      if (S.quiz.i + 1 < c.quiz.length) { S.quiz.i += 1; S.quiz.rep = null; }
      else {
        S.quiz.fini = true;
        const avant = S.quizFaits[c.id];
        if (!avant || S.quiz.score >= avant.score) { S.quizFaits[c.id] = { score: S.quiz.score, total: c.quiz.length, date: new Date().toISOString() }; stockage.ecrire('odc_quiz', S.quizFaits); }
      }
      rendre(true);
    }
    else if (a === 'quiz-recommencer') { S.quiz = null; rendre(true); }
    else if (a === 'effacer-local') {
      if (b.dataset.confirme !== '1') { b.dataset.confirme = '1'; b.textContent = 'Confirmer : tout effacer de ce téléphone'; return; }
      ['odc_mes', 'odc_moi', 'odc_don', 'odc_parts', 'odc_cands', 'odc_quiz', 'odc_profil', 'odc_vu', 'odc_photo'].forEach((k) => stockage.effacer(k));
      Object.assign(S, { profil: null, mes: [], moi: null, don: null, parts: [], cands: [], quizFaits: {}, consult: null, benevoleFait: null });
      toast('Données effacées de ce téléphone'); rendre(true);
    }
    else if (a === 'ev-nouveau') { S.adm.evEdit = 'nouveau'; majAdm(); window.scrollTo(0, 0); }
    else if (a === 'ev-modifier') { S.adm.evEdit = b.dataset.id; majAdm(); window.scrollTo(0, 0); }
    else if (a === 'ev-annuler') { S.adm.evEdit = null; majAdm(); }
    else if (a === 'ev-participants') { S.adm.parEv = b.dataset.id; S.adm.onglet = 'participations'; rendre(false); }
    else if (a === 'gr-nouveau') { S.adm.grEdit = 'nouveau'; majAdm(); }
    else if (a === 'gr-modifier') { S.adm.grEdit = b.dataset.id; majAdm(); }
    else if (a === 'gr-annuler') { S.adm.grEdit = null; majAdm(); }
    else if (a === 'ct-nouveau') { S.adm.ctEdit = 'nouveau'; majAdm(); window.scrollTo(0, 0); }
    else if (a === 'ct-modifier') { S.adm.ctEdit = b.dataset.id; majAdm(); window.scrollTo(0, 0); }
    else if (a === 'ct-annuler') { S.adm.ctEdit = null; majAdm(); }
    else if (['ev-supprimer', 'gr-supprimer', 'ct-supprimer'].includes(a)) {
      if (b.dataset.confirme !== '1') { b.dataset.confirme = '1'; b.textContent = 'Confirmer la suppression'; return; }
      try {
        if (a === 'ev-supprimer') await D.supprimerEvenement(b.dataset.id);
        if (a === 'gr-supprimer') await D.supprimerGroupe(b.dataset.id);
        if (a === 'ct-supprimer') await D.supprimerContenu(b.dataset.id);
        toast('Supprimé'); await admCharger();
      } catch (e) { toast(e.message); }
    }
    else if (a === 'scan') demarrerScan();
    else if (a === 'scan-stop') arreterScan();
    else if (a === 'supprimer-annonce') { b.disabled = true; try { await D.supprimerAnnonce(b.dataset.id); toast('Actualité supprimée'); await admCharger(); } catch (e) { toast(e.message); b.disabled = false; } }
    else if (a === 'vider-resultats') {
      if (b.dataset.confirme !== '1') { b.dataset.confirme = '1'; b.textContent = 'Confirmer : tout effacer'; return; }
      try { await D.viderResultats(); toast('Résultats effacés'); await admCharger(); } catch (e) { toast(e.message); }
    }
    else if (a === 'recharger') { S.consult = null; rendre(false); }
    else if (a === 'don-montant') { S.donMontant = Number(b.dataset.v); const f = vue.querySelector('form[data-form="don"]'); const tel = f ? f.elements.telephone.value : ''; const nom = f ? f.elements.nom.value : ''; rendre(false); const g = vue.querySelector('form[data-form="don"]'); if (g) { g.elements.telephone.value = tel; g.elements.nom.value = nom; } }
    else if (a === 'nouveau-don') { S.don = null; stockage.effacer('odc_don'); rendre(true); }
    else if (a === 'qte') {
      const id = b.dataset.id; const l = S.panier[id] || { qte: 0, taille: 'M' };
      l.qte = Math.max(0, Math.min(10, l.qte + Number(b.dataset.d))); S.panier[id] = l; rendreBoutique();
    }
    else if (a === 'taille') { S.panier[b.dataset.id].taille = b.dataset.t; rendreBoutique(); }
    else if (a === 'nouvelle-commande') { S.commandeFaite = null; S.panier = {}; rendre(true); }
    else if (a === 'adm-onglet') { if (scan) arreterScan(); S.adm.onglet = b.dataset.k; rendre(false); }
    else if (a === 'adm-charger') admCharger();
    else if (a === 'adm-anonymiser') { S.adm.anonConfirm = true; majAdm(); }
    else if (a === 'adm-anonymiser-non') { S.adm.anonConfirm = false; majAdm(); }
    else if (a === 'adm-anonymiser-ok') {
      S.adm.anonConfirm = false;
      D.anonymiserInscriptions().then((n) => { toast(`Coordonnées effacées pour ${n} inscription(s).`); admCharger(); }).catch((e) => { toast(e.message); majAdm(); });
    }
    else if (a === 'deconnexion') { await D.deconnexion(); S.staff = false; S.adm.ins = []; rendre(true); }
    else if (a === 'csv') csv(b.dataset.k);
    else if (['valider', 'annuler', 'retrait', 'valider-don', 'annuler-don'].includes(a)) {
      b.disabled = true;
      try {
        if (a === 'valider') { const n = await D.validerPaiement(b.dataset.id); toast(`Paiement validé · dossard ${n}`); }
        if (a === 'annuler') { await D.annulerInscription(b.dataset.id); toast('Inscription annulée'); }
        if (a === 'retrait') { await D.retrait(b.dataset.id, b.dataset.v === '1'); toast(b.dataset.v === '1' ? 'Dossard remis' : 'Retrait annulé'); }
        if (a === 'valider-don') { await D.validerDon(b.dataset.id); toast('Don validé et ajouté au Fonds'); }
        if (a === 'annuler-don') { await D.annulerDon(b.dataset.id); toast('Don annulé'); }
        await admCharger();
      } catch (e) { toast(e.message); b.disabled = false; }
    }
  });

  function rendreBoutique() { const y = window.scrollY; const vals = {}; const f = vue.querySelector('form[data-form="commande"]'); if (f) Object.assign(vals, Object.fromEntries(new FormData(f))); rendre(false); const g = vue.querySelector('form[data-form="commande"]'); if (g) for (const [k, v] of Object.entries(vals)) if (g.elements[k]) g.elements[k].value = v; window.scrollTo(0, y); }

  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset.filtre === 'retrait') { S.adm.r = t.value; document.getElementById('adm-liste').innerHTML = admRetrait(); return; }
    if (t.dataset.filtre === 'parEv' || t.dataset.filtre === 'candType') return;
    if (t.dataset.filtre) { S.adm[t.dataset.filtre] = t.value; document.getElementById('adm-liste').innerHTML = admListe(); return; }
    if (t.name === 'nom_attestation') { S.nomAttestation = t.value.slice(0, 80); const n = document.querySelector('[data-nom-attestation]'); if (n) n.textContent = S.nomAttestation || 'Votre nom'; return; }
    if (t.name === 'don_autre') {
      S.choix.don = Math.max(0, parseInt(t.value, 10) || 0);
      const tot = vue.querySelector('[data-total]'); if (tot) tot.textContent = fcfa(distance(S.choix.distance).tarifs[S.choix.categorie] + S.choix.don);
    }
  });

  document.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (t.matches && t.matches('input[data-photo-pub]') && t.files && t.files[0]) {
      const f = vue.querySelector('form[data-form="publication"]'); const vals = f ? Object.fromEntries(new FormData(f)) : {};
      try { const r = await preparerPhoto(t.files[0]); S.pubPhoto = r; S.pubApercu = r.dataUrl; } catch (e) { toast('Image illisible'); return; }
      rendre(false);
      const g = vue.querySelector('form[data-form="publication"]');
      if (g) for (const [k, v] of Object.entries(vals)) { const el = g.elements[k]; if (el && el.type !== 'file') { if (el.type === 'checkbox') el.checked = v === 'on'; else el.value = v; } }
      return;
    }
    if (t.matches && t.matches('input[data-photo]') && t.files && t.files[0]) {
      try {
        const img = new Image(); const url = URL.createObjectURL(t.files[0]);
        await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
        const c = document.createElement('canvas'); const cote = 240; c.width = c.height = cote;
        const k = Math.min(img.width, img.height); c.getContext('2d').drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, cote, cote);
        stockage.ecrire('odc_photo', c.toDataURL('image/jpeg', 0.8)); URL.revokeObjectURL(url); rendre(false);
      } catch (e) { toast('Image illisible'); }
      return;
    }
    if (t.dataset.filtre === 'parEv' || t.dataset.filtre === 'candType') { S.adm[t.dataset.filtre] = t.value; majAdm(); return; }
    if (t.dataset.actionChange === 'statut-participation') {
      try { await D.majParticipation(t.dataset.id, t.value); toast('Présence mise à jour'); await admCharger(); } catch (e) { toast(e.message); }
    }
    if (t.dataset.actionChange === 'statut-candidature') {
      try { await D.majCandidature(t.dataset.id, t.value); toast('Suivi mis à jour'); await admCharger(); } catch (e) { toast(e.message); }
    }
    if (t.dataset.actionChange === 'statut-benevole') {
      try { await D.majBenevole(t.dataset.id, t.value); toast('Statut mis à jour'); await admCharger(); } catch (e) { toast(e.message); }
    }
    if (t.dataset.actionChange === 'statut-commande') {
      try { await D.majCommande(t.dataset.id, t.value); toast('Statut mis à jour'); await admCharger(); } catch (e) { toast(e.message); }
    }
  });

  // ---------------------------------------------------------------
  // Formulaires
  // ---------------------------------------------------------------
  document.addEventListener('submit', async (ev) => {
    const f = ev.target; const type = f.dataset.form; if (!type) return;
    ev.preventDefault();
    const err = f.querySelector('.erreur'); const btn = f.querySelector('[type=submit]');
    const v = Object.fromEntries(new FormData(f));
    const echec = (m) => { if (err) err.textContent = m; if (btn) btn.disabled = false; f.classList.remove('charge'); };
    if (err) err.textContent = '';
    const manquant = [...f.querySelectorAll('[required]')].find((el) => (el.type === 'checkbox' ? !el.checked : !String(el.value).trim()));
    if (manquant) { manquant.focus(); return echec(manquant.type === 'checkbox' ? 'Merci de cocher les cases obligatoires.' : 'Merci de remplir tous les champs obligatoires.'); }
    if (btn) btn.disabled = true; f.classList.add('charge');
    try {
      if (type === 'ins1') {
        if (!window.ODC_DATA.telValide(v.telephone) || !window.ODC_DATA.telValide(v.urgence_tel)) return echec('Vérifiez les numéros de téléphone (8 à 15 chiffres).');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email || '')) return echec("L'adresse e-mail n'est pas valide.");
        S.insData = v; S.insEtape = 2; cleEnvoi(); rendre(true); return;
      }
      if (type === 'inscription') {
        const don = v.don_autre !== undefined ? Math.max(0, parseInt(v.don_autre, 10) || 0) : S.choix.don;
        const P = S.insData || {};
        if (!P.nom) { S.insEtape = 1; rendre(true); return; }
        const r = await D.creerInscription({
          nom: P.nom, prenom: P.prenom, telephone: P.telephone, email: P.email, date_naissance: P.date_naissance, sexe: P.sexe,
          distance: S.choix.distance, categorie: S.choix.categorie, urgence_nom: P.urgence_nom, urgence_tel: P.urgence_tel, consentement: true,
          consentement_parental: v.consentement_parental === 'on', consentement_version: CONSENTEMENT_VERSION, don,
          taille_tshirt: S.choix.taille, cle_envoi: cleEnvoi()
        });
        S.cleEnvoi = null; cleSession.effacer();
        ajouterMoi({ reference: r.reference, telephone: P.telephone, prenom: P.prenom });
        S.insData = null; S.insEtape = 1;
        S.choix.don = 0;
        toast(`Inscription enregistrée · référence ${r.reference}`);
        location.hash = 'paiement';
        chargerEtat();
      } else if (type === 'declarer') {
        const tx = String(v.tx || '').trim();
        if (tx.length < 4) return echec("L'identifiant de transaction semble incomplet.");
        if (f.dataset.type === 'don') {
          await D.declarerDon(f.dataset.ref, f.dataset.tel, S.op, tx);
          S.don.etape = 'fait'; stockage.ecrire('odc_don', S.don); rendre(true);
        } else {
          await D.declarerPaiement(f.dataset.ref, f.dataset.tel, S.op, tx);
          S.consult = null; toast('Paiement déclaré, merci !'); location.hash = 'confirmation'; if (route() === 'confirmation') rendre(true);
        }
      } else if (type === 'retrouver') {
        const r = await D.consulter(v.reference, v.telephone);
        if (!r) return echec('Aucune inscription ne correspond. Vérifiez la référence et le téléphone.');
        ajouterMoi({ reference: r.reference, telephone: v.telephone, prenom: r.prenom });
        S.consult = r; stockage.ecrire('odc_vu', true);
        if (route() === 'connexion') { toast(`Bienvenue ${r.prenom} !`); location.hash = 'dossard'; } else rendre(true);
      } else if (type === 'don') {
        const m = parseInt(v.montant, 10) || 0;
        if (m < 100) return echec('Le don minimum est de 100 FCFA.');
        if (!window.ODC_DATA.telValide(v.telephone)) return echec('Vérifiez le numéro de téléphone.');
        const r = await D.creerDon({ montant: m, nom: v.nom, telephone: v.telephone });
        S.don = { reference: r.reference, telephone: v.telephone, montant: r.montant, etape: 'payer' };
        stockage.ecrire('odc_don', S.don); rendre(true);
      } else if (type === 'commande') {
        if (!window.ODC_DATA.telValide(v.telephone)) return echec('Vérifiez le numéro de téléphone.');
        const articles = Object.entries(S.panier).filter(([, l]) => l.qte > 0).map(([id, l]) => {
          const a = C.boutique.articles.find((x) => x.id === id); return { id, qte: l.qte, taille: a && a.tailles ? l.taille : null };
        });
        if (!articles.length) return echec('Votre panier est vide.');
        S.commandeFaite = await D.creerCommande({ nom: v.nom, telephone: v.telephone, inscription_ref: v.inscription_ref, articles });
        S.panier = {}; rendre(true);
      } else if (type === 'benevole') {
        const missions = new FormData(f).getAll('missions');
        if (!missions.length) return echec('Choisissez au moins une mission.');
        if (!window.ODC_DATA.telValide(v.telephone)) return echec('Vérifiez le numéro de téléphone.');
        S.benevoleFait = await D.creerBenevole({ nom: v.nom, prenom: v.prenom, telephone: v.telephone, email: v.email, ville: v.ville,
          missions, disponibilites: new FormData(f).getAll('dispo').join(' · '), taille_tshirt: v.taille_tshirt || null });
        rendre(true);
      } else if (type === 'resultats') {
        S.resTout = false; await chercherResultats(String(v.q || '').trim()); rendre(false);
      } else if (type === 'annonce') {
        await D.publierAnnonce(v.titre, v.texte); toast('Actualité publiée'); await admCharger();
      } else if (type === 'import-resultats') {
        let texteBrut = String(v.lignes || '');
        const fichier = f.elements.fichier && f.elements.fichier.files[0];
        if (fichier) texteBrut += '\n' + await fichier.text();
        const { lignes, rejets } = lireTemps(texteBrut);
        if (!lignes.length) return echec('Aucune ligne valide. Format attendu : 1;1:05:42');
        const n = await D.importerResultats(lignes);
        toast(`${n} temps importés${rejets.length ? ` · ${rejets.length} ligne(s) ignorée(s)` : ''}`);
        await admCharger();
        if (rejets.length) { const e2 = document.querySelector('form[data-form="import-resultats"] .erreur'); if (e2) e2.textContent = 'Lignes ignorées : ' + rejets.slice(0, 8).join(' | '); }
      } else if (type === 'profil') {
        if (!window.ODC_DATA.telValide(v.telephone)) return echec('Vérifiez le numéro de téléphone.');
        S.profil = { prenom: v.prenom.trim(), nom: v.nom.trim(), telephone: v.telephone.trim(), ville: (v.ville || '').trim() };
        stockage.ecrire('odc_profil', S.profil); stockage.ecrire('odc_vu', true);
        toast(`Bienvenue ${S.profil.prenom} !`); location.hash = 'accueil';
      } else if (type === 'publication') {
        if (!S.pubPhoto) return echec('Ajoutez une photo.');
        await D.creerPublication({ appareil, auteur: v.auteur, ville: v.ville, categorie: v.categorie, evenement_id: v.evenement_id || null, texte: v.texte, lieu: v.lieu }, S.pubPhoto.blob, S.pubPhoto.dataUrl);
        S.pubFaite = true; S.pubPhoto = null; S.pubApercu = null; S.fil = null; rendre(true);
      } else if (type === 'commentaire') {
        const id = f.dataset.id;
        await D.commenter(id, appareil, prenomActuel() || 'Membre', v.texte);
        S.coms[id] = await D.commentaires(id); const x = (S.fil || []).find((o) => o.id === id); if (x) x.commentaires = S.coms[id].length; rendre(false);
      } else if (type === 'point') {
        const fd = new FormData(f); const p2 = Object.fromEntries(fd); p2.publie = fd.get('publie') === 'on'; p2.id = f.dataset.id || null;
        await D.enregistrerPoint(p2); S.adm.ptEdit = null; S.points = null; toast('Enregistré'); await admCharger();
      } else if (type === 'participation') {
        if (!window.ODC_DATA.telValide(v.telephone)) return echec('Vérifiez le numéro de téléphone.');
        const e = S.evs.find((x) => x.id === S.evSel);
        const ref = await D.creerParticipation({ evenement_id: S.evSel, nom: v.nom, prenom: v.prenom, telephone: v.telephone, email: v.email, personnes: v.personnes, message: v.message });
        S.parts = [{ reference: ref, evenement_id: S.evSel, titre: e ? e.titre : '' }].concat(S.parts).slice(0, 50); stockage.ecrire('odc_parts', S.parts);
        S.partFaite = S.evSel; chargerEtat(); rendre(true);
      } else if (type === 'candidature') {
        if (!window.ODC_DATA.telValide(v.telephone)) return echec('Vérifiez le numéro de téléphone.');
        if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return echec("L'adresse e-mail n'est pas valide.");
        const ref = await D.creerCandidature({ type: f.dataset.type, nom: v.nom, prenom: v.prenom, organisation: v.organisation, telephone: v.telephone, email: v.email, ville: v.ville, titre: v.titre, message: v.message });
        S.candFaite = { type: f.dataset.type, reference: ref }; S.cands = [S.candFaite].concat(S.cands).slice(0, 20); stockage.ecrire('odc_cands', S.cands); rendre(true);
      } else if (type === 'evenement') {
        const fd = new FormData(f); const p = Object.fromEntries(fd); p.publie = fd.get('publie') === 'on'; p.id = f.dataset.id || null;
        await D.enregistrerEvenement(p); S.adm.evEdit = null; toast('Enregistré'); await admCharger(); S.evs = null; chargerEtat();
      } else if (type === 'groupe') {
        const fd = new FormData(f); const p = Object.fromEntries(fd); p.publie = fd.get('publie') === 'on'; p.id = f.dataset.id || null;
        await D.enregistrerGroupe(p); S.adm.grEdit = null; S.groupes = null; toast('Enregistré'); await admCharger();
      } else if (type === 'contenu') {
        const fd = new FormData(f); const p = Object.fromEntries(fd); p.publie = fd.get('publie') === 'on'; p.id = f.dataset.id || null;
        if (p.type === 'quiz') { try { p.quiz = lireQuiz(p.quiz); } catch (e) { return echec(e.message); } if (!p.quiz.length) return echec('Ajoutez au moins une question.'); }
        else p.quiz = null;
        await D.enregistrerContenu(p); S.adm.ctEdit = null; S.contenus = null; toast('Enregistré'); await admCharger();
      } else if (type === 'connexion') {
        await D.connexion(v.email, v.mdp); S.staff = true; rendre(true); admCharger();
      } else if (type === 'reglages') {
        const quota = parseInt(v.quota, 10);
        if (!Number.isInteger(quota) || quota < 0 || quota > 100000) return echec('Le quota doit être un nombre entre 0 et 100 000.');
        const delai = parseInt(v.delai, 10);
        if (!Number.isInteger(delai) || delai < 1 || delai > 720) return echec('Le délai pour payer doit être entre 1 et 720 heures.');
        let e = await D.reglerInscriptions(v.ouvertes === 'oui', quota, v.message);
        if (delai !== (e.delai_paiement_heures || 48)) e = await D.reglerDelaiPaiement(delai);
        if (S.etat) S.etat.inscriptions = e;
        toast(e.ouvertes ? `Inscriptions ouvertes · ${e.restantes.toLocaleString('fr-FR')} places restantes` : 'Inscriptions fermées');
        await admCharger();
      } else if (type === 'fonds') {
        await D.majFonds(Math.max(0, parseInt(v.collecte, 10) || 0), Math.max(0, parseInt(v.donateurs, 10) || 0));
        toast('Fonds mis à jour'); await admCharger();
      }
    } catch (e) {
      let m = e.message || 'Une erreur est survenue. Réessayez.';
      if (type === 'inscription' && /^Connexion impossible/.test(m)) m += " Vous pouvez renvoyer sans crainte : l'inscription ne sera pas créée deux fois.";
      return echec(m);
    }
    if (btn) btn.disabled = false; f.classList.remove('charge');
  });

  // ---------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------
  if (D.mode === 'demo') {
    const bd = document.getElementById('bandeau-demo');
    bd.hidden = false;
    bd.innerHTML = 'Version de démonstration : les données restent sur cet appareil. <button type="button" id="reset-demo">Tout effacer</button>';
    document.getElementById('reset-demo').addEventListener('click', () => { D.reinitialiser(); S.fil = null; S.points = null; S.coms = {}; S.profil = null; stockage.effacer('odc_profil'); stockage.effacer('odc_vu'); S.moi = null; S.mes = []; stockage.effacer('odc_mes'); S.annonces = []; S.evs = null; S.parts = []; S.cands = []; S.quizFaits = {}; ['odc_parts', 'odc_cands', 'odc_quiz'].forEach((k) => stockage.effacer(k)); S.don = null; S.consult = null; S.staff = false; S.adm.ins = []; stockage.effacer('odc_moi'); stockage.effacer('odc_don'); toast('Démonstration remise à zéro'); location.hash = 'accueil'; rendre(true); chargerEtat(); });
  }
  (async () => {
    if (route() === 'admin') { try { S.staff = await D.session(); } catch (e) { S.staff = false; } }
    rendre(false);
    if (route() === 'admin' && S.staff) admCharger();
    if (route() === 'resultats') chercherResultats('');
    chargerEtat();
    if (['accueil', 'fil'].includes(route())) { S.filCharge = true; chargerFil(); }
  })();

  if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window.self) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* non disponible */ }
  }
}
