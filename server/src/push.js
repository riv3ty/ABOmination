// Web Push: Server-Schlüssel (VAPID), Versand und Zeitplaner.
// Der Server kennt nur Zeitpunkte und verschlüsselte Nutzlasten: Die Texte verschlüsselt der Client mit einem
// Push-Schlüssel aus dem Tresor; entschlüsselt wird erst im Service Worker des Geräts.
import webpush from "web-push";

// Nur echte Push-Dienste der Browser als Ziel zulassen (kein Versand an beliebige Adressen)
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/,
  /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /^push\.services\.mozilla\.com$/];
export function validEndpoint(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.port && !u.username && PUSH_HOSTS.some(re => re.test(u.hostname));
  } catch { return false; }
}

// VAPID-Schlüsselpaar einmalig erzeugen und in meta ablegen
export function vapidKeys(db) {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'vapid'").get();
  if (row) return JSON.parse(row.value);
  const keys = webpush.generateVAPIDKeys();
  db.prepare("INSERT INTO meta (key, value) VALUES ('vapid', ?)").run(JSON.stringify(keys));
  return keys;
}

// Standard-Versand über web-push; Tests übergeben eine eigene Funktion
export function makeSender(keys, subject) {
  return (sub, payload, ttl) => webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload,
    { TTL: ttl, urgency: "normal", vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey } });
}

// An alle Geräte eines Kontos senden; abgelaufene Abos (404/410) werden entfernt
export async function sendToUser(db, send, userId, payload, log, ttl = 86400) {
  const subs = db.prepare("SELECT id, endpoint, p256dh, auth FROM push_subs WHERE user_id = ?").all(userId);
  let sent = 0, failed = 0;
  for (const s of subs) {
    try {
      await send(s, payload, ttl);
      db.prepare("UPDATE push_subs SET last_ok = ? WHERE id = ?").run(Date.now(), s.id);
      sent++;
    } catch (e) {
      failed++;
      if (e.statusCode === 404 || e.statusCode === 410) db.prepare("DELETE FROM push_subs WHERE id = ?").run(s.id);
      else log?.warn({ status: e.statusCode, host: new URL(s.endpoint).hostname }, "Push-Versand fehlgeschlagen");
    }
  }
  return { sent, failed };
}

// Fällige Einträge verschicken. Was länger als einen Tag überfällig ist (Server war aus), entfällt still.
export async function processQueue(db, send, log, now = Date.now()) {
  db.prepare("DELETE FROM push_queue WHERE at < ?").run(now - 86400000);
  const due = db.prepare("SELECT id, user_id, payload FROM push_queue WHERE at <= ? ORDER BY at LIMIT 200").all(now);
  for (const item of due) {
    db.prepare("DELETE FROM push_queue WHERE id = ?").run(item.id);       // vor dem Versand: nie doppelt senden
    await sendToUser(db, send, item.user_id, item.payload, log);
  }
  return due.length;
}

export function startScheduler(db, send, log, intervalMs) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await processQueue(db, send, log); } catch (e) { log.error(e, "Push-Zeitplaner"); } finally { busy = false; }
  };
  const timer = setInterval(tick, intervalMs); timer.unref();
  return () => clearInterval(timer);
}
