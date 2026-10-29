import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { openDb } from "../src/db.js";
import { buildApp } from "../src/app.js";
import { run } from "../src/cli.js";
import { validEndpoint, processQueue } from "../src/push.js";

const CSRF = { "x-requested-with": "abomination" };
const EP = "https://fcm.googleapis.com/fcm/send/abc123";
const keys = { p256dh: "B" + "A".repeat(86), auth: "c".repeat(22) };
const enc = (s = "x") => "v1." + Buffer.from("geheim:" + s).toString("base64url");

let app, db, sent, failWith;
beforeEach(async () => {
  sent = []; failWith = null;
  const config = loadConfig({ REGISTRATION: "invite", COOKIE_SECURE: "false", PUSH_INTERVAL_MS: "600000", STATIC_DIR: path.join(os.tmpdir(), "abo-kein-dist") });
  db = openDb(":memory:");
  app = await buildApp({ config, db, logger: false, pushSend: async (sub, payload, ttl) => {
    if (failWith) { const e = new Error("weg"); e.statusCode = failWith; throw e; }
    sent.push({ endpoint: sub.endpoint, payload, ttl });
  } });
});
afterEach(async () => { await app.close(); db.close(); });

async function login(name = "Anna") {
  const code = run(["invite"], db, () => {});
  const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: {
    username: name, invite: code, salt: crypto.randomBytes(16).toString("base64"), iter: 600000,
    authKey: crypto.randomBytes(32).toString("base64"), vault: { v: 1, iv: crypto.randomBytes(12).toString("base64"), ct: Buffer.from("x".repeat(40)).toString("base64") } } });
  const c = res.cookies.find(x => x.name === "abo_session");
  return { cookie: `abo_session=${c.value}`, ...CSRF };
}
const req = (method, url, h, payload) => app.inject({ method, url, headers: h, payload });

describe("Push-Benachrichtigungen", () => {
  it("liefert den öffentlichen Schlüssel, stabil über Neustarts der App", async () => {
    const k = (await app.inject("/api/push/key")).json().publicKey;
    expect(k).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    expect(db.prepare("SELECT value FROM meta WHERE key = 'vapid'").get()).toBeTruthy();
  });

  it("nimmt nur echte Push-Dienste als Ziel an", async () => {
    expect(validEndpoint(EP)).toBe(true);
    expect(validEndpoint("https://web.push.apple.com/QGx")).toBe(true);
    expect(validEndpoint("https://wns2-db5p.notify.windows.com/w/?token=x")).toBe(true);
    expect(validEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(validEndpoint("https://evil.example.com/fcm.googleapis.com")).toBe(false);
    expect(validEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(validEndpoint("https://localhost/x")).toBe(false);
    const h = await login();
    expect((await req("POST", "/api/push/subscribe", h, { endpoint: "https://169.254.169.254/latest", keys })).statusCode).toBe(400);
  });

  it("Gerät an- und abmelden, Status abrufen (nur angemeldet)", async () => {
    expect((await req("POST", "/api/push/subscribe", {}, { endpoint: EP, keys })).statusCode).toBe(401);
    const h = await login();
    expect((await req("POST", "/api/push/subscribe", h, { endpoint: EP, keys, label: "Handy" })).json()).toEqual({ ok: true });
    expect((await req("POST", "/api/push/subscribe", h, { endpoint: EP, keys })).statusCode).toBe(200);   // erneut: kein Duplikat
    let st = (await req("GET", "/api/push/status", h)).json();
    expect(st.devices).toHaveLength(1);
    await req("DELETE", "/api/push/subscribe", h, { endpoint: EP });
    st = (await req("GET", "/api/push/status", h)).json();
    expect(st.devices).toHaveLength(0);
  });

  it("ersetzt den Plan und verschickt fällige Einträge an alle Geräte des Kontos", async () => {
    const a = await login("Anna"), b = await login("Bert");
    await req("POST", "/api/push/subscribe", a, { endpoint: EP, keys });
    await req("POST", "/api/push/subscribe", a, { endpoint: EP + "zwei", keys });
    await req("POST", "/api/push/subscribe", b, { endpoint: EP + "bert", keys });
    const now = Date.now();
    await req("PUT", "/api/push/schedule", a, { items: [{ at: now + 3600000, payload: enc("alt") }] });
    const r = (await req("PUT", "/api/push/schedule", a, { items: [{ at: now - 1000, payload: enc("jetzt") }, { at: now + 86400000, payload: enc("morgen") }, { at: now - 7200000, payload: enc("zu alt") }] })).json();
    expect(r.queued).toBe(2);                                                   // ersetzt, zu alte verworfen
    expect((await req("GET", "/api/push/status", a)).json().queued).toBe(2);
    expect(await processQueue(db, (s, p, t) => { sent.push({ endpoint: s.endpoint, payload: p, ttl: t }); }, null)).toBe(1);
    expect(sent.map(s => s.endpoint).sort()).toEqual([EP, EP + "zwei"]);       // nur Annas Geräte
    expect(sent[0].payload).toBe(enc("jetzt"));
    expect(await processQueue(db, () => {}, null)).toBe(0);                     // nicht doppelt
  });

  it("Test sofort senden; abgelaufene Geräte werden entfernt", async () => {
    const h = await login();
    await req("POST", "/api/push/subscribe", h, { endpoint: EP, keys });
    expect((await req("POST", "/api/push/test", h, { payload: enc("test") })).json()).toEqual({ sent: 1, failed: 0 });
    failWith = 410;
    expect((await req("POST", "/api/push/test", h, { payload: enc("test") })).json()).toEqual({ sent: 0, failed: 1 });
    expect((await req("GET", "/api/push/status", h)).json().devices).toHaveLength(0);
  });

  it("prüft die Eingaben", async () => {
    const h = await login();
    expect((await req("PUT", "/api/push/schedule", h, { items: [{ at: 1, payload: "x" }] })).statusCode).toBe(400);
    expect((await req("PUT", "/api/push/schedule", h, { items: Array.from({ length: 301 }, () => ({ at: Date.now() + 1e6, payload: enc() })) })).statusCode).toBe(400);
    expect((await req("POST", "/api/push/subscribe", h, { endpoint: EP, keys: { p256dh: "kurz", auth: "x" } })).statusCode).toBe(400);
  });
});
