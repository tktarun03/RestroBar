// Offline support. VERSION must equal APP_VERSION (tests check it).
// The page itself is network-first (so updates arrive), versioned assets are cache-first.
const VERSION = '0.1.3';
const CACHE = 'restrobar-' + VERSION;
const V = '?v=' + VERSION;
const ASSETS = [
  './', 'index.html',
  'css/app.css' + V,
  'lib/qrcode-1.4.4.js' + V, 'lib/jsQR-1.4.0.js' + V,
  'js/core/version.js' + V, 'js/core/util.js' + V, 'js/core/i18n.js' + V, 'js/core/billing.js' + V, 'js/core/store.js' + V,
  'js/ui/ui.js' + V,
  'js/features/lock.js' + V, 'js/features/payqr.js' + V, 'js/features/qr.js' + V, 'js/features/share.js' + V, 'js/features/link.js' + V, 'js/features/setup.js' + V,
  'js/features/tables.js' + V, 'js/features/order.js' + V, 'js/features/kitchen.js' + V, 'js/features/bill.js' + V,
  'js/features/menu.js' + V, 'js/features/reports.js' + V, 'js/features/settings.js' + V,
  'js/app.js' + V,
  'fonts/barlow-latin-300-normal.woff2', 'fonts/barlow-latin-400-normal.woff2', 'fonts/barlow-latin-500-normal.woff2',
  'fonts/ibm-plex-mono-latin-400-normal.woff2',
  'manifest.webmanifest' + V, 'icons/icon.svg' + V, 'icons/favicon.ico' + V, 'icons/apple-touch-icon.png' + V,
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('restrobar-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // Page: network first, fall back to the cached shell when offline.
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('index.html', copy));
      return res;
    }).catch(() => caches.match('index.html').then((r) => r || caches.match('./'))));
    return;
  }
  // Assets: cache first.
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
