/* ═══════════════════════════════════════════════════════════
   Grà — Service Worker  v1.0
   Cache strategy: network-first, cache fallback
   Push: delivers nudge notifications with 3 action buttons
═══════════════════════════════════════════════════════════ */

const CACHE   = 'gra-v1';
const ASSETS  = [
  '/Gra/',
  '/Gra/index.html',
  '/Gra/manifest.json',
  '/Gra/sw.js',
  '/Gra/icons/icon-192x192.png',
  '/Gra/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap',
];

/* ── Install ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
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

/* ── Fetch ── */
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
        caches.match(e.request).then(cached => cached || caches.match('/Gra/index.html'))
      )
  );
});

/* ── Push ── */
self.addEventListener('push', e => {
  let data = {
    title:      'Grà 💛',
    body:       'Time to send some love ♡',
    tag:        'gra-nudge',
    nudgeId:    null,
    personId:   null,
    personName: null,
    nudgeType:  'text',
  };

  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (_) {}

  const typeVerb = data.nudgeType === 'call' ? 'call' : 'text';

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      tag:     data.tag,
      icon:    '/Gra/icons/icon-192x192.png',
      badge:   '/Gra/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: {
        nudgeId:    data.nudgeId,
        personId:   data.personId,
        personName: data.personName,
        nudgeType:  data.nudgeType,
        url:        '/Gra/',
      },
      actions: [
        { action: 'done',   title: '✓ Done it' },
        { action: 'skip',   title: '✗ Didn\'t' },
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
  const action = e.action; // 'done' | 'skip' | 'snooze' | '' (body tap)

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // Post action to any open app window
        const postAction = (client) => {
          client.postMessage({
            type:       'nudge-action',
            action:     action || 'open',
            nudgeId,
            personId,
            personName,
            nudgeType,
          });
        };

        // If app is already open — focus it and post
        const existing = clients.find(c => c.url.includes('/Gra/') && 'focus' in c);
        if (existing) {
          existing.focus();
          postAction(existing);
          return;
        }

        // Otherwise open app, then post once ready
        // The app listens for this message on load via navigator.serviceWorker.addEventListener('message')
        self.clients.openWindow(url || '/Gra/').then(client => {
          if (client) {
            // Short delay to let the app initialise before posting
            setTimeout(() => postAction(client), 800);
          }
        });
      })
  );
});
