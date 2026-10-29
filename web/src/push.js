// Push-Benachrichtigungen (nur Server-Konto): Gerät beim Push-Dienst des Browsers anmelden und den
// Erinnerungsplan verschlüsselt beim eigenen Server hinterlegen.
// Schlüssel: ein Push-Schlüssel pro Konto liegt im Tresor (abo-manager-push). Geräte mit aktivem Push legen ihn
// zusätzlich als nicht exportierbaren CryptoKey in IndexedDB ab, damit der Service Worker die Texte entschlüsseln kann.
import { api } from "./server/store.js";

const IDB = "abo-push", STORE = "keys";
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64url = bytes => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = s => unb64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
// iPhone/iPad: Web Push nur in der zum Home-Bildschirm hinzugefügten App
export const needsInstall = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches;

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(IDB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { open.result.close(); resolve(req?.result); };
      tx.onerror = () => { open.result.close(); reject(tx.error); };
    };
  });
}

export const newPushKey = () => b64(crypto.getRandomValues(new Uint8Array(32)));
const importKey = (raw, extractable = false) => crypto.subtle.importKey("raw", unb64(raw), "AES-GCM", extractable, ["encrypt", "decrypt"]);
// Schlüssel für den Service Worker hinterlegen (nicht exportierbar)
export async function storeDeviceKey(raw) { const k = await importKey(raw); await idb("readwrite", s => s.put(k, "key")); }
export const clearDeviceKey = () => new Promise(r => { const d = indexedDB.deleteDatabase(IDB); d.onsuccess = d.onerror = d.onblocked = () => r(); });

// Nutzlast verschlüsseln: "v1.<iv>.<ciphertext>" (Base64url); entschlüsselt im Service Worker (sw.js)
export async function encryptPayload(raw, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importKey(raw), new TextEncoder().encode(JSON.stringify(data)));
  return `v1.${b64url(iv)}.${b64url(ct)}`;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Gerät";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} auf ${os}`;
}

// Dieses Gerät anmelden: Erlaubnis, Push-Abo beim Browser-Dienst, Eintrag beim eigenen Server, Schlüssel ablegen
export async function enablePush(raw) {
  if (!pushSupported()) throw new Error("Dieser Browser unterstützt keine Push-Benachrichtigungen.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Browser-Einstellungen und versuche es erneut.");
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api("GET", "/api/push/key");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64url(publicKey) });
  const j = sub.toJSON();
  await api("POST", "/api/push/subscribe", { endpoint: j.endpoint, keys: j.keys, label: deviceLabel() });
  await storeDeviceKey(raw);
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) { try { await api("DELETE", "/api/push/subscribe", { endpoint: sub.endpoint }); } finally { await sub.unsubscribe(); } }
  await clearDeviceKey();
}

export const pushStatus = () => api("GET", "/api/push/status");

// Plan verschlüsselt hochladen (ersetzt den bisherigen Plan des Kontos)
export async function uploadSchedule(raw, plan) {
  const items = [];
  for (const p of plan) items.push({ at: p.at, payload: await encryptPayload(raw, { t: p.title, b: p.body, tag: p.tag }) });
  return api("PUT", "/api/push/schedule", { items });
}

export async function sendTest(raw) {
  return api("POST", "/api/push/test", { payload: await encryptPayload(raw, { t: "ABOmination", b: "Push-Benachrichtigungen funktionieren auf diesem Gerät.", tag: "test" }) });
}
