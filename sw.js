const CACHE_PREFIX = "fpl-draft-challenge-";
const CACHE_NAME = `${CACHE_PREFIX}studio-refresh-v9`;
const MAX_CACHE_ENTRIES = 128;
const STATIC_ASSETS = ["./manifest.webmanifest", "./icons/icon-192.svg", "./icons/icon-512.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
function isDynamic(url, request) {
  return request.mode === "navigate" || /\.(?:html|css|js)$/.test(url.pathname) || /\/challenges\//.test(url.pathname);
}
function cacheKey(request) {
  const url = new URL(request.url);
  // Only cache-busting parameters on static assets are disposable.
  if (/\.(?:css|js)$/.test(url.pathname)) url.searchParams.delete("v");
  return url.href;
}
async function cached(request) {
  return (await caches.open(CACHE_NAME)).match(cacheKey(request));
}
function usable(request, response) {
  if (!response.ok || response.type === "opaque") return false;
  const path = new URL(request.url).pathname;
  const type = (response.headers.get("Content-Type") || "").toLowerCase();
  if (/\.js$/.test(path)) return /(?:java|ecma)script/.test(type);
  if (/\.css$/.test(path)) return type.includes("text/css");
  return request.mode === "navigate" || !type.includes("text/html");
}
let cacheWrites = Promise.resolve();
function remember(request, response) {
  if (!usable(request, response)) return Promise.resolve();
  const copy = response.clone();
  cacheWrites = cacheWrites.catch(() => {}).then(async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(cacheKey(request), copy);
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_CACHE_ENTRIES)).map(key => cache.delete(key)));
  });
  return cacheWrites;
}
async function fallback(request) {
  const asset = await cached(request);
  if (asset) return asset;
  if (request.mode === "navigate") {
    const cache = await caches.open(CACHE_NAME);
    const page = await cache.match("./") || await cache.match("./index.html");
    if (page) return page;
  }
  return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
}
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    if (!isDynamic(url, event.request)) {
      const hit = await cached(event.request);
      if (hit) return hit;
    }
    try {
      const response = await fetch(event.request, { cache: "no-store" });
      if (!usable(event.request, response)) return await cached(event.request) || (response.ok ? new Response("Invalid asset response", { status: 503 }) : response);
      event.waitUntil(remember(event.request, response));
      return response;
    } catch {
      return fallback(event.request);
    }
  })());
});
