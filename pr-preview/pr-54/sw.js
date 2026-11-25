/* Odyssée Connect · fonctionnement hors connexion (coquille de l'appli) */
const CACHE = 'odc-v11';
const FICHIERS = ['./', './index.html', './css/app.css', './js/config.js', './js/data.js', './js/parcours.js', './js/app.js', './parcours/parcours-3km.gpx', './parcours/parcours-5km.gpx', './parcours/parcours-10km.gpx', './js/vendor/qrcode.min.js', './js/vendor/jsQR.js',
  './images/coureurs.jpg', './icons/icon-192.png', './icons/icon-512.png', './manifest.webmanifest'];

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
