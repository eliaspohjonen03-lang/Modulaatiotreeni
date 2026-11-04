// Yksinkertainen offline-välimuisti tuotantoversiolle (ei käytössä kehityspalvelimessa).
const CACHE = "modulaatiotreeni-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./manifest.webmanifest", "./icon.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Vain sovelluksen omat GET-pyynnöt: muiden sivustojen ja selainlaajennusten vastauksia ei tallenneta.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((res) => {
        // Virhevastauksia (404, 500 …) ei tallenneta, jottei offline-tilassa näytetä niitä.
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE).then((c) => c.put(request, copy)));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Sovelluksen etusivu vain sivulatauksille, ei esim. kuville tai skripteille.
        if (request.mode === "navigate") return (await caches.match("./")) ?? Response.error();
        return Response.error();
      }),
  );
});
