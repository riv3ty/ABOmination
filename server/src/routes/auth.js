// Konten: Prelogin (Salz), Registrierung, Anmeldung, Sessions/Geräte, Passwort ändern, Konto löschen
import { tx } from "../db.js";
import { hashAuthKey, verifyAuthKey, burnAuthCheck, fakeSalt, normalizeUsername, b64Bytes, sha256, normalizeInvite } from "../security.js";
import { COOKIE, createSession, cookieOptions } from "../sessions.js";
import * as S from "../schemas.js";

export default async function authRoutes(app, { config, db, secret, throttle }) {
  const limit = { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };
  const err = (reply, code, error, message, extra) => reply.code(code).send({ error, message, ...extra });
  const publicUser = u => ({ username: u.display, createdAt: u.created_at ?? u.createdAt });

  // Session anlegen: Web bekommt ein httpOnly-Cookie, die App das Token im Body
  function startSession(reply, userId, clientKind, label) {
    const kind = clientKind === "app" ? "app" : "web";
    const s = createSession(db, config, userId, kind, (label || (kind === "app" ? "App" : "Browser")).slice(0, 80));
    if (kind === "web") reply.setCookie(COOKIE, s.token, cookieOptions(config));
    return kind === "app" ? { token: s.token, sessionId: s.id } : { sessionId: s.id };
  }
  // Falsches Passwort bremsen (pro IP und Name)
  function throttled(req, reply, name) {
    const ms = throttle.retryAfter(req.ip, name);
    if (!ms) return false;
    reply.header("Retry-After", Math.ceil(ms / 1000));
    err(reply, 429, "too_many_attempts", "Zu viele Fehlversuche. Bitte später erneut versuchen.", { retryAfter: Math.ceil(ms / 1000) });
    return true;
  }

  app.post("/api/auth/prelogin", { ...limit, schema: S.body({ username: S.username }) }, async req => {
    const n = normalizeUsername(req.body.username);
    const u = n && db.prepare("SELECT kdf_salt, kdf_iter FROM users WHERE username = ?").get(n.key);
    return u ? { kdf: S.KDF.name, salt: u.kdf_salt, iter: u.kdf_iter }
             : { kdf: S.KDF.name, salt: fakeSalt(secret, n ? n.key : String(req.body.username)), iter: S.KDF.defaultIter };
  });

  app.post("/api/auth/register", {
    ...limit,
    schema: S.body({ username: S.username, invite: { type: "string", maxLength: 64 }, salt: S.salt, iter: S.iter,
      authKey: S.authKey, vault: S.blob, client: S.client, label: S.label }, ["username", "salt", "iter", "authKey", "vault"])
  }, async (req, reply) => {
    if (config.registration === "closed") return err(reply, 403, "registration_closed", "Registrierung ist deaktiviert.");
    const b = req.body, n = normalizeUsername(b.username), key = b64Bytes(b.authKey, 32);
    if (!n) return err(reply, 400, "invalid_username", "Name: 3–32 Zeichen, nur Buchstaben, Ziffern, Punkt, Unterstrich, Bindestrich.");
    if (!key || !b64Bytes(b.salt, 16)) return err(reply, 400, "invalid_key", "Ungültige Schlüsseldaten.");
    if (throttled(req, reply, "invite")) return;
    const authHash = await hashAuthKey(key), now = Date.now(), inviteHash = sha256(normalizeInvite(b.invite));
    const res = tx(db, () => {
      if (config.registration === "invite") {
        const inv = db.prepare("SELECT uses_left FROM invites WHERE code_hash = ? AND expires_at > ? AND uses_left > 0").get(inviteHash, now);
        if (!inv) return { error: "invalid_invite" };
        db.prepare("UPDATE invites SET uses_left = uses_left - 1 WHERE code_hash = ?").run(inviteHash);
      }
      if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(n.key)) return { error: "username_taken" };
      const id = Number(db.prepare(`INSERT INTO users (username, display, kdf_salt, kdf_iter, auth_hash, created_at, updated_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(n.key, n.display, b.salt, b.iter, authHash, now, now).lastInsertRowid);
      db.prepare("INSERT INTO vaults (user_id, version, blob, updated_at) VALUES (?, 1, ?, ?)").run(id, JSON.stringify(b.vault), now);
      return { id };
    });
    if (res.error === "invalid_invite") { throttle.fail(req.ip, "invite"); return err(reply, 403, "invalid_invite", "Einladungscode ungültig oder abgelaufen."); }
    if (res.error) return err(reply, 409, "username_taken", "Dieser Name ist schon vergeben.");
    req.log.info({ user: n.key }, "Konto angelegt");
    return reply.code(201).send({ user: { username: n.display, createdAt: now }, vault: { version: 1, updatedAt: now },
      ...startSession(reply, res.id, b.client, b.label) });
  });

  app.post("/api/auth/login", {
    ...limit, schema: S.body({ username: S.username, authKey: S.authKey, client: S.client, label: S.label }, ["username", "authKey"])
  }, async (req, reply) => {
    const n = normalizeUsername(req.body.username), name = n ? n.key : "?";
    if (throttled(req, reply, name)) return;
    const key = b64Bytes(req.body.authKey, 32);
    const u = n && key && db.prepare("SELECT * FROM users WHERE username = ?").get(n.key);
    const ok = u ? await verifyAuthKey(key, u.auth_hash) : (await burnAuthCheck(key || Buffer.alloc(32)), false);
    if (!ok) {
      throttle.fail(req.ip, name);
      req.log.warn({ user: name }, "Anmeldung fehlgeschlagen");
      return err(reply, 401, "invalid_credentials", "Name oder Passwort falsch.");
    }
    throttle.success(req.ip, name);
    return { user: publicUser(u), ...startSession(reply, u.id, req.body.client, req.body.label) };
  });

  app.post("/api/auth/logout", { preHandler: app.requireAuth }, async (req, reply) => {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(req.session.sessionId);
    reply.clearCookie(COOKIE, { path: "/api" });
    return reply.code(204).send();
  });

  app.get("/api/auth/me", { preHandler: app.requireAuth }, async req =>
    ({ user: publicUser(req.session.user), session: { id: req.session.sessionId, kind: req.session.kind } }));

  app.get("/api/auth/sessions", { preHandler: app.requireAuth }, async req => ({
    sessions: db.prepare("SELECT id, kind, label, created_at, last_seen FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen DESC")
      .all(req.session.user.id, Date.now())
      .map(s => ({ id: s.id, kind: s.kind, label: s.label, createdAt: s.created_at, lastSeen: s.last_seen, current: s.id === req.session.sessionId }))
  }));

  app.delete("/api/auth/sessions/:id", { preHandler: app.requireAuth }, async (req, reply) => {
    const r = db.prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?").run(req.params.id, req.session.user.id);
    return r.changes ? reply.code(204).send() : err(reply, 404, "not_found", "Sitzung nicht gefunden.");
  });

  // Aktuelles Passwort (authKey) prüfen; Fehlversuche zählen wie bei der Anmeldung
  async function checkCurrent(req, reply) {
    const name = req.session.user.username;
    if (throttled(req, reply, name)) return false;
    const u = db.prepare("SELECT auth_hash FROM users WHERE id = ?").get(req.session.user.id);
    const key = b64Bytes(req.body.authKey, 32);
    if (key && await verifyAuthKey(key, u.auth_hash)) return true;
    throttle.fail(req.ip, name);
    err(reply, 403, "invalid_credentials", "Aktuelles Passwort ist falsch.");
    return false;
  }

  // Passwort ändern = neues Salz + neuer authKey + neu verschlüsselter Tresor, atomar; andere Geräte werden abgemeldet
  app.post("/api/auth/password", {
    preHandler: app.requireAuth, ...limit,
    schema: S.body({ authKey: S.authKey, newSalt: S.salt, newIter: S.iter, newAuthKey: S.authKey, vault: S.blob, baseVersion: { type: "integer", minimum: 1 } })
  }, async (req, reply) => {
    if (!(await checkCurrent(req, reply))) return;
    const b = req.body, newKey = b64Bytes(b.newAuthKey, 32);
    if (!newKey || !b64Bytes(b.newSalt, 16)) return err(reply, 400, "invalid_key", "Ungültige Schlüsseldaten.");
    const hash = await hashAuthKey(newKey), now = Date.now(), uid = req.session.user.id;
    const res = tx(db, () => {
      const v = db.prepare("SELECT version FROM vaults WHERE user_id = ?").get(uid);
      if (v.version !== b.baseVersion) return { conflict: v.version };
      db.prepare("UPDATE users SET kdf_salt = ?, kdf_iter = ?, auth_hash = ?, updated_at = ? WHERE id = ?").run(b.newSalt, b.newIter, hash, now, uid);
      db.prepare("UPDATE vaults SET version = version + 1, blob = ?, updated_at = ? WHERE user_id = ?").run(JSON.stringify(b.vault), now, uid);
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(uid, req.session.sessionId);
      return { version: v.version + 1 };
    });
    if (res.conflict) return err(reply, 409, "conflict", "Der Tresor wurde zwischenzeitlich geändert. Bitte neu laden und erneut versuchen.", { version: res.conflict });
    req.log.info({ user: req.session.user.username }, "Passwort geändert");
    return { vault: { version: res.version, updatedAt: now } };
  });

  app.delete("/api/account", { preHandler: app.requireAuth, ...limit, schema: S.body({ authKey: S.authKey }) }, async (req, reply) => {
    if (!(await checkCurrent(req, reply))) return;
    db.prepare("DELETE FROM users WHERE id = ?").run(req.session.user.id);    // Tresor und Sessions per ON DELETE CASCADE
    req.log.info({ user: req.session.user.username }, "Konto gelöscht");
    reply.clearCookie(COOKIE, { path: "/api" });
    return reply.code(204).send();
  });
}
