/*
 * Odyssée Connect · accès aux données
 * Deux moteurs avec les mêmes fonctions :
 *  - Supabase (production) quand config.supabaseUrl est rempli ;
 *  - Démonstration (navigateur) sinon.
 */
(function () {
  const C = window.ODC_CONFIG;
  const chiffres = (t) => String(t || '').replace(/\D/g, '');
  const telValide = (t) => { const n = chiffres(t).length; return n >= 8 && n <= 15; };

  function erreur(message) { const e = new Error(message); e.utilisateur = true; return e; }

  // ------------------------------------------------------------------
  // Moteur Supabase
  // ------------------------------------------------------------------
  function moteurSupabase() {
    const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    async function rpc(nom, args) {
      const { data, error } = await sb.rpc(nom, args);
      if (error) throw erreur(nettoie(error.message));
      return data;
    }
    function nettoie(m) {
      if (!m) return 'Une erreur est survenue. Réessayez.';
      if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
      return m.replace(/^.*?ERROR:\s*/, '');
    }
    async function toutLire(table) {
      const lignes = []; const pas = 1000;
      for (let debut = 0; ; debut += pas) {
        const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: false }).range(debut, debut + pas - 1);
        if (error) throw erreur(nettoie(error.message));
        lignes.push(...data);
        if (data.length < pas) break;
      }
      return lignes;
    }
    return {
      mode: 'production',
      etatPublic: () => rpc('etat_public'),
      creerInscription: async (f) => (await rpc('creer_inscription', { p: f }))[0],
      consulter: async (ref, tel) => (await rpc('consulter_inscription', { p_reference: ref, p_telephone: tel }))[0] || null,
      declarerPaiement: (ref, tel, op, tx) => rpc('declarer_paiement', { p_reference: ref, p_telephone: tel, p_operateur: op, p_transaction: tx }),
      creerDon: async (f) => (await rpc('creer_don', { p: f }))[0],
      declarerDon: (ref, tel, op, tx) => rpc('declarer_don', { p_reference: ref, p_telephone: tel, p_operateur: op, p_transaction: tx }),
      creerCommande: (f) => rpc('creer_commande', { p: f }),
      // Équipe
      connexion: async (email, mdp) => {
        const { error } = await sb.auth.signInWithPassword({ email, password: mdp });
        if (error) throw erreur('Adresse ou mot de passe incorrect.');
        if (!(await rpc('est_staff'))) { await sb.auth.signOut(); throw erreur("Ce compte n'est pas autorisé dans l'espace organisateurs."); }
      },
      deconnexion: () => sb.auth.signOut(),
      session: async () => { const { data } = await sb.auth.getSession(); if (!data.session) return false; try { return await rpc('est_staff'); } catch (e) { return false; } },
      inscriptions: () => toutLire('inscriptions'),
      dons: () => toutLire('dons'),
      commandes: () => toutLire('commandes'),
      validerPaiement: (id) => rpc('valider_paiement', { p_id: id }),
      refuserPaiement: (id, motif) => rpc('refuser_paiement', { p_id: id, p_motif: motif }),
      anonymiserInscriptions: () => rpc('anonymiser_inscriptions', {}),
      reglerInscriptions: (ouvertes, quota, message) => rpc('regler_inscriptions', { p_ouvertes: ouvertes, p_quota: quota, p_message: message || null }),
      reglerDelaiPaiement: (heures) => rpc('regler_delai_paiement', { p_heures: heures }),
      annulerInscription: (id) => rpc('annuler_inscription', { p_id: id }),
      retrait: (id, oui) => rpc('marquer_retrait', { p_id: id, p_retire: oui }),
      validerDon: (id) => rpc('valider_don', { p_id: id }),
      annulerDon: (id) => rpc('annuler_don', { p_id: id }),
      majCommande: (id, statut) => rpc('maj_commande', { p_id: id, p_statut: statut }),
      majFonds: (collecte, donateurs) => rpc('maj_fonds', { p_collecte: collecte, p_donateurs: donateurs }),
      creerBenevole: (f) => rpc('creer_benevole', { p: f }),
      annonces: async () => (await rpc('annonces_publiques')) || [],
      resultats: async (q) => (await rpc('resultats_publics', { p_q: q || '' })) || [],
      benevoles: () => toutLire('benevoles'),
      majBenevole: (id, statut) => rpc('maj_benevole', { p_id: id, p_statut: statut }),
      publierAnnonce: (titre, texte) => rpc('publier_annonce', { p_titre: titre, p_texte: texte }),
      supprimerAnnonce: (id) => rpc('supprimer_annonce', { p_id: id }),
      importerResultats: (lignes) => rpc('importer_resultats', { p: lignes }),
      viderResultats: () => rpc('vider_resultats'),
      // Plateforme
      evenements: async () => (await rpc('evenements_publics')) || [],
      groupes: async () => (await rpc('groupes_publics')) || [],
      contenus: async () => (await rpc('contenus_publics')) || [],
      impact: () => rpc('impact_public'),
      creerParticipation: (f) => rpc('creer_participation', { p: f }),
      creerCandidature: (f) => rpc('creer_candidature', { p: f }),
      evenementsAdmin: () => toutLire('evenements'),
      participations: () => toutLire('participations'),
      candidatures: () => toutLire('candidatures'),
      groupesAdmin: () => toutLire('groupes'),
      contenusAdmin: () => toutLire('contenus'),
      enregistrerEvenement: (p) => rpc('enregistrer_evenement', { p }),
      supprimerEvenement: (id) => rpc('supprimer_evenement', { p_id: id }),
      majParticipation: (id, statut) => rpc('maj_participation', { p_id: id, p_statut: statut }),
      majCandidature: (id, statut) => rpc('maj_candidature', { p_id: id, p_statut: statut }),
      enregistrerGroupe: (p) => rpc('enregistrer_groupe', { p }),
      supprimerGroupe: (id) => rpc('supprimer_groupe', { p_id: id }),
      enregistrerContenu: (p) => rpc('enregistrer_contenu', { p }),
      supprimerContenu: (id) => rpc('supprimer_contenu', { p_id: id }),
      // Carte et fil d'actualité
      points: async () => (await rpc('points_publics')) || [],
      suiviEtat: () => rpc('suivi_etat'),
      partagerPosition: (app, prenom, dossard, lat, lng) => rpc('partager_position', { p_appareil: app, p_prenom: prenom, p_dossard: dossard || null, p_lat: lat, p_lng: lng }),
      arreterPosition: (app) => rpc('arreter_position', { p_appareil: app }),
      positions: async () => (await rpc('positions_publiques')) || [],
      urlPhoto: (chemin) => (/^publications\//.test(chemin) ? `${C.supabaseUrl}/storage/v1/object/public/photos/${chemin}` : chemin),
      creerPublication: async (f, blob) => {
        const chemin = `publications/${crypto.randomUUID()}.jpg`;
        const { error } = await sb.storage.from('photos').upload(chemin, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw erreur("La photo n'a pas pu être envoyée. Vérifiez votre connexion.");
        return rpc('creer_publication', { p: { ...f, photo: chemin } });
      },
      fil: async (cat, app) => (await rpc('fil_public', { p_categorie: cat || '', p_appareil: app })) || [],
      commentaires: async (id) => (await rpc('commentaires_publics', { p_publication: id })) || [],
      aimer: (id, app) => rpc('aimer', { p_publication: id, p_appareil: app }),
      commenter: (id, app, auteur, texte) => rpc('commenter', { p_publication: id, p_appareil: app, p_auteur: auteur, p_texte: texte }),
      signaler: (id, app) => rpc('signaler', { p_publication: id, p_appareil: app }),
      publicationsAdmin: async () => (await rpc('publications_admin')) || [],
      modererPublication: (id, statut) => rpc('moderer_publication', { p_id: id, p_statut: statut }),
      masquerCommentaire: (id) => rpc('masquer_commentaire', { p_id: id }),
      reglerSuivi: (actif, heures) => rpc('regler_suivi', { p_actif: actif, p_heures: heures }),
      pointsAdmin: () => toutLire('points_collecte'),
      enregistrerPoint: (p) => rpc('enregistrer_point', { p }),
      supprimerPoint: (id) => rpc('supprimer_point', { p_id: id })
    };
  }

  // ------------------------------------------------------------------
  // Moteur de démonstration (même règles que la base, dans le navigateur)
  // ------------------------------------------------------------------
  // Exemples affichés seulement en démonstration (marqués « Exemple »)
  function exemplesEvenements() {
    const e = (o) => Object.assign({ id: 'ex-' + Math.random().toString(16).slice(2, 10), created_at: new Date().toISOString(), resume: null, description: null,
      date_debut: null, date_fin: null, date_texte: null, lieu: null, ville: null, inscription: 'participation', lien: null, places: null, publie: true,
      dechets_kg: 0, recycles_kg: 0, arbres: 0, sensibilises: 0, bilan: null, image: null }, o);
    return [
      e({ rubrique: 'evenement', type: 'course', titre: '10 KM de Yaoundé 2027', resume: 'Course solidaire de 3, 5 et 10 km au profit du Fonds de solidarité environnementale.',
          date_debut: '2027-07-10', date_texte: 'Samedi 10 juillet 2027 (date provisoire)', ville: 'Yaoundé', inscription: 'course20km', lat: 3.8606, lng: 11.5159 }),
      e({ rubrique: 'evenement', type: 'hackathon', titre: 'Brussels Green Hackathon', resume: 'Innovation et environnement : des équipes développent des solutions pour la ville durable.',
          date_texte: 'Date à confirmer', ville: 'Bruxelles', inscription: 'aucune' }),
      e({ rubrique: 'action', type: 'collecte', titre: 'Exemple : collecte de déchets dans un quartier', resume: 'Une matinée de ramassage et de tri avec les habitants.',
          description: "Action d'exemple pour la démonstration. L'équipe crée les vraies actions dans l'espace organisateurs.", date_debut: '2027-03-13', ville: 'Yaoundé', places: 40, lat: 3.87, lng: 11.523 }),
      e({ rubrique: 'action', type: 'reboisement', titre: 'Exemple : journée de reboisement', resume: 'Planter et suivre de jeunes arbres avec une école.',
          description: "Action d'exemple pour la démonstration.", date_debut: '2027-06-05', ville: 'Yaoundé', places: 60, lat: 3.881, lng: 11.497 }),
      e({ rubrique: 'action', type: 'sensibilisation', titre: "Exemple : sensibilisation à l'école", resume: 'Atelier sur le tri des déchets dans une classe de CM2.',
          description: "Action d'exemple pour la démonstration.", date_debut: '2027-02-10', ville: 'Yaoundé', inscription: 'aucune' })
    ];
  }
  function exemplesContenus() {
    const now = new Date().toISOString();
    return [
      { id: 'exc-1', created_at: now, type: 'guide', theme: 'Déchets', titre: 'Exemple : trier ses déchets à la maison', resume: 'Trois bacs simples pour commencer.', publie: true, lien: null, quiz: null,
        corps: "Contenu d'exemple pour la démonstration.\n\n1. Un bac pour les déchets de cuisine (épluchures, restes) : ils peuvent devenir du compost.\n2. Un bac pour le plastique, le métal et le verre propres : ils peuvent être recyclés ou réutilisés.\n3. Un bac pour le reste.\n\nRincez les emballages avant de les trier, et ne brûlez jamais le plastique : la fumée est toxique." },
      { id: 'exc-2', created_at: now, type: 'quiz', theme: 'Déchets', titre: 'Exemple : quiz sur les déchets', resume: '3 questions pour tester vos réflexes.', publie: true, lien: null, corps: null,
        quiz: [
          { q: 'Combien de temps une bouteille en plastique met-elle à se dégrader dans la nature ?', choix: ['Quelques mois', 'Environ 5 ans', 'Plusieurs siècles'], bonne: 2, explication: 'Le plastique se fragmente très lentement, sur des centaines d’années.' },
          { q: 'Que faire des épluchures de légumes ?', choix: ['Les brûler', 'Les composter', 'Les jeter dans le caniveau'], bonne: 1, explication: 'Le compost les transforme en engrais naturel.' },
          { q: 'Pourquoi ne faut-il pas brûler le plastique ?', choix: ['La fumée est toxique', 'Ça ne brûle pas', 'C’est sans danger'], bonne: 0, explication: 'La combustion du plastique libère des fumées nocives pour la santé.' }
        ] }
    ];
  }

  function exemplesPoints() {
    return [
      { id: 'pt-1', created_at: new Date().toISOString(), nom: 'Exemple : point de collecte du marché', type: 'collecte', adresse: 'Quartier du marché', horaires: 'Samedi 7 h – 12 h', lat: 3.866, lng: 11.517, publie: true },
      { id: 'pt-2', created_at: new Date().toISOString(), nom: 'Exemple : bac de tri de l’école', type: 'tri', adresse: 'École primaire', horaires: 'Jours de classe', lat: 3.842, lng: 11.495, publie: true },
      { id: 'pt-3', created_at: new Date().toISOString(), nom: 'Exemple : aire de compostage', type: 'compost', adresse: 'Jardin communautaire', horaires: 'Tous les jours', lat: 3.875, lng: 11.488, publie: true }
    ];
  }
  function exemplesPublications() {
    const t = Date.now();
    return [
      { id: 'pub-1', created_at: new Date(t - 3600e3 * 5).toISOString(), appareil: 'equipe', auteur: 'Équipe Odyssée', ville: 'Yaoundé', categorie: 'evenement', texte: 'Exemple : séance photo pour l’affiche des 10 KM de Yaoundé 2027. Merci aux coureurs !', lieu: 'Monument de la Réunification', photo: 'images/hero-accueil.webp', statut: 'publie' },
      { id: 'pub-2', created_at: new Date(t - 3600e3 * 30).toISOString(), appareil: 'equipe', auteur: 'Équipe Odyssée', ville: 'Yaoundé', categorie: 'communaute', texte: 'Exemple : les maillots Odyssée sont prêts pour l’entraînement collectif.', lieu: 'Yaoundé', photo: 'images/coureurs.webp', statut: 'publie' }
    ];
  }

  function moteurDemo() {
    const CLE = 'odc_demo_v1';
    let memoire = null;
    function vide() {
      return { inscriptions: [], dons: [], commandes: [], benevoles: [], annonces: [], resultats: {}, staff: false,
               evenements: exemplesEvenements(), participations: [], candidatures: [], groupes: [], contenus: exemplesContenus(),
               points: exemplesPoints(), publications: exemplesPublications(), commentaires: [], reactions: [], signalements: [], suivi: { actif: true },
               reglages: { ouvertes: true, quota: 3000, message: null, delai_paiement_heures: 48 }, refuses: [],
               fonds: { objectif: C.fonds.objectif, collecte: 0, donateurs: 0, maj: new Date().toISOString() } };
    }
    function lire() {
      if (memoire) return memoire;
      try { memoire = JSON.parse(localStorage.getItem(CLE)) || vide(); } catch (e) { memoire = vide(); }
      const base = vide(); for (const k of Object.keys(base)) if (memoire[k] === undefined) memoire[k] = base[k];
      return memoire;
    }
    function ecrire() { try { localStorage.setItem(CLE, JSON.stringify(memoire)); } catch (e) { /* mémoire seule */ } }
    const attendre = (v) => new Promise((r) => setTimeout(() => r(v), 250));
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    function reference(prefixe, liste) {
      let r;
      do { r = prefixe + '-' + Math.random().toString(16).slice(2, 8).toUpperCase().padEnd(6, '0'); }
      while (liste.some((x) => x.reference === r));
      return r;
    }
    function texte(f, cle, maxi, obligatoire) {
      const v = String(f[cle] == null ? '' : f[cle]).trim();
      if (!v && obligatoire) throw erreur('Champ manquant : ' + cle);
      if (v.length > maxi) throw erreur('Champ trop long : ' + cle);
      return v || null;
    }
    const plages = { '10': [1, 4999], '5': [5001, 9999], '3': [10001, 19999] };
    function exigerStaff() { if (!lire().staff) throw erreur("Accès réservé à l'équipe organisatrice"); }
    // Une inscription tient une place si elle est payée ou en vérification,
    // ou si elle attend son paiement avant sa date limite (fixée à la création : 48 h par défaut).
    const delaiMs = (d) => (Number(d.reglages.delai_paiement_heures) || 48) * 3600 * 1000;
    const limite = (d, i) => i.paiement_avant || new Date(new Date(i.created_at).getTime() + delaiMs(d)).toISOString();
    const tient = (d, i) => ['paye', 'paiement_declare'].includes(i.statut)
      || (i.statut === 'en_attente' && new Date(limite(d, i)).getTime() > Date.now());
    const actives = (d) => d.inscriptions.filter((i) => tient(d, i)).length;
    function etatInscriptions(d) {
      const r = d.reglages;
      return { ouvertes: r.ouvertes, quota: r.quota, restantes: Math.max(0, r.quota - actives(d)), delai_paiement_heures: Number(r.delai_paiement_heures) || 48, message: r.message };
    }
    const norm = (t) => String(t || '').trim().toLowerCase();
    // Un identifiant de transaction ne sert qu'une fois (inscriptions et dons confondus)
    function transactionPrise(d, op, tx, ref) {
      const meme = (x) => x.operateur === op && norm(x.transaction_id) === norm(tx) && x.statut !== 'annule' && x.reference !== String(ref).trim().toUpperCase();
      return d.inscriptions.some(meme) || d.dons.some(meme) || (d.refuses || []).some((r) => r.operateur === op && r.transaction_id === norm(tx));
    }
    function trouve(liste, id) { const x = liste.find((i) => i.id === id); if (!x) throw erreur('Introuvable'); return x; }

    return {
      mode: 'demo',
      etatPublic: async () => {
        const d = lire(); const n = (k) => d.inscriptions.filter((i) => i.distance === k && tient(d, i)).length;
        return attendre({ fonds: { ...d.fonds }, inscrits: { '3': n('3'), '5': n('5'), '10': n('10') }, inscriptions: etatInscriptions(d), resultats: Object.keys(d.resultats).length });
      },
      creerInscription: async (f) => {
        const d = lire();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(f.cle_envoi || ''))) throw erreur("Version de l'appli trop ancienne. Rechargez la page.");
        const dist = C.distances.find((x) => x.id === f.distance);
        if (!dist) throw erreur('Distance invalide');
        if (!['etudiant', 'travailleur'].includes(f.categorie)) throw erreur('Catégorie invalide');
        if (!telValide(f.telephone) || !telValide(f.urgence_tel)) throw erreur('Numéro de téléphone invalide');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.email || '').trim())) throw erreur('Adresse e-mail invalide');
        if (f.consentement !== true) throw erreur('Le consentement est obligatoire');
        const ddn = new Date(f.date_naissance);
        const limite = new Date(C.evenement.depart); limite.setFullYear(limite.getFullYear() - 10);
        if (isNaN(ddn) || ddn > limite || ddn < new Date('1920-01-01')) throw erreur('Date de naissance invalide');
        const majorite = new Date(ddn); majorite.setFullYear(ddn.getFullYear() + 18);
        const mineur = majorite > new Date(C.evenement.depart);
        if (mineur && f.consentement_parental !== true) throw erreur("L'accord d'un parent ou représentant légal est obligatoire pour les moins de 18 ans");
        if (f.consentement_version !== '2026-11-25') throw erreur('Version du texte de consentement inconnue. Rechargez la page.');
        // Même envoi répété (double clic, réseau coupé) : on renvoie l'inscription déjà créée
        const deja = d.inscriptions.find((i) => i.cle_envoi === f.cle_envoi);
        if (deja) {
          if (chiffres(deja.telephone) !== chiffres(f.telephone)) throw erreur('Envoi refusé. Rechargez la page et recommencez.');
          if (norm(deja.nom) !== norm(f.nom) || norm(deja.prenom) !== norm(f.prenom) || deja.date_naissance !== f.date_naissance || deja.distance !== f.distance || deja.categorie !== f.categorie)
            throw erreur(`Une inscription a déjà été enregistrée depuis ce formulaire (référence ${deja.reference}), avec d'autres informations. Pour la corriger, contactez l'organisation avec cette référence.`);
          return attendre({ reference: deja.reference, montant: deja.montant, don: deja.don });
        }
        if (!d.reglages.ouvertes) throw erreur((d.reglages.message || '').trim() || 'Les inscriptions ne sont pas ouvertes pour le moment.');
        if (actives(d) >= d.reglages.quota) throw erreur('Complet : toutes les places de cette vague sont prises. Suivez nos annonces pour la prochaine ouverture.');
        if (d.inscriptions.some((i) => tient(d, i) && norm(i.nom) === norm(f.nom) && norm(i.prenom) === norm(f.prenom) && i.date_naissance === f.date_naissance))
          throw erreur("Cette personne est déjà inscrite (même nom, prénom et date de naissance). Retrouvez l'inscription dans « Mon dossard » avec sa référence, ou contactez l'organisation.");
        if (d.inscriptions.filter((i) => chiffres(i.telephone) === chiffres(f.telephone) && tient(d, i)).length >= 6)
          throw erreur("Trop d'inscriptions avec ce numéro. Contactez l'organisation.");
        const don = Math.max(0, Math.min(parseInt(f.don, 10) || 0, 1000000));
        const ins = {
          id: uid(), reference: reference('ODY', d.inscriptions), cle_envoi: f.cle_envoi, created_at: new Date().toISOString(),
          nom: texte(f, 'nom', 80, true), prenom: texte(f, 'prenom', 80, true), telephone: texte(f, 'telephone', 20, true),
          email: texte(f, 'email', 120, true).toLowerCase(), date_naissance: f.date_naissance, sexe: f.sexe, ville: null,
          consentement_parental: mineur && f.consentement_parental === true, consentement_version: f.consentement_version,
          consentement_at: new Date().toISOString(), anonymise_at: null,
          distance: f.distance, categorie: f.categorie, urgence_nom: texte(f, 'urgence_nom', 80, true),
          urgence_tel: texte(f, 'urgence_tel', 20, true), consentement: true,
          montant: dist.tarifs[f.categorie], don, statut: 'en_attente', operateur: null, transaction_id: null,
          paiement_declare_at: null, paye_at: null, dossard: null, retire: false, retire_at: null,
          paiement_avant: new Date(Date.now() + delaiMs(d)).toISOString(),
          taille_tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].includes(f.taille_tshirt) ? f.taille_tshirt : null
        };
        d.inscriptions.push(ins); ecrire();
        return attendre({ reference: ins.reference, montant: ins.montant, don: ins.don });
      },
      consulter: async (ref, tel) => {
        const i = lire().inscriptions.find((x) => x.reference === String(ref).trim().toUpperCase() && chiffres(x.telephone) === chiffres(tel));
        if (!i) return attendre(null);
        const { reference, prenom, nom, distance, categorie, montant, don, statut, dossard, retire, created_at, taille_tshirt } = i;
        return attendre({ reference, prenom, nom, distance, categorie, montant, don, statut, dossard, retire, created_at, taille_tshirt: taille_tshirt || null,
                          paiement_avant: i.statut === 'en_attente' ? limite(lire(), i) : (i.paiement_avant || null), motif_refus: i.motif_refus || null });
      },
      declarerPaiement: async (ref, tel, op, tx) => {
        if (!['mtn', 'orange'].includes(op)) throw erreur('Opérateur invalide');
        tx = String(tx || '').trim();
        if (tx.length < 4 || tx.length > 60) throw erreur('Identifiant de transaction invalide');
        if (transactionPrise(lire(), op, tx, ref)) throw erreur("Cet identifiant de transaction est déjà déclaré pour un autre paiement. Vérifiez-le ou contactez l'organisation.");
        const d = lire();
        const i = d.inscriptions.find((x) => x.reference === String(ref).trim().toUpperCase() && chiffres(x.telephone) === chiffres(tel) && ['en_attente', 'paiement_declare'].includes(x.statut));
        if (!i) throw erreur('Inscription introuvable ou déjà traitée');
        if (!tient(d, i) && d.inscriptions.some((x) => x !== i && tient(d, x) && norm(x.nom) === norm(i.nom) && norm(x.prenom) === norm(i.prenom) && x.date_naissance === i.date_naissance))
          throw erreur('Le délai de paiement de cette inscription est dépassé et vous avez une inscription plus récente : payez avec sa référence (« Mon dossard »).');
        if (!tient(d, i) && actives(d) >= d.reglages.quota)
          throw erreur("Le délai de paiement de cette inscription est dépassé et toutes les places sont prises. Si vous avez déjà payé, contactez l'organisation avec votre référence.");
        Object.assign(i, { statut: 'paiement_declare', operateur: op, transaction_id: tx, paiement_declare_at: new Date().toISOString(), motif_refus: null });
        ecrire(); return attendre(i.statut);
      },
      creerDon: async (f) => {
        const d = lire(); const m = parseInt(f.montant, 10) || 0;
        if (m < 100 || m > 10000000) throw erreur('Montant invalide');
        if (!telValide(f.telephone)) throw erreur('Numéro de téléphone invalide');
        const don = { id: uid(), reference: reference('DON', d.dons), created_at: new Date().toISOString(), nom: texte(f, 'nom', 80, false),
                      telephone: texte(f, 'telephone', 20, true), montant: m, statut: 'en_attente', operateur: null, transaction_id: null };
        d.dons.push(don); ecrire();
        return attendre({ reference: don.reference, montant: m });
      },
      declarerDon: async (ref, tel, op, tx) => {
        if (!['mtn', 'orange'].includes(op)) throw erreur('Opérateur invalide');
        tx = String(tx || '').trim();
        if (tx.length < 4 || tx.length > 60) throw erreur('Identifiant de transaction invalide');
        if (transactionPrise(lire(), op, tx, ref)) throw erreur("Cet identifiant de transaction est déjà déclaré pour un autre paiement. Vérifiez-le ou contactez l'organisation.");
        const x = lire().dons.find((o) => o.reference === String(ref).trim().toUpperCase() && chiffres(o.telephone) === chiffres(tel) && ['en_attente', 'paiement_declare'].includes(o.statut));
        if (!x) throw erreur('Don introuvable ou déjà traité');
        Object.assign(x, { statut: 'paiement_declare', operateur: op, transaction_id: tx, paiement_declare_at: new Date().toISOString() });
        ecrire(); return attendre(x.statut);
      },
      creerCommande: async (f) => {
        const d = lire();
        if (!Array.isArray(f.articles) || !f.articles.length || f.articles.length > 12) throw erreur('Panier invalide');
        if (!telValide(f.telephone)) throw erreur('Numéro de téléphone invalide');
        const c = { id: uid(), reference: reference('CMD', d.commandes), created_at: new Date().toISOString(), nom: texte(f, 'nom', 80, true),
                    telephone: texte(f, 'telephone', 20, true), inscription_ref: (texte(f, 'inscription_ref', 20, false) || '').toUpperCase() || null,
                    articles: f.articles, statut: 'nouvelle' };
        d.commandes.push(c); ecrire();
        return attendre(c.reference);
      },
      connexion: async (email, mdp) => {
        if (mdp !== 'odyssee2027') throw erreur('Adresse ou mot de passe incorrect.');
        lire().staff = true; ecrire(); return attendre(true);
      },
      deconnexion: async () => { lire().staff = false; ecrire(); },
      session: async () => attendre(!!lire().staff),
      inscriptions: async () => { exigerStaff(); return attendre(lire().inscriptions.slice().reverse()); },
      dons: async () => { exigerStaff(); return attendre(lire().dons.slice().reverse()); },
      commandes: async () => { exigerStaff(); return attendre(lire().commandes.slice().reverse()); },
      reglerInscriptions: async (ouvertes, quota, message) => {
        exigerStaff();
        const q = Number(quota);
        if (typeof ouvertes !== 'boolean') throw erreur('Choisissez ouvertes ou fermées');
        if (!Number.isInteger(q) || q < 0 || q > 100000) throw erreur('Quota invalide (0 à 100 000)');
        if (String(message || '').length > 300) throw erreur('Message trop long (300 caractères au plus)');
        const d = lire(); d.reglages = { ...d.reglages, ouvertes, quota: q, message: String(message || '').trim() || null }; ecrire();
        return attendre(etatInscriptions(d));
      },
      reglerDelaiPaiement: async (heures) => {
        exigerStaff();
        const h = Number(heures);
        if (!Number.isInteger(h) || h < 1 || h > 720) throw erreur('Délai invalide (1 à 720 heures)');
        const d = lire(); d.reglages = { ...d.reglages, delai_paiement_heures: h }; ecrire();
        return attendre(etatInscriptions(d));
      },
      anonymiserInscriptions: async () => {
        exigerStaff();
        if (new Date() <= new Date(C.evenement.depart)) throw erreur("L'effacement n'est possible qu'après la course");
        const d = lire(); let n = 0;
        for (const i of d.inscriptions) {
          if (i.anonymise_at) continue;
          Object.assign(i, { nom: String(i.nom || '').slice(0, 1) + '.', telephone: 'efface-' + String(i.id).slice(0, 8), email: null,
            date_naissance: String(i.date_naissance || '').slice(0, 4) + '-01-01', ville: null, urgence_nom: '', urgence_tel: '', transaction_id: null,
            anonymise_at: new Date().toISOString() });
          n++;
        }
        ecrire(); return attendre(n);
      },
      validerPaiement: async (id) => {
        exigerStaff(); const d = lire(); const i = trouve(d.inscriptions, id);
        if (i.statut === 'paye') return i.dossard;
        if (i.statut === 'annule') throw erreur('Inscription annulée');
        const [debut, fin] = plages[i.distance];
        const pris = d.inscriptions.filter((x) => x.distance === i.distance && x.dossard).map((x) => x.dossard);
        const num = pris.length ? Math.max(...pris) + 1 : debut;
        if (num > fin) throw erreur('Plus de dossards disponibles pour cette distance');
        Object.assign(i, { statut: 'paye', paye_at: new Date().toISOString(), dossard: num });
        if (i.don > 0) { d.fonds.collecte += i.don; d.fonds.donateurs += 1; d.fonds.maj = new Date().toISOString(); }
        ecrire(); return attendre(num);
      },
      refuserPaiement: async (id, motif) => {
        exigerStaff(); const d = lire(); const i = trouve(d.inscriptions, id);
        const m = String(motif || '').trim();
        if (m.length < 3 || m.length > 200) throw erreur('Indiquez un motif (3 à 200 caractères)');
        if (i.statut !== 'paiement_declare') throw erreur(`Seul un paiement déclaré peut être refusé (statut actuel : ${i.statut})`);
        d.refuses = d.refuses || [];
        if (!d.refuses.some((r) => r.operateur === i.operateur && r.transaction_id === norm(i.transaction_id)))
          d.refuses.push({ operateur: i.operateur, transaction_id: norm(i.transaction_id), reference: i.reference, motif: m, refuse_at: new Date().toISOString() });
        Object.assign(i, { statut: 'en_attente', operateur: null, transaction_id: null, paiement_declare_at: null, motif_refus: m,
          refus_at: new Date().toISOString(), refus_nombre: (i.refus_nombre || 0) + 1, paiement_avant: new Date(Date.now() + delaiMs(d)).toISOString() });
        ecrire(); return attendre();
      },
      annulerInscription: async (id) => {
        exigerStaff(); const i = trouve(lire().inscriptions, id);
        if (i.statut === 'paye') throw erreur('Impossible : inscription déjà payée');
        i.statut = 'annule'; ecrire(); return attendre();
      },
      retrait: async (id, oui) => {
        exigerStaff(); const i = trouve(lire().inscriptions, id);
        if (i.statut !== 'paye') throw erreur("Le dossard n'est remis qu'après paiement validé");
        i.retire = !!oui; i.retire_at = oui ? new Date().toISOString() : null; ecrire(); return attendre();
      },
      validerDon: async (id) => {
        exigerStaff(); const d = lire(); const x = trouve(d.dons, id);
        if (x.statut === 'valide') return;
        if (x.statut === 'annule') throw erreur('Don annulé');
        x.statut = 'valide'; x.valide_at = new Date().toISOString();
        d.fonds.collecte += x.montant; d.fonds.donateurs += 1; d.fonds.maj = new Date().toISOString();
        ecrire(); return attendre();
      },
      annulerDon: async (id) => {
        exigerStaff(); const x = trouve(lire().dons, id);
        if (x.statut === 'valide') throw erreur('Impossible : don déjà validé');
        x.statut = 'annule'; ecrire(); return attendre();
      },
      majCommande: async (id, statut) => { exigerStaff(); trouve(lire().commandes, id).statut = statut; ecrire(); return attendre(); },
      majFonds: async (collecte, donateurs) => {
        exigerStaff(); if (collecte < 0 || donateurs < 0) throw erreur('Valeurs invalides');
        Object.assign(lire().fonds, { collecte, donateurs, maj: new Date().toISOString() }); ecrire(); return attendre();
      },
      creerBenevole: async (f) => {
        const d = lire();
        const ok = ['ravitaillement', 'retrait', 'securite', 'dechets', 'village', 'animation'];
        const missions = [...new Set((f.missions || []).filter((m) => ok.includes(m)))];
        if (!missions.length) throw erreur('Choisissez au moins une mission');
        if (!telValide(f.telephone)) throw erreur('Numéro de téléphone invalide');
        if (d.benevoles.filter((b) => chiffres(b.telephone) === chiffres(f.telephone)).length >= 3) throw erreur('Ce numéro est déjà inscrit comme bénévole');
        const b = { id: uid(), reference: reference('BEN', d.benevoles), created_at: new Date().toISOString(), nom: texte(f, 'nom', 80, true), prenom: texte(f, 'prenom', 80, true),
                    telephone: texte(f, 'telephone', 20, true), email: texte(f, 'email', 120, false), ville: texte(f, 'ville', 80, false), missions,
                    disponibilites: texte(f, 'disponibilites', 300, false), taille_tshirt: f.taille_tshirt || null, statut: 'nouveau' };
        d.benevoles.push(b); ecrire(); return attendre(b.reference);
      },
      annonces: async () => attendre(lire().annonces.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20)),
      resultats: async (q) => {
        const d = lire(); q = String(q || '').trim();
        const lignes = d.inscriptions.filter((i) => i.statut === 'paye' && d.resultats[i.dossard]).map((i) => ({ ...i, secondes: d.resultats[i.dossard] }));
        const rang = (l, filtre) => 1 + lignes.filter((x) => filtre(x) && x.secondes < l.secondes).length;
        const hms = (t) => [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map((n) => String(n).padStart(2, '0')).join(':');
        const res = lignes.map((l) => ({
          dossard: l.dossard, prenom: l.prenom, nom_initiale: l.nom.charAt(0).toUpperCase() + '.', distance: l.distance, sexe: l.sexe, temps: hms(l.secondes),
          rang: rang(l, (x) => x.distance === l.distance), rang_sexe: rang(l, (x) => x.distance === l.distance && x.sexe === l.sexe),
          classes: lignes.filter((x) => x.distance === l.distance).length, _nom: l.nom
        })).filter((r) => q === '*' || (!q && r.rang <= 10) || (q && (String(r.dossard) === q || (q.length >= 2 && (r.prenom + ' ' + r._nom).toLowerCase().includes(q.toLowerCase())))));
        res.sort((a, b) => Number(b.distance) - Number(a.distance) || a.rang - b.rang);
        return attendre(res.slice(0, q === '*' ? 5000 : 60).map(({ _nom, ...r }) => r));
      },
      benevoles: async () => { exigerStaff(); return attendre(lire().benevoles.slice().reverse()); },
      majBenevole: async (id, statut) => { exigerStaff(); trouve(lire().benevoles, id).statut = statut; ecrire(); return attendre(); },
      publierAnnonce: async (titre, texteA) => {
        exigerStaff(); titre = String(titre || '').trim(); texteA = String(texteA || '').trim();
        if (!titre || !texteA || titre.length > 120 || texteA.length > 2000) throw erreur('Titre (120 caractères) et texte (2000) obligatoires');
        lire().annonces.push({ id: uid(), created_at: new Date().toISOString(), titre, texte: texteA }); ecrire(); return attendre();
      },
      supprimerAnnonce: async (id) => { exigerStaff(); const d = lire(); d.annonces = d.annonces.filter((a) => a.id !== id); ecrire(); return attendre(); },
      importerResultats: async (lignes) => {
        exigerStaff(); const d = lire(); let n = 0;
        for (const l of lignes) { if (l.secondes >= 60 && l.secondes <= 36000 && l.dossard > 0) { d.resultats[l.dossard] = l.secondes; n++; } }
        ecrire(); return attendre(n);
      },
      viderResultats: async () => { exigerStaff(); lire().resultats = {}; ecrire(); return attendre(); },
      // Plateforme
      evenements: async () => {
        const d = lire();
        const inscrits = (id) => d.participations.filter((p) => p.evenement_id === id && p.statut !== 'annule').reduce((a, p) => a + p.personnes, 0);
        return attendre(d.evenements.filter((e) => e.publie).map((e) => ({ ...e, inscrits: e.inscription === 'course20km' ? d.inscriptions.filter((i) => i.statut !== 'annule').length : inscrits(e.id) }))
          .sort((a, b) => (a.date_debut || '9999').localeCompare(b.date_debut || '9999')));
      },
      groupes: async () => attendre(lire().groupes.filter((g) => g.publie)),
      contenus: async () => attendre(lire().contenus.filter((c) => c.publie)),
      impact: async () => {
        const d = lire(); const pub = d.evenements.filter((e) => e.publie);
        const avecBilan = pub.filter((e) => e.bilan || e.dechets_kg > 0 || e.recycles_kg > 0 || e.arbres > 0 || e.sensibilises > 0);
        const somme = (k) => pub.reduce((a, e) => a + (Number(e[k]) || 0), 0);
        return attendre({ dechets_kg: somme('dechets_kg'), recycles_kg: somme('recycles_kg'), arbres: somme('arbres'), sensibilises: somme('sensibilises'),
          actions: avecBilan.filter((e) => e.rubrique === 'action').length,
          participants: d.participations.filter((p) => p.statut === 'present').reduce((a, p) => a + p.personnes, 0),
          benevoles: d.benevoles.filter((b) => b.statut === 'retenu').length,
          ambassadeurs: d.candidatures.filter((c) => c.type === 'ambassadeur' && c.statut === 'accepte').length,
          fonds: d.fonds.collecte,
          bilans: avecBilan.map((e) => ({ titre: e.titre, date: e.date_texte || e.date_debut, ville: e.ville, dechets_kg: e.dechets_kg, recycles_kg: e.recycles_kg || 0, arbres: e.arbres, sensibilises: e.sensibilises, bilan: e.bilan })) });
      },
      creerParticipation: async (f) => {
        const d = lire(); const ev = d.evenements.find((e) => e.id === f.evenement_id && e.publie);
        if (!ev) throw erreur('Événement introuvable');
        if (ev.inscription !== 'participation') throw erreur("L'inscription à cet événement se fait ailleurs");
        const fin = ev.date_fin || ev.date_debut; if (fin && fin < new Date().toISOString().slice(0, 10)) throw erreur('Cet événement est terminé');
        if (!telValide(f.telephone)) throw erreur('Numéro de téléphone invalide');
        const n = Math.max(1, Math.min(parseInt(f.personnes, 10) || 1, 20));
        const actifs = d.participations.filter((p) => p.evenement_id === ev.id && p.statut !== 'annule');
        if (actifs.some((p) => chiffres(p.telephone) === chiffres(f.telephone) && p.prenom.toLowerCase() === String(f.prenom || '').trim().toLowerCase())) throw erreur('Vous êtes déjà inscrit à cet événement');
        if (ev.places && actifs.reduce((a, p) => a + p.personnes, 0) + n > ev.places) throw erreur('Il ne reste plus assez de places');
        const p = { id: uid(), reference: reference('PAR', d.participations), created_at: new Date().toISOString(), evenement_id: ev.id,
          nom: texte(f, 'nom', 80, true), prenom: texte(f, 'prenom', 80, true), telephone: texte(f, 'telephone', 20, true), email: texte(f, 'email', 120, false),
          personnes: n, message: texte(f, 'message', 500, false), statut: 'inscrit' };
        d.participations.push(p); ecrire(); return attendre(p.reference);
      },
      creerCandidature: async (f) => {
        const d = lire(); if (!['ambassadeur', 'projet', 'partenaire'].includes(f.type)) throw erreur('Type invalide');
        if (!telValide(f.telephone)) throw erreur('Numéro de téléphone invalide');
        const pre = { ambassadeur: 'AMB', projet: 'PRJ', partenaire: 'PTN' }[f.type];
        const c = { id: uid(), reference: reference(pre, d.candidatures), created_at: new Date().toISOString(), type: f.type, nom: texte(f, 'nom', 80, true),
          prenom: texte(f, 'prenom', 80, false), organisation: texte(f, 'organisation', 120, false), telephone: texte(f, 'telephone', 20, true),
          email: texte(f, 'email', 120, false), ville: texte(f, 'ville', 80, false), titre: texte(f, 'titre', 140, false), message: texte(f, 'message', 3000, true), statut: 'nouveau' };
        d.candidatures.push(c); ecrire(); return attendre(c.reference);
      },
      evenementsAdmin: async () => { exigerStaff(); return attendre(lire().evenements.slice().reverse()); },
      participations: async () => { exigerStaff(); return attendre(lire().participations.slice().reverse()); },
      candidatures: async () => { exigerStaff(); return attendre(lire().candidatures.slice().reverse()); },
      groupesAdmin: async () => { exigerStaff(); return attendre(lire().groupes.slice()); },
      contenusAdmin: async () => { exigerStaff(); return attendre(lire().contenus.slice().reverse()); },
      enregistrerEvenement: async (p) => {
        exigerStaff(); const d = lire();
        if (!p.titre || !String(p.titre).trim()) throw erreur('Titre obligatoire');
        if (p.lien && !/^https:\/\//.test(p.lien)) throw erreur('Le lien doit commencer par https://');
        let e = p.id && d.evenements.find((x) => x.id === p.id);
        if (!e) { e = { id: uid(), created_at: new Date().toISOString() }; d.evenements.push(e); }
        const num = (v) => (v === '' || v == null ? 0 : Math.max(0, Number(v) || 0));
        Object.assign(e, { rubrique: p.rubrique, type: p.type, titre: String(p.titre).trim(), resume: p.resume || null, description: p.description || null,
          date_debut: p.date_debut || null, date_fin: p.date_fin || null, date_texte: p.date_texte || null, lieu: p.lieu || null, ville: p.ville || null,
          inscription: p.inscription || 'participation', lien: p.lien || null, places: p.places ? parseInt(p.places, 10) : null, publie: !!p.publie,
          dechets_kg: num(p.dechets_kg), recycles_kg: num(p.recycles_kg), arbres: Math.round(num(p.arbres)), sensibilises: Math.round(num(p.sensibilises)), bilan: p.bilan || null,
          image: p.image && /^https:\/\//.test(p.image) ? p.image : null,
          lat: p.lat === '' || p.lat == null ? null : Number(p.lat), lng: p.lng === '' || p.lng == null ? null : Number(p.lng) });
        ecrire(); return attendre(e.id);
      },
      supprimerEvenement: async (id) => { exigerStaff(); const d = lire(); d.evenements = d.evenements.filter((e) => e.id !== id); d.participations = d.participations.filter((p) => p.evenement_id !== id); ecrire(); return attendre(); },
      majParticipation: async (id, statut) => { exigerStaff(); trouve(lire().participations, id).statut = statut; ecrire(); return attendre(); },
      majCandidature: async (id, statut) => { exigerStaff(); trouve(lire().candidatures, id).statut = statut; ecrire(); return attendre(); },
      enregistrerGroupe: async (p) => {
        exigerStaff(); const d = lire();
        if (!p.nom || !p.ville) throw erreur('Nom et ville obligatoires');
        if (p.lien && !/^https:\/\//.test(p.lien)) throw erreur('Le lien doit commencer par https://');
        let g = p.id && d.groupes.find((x) => x.id === p.id);
        if (!g) { g = { id: uid(), created_at: new Date().toISOString() }; d.groupes.push(g); }
        Object.assign(g, { nom: p.nom.trim(), ville: p.ville.trim(), description: p.description || null, lien: p.lien || null, publie: p.publie !== false });
        ecrire(); return attendre(g.id);
      },
      supprimerGroupe: async (id) => { exigerStaff(); const d = lire(); d.groupes = d.groupes.filter((g) => g.id !== id); ecrire(); return attendre(); },
      enregistrerContenu: async (p) => {
        exigerStaff(); const d = lire();
        if (!p.titre || !String(p.titre).trim()) throw erreur('Titre obligatoire');
        if (p.lien && !/^https:\/\//.test(p.lien)) throw erreur('Le lien doit commencer par https://');
        if (p.type === 'quiz') {
          if (!Array.isArray(p.quiz) || !p.quiz.length || p.quiz.length > 30) throw erreur('Quiz : 1 à 30 questions');
          if (p.quiz.some((q) => !Array.isArray(q.choix) || q.choix.length < 2 || q.choix.length > 6 || !(q.bonne >= 0 && q.bonne < q.choix.length))) throw erreur('Quiz : chaque question a 2 à 6 réponses et une bonne réponse');
        }
        let c = p.id && d.contenus.find((x) => x.id === p.id);
        if (!c) { c = { id: uid(), created_at: new Date().toISOString() }; d.contenus.push(c); }
        Object.assign(c, { type: p.type, theme: p.theme || null, titre: String(p.titre).trim(), resume: p.resume || null, corps: p.corps || null, lien: p.lien || null,
          quiz: p.type === 'quiz' ? p.quiz : null, publie: !!p.publie });
        ecrire(); return attendre(c.id);
      },
      supprimerContenu: async (id) => { exigerStaff(); const d = lire(); d.contenus = d.contenus.filter((c) => c.id !== id); ecrire(); return attendre(); },
      // Carte (démonstration : positions simulées par l'écran)
      points: async () => attendre(lire().points.filter((p) => p.publie)),
      suiviEtat: async () => attendre({ actif: !!lire().suivi.actif, simulation: true }),
      partagerPosition: async () => attendre(),
      arreterPosition: async () => attendre(),
      positions: async () => attendre([]),
      urlPhoto: (chemin) => chemin,
      // Fil d'actualité
      creerPublication: async (f, blob, dataUrl) => {
        const d = lire();
        if ((d.publications.filter((x) => x.appareil === f.appareil && Date.now() - new Date(x.created_at) < 86400e3)).length >= 10) throw erreur('Limite de 10 publications par jour atteinte');
        const x = { id: uid(), created_at: new Date().toISOString(), appareil: f.appareil, auteur: texte(f, 'auteur', 80, true), ville: texte(f, 'ville', 80, false),
          categorie: f.categorie || 'communaute', evenement_id: f.evenement_id || null, texte: texte(f, 'texte', 1000, false), lieu: texte(f, 'lieu', 120, false), photo: dataUrl, statut: 'en_attente' };
        d.publications.push(x);
        try { localStorage.setItem(CLE, JSON.stringify(d)); } catch (e) { d.publications.pop(); throw erreur('Mémoire du navigateur pleine : supprimez des publications de démonstration ou touchez « Tout effacer ».'); }
        return attendre(x.id);
      },
      fil: async (cat, app) => {
        const d = lire();
        return attendre(d.publications.filter((x) => (x.statut === 'publie' || (x.statut === 'en_attente' && x.appareil === app)) && (!cat || x.categorie === cat))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((x) => ({ ...x, aimes: d.reactions.filter((r) => r.pub === x.id).length, commentaires: d.commentaires.filter((c) => c.pub === x.id && c.statut === 'publie').length,
            j_aime: d.reactions.some((r) => r.pub === x.id && r.app === app), a_moi: x.appareil === app })));
      },
      commentaires: async (id) => attendre(lire().commentaires.filter((c) => c.pub === id && c.statut === 'publie').map((c) => ({ id: c.id, created_at: c.created_at, auteur: c.auteur, texte: c.texte }))),
      aimer: async (id, app) => {
        const d = lire(); const x = d.publications.find((p) => p.id === id && p.statut === 'publie'); if (!x) throw erreur('Publication introuvable');
        const i = d.reactions.findIndex((r) => r.pub === id && r.app === app);
        if (i >= 0) d.reactions.splice(i, 1); else d.reactions.push({ pub: id, app });
        ecrire(); return attendre(d.reactions.filter((r) => r.pub === id).length);
      },
      commenter: async (id, app, auteur, txt) => {
        const d = lire(); if (!d.publications.some((p) => p.id === id && p.statut === 'publie')) throw erreur('Publication introuvable');
        txt = String(txt || '').trim(); if (!txt || txt.length > 500) throw erreur('Commentaire vide ou trop long');
        d.commentaires.push({ id: uid(), pub: id, app, auteur: String(auteur || 'Membre').slice(0, 80), texte: txt, created_at: new Date().toISOString(), statut: 'publie' });
        ecrire(); return attendre();
      },
      signaler: async (id, app) => {
        const d = lire(); if (!d.signalements.some((s2) => s2.pub === id && s2.app === app)) d.signalements.push({ pub: id, app });
        if (d.signalements.filter((s2) => s2.pub === id).length >= 3) { const x = d.publications.find((p) => p.id === id); if (x && x.statut === 'publie') x.statut = 'masque'; }
        ecrire(); return attendre();
      },
      publicationsAdmin: async () => {
        exigerStaff(); const d = lire();
        return attendre(d.publications.map((x) => ({ ...x, signalements: d.signalements.filter((s2) => s2.pub === x.id).length,
          commentaires: d.commentaires.filter((c) => c.pub === x.id).map((c) => ({ id: c.id, auteur: c.auteur, texte: c.texte, statut: c.statut })) }))
          .sort((a, b) => (b.statut === 'en_attente') - (a.statut === 'en_attente') || b.created_at.localeCompare(a.created_at)));
      },
      modererPublication: async (id, statut) => { exigerStaff(); trouve(lire().publications, id).statut = statut; ecrire(); return attendre(); },
      masquerCommentaire: async (id) => { exigerStaff(); trouve(lire().commentaires, id).statut = 'masque'; ecrire(); return attendre(); },
      reglerSuivi: async (actif) => { exigerStaff(); lire().suivi = { actif: !!actif }; ecrire(); return attendre(); },
      pointsAdmin: async () => { exigerStaff(); return attendre(lire().points.slice()); },
      enregistrerPoint: async (p) => {
        exigerStaff(); const d = lire(); const lat = Number(p.lat); const lng = Number(p.lng);
        if (!p.nom || !(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180) || p.lat === '' || p.lng === '') throw erreur('Nom, latitude et longitude obligatoires');
        let x = p.id && d.points.find((o) => o.id === p.id);
        if (!x) { x = { id: uid(), created_at: new Date().toISOString() }; d.points.push(x); }
        Object.assign(x, { nom: p.nom.trim(), type: p.type || 'collecte', adresse: p.adresse || null, horaires: p.horaires || null, lat, lng, publie: p.publie !== false });
        ecrire(); return attendre(x.id);
      },
      supprimerPoint: async (id) => { exigerStaff(); const d = lire(); d.points = d.points.filter((o) => o.id !== id); ecrire(); return attendre(); },
      reinitialiser: () => { memoire = vide(); ecrire(); }
    };
  }

  window.ODC_DATA = {
    creer() {
      if (C.supabaseUrl && C.supabaseAnonKey && window.supabase) return moteurSupabase();
      return moteurDemo();
    },
    telValide, chiffres
  };
})();
