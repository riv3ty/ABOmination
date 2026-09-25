import { CYCLES, CURRENCIES, USAGE, PALETTE } from "./constants.js";
import { parseISO, today, daysBetween, addCycle, nextInfo } from "./dates.js";

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// IDs landen in HTML-Attributen: nur harmlose Zeichen zulassen (Schutz vor präparierten Sicherungen/Sync-Dateien)
export const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export function normalizeSub(s) {
  if (!s || !s.name || !ISO_DATE.test(String(s.nextDate || "")) || !CYCLES[s.cycle]) return null;
  const inst = s.kind === "installment" && Number(s.totalPayments) >= 1;
  const total = inst ? Math.floor(Number(s.totalPayments)) : 0;
  return {
    id: SAFE_ID.test(String(s.id || "")) ? String(s.id) : uid(), name: String(s.name), price: Math.max(0, Number(s.price) || 0), cycle: s.cycle,
    currency: CURRENCIES.includes(s.currency) ? s.currency : "EUR",
    nextDate: String(s.nextDate), category: String(s.category || ""),
    status: ["active", "paused", "cancelled"].includes(s.status) ? s.status : "active",
    noticeDays: inst ? 0 : Math.max(0, Number(s.noticeDays) || 0), payment: String(s.payment || ""), notes: String(s.notes || ""),
    account: String(s.account || "").trim().slice(0, 60),
    kind: inst ? "installment" : "subscription", totalPayments: total,
    // Bereits gezahlt: entweder als Anzahl Raten (paidCount) oder als exakter Betrag (paidAmount, dann ist paidCount nur abgeleitet)
    paidAmount: inst && s.paidAmount !== null && s.paidAmount !== undefined && s.paidAmount !== "" && Number.isFinite(Number(s.paidAmount))
      ? Math.min(total * Math.max(0, Number(s.price) || 0), Math.max(0, Math.round(Number(s.paidAmount) * 100) / 100)) : null,
    paidCount: inst ? Math.min(total, Math.max(0, Math.floor(Number(s.paidCount) || 0))) : 0,
    // Kaufpreis und Zinssatz p. a.: wenn gesetzt, ergibt sich der Betrag pro Rate (price) daraus
    principal: inst ? Math.max(0, Math.round((Number(s.principal) || 0) * 100) / 100) : 0,
    interestRate: inst ? Math.min(100, Math.max(0, Number(s.interestRate) || 0)) : 0,
    usage: USAGE[s.usage] ? s.usage : "", yearlyAlt: inst ? 0 : Math.max(0, Number(s.yearlyAlt) || 0)
  };
}
export function clean(list) { return (Array.isArray(list) ? list : []).map(normalizeSub).filter(Boolean); }

// Abgeleitete Sicht auf alle Einträge: nächster Termin, Ratenstand, Beträge in der Hauptwährung.
// convert(betrag, währung) rechnet in die Hauptwährung um; t = heutiges Datum (für Tests einstellbar).
export function computeView(subs, convert, t = today()) {
  return subs.map(s => {
    const { date: next, k } = nextInfo(s, t);
    const inst = s.kind === "installment";
    // Ratenzahlung: verstrichene Termine zählen automatisch als bezahlt.
    // Mit exaktem Betrag (paidAmount) wird in Geld gerechnet, sonst in ganzen Raten (bisheriges Verhalten).
    const byAmount = inst && s.paidAmount !== null;
    const totalAmt = inst ? s.totalPayments * s.price : 0;
    let remaining = 0, paidAmt = 0;
    if (inst && byAmount) {
      paidAmt = Math.min(totalAmt, s.paidAmount + k * s.price);
      remaining = s.price > 0 ? Math.max(0, Math.ceil((totalAmt - paidAmt) / s.price - 1e-9)) : 0;
    } else if (inst) {
      remaining = Math.max(0, s.totalPayments - s.paidCount - k);
      paidAmt = (s.totalPayments - remaining) * s.price;
    }
    const remainingAmt = inst ? Math.max(0, Math.round((totalAmt - paidAmt) * 100) / 100) : 0;
    const done = inst && remaining <= 0;
    const priceBase = convert(s.price, s.currency);
    // Kredit-Kennzahlen (nur wenn Kaufpreis angegeben): Gesamtkosten = Rate × Anzahl, Zinsen = Gesamtkosten − Kaufpreis
    const loan = inst && s.principal > 0 ? { total: totalAmt, interest: Math.max(0, Math.round((totalAmt - s.principal) * 100) / 100) } : null;
    return { ...s, next, inDays: daysBetween(t, next), inst, remaining, byAmount, totalAmt, paidAmt, remainingAmt, loan,
      state: done ? "done" : s.status,
      paid: inst ? s.totalPayments - remaining : 0,
      due: inst ? Math.min(s.price, remainingAmt) : s.price,      // letzte Rate kann kleiner sein
      endDate: inst && !done ? addCycle(parseISO(s.nextDate), s.cycle, remaining + k - 1) : null,
      monthly: convert(s.price * CYCLES[s.cycle].perMonth, s.currency),
      priceBase, remainingBase: convert(remainingAmt, s.currency) };
  });
}
export const catName = s => s.category?.trim() || "Ohne Kategorie";
export const catColor = name => {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
