/**
 * sw.js — Service Worker для Jewerly of Soul
 * ----------------------------------------------------------------
 * Стратегии кэширования:
 *   HTML            → network-first (свежий контент, fallback на cache при оффлайне)
 *   CSS / JS        → stale-while-revalidate (мгновенный ответ из cache + фон-update)
 *   PNG камней      → cache-first (один раз — навсегда, тяжёлые фотки)
 *   JSON-данные     → network-first (нужны свежие идеи / seed)
 *   Шрифты Google   → cache-first (immutable URL-ы)
 *   Прочее          → fallback на сеть
 *
 * Версионирование: при изменении CACHE_VERSION старые caches удаляются.
 */

const CACHE_VERSION = 'jos-v2-4-feed';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const STONES_CACHE  = `${CACHE_VERSION}-stones`;
const DATA_CACHE    = `${CACHE_VERSION}-data`;
const FONTS_CACHE   = `${CACHE_VERSION}-fonts`;

// Минимальный набор для оффлайн-shell. Грузим при install.
const PRECACHE_URLS = [
    './',
    './index.html',
    './constructor.html',
    './stones.html',
    './inspiration.html',
    './contact.html',
    './login.html',
    './register.html',
    './profile.html',
    './idea.html',
    './create-idea.html',
    './manifest.webmanifest',
    './assets/favicon.svg',
    './assets/og-image.svg',
];

// =================================================================
// INSTALL: предзагрузка app-shell
// =================================================================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(PRECACHE_URLS).catch(err => {
                console.warn('[sw] precache partial fail:', err);
            }))
            .then(() => self.skipWaiting())
    );
});

// =================================================================
// ACTIVATE: чистим старые версии кэшей
// =================================================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys
                .filter(k => !k.startsWith(CACHE_VERSION))
                .map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

// =================================================================
// FETCH: маршрутизация по типу ресурса
// =================================================================
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Google Fonts → cache-first
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(cacheFirst(req, FONTS_CACHE));
        return;
    }

    // Игнорируем cross-origin (POST, чужие домены и т.д.)
    if (url.origin !== self.location.origin) return;

    // assets/stones/*.png — cache-first, долго живут
    if (url.pathname.startsWith('/') && url.pathname.includes('/assets/stones/') && url.pathname.endsWith('.png')) {
        event.respondWith(cacheFirst(req, STONES_CACHE));
        return;
    }

    // data/*.json — network-first
    if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
        event.respondWith(networkFirst(req, DATA_CACHE));
        return;
    }

    // HTML — network-first
    if (req.mode === 'navigate' || (req.headers.get('Accept') || '').includes('text/html')) {
        event.respondWith(networkFirst(req, STATIC_CACHE));
        return;
    }

    // CSS / JS / SVG / прочие статические — stale-while-revalidate
    if (/\.(css|js|svg|png|jpg|jpeg|gif|webp|woff2?)$/.test(url.pathname)) {
        event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
        return;
    }

    // Прочее — сеть с фолбэком на кэш
    event.respondWith(networkFirst(req, STATIC_CACHE));
});

// =================================================================
// СТРАТЕГИИ
// =================================================================

async function cacheFirst(req, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
    } catch (err) {
        return cached || new Response('', { status: 504, statusText: 'offline' });
    }
}

async function networkFirst(req, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
    } catch (err) {
        const cached = await cache.match(req);
        if (cached) return cached;
        // Fallback на index.html для HTML-навигации (SPA-style)
        if (req.mode === 'navigate') {
            const offlineFallback = await cache.match('./index.html');
            if (offlineFallback) return offlineFallback;
        }
        return new Response('', { status: 504, statusText: 'offline' });
    }
}

async function staleWhileRevalidate(req, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    const network = fetch(req)
        .then(res => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
        })
        .catch(() => null);
    return cached || (await network) || new Response('', { status: 504 });
}

// =================================================================
// СООБЩЕНИЯ от клиента (например, для принудительного skip-wait)
// =================================================================
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
