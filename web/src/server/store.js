// Server-Konto: Anmeldung, verschlüsselte Offline-Kopie und Abgleich des Tresors (Protokoll: server/API.md).
// Der Server bekommt nur den authKey und den mit encKey verschlüsselten Tresor zu sehen.
import { deriveServerKeys, seal, openBlob, toB64, randomBytes } from "../cryptoutil.js";
import { mergeData } from "../lib/merge.js";
import { rget, rset } from "../storage.js";

export class ApiError extends Error {
  constructor(status, body) { super(body?.message || `Serverfehler (HTTP ${status})`); this.status = status; this.code = body?.error; this.body = body; }
}
export class OfflineError extends Error {}

export async function api(method, path, body, timeoutMs = 20000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeoutMs);
  let r;
  try {
    r = await fetch(path, { method, credentials: "same-origin", cache: "no-store", signal: ctl.signal,
      headers: { "X-Requested-With": "abomination", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined });
  } catch { throw new OfflineError("Server nicht erreichbar."); }
  finally { clearTimeout(t); }
  if (r.status === 204) return null;
  const j = await r.json().catch(() => null);
  if (r.status >= 502 && r.status <= 504) throw new OfflineError("Server nicht erreichbar.");
  if (!r.ok || !j) throw new ApiError(r.status, j);
  return j;
}

// Läuft die App auf einem ABOmination-Server? (Liefert dessen Konfiguration oder null)
export async function detectServer() {
  if (!/^https?:$/.test(location.protocol)) return null;
  try { const c = await api("GET", "/api/config", null, 4000); return c?.kdf ? c : null; } catch { return null; }
}

/* ---------- Offline-Kopie (verschlüsselt, pro Konto) ---------- */
const CACHE_PREFIX = "abo-srv-";
export const normName = n => String(n ?? "").normalize("NFC").trim().toLocaleLowerCase("de-DE");
export const validUsername = n => /^[\p{L}\p{N}._-]{3,32}$/u.test(String(n ?? "").normalize("NFC").trim());
export const readCache = name => rget(CACHE_PREFIX + normName(name), null);
export const cachedAccounts = () => Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX))
  .map(k => rget(k, null)).filter(c => c?.username).sort((a, b) => a.username.localeCompare(b.username, "de"));
const deviceLabel = () => `Browser · ${navigator.userAgentData?.platform || navigator.platform || "unbekannt"}`;
const box = async (key, data) => ({ v: 1, ...(await seal(key, data)) });

export class ServerStore {
  // hooks: getData() → aktueller Tresor-Inhalt, setData(d) → vom Server übernommener Stand,
  //        isDirty() → lokale Änderung noch nicht gespeichert, onStatus(status, meldung)
  constructor({ username, salt, iter, encKey, version, pending = false, createdAt, hooks }) {
    Object.assign(this, { username, salt, iter, encKey, version, pending, createdAt, hooks, status: "ok", message: "" });
    this.chain = Promise.resolve();
  }

  /* ---- Anmelden / Registrieren ---- */
  static async login(username, pw, hooks) {
    const cache = readCache(username);
    let kdf;
    try { kdf = await api("POST", "/api/auth/prelogin", { username }); }
    catch (e) {
      if (!(e instanceof OfflineError)) throw e;
      if (!cache) throw new Error("Server nicht erreichbar – und auf diesem Gerät gibt es noch keine Offline-Kopie dieses Kontos.", { cause: e });
      const keys = await deriveServerKeys(pw, cache.salt, cache.iter);
      let data;
      try { data = await openBlob(keys.encKey, cache.blob); } catch (e) { throw new Error("Falsches Passwort.", { cause: e }); }
      const store = new ServerStore({ ...cache, encKey: keys.encKey, hooks });
      store.setStatus("offline", "Offline – Änderungen werden später übertragen.");
      return { store, data, user: { username: cache.username, createdAt: cache.createdAt } };
    }
    const keys = await deriveServerKeys(pw, kdf.salt, kdf.iter);
    // Gültige Sitzung (Cookie) für dieses Konto? Dann ist keine neue Anmeldung nötig – das Passwort
    // wird trotzdem geprüft, denn ohne richtiges Passwort lässt sich der Tresor nicht entschlüsseln.
    let user = null;
    try { const me = await api("GET", "/api/auth/me"); if (normName(me.user.username) === normName(username)) user = me.user; } catch {}
    user ||= (await api("POST", "/api/auth/login", { username, authKey: keys.authKey, client: "web", label: deviceLabel() })).user;

    const r = await api("GET", "/api/vault");
    let data;
    try { data = await openBlob(keys.encKey, r.blob); } catch (e) { throw new Error("Falsches Passwort.", { cause: e }); }
    let pending = false, lostPending = false;
    if (cache?.pending && normName(cache.username) === normName(user.username)) {
      // Offline-Änderungen dieses Geräts übernehmen (gleiche Basis: direkt, sonst zusammenführen)
      try { const local = await openBlob(keys.encKey, cache.blob); data = cache.version === r.version ? local : mergeData(local, data); pending = true; }
      catch { lostPending = true; }                                           // Passwort wurde inzwischen woanders geändert
    }
    const store = new ServerStore({ username: user.username, salt: kdf.salt, iter: kdf.iter, encKey: keys.encKey,
      version: r.version, pending, createdAt: user.createdAt, hooks });
    store.writeCache(pending ? await box(keys.encKey, data) : r.blob, pending);
    return { store, data, user, lostPending };
  }

