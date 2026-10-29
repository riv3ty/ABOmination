// Erinnerungsplan für Push-Benachrichtigungen: alle Hinweise der nächsten Wochen mit festem Zeitpunkt.
// Gleiche Regeln wie lib/reminders.js (Zahlung X Tage vorher, Kündigungsfrist Y Tage vorher), nur in die Zukunft gerechnet.
// list = computeView-Ergebnis; settings: remindDays, noticeRemind, pushHour (Uhrzeit der Mitteilung, Standard 9 Uhr)
import { money } from "./money.js";
import { parseISO, toISO, fmtDate, addDays, addCycle, whenText } from "./dates.js";

export const PUSH_HORIZON_DAYS = 45, PUSH_MAX = 250;

const at = (day, hour) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0).getTime();

export function buildPushPlan(list, settings, now = new Date(), horizonDays = PUSH_HORIZON_DAYS) {
  const hour = Number.isInteger(settings.pushHour) && settings.pushHour >= 0 && settings.pushHour <= 23 ? settings.pushHour : 9;
  const remind = Math.max(0, settings.remindDays ?? 3), notice = Math.max(0, settings.noticeRemind ?? 7);
  const nowMs = +now, end = addDays(new Date(nowMs), horizonDays + Math.max(remind, notice));
  const out = [];
  for (const s of list) {
    if (s.state !== "active") continue;
    const anchor = parseISO(s.nextDate);
    let j = 0;
    while (addCycle(anchor, s.cycle, j) < s.next && j < 5000) j++;           // Index des nächsten offenen Termins
    for (let n = 0; n < 400; n++) {
      if (s.inst && n >= s.remaining) break;
      const due = addCycle(anchor, s.cycle, j + n);
      if (due > end) break;
      const amount = s.inst && n === s.remaining - 1 ? Math.round((s.remainingAmt - s.price * (s.remaining - 1)) * 100) / 100 : s.price;
      const tPay = at(addDays(due, -remind), hour);
      if (tPay > nowMs) out.push({
        at: tPay, tag: `pay-${s.id}-${toISO(due)}`,
        title: `${s.name}: ${s.inst ? "Rate" : "Zahlung"} ${whenText(remind)}`,
        body: `${money(amount, s.currency)} am ${fmtDate(due)}${s.inst ? ` (Rate ${s.paid + n + 1} von ${s.totalPayments})` : ""}`
      });
      if (!s.inst && s.noticeDays > 0) {
        const dl = addDays(due, -s.noticeDays), tDl = at(addDays(dl, -notice), hour);
        if (tDl > nowMs) out.push({
          at: tDl, tag: `cancel-${s.id}-${toISO(dl)}`,
          title: `${s.name}: Kündigungsfrist endet ${whenText(notice)}`,
          body: `Bis ${fmtDate(dl)} kündigen, sonst wird am ${fmtDate(due)} erneut ${money(s.price, s.currency)} fällig.`
        });
      }
    }
  }
  const limit = nowMs + horizonDays * 86400000;
  return out.filter(i => i.at <= limit).sort((a, b) => a.at - b.at).slice(0, PUSH_MAX);
}
