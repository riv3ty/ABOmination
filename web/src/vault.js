// Tresor: hält die entschlüsselten Daten des angemeldeten Profils nur im Speicher.
// Zwei Modi: "local" (Profil in diesem Browser, localStorage) und "server" (Konto auf dem ABOmination-Server,
// Abgleich über ServerStore, verschlüsselte Offline-Kopie im localStorage).
import { deriveLocalKey, seal, openBlob, toB64, fromB64, randomBytes } from "./cryptoutil.js";
import { rget, rset, sleep } from "./storage.js";
import { normName } from "./server/store.js";

export { rget, sleep };
export const USERS_KEY = "abo-users";
const BLOB_PREFIX = "abo-user-";
export const LEGACY_KEYS = [   // unverschlüsselte Schlüssel früherer Versionen (Übernahme ins erste Profil)
  "abo-manager-v1", "abo-manager-meta", "abo-manager-settings", "abo-manager-sync"];
export const ITER = 600000;
const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6"];
const clone = v => JSON.parse(JSON.stringify(v));

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

let idle = null;
export const Vault = {
  mode: "local", store: null,
  uid: null, name: null, data: {}, key: null, blob: null, timer: null, dirty: false, failed: false,
  get(k, fb) { return k in this.data ? clone(this.data[k]) : fb; },
  // Gespeichert wird verzögert und asynchron; Fehler meldet flush(). Rückgabe: ob der letzte Speicherversuch geklappt hat.
  set(k, v) { this.data[k] = clone(v); this.dirty = true; clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 150); return !this.failed; },
  async flush() {
    if (!this.key || !this.dirty) return;
    this.dirty = false; clearTimeout(this.timer);
    if (this.mode === "server") return this.store.save();                 // Fehler zeigt der Sync-Status an
    try { rset(BLOB_PREFIX + this.uid, { ...this.blob, ...(await seal(this.key, this.data)) }); this.failed = false; }
    catch (e) {
      this.dirty = true; console.error(e);
      if (!this.failed) alert("Speichern im Browser fehlgeschlagen (Speicher voll?): " + (e.message || e) + "\nBitte unter Einstellungen → Daten eine Sicherung (JSON) exportieren.");
      this.failed = true;                        // nur beim ersten Fehlschlag melden, nicht bei jeder Änderung erneut
    }
  },

  /* ---- Lokale Profile ---- */
  async create(name, pw, initial) {
    name = name.trim(); checkName(name);
    if (nameTaken(name)) throw new Error("Dieser Name ist schon vergeben.");
    const salt = randomBytes(16), key = await deriveLocalKey(pw, salt, ITER);
    const blob = { v: 1, salt: toB64(salt), iter: ITER }, id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    rset(BLOB_PREFIX + id, { ...blob, ...(await seal(key, initial || {})) });
    const users = rget(USERS_KEY, []);
    users.push({ id, name, color: COLORS[users.length % COLORS.length], created: Date.now() });
    rset(USERS_KEY, users);
    Object.assign(this, { mode: "local", uid: id, name, key, blob, data: initial || {}, dirty: false, created: users[users.length - 1].created });
  },
  // Lokales Profil entschlüsseln, ohne es zu öffnen (z. B. Übernahme in ein Server-Konto)
  async readLocal(id, pw) {
    const blob = rget(BLOB_PREFIX + id, null);
    if (!blob) throw new Error("Profil nicht gefunden.");
    const key = await deriveLocalKey(pw, fromB64(blob.salt), blob.iter);
    try { return { key, blob, data: await openBlob(key, blob) }; } catch { throw new Error("Falsches Passwort."); }
  },
  async unlock(id, pw) {
    const user = rget(USERS_KEY, []).find(u => u.id === id);
    if (!user) throw new Error("Profil nicht gefunden.");
    const { key, blob, data } = await this.readLocal(id, pw);
    Object.assign(this, { mode: "local", uid: id, name: user.name, key, blob: { v: blob.v, salt: blob.salt, iter: blob.iter }, data, dirty: false, created: user.created || Date.now() });
  },
  async verify(pw) {
    try { await this.readLocal(this.uid, pw); return true; } catch { return false; }
  },

  /* ---- Server-Konto (ServerStore aus server/store.js) ---- */
  enterServer({ store, data, user }) {
    Object.assign(this, { mode: "server", store, uid: "srv:" + normName(user.username), name: user.username,
      key: store.encKey, data, dirty: false, created: user.createdAt || Date.now() });
    if (store.pending) store.save();                                        // Offline-Änderungen hochladen
    store.startAutoSync();
  },
  // vom Server übernommener Stand (Abgleich/Konflikt): App lädt ihren Zustand neu
  applyRemote(data) { this.data = data; document.dispatchEvent(new Event("abo:remote")); },

  /* ---- Konto-Aktionen (je nach Modus) ---- */
  async changePassword(oldPw, newPw) {
    if (this.mode === "server") { await this.flush(); return this.store.changePassword(oldPw, newPw); }
    if (!(await this.verify(oldPw))) throw new Error("Aktuelles Passwort ist falsch.");
    await this.flush();
    const salt = randomBytes(16);
    this.key = await deriveLocalKey(newPw, salt, ITER);
    this.blob = { v: 1, salt: toB64(salt), iter: ITER };
    this.dirty = true; await this.flush();
  },
  rename(name) {
    if (this.mode === "server") throw new Error("Der Name eines Server-Kontos lässt sich nicht ändern.");
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
    if (this.mode === "server") { await this.store.deleteAccount(pw); this.key = null; this.dirty = false; clearTimeout(this.timer); return; }
    if (!(await this.verify(pw))) throw new Error("Passwort ist falsch.");
    const id = this.uid; this.key = null; this.dirty = false; clearTimeout(this.timer);
    await this.removeProfile(id);
  },
  // Server-Konto auf diesem Gerät abmelden (Sitzung beenden, Offline-Kopie entfernen)
  async logout() {
    await this.flush();
    await this.store.chain;
    if (this.store.pending && !confirm("Einige Änderungen sind noch nicht auf dem Server gespeichert (offline?). Trotzdem abmelden? Diese Änderungen gehen dann verloren.")) return;
    clearTimeout(idle); this.key = null;
    await this.store.logout();
    location.reload();
  },
  async lock() {                                                              // Neuladen löscht Schlüssel und Daten aus dem Speicher
    clearTimeout(idle); await this.flush();
    if (this.store) await Promise.race([this.store.chain, sleep(3000)]);   // laufenden Upload abwarten (Offline-Kopie ist ohnehin gesichert)
    location.reload();
  },
  bump() {                                                                    // Inaktivitäts-Timer neu starten
    clearTimeout(idle);
    const m = Number((this.data["abo-manager-settings"] || {}).autoLock ?? 15);
    if (this.key && m > 0) idle = setTimeout(() => this.lock(), m * 60000);
  }
};
["pointerdown", "keydown", "wheel", "touchstart"].forEach(ev => addEventListener(ev, () => Vault.bump(), { passive: true }));
document.addEventListener("visibilitychange", () => { if (document.hidden) Vault.flush(); });
addEventListener("pagehide", () => Vault.flush());   // Tab schließen innerhalb der 150-ms-Verzögerung
