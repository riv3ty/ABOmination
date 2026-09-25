import { CYCLES } from "./constants.js";
import { money } from "./money.js";
import { toISO, addDays } from "./dates.js";

// Kalender-Datei (RFC 5545) mit Serienterminen und Erinnerungen; list = computeView-Ergebnis
export function buildIcs(list, settings, now = new Date()) {
  const t2 = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const fold = l => { if (l.length <= 73) return l; let o = l.slice(0, 73); for (let i = 73; i < l.length; i += 72) o += "\r\n " + l.slice(i, i + 72); return o; };
  const ymd = d => toISO(d).replace(/-/g, "");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const RR = { weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY", quarterly: "FREQ=MONTHLY;INTERVAL=3", yearly: "FREQ=YEARLY" };
  // Ganztagstermin beginnt um 00:00 → Erinnerung um 09:00 Uhr, n Tage vorher
  const trig = n => n <= 0 ? "PT9H" : `-P${n - 1}DT15H`;
  const ev = (uidPart, date, cycle, summary, desc, days, count) => [
    "BEGIN:VEVENT", `UID:${uidPart}@abo-manager`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(date)}`,
    `RRULE:${RR[cycle]}${count ? ";COUNT=" + count : ""}`, `SUMMARY:${t2(summary)}`, `DESCRIPTION:${t2(desc)}`, "TRANSP:TRANSPARENT",
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${t2(summary)}`, `TRIGGER:${trig(days)}`, "END:VALARM", "END:VEVENT"];
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ABOmination//DE", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Abos"];
  for (const s of list.filter(x => x.state === "active")) {
    const next = s.next;
    lines.push(...ev(s.id + "-pay", next, s.cycle, `💳 ${s.name} – ${money(s.due, s.currency)}`,
      `${s.inst ? `Ratenzahlung, noch ${s.remaining} Raten` : CYCLES[s.cycle].label}${s.payment ? " · " + s.payment : ""}${s.notes ? "\n" + s.notes : ""}`,
      settings.remindDays, s.inst ? s.remaining : 0));
    if (!s.inst && s.noticeDays > 0)
      lines.push(...ev(s.id + "-cancel", addDays(next, -s.noticeDays), s.cycle, `⚠️ Kündigungsfrist: ${s.name}`,
        `Bis heute kündigen, sonst verlängert sich das Abo (${money(s.price, s.currency)}).`, settings.noticeRemind));
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
