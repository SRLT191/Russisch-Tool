// Hintergrund-Helfer für die installierte App.
// Regel: immer zuerst das Netz (neueste Version), die gespeicherte Kopie nur ohne Internet.
// Anfragen an andere Adressen (z. B. api.github.com) werden nicht angefasst.
// srlt191.github.io teilen sich alle Seiten des Kontos: daher nur eigene Speicher ("russisch-…")
// anfassen und nur Dateien innerhalb des eigenen Pfads speichern.
const CACHE = 'russisch-v2';
const DATEIEN = ['./index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN.map(u => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('russisch-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Speicherschlüssel ohne ?… und #…, Seitenaufrufe der Startseite immer als index.html –
// so wächst der Speicher nicht mit jeder Adressvariante
function schluessel(req) {
  const u = new URL(req.url); const basis = new URL(self.registration.scope).pathname;
  if (!u.pathname.startsWith(basis)) return null;
  if (req.mode === 'navigate' && (u.pathname === basis || u.pathname === basis + 'index.html')) return new URL('./index.html', self.registration.scope).href;
  return u.origin + u.pathname;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const key = schluessel(req);
  if (!key) return;
  e.respondWith(
    // Seitenaufrufe (mode "navigate") dürfen nicht mit Zusatzoptionen kopiert werden, daher über die Adresse.
    fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' }).then(res => {
      // umgeleitete Seitenaufrufe als Umleitung weitergeben (sonst bricht der Browser ab)
      if (res.redirected && req.mode === 'navigate') return Response.redirect(res.url, 302);
      if (res.ok && res.type === 'basic') { const kopie = res.clone(); caches.open(CACHE).then(c => c.put(key, kopie)); }
      return res;
    }).catch(() => caches.match(key)
      .then(r => r || (req.mode === 'navigate' ? caches.match(new URL('./index.html', self.registration.scope).href) : undefined))
      .then(r => r || Response.error()))
  );
});
