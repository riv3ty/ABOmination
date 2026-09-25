// Sessions (Cookie fürs Web, Bearer-Token für die App) und Schutz vor Passwort-Raten
import { randomToken, sha256 } from "./security.js";

export const COOKIE = "abo_session";
const DAY = 86400000;

export function createSession(db, config, userId, kind, label) {
  const token = randomToken(32), id = randomToken(12), now = Date.now();
  db.prepare(`INSERT INTO sessions (id, user_id, token_hash, kind, label, created_at, last_seen, expires_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, userId, sha256(token), kind, label, now, now, now + config.sessionDays * DAY);
  return { id, token };
}

export function cookieOptions(config) {
  return { path: "/api", httpOnly: true, secure: config.cookieSecure, sameSite: "strict", maxAge: config.sessionDays * 86400 };
}

// Session aus Cookie oder "Authorization: Bearer" lesen; verlängert sich bei Nutzung (höchstens stündlich geschrieben)
export function readSession(db, config, req) {
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const token = bearer || req.cookies?.[COOKIE];
  if (!token || token.length > 100) return null;
  const now = Date.now();
  const s = db.prepare(`SELECT s.id, s.kind, s.last_seen, u.id AS user_id, u.username, u.display, u.created_at
                        FROM sessions s JOIN users u ON u.id = s.user_id
                        WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256(token), now);
  if (!s) return null;
  if (now - s.last_seen > 3600000)
    db.prepare("UPDATE sessions SET last_seen = ?, expires_at = ? WHERE id = ?").run(now, now + config.sessionDays * DAY, s.id);
  return { sessionId: s.id, kind: s.kind, viaCookie: !bearer,
    user: { id: s.user_id, username: s.username, display: s.display, createdAt: s.created_at } };
}

export function purgeExpired(db) {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  db.prepare("DELETE FROM invites WHERE expires_at <= ? OR uses_left <= 0").run(Date.now());
}

// Fehlversuche pro IP+Name und pro IP; ab 5 Fehlern exponentiell wachsende Sperre (max. 15 Minuten)
export class Throttle {
  constructor({ free = 5, maxLockMs = 15 * 60000 } = {}) { this.free = free; this.maxLockMs = maxLockMs; this.map = new Map(); }
  keys(ip, name) { return [`ip:${ip}`, `u:${ip}|${name}`]; }
  retryAfter(ip, name) {
    const now = Date.now();
    return Math.max(0, ...this.keys(ip, name).map(k => (this.map.get(k)?.until || 0) - now));
  }
  fail(ip, name) {
    const now = Date.now();
    this.keys(ip, name).forEach((k, i) => {
      const e = this.map.get(k) || { fails: 0, until: 0 };
      e.fails++;
      const free = i === 0 ? this.free * 4 : this.free;      // pro IP großzügiger (mehrere Nutzer hinter einem NAT)
      if (e.fails >= free) e.until = now + Math.min(this.maxLockMs, 1000 * 2 ** (e.fails - free));
      e.seen = now; this.map.set(k, e);
    });
    if (this.map.size > 10000) for (const [k, e] of this.map) if (now - e.seen > this.maxLockMs) this.map.delete(k);
  }
  success(ip, name) { this.map.delete(`u:${ip}|${name}`); }
}
