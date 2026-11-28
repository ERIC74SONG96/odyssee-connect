// Edge Function Odyris : création d'un accès collaborateur par un administrateur.
//
// Pourquoi une fonction serveur : créer un compte de connexion exige la clé de
// service Supabase, qui ne doit JAMAIS être exposée dans une page web. Ici elle
// reste côté serveur (injectée par Supabase), et l'appel est strictement réservé
// à un administrateur Odyris disposant d'une MFA récente.
//
// Entrée (POST, JSON) : { email, nom, role: 'agent'|'admin', password }
// En-tête : Authorization: Bearer <jeton de l'admin appelant>
// Sortie (toujours HTTP 200) : { ok: true, user_id, role } ou { ok:false, error, code? }
//
// L'inscription publique reste désactivée : seul cet appel (admin + MFA) crée
// des comptes. Le compte est créé déjà confirmé. Action journalisée.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Décode la charge utile d'un JWT (sans vérifier la signature — on s'en sert
// seulement pour lire des claims non sensibles après avoir validé l'identité
// via Supabase).
function jwtPayload(jwt: string): any {
  try {
    const p = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(p + '='.repeat((4 - (p.length % 4)) % 4)));
  } catch { return {}; }
}

// La MFA a-t-elle été présentée récemment ? (claim amr horodaté)
// On rejette les horodatages invalides (NaN) et ceux situés dans le futur
// au-delà d'une petite tolérance d'horloge : un ts futur ne doit jamais passer.
function mfaRecente(payload: any, maxMinutes = 15): boolean {
  const amr = Array.isArray(payload?.amr) ? payload.amr : [];
  const now = Math.floor(Date.now() / 1000);
  const fenetre = maxMinutes * 60;
  const tolFutur = 60; // secondes de décalage d'horloge tolérées
  return amr.some((e: any) => {
    if (!['totp', 'mfa', 'webauthn', 'phone'].includes(e?.method)) return false;
    const ts = Number(e?.timestamp);
    if (!Number.isFinite(ts)) return false;
    const delta = now - ts;
    return delta >= -tolFutur && delta < fenetre;
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Méthode non autorisée' });

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ ok: false, error: 'Non authentifié' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1) L'appelant est-il un administrateur avec MFA active et récente ?
  const asCaller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: moi, error: moiErr } = await asCaller.rpc('odyris_moi');
  if (moiErr || !moi) return json({ ok: false, error: 'Accès refusé' });
  if (moi.admin !== true) return json({ ok: false, error: 'Réservé aux administrateurs' });
  if (moi.aal !== 'aal2') return json({ ok: false, code: 'mfa', error: 'MFA requise' });
  const payload = jwtPayload(jwt);
  if (!mfaRecente(payload)) return json({ ok: false, code: 'mfa', error: 'Reconfirmez votre MFA (authentification trop ancienne)' });

  // 2) Valider les entrées.
  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Requête invalide' }); }
  const email = String(body?.email ?? '').trim().toLowerCase();
  const nom = body?.nom ? String(body.nom).trim() : null;
  const role = String(body?.role ?? 'agent').toLowerCase();
  const password = String(body?.password ?? '');
  if (role !== 'agent' && role !== 'admin') return json({ ok: false, error: 'Rôle invalide' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: 'E-mail invalide' });
  if (password.length < 8) return json({ ok: false, error: 'Mot de passe trop court (8 caractères minimum)' });

  // 3) Créer le compte (clé de service), déjà confirmé.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr) {
    // Détail gardé côté serveur ; message générique renvoyé au navigateur.
    console.error('odyris-creer-acces: createUser', cErr.message);
    return json({ ok: false, error: 'Un compte existe peut-être déjà pour cet e-mail. Ajoutez-le sans mot de passe.' });
  }
  const userId = created?.user?.id;
  if (!userId) return json({ ok: false, error: 'Utilisateur introuvable après création' });

  // 4) L'ajouter au personnel (contourne la RLS via la clé de service) + journaliser.
  const { error: sErr } = await admin.from('staff').upsert({ user_id: userId, nom, role }, { onConflict: 'user_id' });
  if (sErr) {
    console.error('odyris-creer-acces: staff upsert', sErr.message);
    return json({ ok: false, error: 'Compte créé mais ajout au personnel échoué. Réessayez de l\'ajouter sans mot de passe.' });
  }

  // Journalisation obligatoire : si elle échoue, on ne renvoie PAS un succès
  // silencieux — l'admin est averti explicitement que la trace manque.
  const { error: jErr } = await admin.from('odyris_journal').insert({
    acteur: payload?.sub ?? null, acteur_nom: moi.nom ?? null,
    action: 'personnel_creer_acces', cible: email, details: { role }, aal: 'aal2',
  });
  if (jErr) {
    console.error('odyris-creer-acces: journalisation échouée', jErr.message);
    return json({ ok: true, user_id: userId, role, avertissement: 'Compte créé, mais la journalisation a échoué — à signaler.' });
  }

  return json({ ok: true, user_id: userId, role });
});
