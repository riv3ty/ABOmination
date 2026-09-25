// JSON-Sicherung: Abos, Einstellungen und Errungenschaften (Version 3).
// Sync-Zugangsdaten (z. B. Nextcloud-App-Passwort) gehören bewusst NICHT hinein – die Datei ist unverschlüsselt.
// Ältere Sicherungen (Version 2: { subs }, Version 1: reines Array) werden weiterhin gelesen.
import { clean } from "./model.js";
import { CURRENCIES } from "./constants.js";

export const BACKUP_VERSION = 3;
const AUTOLOCK = [0, 5, 15, 30, 60];
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

// Nur bekannte Einstellungen mit gültigen Werten übernehmen
export function sanitizeSettings(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return null;
  const out = {};
  if (CURRENCIES.includes(s.base)) out.base = s.base;
  if (int(s.remindDays, 0, 30)) out.remindDays = s.remindDays;
  if (int(s.noticeRemind, 0, 60)) out.noticeRemind = s.noticeRemind;
  if (typeof s.notif === "boolean") out.notif = s.notif;
  if (AUTOLOCK.includes(s.autoLock)) out.autoLock = s.autoLock;
  return Object.keys(out).length ? out : null;
}

// Errungenschaften: nur einfache Werte (Zahlen, Merker, ID-Listen, Zeitstempel-Tabellen) übernehmen
export function sanitizeAchievements(a) {
  if (!a || typeof a !== "object" || Array.isArray(a)) return null;
  const out = {};
  for (const [k, v] of Object.entries(a)) {
    if (!/^[A-Za-z]{1,40}$/.test(k)) continue;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter(x => typeof x === "string" && x.length <= 64).slice(0, 10000);
    else if (v && typeof v === "object")
      out[k] = Object.fromEntries(Object.entries(v).filter(([id, t]) => /^[\w-]{1,64}$/.test(id) && typeof t === "number" && t > 0));
  }
  return Object.keys(out).length ? out : null;
}

export function buildBackup({ subs, meta, settings, achievements }, now = Date.now()) {
  return {
    app: "abo-manager", version: BACKUP_VERSION, exportedAt: now, updatedAt: meta?.updatedAt || 0,
    subs, settings: sanitizeSettings(settings), achievements: sanitizeAchievements(achievements)
  };
}

// Liefert { subs, settings, achievements, version }; wirft bei unbrauchbaren Daten
export function parseBackup(data) {
  const list = Array.isArray(data) ? data : data?.subs;
  if (!Array.isArray(list)) throw new Error("Keine Abo-Liste gefunden.");
  const obj = Array.isArray(data) ? {} : data;
  return {
    version: Number(obj.version) || 1,
    subs: clean(list),
    settings: sanitizeSettings(obj.settings),
    achievements: sanitizeAchievements(obj.achievements)
  };
}
