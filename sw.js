// Hintergrund-Helfer für die installierte App.
// Regel: immer zuerst das Netz (neueste Version), die gespeicherte Kopie nur ohne Internet.
// Anfragen an andere Adressen (z. B. api.github.com) werden nicht angefasst.
const CACHE = 'russisch-v1';
const DATEIEN = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN.map(u => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    // Seitenaufrufe (mode "navigate") dürfen nicht mit Zusatzoptionen kopiert werden, daher über die Adresse.
    fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const kopie = res.clone(); caches.open(CACHE).then(c => c.put(req, kopie)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
      .then(r => r || Response.error()))
  );
});
