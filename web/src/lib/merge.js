// Zwei Tresor-Stände zusammenführen (z. B. Handy offline geändert, Browser gleichzeitig auch).
// Abos pro Eintrag nach updatedAt, Löschungen über Grabsteine (meta.deleted), Einstellungen nach changedAt,
// Errungenschaften vereinigt. Bei Gleichstand gewinnt der lokale Stand.
export const KEYS = {
  SUBS: "abo-manager-v1", META: "abo-manager-meta", SETTINGS: "abo-manager-settings",
  SYNC: "abo-manager-sync", ACH: "abo-manager-achievements"
};
export const TOMBSTONE_DAYS = 180;

const ts = v => Number(v) || 0;

function mergeSubs(local = [], remote = [], deleted) {
  const byId = new Map();
  for (const s of local) byId.set(s.id, s);
  for (const s of remote) { const cur = byId.get(s.id); if (!cur || ts(s.updatedAt) > ts(cur.updatedAt)) byId.set(s.id, s); }
  return [...byId.values()].filter(s => !(s.id in deleted && deleted[s.id] >= ts(s.updatedAt)));
}

const newer = (a, b) => a === undefined ? b : b === undefined ? a : ts(b?.changedAt) > ts(a?.changedAt) ? b : a;

// Errungenschaften: freigeschaltet = Vereinigung (frühester Zeitpunkt), Zähler = Maximum, Merker = ODER, Listen = Vereinigung
export function mergeAch(a, b) {
  if (!a || !b) return a || b;
  const out = { ...b, ...a };
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k], y = b[k];
    if (x === undefined || y === undefined) continue;
    if (typeof x === "number" && typeof y === "number") out[k] = Math.max(x, y);
    else if (typeof x === "boolean" || typeof y === "boolean") out[k] = !!x || !!y;
    else if (Array.isArray(x) && Array.isArray(y)) out[k] = [...new Set([...x, ...y])];
    else if (x && y && typeof x === "object") {
      const u = { ...y, ...x };
      for (const id in y) if (id in x) u[id] = Math.min(ts(x[id]), ts(y[id]));
      out[k] = u;
    }
  }
  return out;
}

export function mergeData(local = {}, remote = {}, now = Date.now()) {
  const { SUBS, META, SETTINGS, SYNC, ACH } = KEYS;
  const lm = local[META] || {}, rm = remote[META] || {};
  const deleted = {};
  for (const src of [lm.deleted, rm.deleted])
    for (const [id, t] of Object.entries(src || {})) if (now - ts(t) < TOMBSTONE_DAYS * 86400000) deleted[id] = Math.max(deleted[id] || 0, ts(t));
  const out = { ...remote, ...local };                       // unbekannte Schlüssel: lokal vor entfernt
  out[SUBS] = mergeSubs(local[SUBS], remote[SUBS], deleted);
  out[META] = { ...rm, ...lm, updatedAt: Math.max(ts(lm.updatedAt), ts(rm.updatedAt)), deleted };
  for (const k of [SETTINGS, SYNC]) { const v = newer(local[k], remote[k]); if (v !== undefined) out[k] = v; }
  const a = mergeAch(local[ACH], remote[ACH]); if (a !== undefined) out[ACH] = a;
  return out;
}
