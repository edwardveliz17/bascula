// Service worker de Báscula Ganadera: permite abrir la app sin internet.
// Los DATOS los maneja Firebase (caché local + sincronización); este archivo guarda la APP.
const CACHE = "bascula-app-v1";
const LOCALES = ["./", "./index.html", "./manifest.json", "./icono-192.png", "./icono-512.png"];
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const FIREBASE = [FB + "firebase-app.js", FB + "firebase-auth.js", FB + "firebase-firestore.js"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(LOCALES);
    // Las librerías de Firebase se guardan una por una (si alguna falla, no detiene la instalación)
    await Promise.allSettled(FIREBASE.map(u => fetch(u, { mode: "cors" }).then(r => r.ok && c.put(u, r))));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  // Nunca interceptar la base de datos ni el login de Firebase
  if (/googleapis\.com|firebaseio\.com|identitytoolkit|securetoken/.test(url.hostname)) return;

  // La app (HTML): primero internet para tener siempre la última versión; sin señal, la guardada
  if (req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith(".html"))) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req, { cache: "no-store" });
        if (r.ok) (await caches.open(CACHE)).put("./index.html", r.clone());
        return r;
      } catch (_) {
        return (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
      }
    })());
    return;
  }

  // Librerías de Firebase, íconos y demás: primero lo guardado; si no está, se descarga y se guarda
  if (url.origin === location.origin || url.hostname === "www.gstatic.com") {
    e.respondWith((async () => {
      const g = await caches.match(req);
      if (g) return g;
      try {
        const r = await fetch(req);
        if (r.ok) (await caches.open(CACHE)).put(req, r.clone());
        return r;
      } catch (_) { return Response.error(); }
    })());
  }
});
