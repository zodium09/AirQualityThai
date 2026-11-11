/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

clientsClaim();
self.skipWaiting();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ url }) => url.origin === self.location.origin && /\/(thai_geo|thailand)\.json$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'geojson-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 5,
        maxAgeSeconds: 60 * 60 * 24 * 7,
      }),
    ],
  }),
);

registerRoute(
  ({ request, url }) => url.origin === self.location.origin && request.destination === 'image',
  new CacheFirst({
    cacheName: 'local-image-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 24,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

registerRoute(
  ({ request, url }) => (
    url.origin === self.location.origin
    && ['script', 'style'].includes(request.destination)
  ),
  new NetworkFirst({
    cacheName: 'local-code-cache',
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.hostname.includes('firebaseio.com'),
  new NetworkFirst({
    cacheName: 'firebase-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 5,
      }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.hostname.includes('air4thai.pcd.go.th'),
  new StaleWhileRevalidate({
    cacheName: 'air4thai-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 10,
      }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.hostname.includes('open-meteo.com'),
  new NetworkFirst({
    cacheName: 'weather-api-cache-v2',
    networkTimeoutSeconds: 8,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 10,
      }),
    ],
  }),
);

registerRoute(
  ({ url }) => /^https:\/\/fonts\.(googleapis|gstatic)\.com/.test(url.href),
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  }),
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const nextUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          if ('navigate' in client) {
            client.navigate(nextUrl);
          }

          return client.focus();
        }
      }

      return self.clients.openWindow(nextUrl);
    }),
  );
});
