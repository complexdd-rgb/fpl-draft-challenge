const CACHE_NAME = "fpl-draft-challenge-studio-refresh-v8";
const STATIC_ASSETS = [
  "./manifest.webmanifest",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
function isDynamic(url, request){
  return request.mode === "navigate"
    || /\/(index|admin)\.html$/.test(url.pathname)
    || /\.css$/.test(url.pathname)
    || /\/(players|players-live|prompt-library)\.js$/.test(url.pathname)
    || /\/challenges\//.test(url.pathname)
    || /\/data\/[^/]+\.js$/.test(url.pathname)
    || /\/js\/[^/]+\.js$/.test(url.pathname);
}
self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;
  if(isDynamic(url,event.request)){
    event.respondWith(fetch(event.request,{cache:"no-store"}).then(response => {
      const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));return response;
    }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));return response;
  })));
});
