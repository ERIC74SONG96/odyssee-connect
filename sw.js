/* Odyssée Connect · fonctionnement hors connexion (coquille de l'appli) */
const CACHE = 'odc-v17';
const FICHIERS = ['./', './index.html', './css/app.css', './css/polices.css', './css/polices/inter-latin.woff2',
  './js/config.js', './js/data.js', './js/parcours.js', './js/app.js', './js/vendor/qrcode.min.js',
  './parcours/parcours-3km.gpx', './parcours/parcours-5km.gpx', './parcours/parcours-10km.gpx',
  './images/hero-accueil.webp', './images/coureur-blanc.webp', './images/coureur-vert.webp', './images/coureur-blanc-petit.webp',
  './icons/icon-192.png', './icons/icon-512.png', './manifest.webmanifest'];
// Pas de préchargement du lecteur de QR code (équipe seulement) ni de la bibliothèque Supabase :
// ils sont mis en cache à leur premier usage.

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // la base de données passe toujours par le réseau
  e.respondWith(
    fetch(e.request).then((r) => { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
