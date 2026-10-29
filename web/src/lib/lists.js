// Eigene Listen (Bankkonten, Anbieter, Zahlungsmittel): einmal anlegen, im Abo-Dialog nur noch auswählen.
// In den Abos stehen weiterhin die Namen als Text (kompatibel zu Sicherungen und älteren Ständen);
// die Listen sind die Auswahl dafür. Abgleich pro Eintrag nach updatedAt, Löschungen über Grabsteine.
export const LIST_TYPES = {
  account: { label: "Bankkonten", one: "Bankkonto", field: "account", icon: "🏦", placeholder: "z. B. Girokonto Sparkasse" },
  provider: { label: "Anbieter", one: "Anbieter", field: "provider", icon: "🏪", placeholder: "z. B. Telekom, Netflix" },
  payment: { label: "Zahlungsmittel", one: "Zahlungsmittel", field: "payment", icon: "💳", placeholder: "z. B. PayPal, Visa, Lastschrift" }
};
export const MAX_NAME = 60;
export const TOMBSTONE_DAYS = 180;

const ts = v => Math.max(0, Number(v) || 0);
const key = name => String(name).trim().toLowerCase();
export const cleanName = name => String(name ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);

// Stabile ID aus Typ + Name (FNV-1a): legen zwei Geräte offline denselben Eintrag an, wird er beim Abgleich einer
function hashId(type, name) {
  let h = 0x811c9dc5;
  for (const c of key(name)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${type}-${h.toString(36)}`;
}

export const emptyLists = () => ({ items: [], deleted: {} });

// Nur gültige Einträge übernehmen (Tresor, Sicherung, Abgleich)
export function normalizeLists(raw) {
  const out = emptyLists();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const seen = new Set();
  for (const it of Array.isArray(raw.items) ? raw.items : []) {
    const name = cleanName(it?.name);
    if (!name || !LIST_TYPES[it.type] || !/^[a-z]+-[a-z0-9]{1,13}$/.test(String(it.id)) || seen.has(it.id)) continue;
    seen.add(it.id);
    out.items.push({ id: String(it.id), type: it.type, name, updatedAt: ts(it.updatedAt) });
  }
  for (const [id, t] of Object.entries(raw.deleted && typeof raw.deleted === "object" ? raw.deleted : {}))
    if (/^[a-z]+-[a-z0-9]{1,13}$/.test(id) && ts(t) > 0) out.deleted[id] = ts(t);
  return out;
}

export const namesOf = (lists, type) =>
  lists.items.filter(i => i.type === type).map(i => i.name).sort((a, b) => a.localeCompare(b, "de"));

export const findByName = (lists, type, name) => lists.items.find(i => i.type === type && key(i.name) === key(name));

// Liefert { lists, item }; existiert der Name schon (Groß-/Kleinschreibung egal), bleibt alles unverändert
export function addItem(lists, type, name, now = Date.now()) {
  const n = cleanName(name);
  if (!n || !LIST_TYPES[type]) return { lists, item: null };
  const hit = findByName(lists, type, n);
  if (hit) return { lists, item: hit };
  let id = hashId(type, n);
  while (lists.items.some(i => i.id === id)) id = hashId(type, n + "#" + id);   // Kollision (umbenannter Eintrag hält die ID)
  const item = { id, type, name: n, updatedAt: now };
  const deleted = { ...lists.deleted }; delete deleted[id];
  return { lists: { items: [...lists.items, item], deleted }, item };
}

// Umbenennen; Fehler, wenn der neue Name in derselben Liste schon vergeben ist
export function renameItem(lists, id, name, now = Date.now()) {
  const n = cleanName(name), it = lists.items.find(i => i.id === id);
  if (!it || !n) return lists;
  const clash = findByName(lists, it.type, n);
  if (clash && clash.id !== id) throw new Error(`„${n}“ gibt es in dieser Liste schon.`);
  return { ...lists, items: lists.items.map(i => i.id === id ? { ...i, name: n, updatedAt: now } : i) };
}

export function removeItem(lists, id, now = Date.now()) {
  if (!lists.items.some(i => i.id === id)) return lists;
  return { items: lists.items.filter(i => i.id !== id), deleted: { ...lists.deleted, [id]: now } };
}

// Zwei Stände zusammenführen: pro Eintrag gewinnt die neuere Änderung, Grabsteine löschen ältere Stände
export function mergeLists(a, b, now = Date.now()) {
  const x = normalizeLists(a), y = normalizeLists(b), deleted = {};
  for (const src of [x.deleted, y.deleted])
    for (const [id, t] of Object.entries(src)) if (now - t < TOMBSTONE_DAYS * 86400000) deleted[id] = Math.max(deleted[id] || 0, t);
  const byId = new Map();
  for (const it of x.items) byId.set(it.id, it);
  for (const it of y.items) { const cur = byId.get(it.id); if (!cur || it.updatedAt > cur.updatedAt) byId.set(it.id, it); }
  const items = [...byId.values()].filter(it => !(it.id in deleted && deleted[it.id] >= it.updatedAt));
  return { items, deleted };
}

// Erstbefüllung aus den Werten, die in den Abos schon stehen
export function seedFromSubs(subs, now = Date.now()) {
  let lists = emptyLists();
  for (const s of subs) for (const [type, def] of Object.entries(LIST_TYPES))
    if (cleanName(s[def.field])) lists = addItem(lists, type, s[def.field], now).lists;
  return lists;
}

// Wie viele Abos einen Eintrag nutzen
export const usageCount = (subs, type, name) => subs.filter(s => key(s[LIST_TYPES[type].field] || "") === key(name)).length;

// Umbenennung in die Abos übertragen (nur betroffene Einträge bekommen ein neues updatedAt)
export function renameInSubs(subs, type, oldName, newName, now = Date.now()) {
  const f = LIST_TYPES[type].field;
  return subs.map(s => key(s[f] || "") === key(oldName) ? { ...s, [f]: cleanName(newName), updatedAt: now } : s);
}
