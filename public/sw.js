const CACHE_NAME = 'babai-v1';
const ASSET_CACHE = 'babai-assets-v1';

// URLs to cache on install
const PRECACHE_URLS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== ASSET_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache images, videos and audio from external CDNs
  const isAsset =
    event.request.destination === 'image' ||
    event.request.destination === 'video' ||
    event.request.destination === 'audio' ||
    url.hostname.includes('ibb.co') ||
    url.hostname.includes('pixabay.com') ||
    url.hostname.includes('unsplash.com') ||
    url.hostname.includes('picsum.photos') ||
    url.hostname.includes('supabase.co');

  if (isAsset) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (e) {
          return cached || new Response('', { status: 503 });
        }
      })
    );
    return;
  }

  // For navigation requests, use network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/').then(r => r || new Response('Offline', { status: 503 }))
      )
    );
  }
});
