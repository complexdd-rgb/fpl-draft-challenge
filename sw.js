const CACHE_NAME = "fpl-draft-challenge-formation-v1";
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
  return request.mode === "navigate" || /\/(index|admin)\.html$/.test(url.pathname) || /\/challenges\//.test(url.pathname) || /\/js\/(daily-challenge-loader|challenge-archive|phase45-polish|leaderboard-config|leaderboard-client|leaderboard-team-view|leaderboard-admin-status|admin-batch-calendar)\.js$/.test(url.pathname);
}
self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;
  if(isDynamic(url,event.request)){
    event.respondWith(fetch(event.request).then(response => {
      const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));return response;
    }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./"))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));return response;
  })));
});
