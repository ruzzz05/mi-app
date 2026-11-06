// Cambia VERSION cuando modifiques archivos de la app para forzar la actualización.
const VERSION = 'v3';
const CACHE = `mi-app-${VERSION}`;

const SHELL = [
  './',
  'index.html',
  'vinilos.html',
  'ask.html',
  'styles.css',
  'pwa.js',
  'manifest.webmanifest',
  'vendor/papaparse.min.js',
  'musica.csv',
  'yonunca.csv',
  'ask.csv',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const refresh = fetch(request)
    .then(res => {
      // Las respuestas "opaque" (imágenes de otros dominios) también se guardan.
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || refresh;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Páginas y datos: red primero (ves los cambios al recargar), caché si no hay conexión.
  if (sameOrigin && (request.mode === 'navigate' || url.pathname.endsWith('.csv') || url.pathname.endsWith('.html'))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Resto (css, js, iconos, portadas locales y remotas): caché con refresco en segundo plano.
  event.respondWith(staleWhileRevalidate(request));
});
