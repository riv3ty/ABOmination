// Dashboard nach Wunsch: Reihenfolge, Sichtbarkeit und Breite der Kacheln.
// Gespeichert in den Einstellungen als { order: [id…], hidden: [id…], size: { id: Spalten } } (von 12 Spalten).
export const TILES = [
  { id: "tHero", label: "Übersicht", size: 8 },
  { id: "tYear", label: "Pro Jahr", size: 4 },
  { id: "t30", label: "Nächste 30 Tage", size: 4 },
  { id: "tOpen", label: "Offene Raten", size: 4 },
  { id: "tSalary", label: "Gehalt & Budget", size: 12 },
  { id: "tTime", label: "Zeitleiste", size: 12 },
  { id: "tCats", label: "Kosten nach Kategorie", size: 5 },
  { id: "tAccts", label: "Abgänge pro Bankkonto", size: 7 },
  { id: "optTile", label: "Optimierung", size: 7 },
  { id: "achTile", label: "Errungenschaften", size: 5 },
  { id: "dealTile", label: "Angebote & Preissuche", size: 12 },
  { id: "instCard", label: "Ratenkäufe", size: 12 }
];
export const SIZES = [4, 6, 8, 12];                 // ⅓ · ½ · ⅔ · ganz
export const SIZE_LABEL = { 4: "⅓", 5: "⅖", 6: "½", 7: "⅗", 8: "⅔", 12: "ganz" };
const IDS = TILES.map(t => t.id), DEF = Object.fromEntries(TILES.map(t => [t.id, t.size]));

export const defaultLayout = () => ({ order: [...IDS], hidden: [], size: {} });

// Nur bekannte Kacheln übernehmen; neue Kacheln (spätere Versionen) an ihrer Standardposition einfügen
export function normalizeLayout(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaultLayout();
  const order = [...new Set((Array.isArray(raw.order) ? raw.order : []).filter(id => IDS.includes(id)))];
  for (const id of IDS) if (!order.includes(id)) {
    const before = IDS.slice(0, IDS.indexOf(id)).reverse().find(x => order.includes(x));   // hinter den Standard-Vorgänger
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  }
  const hidden = [...new Set((Array.isArray(raw.hidden) ? raw.hidden : []).filter(id => IDS.includes(id)))];
  const size = {};
  for (const [id, n] of Object.entries(raw.size && typeof raw.size === "object" ? raw.size : {}))
    if (IDS.includes(id) && SIZES.includes(n) && n !== DEF[id]) size[id] = n;
  return { order, hidden, size };
}

export const isDefault = l => { const n = normalizeLayout(l); return n.order.join() === IDS.join() && !n.hidden.length && !Object.keys(n.size).length; };
export const sizeOf = (l, id) => l.size[id] || DEF[id];

// Kachel um eine Position verschieben (dir = −1 / +1)
export function move(l, id, dir) {
  const order = [...l.order], i = order.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return l;
  [order[i], order[j]] = [order[j], order[i]];
  return { ...l, order };
}
// Kachel vor eine andere setzen (Ziehen); target = null → ans Ende
export function moveBefore(l, id, target) {
  if (id === target) return l;
  const order = l.order.filter(x => x !== id);
  const at = target ? order.indexOf(target) : -1;
  order.splice(at < 0 ? order.length : at, 0, id);
  return { ...l, order };
}
export function toggleHidden(l, id) {
  const hidden = l.hidden.includes(id) ? l.hidden.filter(x => x !== id) : [...l.hidden, id];
  return { ...l, hidden };
}
// Nächste Breitenstufe: ⅓ → ½ → ⅔ → ganz → ⅓ (von der aktuellen Breite aus)
export function cycleSize(l, id) {
  const cur = sizeOf(l, id), next = SIZES.find(n => n > cur) || SIZES[0];
  const size = { ...l.size };
  if (next === DEF[id]) delete size[id]; else size[id] = next;
  return { ...l, size };
}
