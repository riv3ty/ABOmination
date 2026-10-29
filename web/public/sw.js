// Service Worker: App auch ohne Netz starten.
// Seite: zuerst Netz (Updates kommen sofort an), sonst Cache. Icons/Manifest: Cache zuerst.
// /api/* wird nie zwischengespeichert – die Daten liegen verschlüsselt in der Offline-Kopie der App.
const CACHE = "abomination-v2";
const SHELL = ["./", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-192.png", "./icons/maskable-512.png", "./icons/favicon-32.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    // App-Seite: Netz, Antwort als neue Offline-Version merken; ohne Netz die gemerkte Version
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./", copy)); }
      return res;
    }).catch(() => caches.match("./")));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});

// Push-Benachrichtigungen: Text ist mit dem Push-Schlüssel des Kontos verschlüsselt (siehe src/push.js);
// der Schlüssel liegt als nicht exportierbarer CryptoKey in IndexedDB („abo-push“).
function deviceKey() {
  return new Promise(resolve => {
    const open = indexedDB.open("abo-push", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("keys");
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      try {
        const req = open.result.transaction("keys").objectStore("keys").get("key");
        req.onsuccess = () => { open.result.close(); resolve(req.result || null); };
        req.onerror = () => { open.result.close(); resolve(null); };
      } catch { open.result.close(); resolve(null); }
    };
  });
}
const fromB64url = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function decryptPayload(text) {
  const [v, iv, ct] = String(text).split(".");
  const key = await deviceKey();
  if (v !== "v1" || !key) return null;
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64url(iv) }, key, fromB64url(ct));
  return JSON.parse(new TextDecoder().decode(plain));
}

self.addEventListener("push", e => {
  e.waitUntil((async () => {
    let msg;
    try { msg = e.data ? await decryptPayload(e.data.text()) : null; } catch { msg = null; }
    const title = msg?.t || "ABOmination";
    await self.registration.showNotification(title, {
      body: msg?.b || "Du hast eine neue Erinnerung. Öffne die App für Details.",
      tag: msg?.tag || "abo", icon: "./icons/icon-192.png", badge: "./icons/favicon-32.png", data: { url: "./" }
    });
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const win = list.find(c => new URL(c.url).origin === location.origin);
    return win ? win.focus() : self.clients.openWindow(e.notification.data?.url || "./");
  }));
});
