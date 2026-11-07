// Cambia VERSION cuando modifiques archivos de la app para forzar la actualización.
const VERSION = 'v40';
const CACHE = `mi-app-${VERSION}`;

// Imágenes de ejercicios (Gimnasio): caché aparte que NO se borra al actualizar la app (la versión de
// las imágenes está fijada y nunca cambian) y con tope para no llenar el móvil.
const IMG_CACHE = 'gym-img';
const IMG_MAX = 250;

// Núcleo de la app. Los archivos de cada módulo se leen de apps.json (campos "path" y "files").
const SHELL = [
  './',
  'index.html',
  'shared/styles.css',
  'shared/pwa.js',
  'shared/theme.js',
  'shared/auth.js',
  'shared/authcore.js',
  'shared/synccore.js',
  'shared/firebase-config.js',
  'apps.json',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Módulos de Firebase Auth: así la comprobación de sesión también funciona sin conexión.
    // El resto del SDK se guarda solo la primera vez que se usa. Si falla, no se cae la instalación.
    await Promise.all([
      'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js',
      'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'
    ].map(u => cache.add(u).catch(() => {})));
    try {
      const res = await fetch('apps.json', { cache: 'no-store' });
      const apps = await res.json();
      const files = apps.flatMap(a => [a.path, ...(a.files || [])]);
      // Cada archivo por separado: si uno falla, no se cae toda la instalación.
      await Promise.all(files.map(f => cache.add(f).catch(() => {})));
    } catch (err) { /* sin apps.json: se cachea al usarlas */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k))))
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

async function cachedImage(request) {
  const cache = await caches.open(IMG_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    const keys = await cache.keys(); // en orden de llegada: se borran las más antiguas
    for (let i = 0; i < keys.length - IMG_MAX; i++) await cache.delete(keys[i]);
  }
  return res;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Páginas y datos: red primero (ves los cambios al recargar), caché si no hay conexión.
  if (sameOrigin && (request.mode === 'navigate' || url.pathname.endsWith('.csv') || url.pathname.endsWith('.html') || url.pathname.endsWith('.json'))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Imágenes de los ejercicios: caché primero (no cambian), con tope.
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/free-exercise-db@')) {
    event.respondWith(cachedImage(request));
    return;
  }

  // Resto (css, js, iconos, portadas locales y remotas): caché con refresco en segundo plano.
  event.respondWith(staleWhileRevalidate(request));
});
