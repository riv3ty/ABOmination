// Profile und verschlüsselter Tresor: PBKDF2-SHA256 -> AES-256-GCM, Ablage im localStorage.
// Der Tresor hält die entschlüsselten Daten des angemeldeten Profils nur im Speicher.
export const USERS_KEY = "abo-users";
const BLOB_PREFIX = "abo-user-";
export const LEGACY_KEYS = [   // unverschlüsselte Schlüssel früherer Versionen (Übernahme ins erste Profil)
  "abo-manager-v1", "abo-manager-meta", "abo-manager-settings", "abo-manager-sync"];
export const ITER = 600000;
const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6"];
const te = new TextEncoder(), td = new TextDecoder();
const toB64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const rget = (k, fb) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; } };
const rset = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const clone = v => JSON.parse(JSON.stringify(v));
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Kryptografie: PBKDF2-SHA256 -> AES-256-GCM ---------- */
async function derive(pw, salt, iter) {
  const base = await crypto.subtle.importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(obj))));
  return { iv: toB64(iv), ct: toB64(ct) };
}
async function openBlob(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) }, key, fromB64(blob.ct));
  return JSON.parse(td.decode(pt));
}
function idbDelete(key) {                    // Sync-Datei-Zugriff eines gelöschten Profils entfernen (best effort)
  return new Promise(res => {
    try {
      const r = indexedDB.open("abo-manager", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => { try { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").delete(key); tx.oncomplete = tx.onerror = () => res(); } catch { res(); } };
      r.onerror = () => res();
    } catch { res(); }
  });
}
const nameTaken = (name, exceptId) => rget(USERS_KEY, []).some(u => u.id !== exceptId && u.name.toLowerCase() === name.toLowerCase());
function checkName(name) {
  if (!name || name.length > 40) throw new Error("Bitte einen Namen mit 1–40 Zeichen eingeben.");
}

/* ---------- Tresor: entschlüsselte Daten des angemeldeten Profils ---------- */
let idle = null;
export const Vault = {
  uid: null, name: null, data: {}, key: null, blob: null, timer: null, dirty: false, failed: false,
  get(k, fb) { return k in this.data ? clone(this.data[k]) : fb; },
  // Gespeichert wird verzögert und asynchron; Fehler meldet flush(). Rückgabe: ob der letzte Speicherversuch geklappt hat.
  set(k, v) { this.data[k] = clone(v); this.dirty = true; clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 150); return !this.failed; },
  async flush() {
    if (!this.key || !this.dirty) return;
    this.dirty = false;
    try { rset(BLOB_PREFIX + this.uid, { ...this.blob, ...(await seal(this.key, this.data)) }); this.failed = false; }
    catch (e) {
      this.dirty = true; console.error(e);
      if (!this.failed) alert("Speichern im Browser fehlgeschlagen (Speicher voll?): " + (e.message || e) + "\nBitte unter Einstellungen → Daten eine Sicherung (JSON) exportieren.");
      this.failed = true;                        // nur beim ersten Fehlschlag melden, nicht bei jeder Änderung erneut
    }
  },
  async create(name, pw, initial) {
    name = name.trim(); checkName(name);
    if (nameTaken(name)) throw new Error("Dieser Name ist schon vergeben.");
    const salt = crypto.getRandomValues(new Uint8Array(16)), key = await derive(pw, salt, ITER);
    const blob = { v: 1, salt: toB64(salt), iter: ITER }, id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    rset(BLOB_PREFIX + id, { ...blob, ...(await seal(key, initial || {})) });
    const users = rget(USERS_KEY, []);
    users.push({ id, name, color: COLORS[users.length % COLORS.length], created: Date.now() });
    rset(USERS_KEY, users);
    Object.assign(this, { uid: id, name, key, blob, data: initial || {}, dirty: false, created: users[users.length - 1].created });
  },
  async unlock(id, pw) {
    const user = rget(USERS_KEY, []).find(u => u.id === id), blob = rget(BLOB_PREFIX + id, null);
    if (!user || !blob) throw new Error("Profil nicht gefunden.");
    const key = await derive(pw, fromB64(blob.salt), blob.iter);
    let data;
    try { data = await openBlob(key, blob); } catch { throw new Error("Falsches Passwort."); }
    Object.assign(this, { uid: id, name: user.name, key, blob: { v: blob.v, salt: blob.salt, iter: blob.iter }, data, dirty: false, created: user.created || Date.now() });
  },
  async verify(pw) {
    const blob = rget(BLOB_PREFIX + this.uid, null);
    try { await openBlob(await derive(pw, fromB64(blob.salt), blob.iter), blob); return true; } catch { return false; }
  },
  async changePassword(oldPw, newPw) {
    if (!(await this.verify(oldPw))) throw new Error("Aktuelles Passwort ist falsch.");
    await this.flush();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    this.key = await derive(newPw, salt, ITER);
    this.blob = { v: 1, salt: toB64(salt), iter: ITER };
    this.dirty = true; await this.flush();
  },
  rename(name) {
    name = name.trim(); checkName(name);
    if (nameTaken(name, this.uid)) throw new Error("Dieser Name ist schon vergeben.");
    rset(USERS_KEY, rget(USERS_KEY, []).map(u => u.id === this.uid ? { ...u, name } : u));
    this.name = name;
  },
  async removeProfile(id) {
    localStorage.removeItem(BLOB_PREFIX + id);
    rset(USERS_KEY, rget(USERS_KEY, []).filter(u => u.id !== id));
    await idbDelete("handle:" + id);
  },
  async deleteProfile(pw) {
    if (!(await this.verify(pw))) throw new Error("Passwort ist falsch.");
    const id = this.uid; this.key = null; this.dirty = false; clearTimeout(this.timer);
    await this.removeProfile(id);
  },
  async lock() { clearTimeout(idle); await this.flush(); location.reload(); },   // Neuladen löscht Schlüssel und Daten aus dem Speicher
  bump() {                                                                      // Inaktivitäts-Timer neu starten
    clearTimeout(idle);
    const m = Number((this.data["abo-manager-settings"] || {}).autoLock ?? 15);
    if (this.key && m > 0) idle = setTimeout(() => this.lock(), m * 60000);
  }
};
["pointerdown", "keydown", "wheel", "touchstart"].forEach(ev => addEventListener(ev, () => Vault.bump(), { passive: true }));
document.addEventListener("visibilitychange", () => { if (document.hidden) Vault.flush(); });
addEventListener("pagehide", () => Vault.flush());   // Tab schließen innerhalb der 150-ms-Verzögerung
