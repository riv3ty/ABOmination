// Push-Benachrichtigungen: Geräte anmelden/abmelden, verschlüsselten Erinnerungsplan hinterlegen, Test senden.
import { tx } from "../db.js";
import { validEndpoint, sendToUser } from "../push.js";

const MAX_SUBS = 10, MAX_ITEMS = 300, MAX_PAYLOAD = 2048, MAX_AHEAD = 400 * 86400000;
const b64url = (min, max) => ({ type: "string", minLength: min, maxLength: max, pattern: "^[A-Za-z0-9_-]+={0,2}$" });
const subSchema = {
  type: "object", additionalProperties: false, required: ["endpoint", "keys"],
  properties: {
    endpoint: { type: "string", minLength: 10, maxLength: 1000 },
    keys: { type: "object", additionalProperties: false, required: ["p256dh", "auth"], properties: { p256dh: b64url(80, 100), auth: b64url(16, 32) } },
    label: { type: "string", maxLength: 80 }
  }
};
const payload = { type: "string", minLength: 10, maxLength: MAX_PAYLOAD };

export default async function pushRoutes(app, { db, keys, send }) {
  // Öffentlicher Schlüssel für pushManager.subscribe()
  app.get("/api/push/key", async () => ({ publicKey: keys.publicKey }));

  app.get("/api/push/status", { preHandler: app.requireAuth }, async req => {
    const uid = req.session.user.id;
    const subs = db.prepare("SELECT endpoint, label, created_at, last_ok FROM push_subs WHERE user_id = ? ORDER BY created_at").all(uid);
    const q = db.prepare("SELECT COUNT(*) AS n, MIN(at) AS next FROM push_queue WHERE user_id = ?").get(uid);
    return { devices: subs.map(s => ({ endpoint: s.endpoint, label: s.label, createdAt: s.created_at, lastOk: s.last_ok })), queued: q.n, next: q.next };
  });

  app.post("/api/push/subscribe", { preHandler: app.requireAuth, schema: { body: subSchema } }, async (req, reply) => {
    const uid = req.session.user.id, { endpoint, keys: k, label = "" } = req.body;
    if (!validEndpoint(endpoint)) return reply.code(400).send({ error: "invalid_endpoint", message: "Unbekannter Push-Dienst." });
    const res = tx(db, () => {
      const other = db.prepare("SELECT user_id FROM push_subs WHERE endpoint = ?").get(endpoint);
      if (!other) {
        const n = db.prepare("SELECT COUNT(*) AS n FROM push_subs WHERE user_id = ?").get(uid).n;
        if (n >= MAX_SUBS) return "limit";
      }
      // Gleiches Gerät erneut (oder nach Kontowechsel): Eintrag übernehmen
      db.prepare(`INSERT INTO push_subs (user_id, endpoint, p256dh, auth, label, created_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, label = excluded.label`)
        .run(uid, endpoint, k.p256dh, k.auth, label.slice(0, 80), Date.now());
      return "ok";
    });
    if (res === "limit") return reply.code(409).send({ error: "limit", message: `Höchstens ${MAX_SUBS} Geräte pro Konto.` });
    return { ok: true };
  });

  app.delete("/api/push/subscribe", { preHandler: app.requireAuth, schema: { body: { type: "object", required: ["endpoint"], properties: { endpoint: { type: "string", maxLength: 1000 } } } } }, async req => {
    db.prepare("DELETE FROM push_subs WHERE user_id = ? AND endpoint = ?").run(req.session.user.id, req.body.endpoint);
    return { ok: true };
  });

  // Erinnerungsplan ersetzen (der Client schickt immer den vollständigen Plan der nächsten Wochen)
  app.put("/api/push/schedule", {
    preHandler: app.requireAuth,
    schema: { body: { type: "object", additionalProperties: false, required: ["items"], properties: {
      items: { type: "array", maxItems: MAX_ITEMS, items: { type: "object", additionalProperties: false, required: ["at", "payload"],
        properties: { at: { type: "integer", minimum: 0 }, payload } } } } } }
  }, async req => {
    const uid = req.session.user.id, now = Date.now();
    const items = req.body.items.filter(i => i.at > now - 60000 && i.at < now + MAX_AHEAD);
    tx(db, () => {
      db.prepare("DELETE FROM push_queue WHERE user_id = ?").run(uid);
      const ins = db.prepare("INSERT INTO push_queue (user_id, at, payload) VALUES (?, ?, ?)");
      for (const i of items) ins.run(uid, i.at, i.payload);
    });
    return { ok: true, queued: items.length };
  });

  // Testnachricht sofort an alle Geräte des Kontos
  app.post("/api/push/test", {
    preHandler: app.requireAuth, config: { rateLimit: { max: 6, timeWindow: "1 minute" } },
    schema: { body: { type: "object", additionalProperties: false, required: ["payload"], properties: { payload } } }
  }, async req => sendToUser(db, send, req.session.user.id, req.body.payload, req.log, 600));
}
