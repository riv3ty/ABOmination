import { money } from "./money.js";
import { toISO, fmtDate, today, daysBetween, addDays, whenText } from "./dates.js";

// Hinweise für anstehende Zahlungen und ablaufende Kündigungsfristen (list = computeView-Ergebnis)
export function computeReminders(list, settings, t = today()) {
  const out = [];
  for (const s of list) {
    if (s.state !== "active") continue;
    if (s.inDays <= settings.remindDays)
      out.push({ key: `${s.id}|${toISO(s.next)}|pay`, type: "pay", subId: s.id, date: toISO(s.next), icon: "🔔", days: s.inDays,
        title: `${s.name}: ${s.inst ? "Rate" : "Zahlung"} ${whenText(s.inDays)}`,
        body: `${money(s.due, s.currency)} am ${fmtDate(s.next)}${s.inst ? ` (Rate ${s.paid + 1} von ${s.totalPayments})` : ""}` });
    if (!s.inst && s.noticeDays > 0) {
      const dl = addDays(s.next, -s.noticeDays), d = daysBetween(t, dl);
      if (d >= 0 && d <= settings.noticeRemind)
        out.push({ key: `${s.id}|${toISO(dl)}|cancel`, type: "cancel", subId: s.id, date: toISO(dl), icon: "⚠️", days: d,
          title: `${s.name}: Kündigungsfrist endet ${whenText(d)}`,
          body: `Bis ${fmtDate(dl)} kündigen, sonst wird am ${fmtDate(s.next)} erneut ${money(s.price, s.currency)} fällig.` });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}
