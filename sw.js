/* ═══════════════════════════════════════════════════════════
   Grà — Service Worker  v1.1
   Paths are derived from self.location so the SW works on any
   host — GitHub Pages, localhost, or a preview environment.
═══════════════════════════════════════════════════════════ */

const CACHE   = 'gra-v1.7';
const BASE    = self.location.pathname.replace(/sw\.js$/, ''); // e.g. '/Gra/'
const APP_URL = self.location.origin + BASE;

const ASSETS = [
  APP_URL,
  APP_URL + 'index.html',
  APP_URL + 'manifest.json',
  APP_URL + 'sw.js',
];

/* ── Install ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache =>
        // Promise.allSettled so missing icons don't abort SW install
        Promise.allSettled(ASSETS.map(url => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

/* ── Activate ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: network-first, cache fallback ── */
self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith('http')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (e.request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request)
          .then(cached => cached || caches.match(APP_URL + 'index.html'))
      )
  );
});

/* ── Push ── */
self.addEventListener('push', e => {
  let data = {
    title: 'Grà 💛', body: 'Time to send some love ♡',
    tag: 'gra-nudge', nudgeId: null, personId: null,
    personName: null, nudgeType: 'text', url: APP_URL,
  };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (_) {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      tag:     data.tag,
      icon:    APP_URL + 'icons/icon-192x192.png',
      badge:   APP_URL + 'icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: {
        nudgeId: data.nudgeId, personId: data.personId,
        personName: data.personName, nudgeType: data.nudgeType,
        url: data.url || APP_URL,
      },
      actions: [
        { action: 'done',   title: '✓ Done it' },
        { action: 'skip',   title: "✗ Didn't" },
        { action: 'snooze', title: '⏰ Remind me' },
      ],
      requireInteraction: true,
    })
  );
});

/* ── Notification click ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { nudgeId, personId, personName, nudgeType, url } = e.notification.data || {};
  const action = e.action;
  const appUrl = url || APP_URL;

  const postAction = client => client.postMessage({
    type: 'nudge-action', action: action || 'open',
    nudgeId, personId, personName, nudgeType,
  });

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        const existing = clients.find(c => c.url.startsWith(APP_URL) && 'focus' in c);
        if (existing) { existing.focus(); postAction(existing); return; }
        self.clients.openWindow(appUrl).then(client => {
          if (client) setTimeout(() => postAction(client), 800);
        });
      })
  );
});
