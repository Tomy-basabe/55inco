const CACHE_NAME = '5inco-store-v3';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './icon.svg'
];

// Al instalar: cachear solo archivos estáticos (NO app.js ni data.js)
self.addEventListener('install', event => {
  self.skipWaiting(); // Activar inmediatamente sin esperar
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Al activar: eliminar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim()) // Tomar control de todos los tabs abiertos
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // app.js y data.js: SIEMPRE desde la red, nunca desde caché
  if (url.pathname.endsWith('app.js') || url.pathname.endsWith('data.js')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // El resto: red primero, caché como fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const resClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, resClone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
