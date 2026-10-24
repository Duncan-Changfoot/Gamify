// Keeps every file on the device so the games work with no signal. A new VERSION (written by
// tools/stamp.js) downloads the whole new set before switching, so old and new files never mix.
// The download skips the browser's HTTP cache: GitHub Pages lets browsers keep files for 10 minutes,
// which would otherwise save old files under the new version.
const VERSION = 'gamify-6dd8532a4e';
const FILES = [
  './',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'index.html',
  'manifest.webmanifest',
  'src/audio.js',
  'src/games/balloons.js',
  'src/games/blaster.js',
  'src/games/memory.js',
  'src/games/road.js',
  'src/games/snake.js',
  'src/games/think.js',
  'src/kit.js',
  'src/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(
    caches.open(VERSION)
      .then((cache) => cache.match(event.request, { ignoreSearch: true }))
      .then((hit) => hit || fetch(event.request)),
  );
});