  static async register({ username, pw, invite, initial, iter }, hooks) {
    const salt = toB64(randomBytes(16)), keys = await deriveServerKeys(pw, salt, iter);
    const blob = await box(keys.encKey, initial);
    const r = await api("POST", "/api/auth/register",
      { username, invite: invite || undefined, salt, iter, authKey: keys.authKey, vault: blob, client: "web", label: deviceLabel() });
    const store = new ServerStore({ username: r.user.username, salt, iter, encKey: keys.encKey, version: r.vault.version, createdAt: r.user.createdAt, hooks });
    store.writeCache(blob, false);
    return { store, data: initial, user: r.user };
  }

  /* ---- Abgleich ---- */
  run(fn) { const p = this.chain.then(fn); this.chain = p.catch(() => {}); return p; }   // nacheinander, nie parallel

  setStatus(status, message = "") {
    this.status = status; this.message = message;
    this.hooks.onStatus?.(status, message);
  }
  writeCache(blob, pending) {
    this.pending = pending;
    try {
      rset(CACHE_PREFIX + normName(this.username), { username: this.username, salt: this.salt, iter: this.iter,
        version: this.version, blob, pending, createdAt: this.createdAt, savedAt: Date.now() });
    } catch (e) { console.error(e); this.setStatus("error", "Offline-Kopie konnte nicht gespeichert werden (Speicher voll?)."); }
  }
  fail(e) {
    if (e instanceof OfflineError) this.setStatus("offline", "Offline – Änderungen werden übertragen, sobald der Server erreichbar ist.");
    else if (e instanceof ApiError && e.status === 401) this.setStatus("auth", "Sitzung abgelaufen – bitte sperren und neu anmelden.");
    else { console.error(e); this.setStatus("error", e.message || String(e)); }
  }

  // Aktuellen Stand verschlüsseln, lokal ablegen und hochladen. Bei Konflikt (409): zusammenführen und erneut.
  save() {
    return this.run(async () => {
      let blob = await box(this.encKey, this.hooks.getData());
      this.writeCache(blob, true);
      await this.push(blob);
    });
  }
  async push(blob) {
    this.setStatus("saving");
    for (let i = 0; i < 4; i++) {
      try {
        const r = await api("PUT", "/api/vault", { blob, baseVersion: this.version });
        this.version = r.version; this.writeCache(blob, false); this.setStatus("ok");
        return;
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 409)) return this.fail(e);
        const remote = await openBlob(this.encKey, e.body.blob);
        this.version = e.body.version;
        const merged = mergeData(this.hooks.getData(), remote);
        this.hooks.setData(merged);
        blob = await box(this.encKey, merged);
        this.writeCache(blob, true);
      }
    }
    this.setStatus("error", "Abgleich mehrfach fehlgeschlagen – bitte später erneut versuchen.");
  }
  // Neuen Stand vom Server holen (falls sich etwas geändert hat); ausstehende eigene Änderungen zuerst hochladen
  pull() {
    return this.run(async () => {
      if (this.hooks.isDirty?.()) return;                                    // gleich folgt ohnehin save()
      if (this.pending) return this.push(await box(this.encKey, this.hooks.getData()));
      try {
        const r = await api("GET", "/api/vault");
        if (r.version !== this.version) {
          const remote = await openBlob(this.encKey, r.blob);
          this.version = r.version; this.writeCache(r.blob, false);
          this.hooks.setData(remote);
        }
        this.setStatus("ok");
      } catch (e) { this.fail(e); }
    });
  }
  // Regelmäßig und bei Fokus/Wiederverbindung abgleichen
  startAutoSync() {
    const tick = () => { if (!document.hidden) this.pull(); };
    addEventListener("focus", tick); addEventListener("online", tick);
    setInterval(tick, 60000);
  }

  /* ---- Konto ---- */
  changePassword(oldPw, newPw) {
    return this.run(async () => {
      if (this.pending) await this.push(await box(this.encKey, this.hooks.getData()));
      if (this.pending) throw new Error("Passwort ändern braucht eine Verbindung zum Server.");
      const old = await deriveServerKeys(oldPw, this.salt, this.iter);
      const salt = toB64(randomBytes(16)), nk = await deriveServerKeys(newPw, salt, this.iter);
      const blob = await box(nk.encKey, this.hooks.getData());
      let r;
      try { r = await api("POST", "/api/auth/password", { authKey: old.authKey, newSalt: salt, newIter: this.iter, newAuthKey: nk.authKey, vault: blob, baseVersion: this.version }); }
      catch (e) {
        if (e instanceof OfflineError) throw new Error("Passwort ändern braucht eine Verbindung zum Server.", { cause: e });
        if (e instanceof ApiError && e.status === 409) { setTimeout(() => this.pull()); throw new Error("Die Daten wurden gerade auf einem anderen Gerät geändert. Bitte gleich noch einmal versuchen.", { cause: e }); }
        throw e;
      }
      Object.assign(this, { encKey: nk.encKey, salt, version: r.vault.version });
      this.writeCache(blob, false); this.setStatus("ok");
    });
  }
  deleteAccount(pw) {
    return this.run(async () => {
      const k = await deriveServerKeys(pw, this.salt, this.iter);
      try { await api("DELETE", "/api/account", { authKey: k.authKey }); }
      catch (e) { if (e instanceof OfflineError) throw new Error("Konto löschen braucht eine Verbindung zum Server.", { cause: e }); throw e; }
      localStorage.removeItem(CACHE_PREFIX + normName(this.username));
    });
  }
  // Abmelden: Sitzung beenden und Offline-Kopie von diesem Gerät entfernen
  logout() {
    return this.run(async () => {
      try { await api("POST", "/api/auth/logout"); } catch {}
      localStorage.removeItem(CACHE_PREFIX + normName(this.username));
    });
  }
}
