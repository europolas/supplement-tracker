/**
 * Scoped static cache, offline app shell and push notification handlers.
 * Import only in a service worker. Cache no API or private data; remove only caches matching this app ID and registration scope.
 * Integration contracts: ../docs/MODULES.md and ../docs/ARCHITECTURE.md.
 */
export function installWorker({ id, version, assets, name, icon = './icon-192.png', image = './icon-512.png', scope: worker = globalThis.self }) {
  if (!/^[a-z][a-z0-9-]{2,23}$/.test(id)) throw new TypeError('Invalid cache namespace');
  const home = worker.registration.scope;
  const prefix = id + ':' + encodeURIComponent(home) + ':';
  const cacheName = prefix + version;
  const assetUrls = new Set(assets.map(path => { const url = new URL(path, home); if (!url.href.startsWith(home)) throw new TypeError('Asset outside app scope'); return url.href; }));
  worker.addEventListener('install', event => event.waitUntil(worker.caches.open(cacheName).then(cache => cache.addAll([...assetUrls].map(url => new Request(url, { cache: 'reload' })))).then(async () => { if (!(await worker.clients.matchAll({ includeUncontrolled: true })).some(client => client.url.startsWith(home))) await worker.skipWaiting(); })));
  worker.addEventListener('message', event => { if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(worker.skipWaiting()); });
  worker.addEventListener('activate', event => event.waitUntil(worker.caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => worker.caches.delete(key)))).then(() => worker.clients.claim())));
  worker.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || !url.href.startsWith(home)) return;
    // Only static files are cached. API responses, uploads and credentials are never cached.
    const clean = new URL(url); clean.search = ''; clean.hash = '';
    if (request.mode !== 'navigate' && !assetUrls.has(clean.href)) return;
    event.respondWith(worker.caches.open(cacheName).then(async cache => {
      if (assetUrls.has(clean.href)) { const cached = await cache.match(clean.href); if (cached) return cached; }
      try { return await worker.fetch(request); }
      catch (error) { if (request.mode === 'navigate') { const page = await cache.match(new URL('./index.html', home).href); if (page) return page; } throw error; }
    }));
  });
  const safeTarget = value => { try { const target = new URL(value || './', home); return target.href.startsWith(home) ? target.href : home; } catch { return home; } };
  worker.addEventListener('push', event => {
    let payload = {}; try { payload = event.data?.json() || {}; } catch {}
    const message = payload.message && typeof payload.message === 'object' ? payload.message : payload;
    event.waitUntil(worker.registration.showNotification(String(message.title || name).slice(0, 200), { body: String(message.body || message.message || "You have a new notification.").slice(0, 1000), icon: new URL(icon, home).href, image: new URL(image, home).href, tag: String(message.id || id).slice(0, 200), data: { url: safeTarget(message.url) } }));
  });
  worker.addEventListener('notificationclick', event => {
    event.notification.close();
    const target = safeTarget(event.notification.data?.url);
    event.waitUntil(worker.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => { const existing = clients.find(client => client.url.startsWith(home)); if (existing) { await existing.navigate(target); return existing.focus(); } return worker.clients.openWindow(target); }));
  });
}
