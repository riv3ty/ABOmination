import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { openDb } from "../src/db.js";
import { buildApp, buildCsp } from "../src/app.js";
import { run } from "../src/cli.js";

const key = () => crypto.randomBytes(32).toString("base64");
const salt = () => crypto.randomBytes(16).toString("base64");
const blob = (n = 1) => ({ v: 1, iv: crypto.randomBytes(12).toString("base64"), ct: Buffer.from("geheim-" + n + "-".repeat(20)).toString("base64") });
const CSRF = { "x-requested-with": "abomination" };

let app, db, config;
async function setup(env = {}) {
  config = loadConfig({ REGISTRATION: "invite", COOKIE_SECURE: "false", STATIC_DIR: path.join(os.tmpdir(), "abo-kein-dist"), ...env });
  db = openDb(":memory:");
  app = await buildApp({ config, db, logger: false });
}
const invite = (uses = 1) => run(["invite", "--uses", String(uses)], db, () => {});
const post = (url, payload, headers = {}) => app.inject({ method: "POST", url, payload, headers });
const cookieOf = res => res.cookies.find(c => c.name === "abo_session");
const withCookie = (res, extra = {}) => ({ cookie: `abo_session=${cookieOf(res).value}`, ...extra });

async function register(username = "Anna", opts = {}) {
  const k = key(), s = salt();
  const res = await post("/api/auth/register", { username, invite: opts.invite ?? invite(), salt: s, iter: 600000, authKey: k, vault: blob(), ...opts.extra });
  return { res, key: k, salt: s };
}

beforeEach(() => setup());
afterEach(async () => { await app.close(); db.close(); });

