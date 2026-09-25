import { CYCLES } from "./constants.js";

/* ================= Datum ================= */
export const parseISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fmtDate = d => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
export const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
export const daysBetween = (a, b) => Math.round((b - a) / 86400000);
export const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
export const whenText = n => n === 0 ? "heute" : n === 1 ? "morgen" : n < 0 ? `vor ${-n} Tagen` : `in ${n} Tagen`;

// k-te Wiederholung ab Ankerdatum (verhindert Drift bei Monatsenden)
export function addCycle(anchor, cycle, k) {
  if (cycle === "weekly") return addDays(anchor, 7 * k);
  const n = CYCLES[cycle].months * k;
  const y = anchor.getFullYear(), m = anchor.getMonth() + n;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(anchor.getDate(), last));
}
// k = Anzahl der Termine, die seit dem gespeicherten Datum bereits verstrichen sind
export function nextInfo(s, t = today()) {
  const anchor = parseISO(s.nextDate);
  let k = 0, d = anchor;
  while (d < t && k < 5000) d = addCycle(anchor, s.cycle, ++k);
  return { date: d, k };
}