describe("Grundlagen", () => {
  it("health und config", async () => {
    expect((await app.inject("/api/health")).json()).toMatchObject({ ok: true });
    const c = (await app.inject("/api/config")).json();
    expect(c).toMatchObject({ registration: "invite", kdf: { name: "PBKDF2-SHA256", defaultIter: 600000 } });
  });

  it("Sicherheits-Header, kein Caching der API, JSON-404", async () => {
    const r = await app.inject("/api/health");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.headers["x-frame-options"]).toBe("DENY");
    expect(r.headers["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
    const nf = await app.inject("/gibtsnicht");
    expect(nf.statusCode).toBe(404);
    expect(nf.json().error).toBe("not_found");
  });
});

describe("Registrierung", () => {
  it("nur mit gültigem Einladungscode; Code ist einmalig", async () => {
    expect((await register("Anna", { invite: "FALSCH" })).res.statusCode).toBe(403);
    const code = invite();
    const a = await register("Anna", { invite: code });
    expect(a.res.statusCode).toBe(201);
    expect(a.res.json()).toMatchObject({ user: { username: "Anna" }, vault: { version: 1 } });
    const c = cookieOf(a.res);
    expect(c).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/api" });
    expect(a.res.json().token).toBeUndefined();                          // Web: Token nur im Cookie
    expect((await register("Bert", { invite: code.toLowerCase() })).res.json().error).toBe("invalid_invite");
  });

  it("Name ist eindeutig (ohne Groß/Klein) und wird geprüft", async () => {
    const code = invite(3);
    expect((await register("Anna", { invite: code })).res.statusCode).toBe(201);
    expect((await register("ANNA", { invite: code })).res.json().error).toBe("username_taken");
    expect((await register("a b", { invite: code })).res.json().error).toBe("invalid_username");
  });

  it("ungültige Tresor- oder Schlüsseldaten werden abgelehnt", async () => {
    const r = await post("/api/auth/register", { username: "Anna", invite: invite(), salt: salt(), iter: 1000, authKey: key(), vault: blob() });
    expect(r.statusCode).toBe(400);                                      // zu wenige Iterationen
    const r2 = await post("/api/auth/register", { username: "Anna", invite: invite(), salt: salt(), iter: 600000, authKey: key(), vault: { v: 1, iv: "x", ct: "y" } });
    expect(r2.statusCode).toBe(400);
  });

  it("offen bzw. geschlossen per Konfiguration", async () => {
    await app.close(); await setup({ REGISTRATION: "open" });
    expect((await register("Anna", { invite: "" })).res.statusCode).toBe(201);
    await app.close(); await setup({ REGISTRATION: "closed" });
    expect((await register("Anna")).res.json().error).toBe("registration_closed");
  });
});

describe("Anmeldung", () => {
  it("Prelogin: echtes Salz für Konten, stabiles Scheinsalz sonst", async () => {
    const { salt: s } = await register("Anna");
    expect((await post("/api/auth/prelogin", { username: "anna" })).json()).toMatchObject({ salt: s, iter: 600000 });
    const x1 = (await post("/api/auth/prelogin", { username: "niemand" })).json();
    const x2 = (await post("/api/auth/prelogin", { username: "niemand" })).json();
    const y = (await post("/api/auth/prelogin", { username: "jemand" })).json();
    expect(x1.salt).toBe(x2.salt);
    expect(x1.salt).not.toBe(y.salt);
    expect(x1.salt).toHaveLength(24);
  });

  it("falsches Passwort 401, richtiges setzt Cookie; App bekommt Token", async () => {
    const { key: k } = await register("Anna");
    const bad = await post("/api/auth/login", { username: "Anna", authKey: key() });
    expect(bad.statusCode).toBe(401);
    expect((await post("/api/auth/login", { username: "Unbekannt", authKey: key() })).statusCode).toBe(401);
    const web = await post("/api/auth/login", { username: "anna", authKey: k });
    expect(web.statusCode).toBe(200);
    expect(cookieOf(web)).toBeTruthy();
    const me = await app.inject({ url: "/api/auth/me", headers: withCookie(web) });
    expect(me.json().user.username).toBe("Anna");

    const appLogin = await post("/api/auth/login", { username: "Anna", authKey: k, client: "app", label: "Pixel 9" });
    expect(cookieOf(appLogin)).toBeUndefined();
    const { token } = appLogin.json();
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const me2 = await app.inject({ url: "/api/auth/me", headers: { authorization: "Bearer " + token } });
    expect(me2.json().session.kind).toBe("app");
  });

  it("viele gleichzeitige Anmeldungen werden abgearbeitet (scrypt-Begrenzung staut, verliert aber nichts)", async () => {
    const { key: k } = await register("Anna");
    const res = await Promise.all(Array.from({ length: 12 }, () => post("/api/auth/login", { username: "Anna", authKey: k, client: "app" })));
    expect(res.map(r => r.statusCode)).toEqual(Array(12).fill(200));
  });

  it("nach 5 Fehlversuchen wird gebremst (auch mit richtigem Passwort)", async () => {
    const { key: k } = await register("Anna");
    for (let i = 0; i < 5; i++) await post("/api/auth/login", { username: "Anna", authKey: key() });
    const r = await post("/api/auth/login", { username: "Anna", authKey: k });
    expect(r.statusCode).toBe(429);
    expect(Number(r.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("ohne Anmeldung kein Zugriff", async () => {
    expect((await app.inject("/api/vault")).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/vault", headers: { authorization: "Bearer falsch" } })).statusCode).toBe(401);
  });

  it("Geräteliste, fremde Sitzung abmelden, Logout", async () => {
    const { res, key: k } = await register("Anna");
    const phone = (await post("/api/auth/login", { username: "Anna", authKey: k, client: "app", label: "Handy" })).json();
    const list = (await app.inject({ url: "/api/auth/sessions", headers: withCookie(res) })).json().sessions;
    expect(list).toHaveLength(2);
    expect(list.find(s => s.current).kind).toBe("web");
    const del = await app.inject({ method: "DELETE", url: "/api/auth/sessions/" + phone.sessionId, headers: withCookie(res, CSRF) });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ url: "/api/auth/me", headers: { authorization: "Bearer " + phone.token } })).statusCode).toBe(401);
    const out = await app.inject({ method: "POST", url: "/api/auth/logout", headers: withCookie(res, CSRF) });
    expect(out.statusCode).toBe(204);
    expect((await app.inject({ url: "/api/auth/me", headers: withCookie(res) })).statusCode).toBe(401);
  });
});

describe("Tresor", () => {
  it("lesen, schreiben mit Version, Konflikt liefert aktuellen Stand", async () => {
    const { res } = await register("Anna");
    const h = withCookie(res, CSRF);
    expect((await app.inject({ url: "/api/vault", headers: h })).json()).toMatchObject({ version: 1 });
    const b2 = blob(2);
    const put = await app.inject({ method: "PUT", url: "/api/vault", headers: h, payload: { blob: b2, baseVersion: 1 } });
    expect(put.json()).toMatchObject({ version: 2 });
    const stale = await app.inject({ method: "PUT", url: "/api/vault", headers: h, payload: { blob: blob(3), baseVersion: 1 } });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: "conflict", version: 2, blob: b2 });
  });

  it("CSRF: Cookie-Anfragen brauchen X-Requested-With, Bearer nicht", async () => {
    const { res, key: k } = await register("Anna");
    const noHeader = await app.inject({ method: "PUT", url: "/api/vault", headers: withCookie(res), payload: { blob: blob(), baseVersion: 1 } });
    expect(noHeader.statusCode).toBe(403);
    const { token } = (await post("/api/auth/login", { username: "Anna", authKey: k, client: "app" })).json();
    const bearer = await app.inject({ method: "PUT", url: "/api/vault", headers: { authorization: "Bearer " + token }, payload: { blob: blob(), baseVersion: 1 } });
    expect(bearer.statusCode).toBe(200);
  });

  it("Tresore sind pro Konto getrennt; zu große Tresore werden abgelehnt", async () => {
    const a = await register("Anna"), b = await register("Bert");
    const bb = blob(9);
    await app.inject({ method: "PUT", url: "/api/vault", headers: withCookie(b.res, CSRF), payload: { blob: bb, baseVersion: 1 } });
    expect((await app.inject({ url: "/api/vault", headers: withCookie(a.res) })).json().blob).not.toEqual(bb);
    const huge = { v: 1, iv: blob().iv, ct: "A".repeat(config.maxVaultBytes + 100000) };
    const r = await app.inject({ method: "PUT", url: "/api/vault", headers: withCookie(a.res, CSRF), payload: { blob: huge, baseVersion: 1 } });
    expect(r.statusCode).toBe(413);
  });
});

describe("Passwort und Konto", () => {
  it("Passwort ändern: atomar, andere Geräte abgemeldet, alter Schlüssel ungültig", async () => {
    const { res, key: k } = await register("Anna");
    const phone = (await post("/api/auth/login", { username: "Anna", authKey: k, client: "app" })).json();
    const h = withCookie(res, CSRF), nk = key(), ns = salt();
    const body = { authKey: k, newSalt: ns, newIter: 700000, newAuthKey: nk, vault: blob(5), baseVersion: 1 };
    expect((await app.inject({ method: "POST", url: "/api/auth/password", headers: h, payload: { ...body, authKey: key() } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/auth/password", headers: h, payload: { ...body, baseVersion: 7 } })).statusCode).toBe(409);
    const ok = await app.inject({ method: "POST", url: "/api/auth/password", headers: h, payload: body });
    expect(ok.json()).toMatchObject({ vault: { version: 2 } });
    expect((await app.inject({ url: "/api/auth/me", headers: { authorization: "Bearer " + phone.token } })).statusCode).toBe(401);
    expect((await app.inject({ url: "/api/auth/me", headers: withCookie(res) })).statusCode).toBe(200);
    expect((await post("/api/auth/prelogin", { username: "Anna" })).json()).toMatchObject({ salt: ns, iter: 700000 });
    expect((await post("/api/auth/login", { username: "Anna", authKey: k })).statusCode).toBe(401);
    expect((await post("/api/auth/login", { username: "Anna", authKey: nk })).statusCode).toBe(200);
  });

  it("Konto löschen entfernt Tresor und Sitzungen", async () => {
    const { res, key: k } = await register("Anna");
    const del = await app.inject({ method: "DELETE", url: "/api/account", headers: withCookie(res, CSRF), payload: { authKey: k } });
    expect(del.statusCode).toBe(204);
    expect(db.prepare("SELECT COUNT(*) n FROM vaults").get().n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM sessions").get().n).toBe(0);
    expect((await post("/api/auth/login", { username: "Anna", authKey: k })).statusCode).toBe(401);
  });
});

describe("Verwaltung (CLI)", () => {
  it("users, logout-all, delete-user mit Bestätigung", async () => {
    await register("Anna");
    const out = [];
    expect(run(["users"], db, s => out.push(s))).toHaveLength(1);
    expect(out[0]).toMatch(/^Anna · seit .* · Tresor v1 .* 1 Sitzung/);
    expect(run(["logout-all", "anna"], db, () => {})).toBe(1);
    expect(() => run(["delete-user", "Anna"], db, () => {})).toThrow(/--yes/);
    expect(run(["delete-user", "Anna", "--yes"], db, () => {})).toBe(true);
    expect(() => run(["logout-all", "Anna"], db, () => {})).toThrow(/nicht gefunden/);
    expect(run(["invites"], db, () => {})).toHaveLength(0);              // die von register() genutzte ist verbraucht
    invite(2);
    expect(run(["invites"], db, () => {})).toHaveLength(1);
  });
});

describe("Wechselkurse", () => {
  const withRates = async fetchImpl => { await app.close(); config = loadConfig({ STATIC_DIR: "x" }); db = openDb(":memory:"); app = await buildApp({ config, db, logger: false, fetchImpl }); };
  const ok = body => async () => ({ ok: true, json: async () => body });

  it("holt einmal, liefert danach aus dem Zwischenspeicher", async () => {
    let calls = 0;
    await withRates(async () => { calls++; return ok({ date: "2026-09-25", rates: { USD: 1.17, CHF: 0.94 } })(); });
    const a = (await app.inject("/api/rates")).json(), b = (await app.inject("/api/rates")).json();
    expect(a).toMatchObject({ date: "2026-09-25", rates: { USD: 1.17, CHF: 0.94 } });
    expect(b.fetchedAt).toBe(a.fetchedAt);
    expect(calls).toBe(1);
  });

  it("filtert unplausible Werte und meldet 503, wenn nichts verfügbar ist", async () => {
    await withRates(ok({ date: "2026-09-25", rates: { USD: 1.1, "<x>": 5, GBP: -1, JPY: "viel" } }));
    expect((await app.inject("/api/rates")).json().rates).toEqual({ USD: 1.1 });
    await withRates(async () => { throw new Error("offline"); });
    const r = await app.inject("/api/rates");
    expect(r.statusCode).toBe(503);
    expect(r.json().error).toBe("rates_unavailable");
  });
});

describe("Hinter dem Reverse Proxy", () => {
  it("übernimmt https und Client-IP aus den Proxy-Headern (Sperre pro echter IP)", async () => {
    await app.close(); await setup({ TRUST_PROXY: "true" });
    const { key: k } = await register("Anna");
    const viaProxy = (ip, authKey) => post("/api/auth/login", { username: "Anna", authKey }, { "x-forwarded-for": ip, "x-forwarded-proto": "https" });
    for (let i = 0; i < 5; i++) await viaProxy("203.0.113.7", key());
    expect((await viaProxy("203.0.113.7", k)).statusCode).toBe(429);        // Angreifer gesperrt …
    const ok = await viaProxy("198.51.100.20", k);                           // … andere Nutzer hinter demselben Proxy nicht
    expect(ok.statusCode).toBe(200);
    expect(ok.headers["strict-transport-security"]).toContain("max-age=");
  });

  it("ohne TRUST_PROXY werden Proxy-Header ignoriert", async () => {
    const r = await app.inject({ url: "/api/health", headers: { "x-forwarded-proto": "https" } });
    expect(r.headers["strict-transport-security"]).toBeUndefined();
  });
});

describe("Sicherung (CLI)", () => {
  it("backup schreibt eine lesbare Kopie und räumt alte auf", async () => {
    await register("Anna");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "abo-backup-"));
    const f = run(["backup"], db, () => {}, { dataDir: dir });
    const copy = openDb(f);
    expect(copy.prepare("SELECT display FROM users").get().display).toBe("Anna");
    copy.close();
    for (const n of ["2020-01-01-00-00", "2020-01-02-00-00", "2020-01-03-00-00"]) fs.writeFileSync(path.join(dir, "backups", `abomination-${n}.db`), "");
    run(["backup", "--keep", "2"], db, () => {}, { dataDir: dir });
    expect(fs.readdirSync(path.join(dir, "backups")).length).toBe(2);
    expect(() => run(["backup", f], db, () => {})).toThrow(/existiert bereits/);
  });
});

describe("Web-App ausliefern", () => {
  it("CSP enthält Hashes der Inline-Skripte", () => {
    const csp = buildCsp('<script>alert(1)</script><script type="module">x()</script><script src="a.js"></script>');
    const h = s => "'sha256-" + crypto.createHash("sha256").update(s).digest("base64") + "'";
    expect(csp).toContain(h("alert(1)"));
    expect(csp).toContain(h("x()"));
    expect(csp).toContain("frame-ancestors 'none'");
    expect(buildCsp("<script>a()\r\nb()\r</script>")).toContain(h("a()\nb()\n"));     // wie der Browser: Zeilenenden normalisiert
  });

  it("liefert index.html mit CSP aus", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "abo-dist-"));
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><script>1</script>");
    fs.writeFileSync(path.join(dir, "sw.js"), "self.addEventListener('fetch', () => {});");
    fs.writeFileSync(path.join(dir, "manifest.webmanifest"), "{}");
    fs.mkdirSync(path.join(dir, "icons")); fs.writeFileSync(path.join(dir, "icons", "icon-192.png"), "png");
    await app.close(); await setup({ STATIC_DIR: dir });
    const r = await app.inject("/");
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-security-policy"]).toContain("script-src 'self' 'sha256-");
    expect(r.headers["cache-control"]).toBe("no-cache");
    const sw = await app.inject("/sw.js"), mf = await app.inject("/manifest.webmanifest"), ic = await app.inject("/icons/icon-192.png");
    expect(sw.headers["cache-control"]).toBe("no-cache");                   // Service-Worker-Updates sofort erkennen
    expect(sw.headers["content-type"]).toMatch(/javascript/);
    expect(mf.headers["content-type"]).toMatch(/manifest\+json/);
    expect(ic.headers["cache-control"]).toContain("max-age");
  });
});
