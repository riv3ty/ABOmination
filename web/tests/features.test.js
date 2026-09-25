import { describe, it, expect } from "vitest";
import { normalizeSub, computeView } from "../src/lib/model.js";
import { parseISO } from "../src/lib/dates.js";
import { optimize } from "../src/lib/optimize.js";
import { computeReminders } from "../src/lib/reminders.js";
import { buildIcs } from "../src/lib/ics.js";
import { parseCsv, parseAmount, parseDate, normKey, analyzeStatement } from "../src/lib/bank.js";

const T = parseISO("2026-03-10");
const same = a => a;
const view = list => computeView(list.map(o => normalizeSub({ price: 10, cycle: "monthly", nextDate: "2026-03-20", ...o })), same, T);
const fmt = v => v.toFixed(2);

describe("Optimierung", () => {
  it("selten genutzte, doppelte und überlappende Abos; pro Abo nur einmal gezählt", () => {
    const all = view([
      { id: "a", name: "Netflix", category: "Streaming", price: 15, usage: "rarely" },
      { id: "b", name: "Disney Plus", category: "Streaming", price: 9 },
      { id: "c", name: "Spotify", category: "Musik", price: 11 },
      { id: "d", name: "Spotify", category: "Musik", price: 11 }
    ]);
    const r = optimize(all, { fmt, convert: same, t: T });
    const titles = r.tips.map(t => t.title).join(" | ");
    expect(titles).toMatch(/Netflix nutzt du selten/);
    expect(titles).toMatch(/2 Abos in „Streaming“/);
    expect(titles).toMatch(/„Spotify“ ist mehrfach erfasst/);
    // Netflix 180 + Disney (günstigstes Streaming) 108 + Spotify 132
    expect(r.total).toBeCloseTo(420, 6);
    expect([...r.flagged].sort()).toEqual(["a", "b", "c"]);
  });

  it("Jahrespreis-Tipp nur wenn günstiger", () => {
    const tips = a => optimize(view([a]), { fmt, convert: same, t: T }).tips.map(t => t.title).join();
    expect(tips({ name: "Cloud", price: 10, yearlyAlt: 99 })).toMatch(/Jahrespreis ist günstiger/);
    expect(tips({ name: "Cloud", price: 10, yearlyAlt: 130 })).not.toMatch(/Jahrespreis/);
  });
});

describe("Erinnerungen", () => {
  it("Zahlung innerhalb der Vorlaufzeit und Kündigungsfrist", () => {
    const list = view([
      { id: "p", name: "Bald", nextDate: "2026-03-12" },
      { id: "q", name: "Später", nextDate: "2026-03-30" },
      { id: "n", name: "Vertrag", nextDate: "2026-04-10", noticeDays: 30 }
    ]);
    const r = computeReminders(list, { remindDays: 3, noticeRemind: 7 }, T);
    expect(r.map(x => x.key)).toEqual(["n|2026-03-11|cancel", "p|2026-03-12|pay"]);
    expect(r[0].title).toMatch(/Kündigungsfrist endet morgen/);
  });
});

describe("Kalender-Export", () => {
  it("erzeugt Serien, COUNT bei Raten und gefaltete Zeilen", () => {
    const list = view([
      { id: "abo1", name: "Ein sehr langer Abo-Name, der mit Sonderzeichen; und Kommas die Zeilenlänge sprengt", noticeDays: 14 },
      { id: "rate1", name: "Handy", kind: "installment", totalPayments: 10, paidCount: 4, cycle: "quarterly" }
    ]);
    const ics = buildIcs(list, { remindDays: 2, noticeRemind: 7 }, new Date("2026-03-10T08:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("RRULE:FREQ=MONTHLY;INTERVAL=3;COUNT=6");
    expect(ics).toContain("UID:abo1-cancel@abo-manager");
    expect(ics).toContain("DTSTAMP:20260310T080000Z");
    expect(ics).toContain("\\;");
    expect(ics.split("\r\n").every(l => l.length <= 75)).toBe(true);
  });
});

describe("Kontoauszug", () => {
  it("parseAmount versteht deutsche und englische Formate", () => {
    expect(parseAmount("-1.234,56")).toBe(-1234.56);
    expect(parseAmount("12,99-")).toBe(-12.99);
    expect(parseAmount("(9.99)")).toBe(-9.99);
    expect(parseAmount("-1,234.50 EUR")).toBe(-1234.5);
    expect(parseAmount("abc")).toBeNaN();
  });

  it("parseDate und parseCsv (Trennzeichen, Anführungszeichen)", () => {
    expect(parseDate("05.03.26")).toEqual(new Date(2026, 2, 5));
    expect(parseDate("2026-03-05")).toEqual(new Date(2026, 2, 5));
    expect(parseCsv('a;"b;c";"d ""x"""\r\n1;2;3')).toEqual([["a", "b;c", 'd "x"'], ["1", "2", "3"]]);
  });

  it("normKey entfernt Rechtsformen und Sonderzeichen", () => {
    expect(normKey("NETFLIX INTERNATIONAL B.V.")).toBe("netflix");
    expect(normKey("Spotify AB, Stockholm")).toBe("spotify ab stockholm");
  });

  const csv = rows => "Buchungstag;Beguenstigter/Zahlungspflichtiger;Verwendungszweck;Betrag\n" + rows.map(r => r.join(";")).join("\n");

  it("erkennt monatliche Abbuchungen, ignoriert Einnahmen und Einmaliges", () => {
    const text = csv([
      ["15.12.2025", "NETFLIX INTERNATIONAL B.V.", "Abo", "-12,99"],
      ["15.01.2026", "NETFLIX INTERNATIONAL B.V.", "Abo", "-12,99"],
      ["16.02.2026", "NETFLIX INTERNATIONAL B.V.", "Abo", "-12,99"],
      ["01.02.2026", "Arbeitgeber GmbH", "Gehalt", "2500,00"],
      ["03.02.2026", "Baumarkt", "Einkauf", "-89,00"]
    ]);
    const r = analyzeStatement(text, [], T);
    expect(r.outgoing).toBe(4);
    expect(r.found).toHaveLength(1);
    expect(r.found[0].name).toMatch(/^Netflix International/);            // GROSSSCHRIFT wird lesbar gemacht
    expect(r.found[0]).toMatchObject({ price: 12.99, cycle: "monthly", nextDate: "2026-03-16", category: "Streaming", exists: false });
    expect(analyzeStatement(text, [{ name: "Netflix" }], T).found[0].exists).toBe(true);
  });

  it("überspringt vermutlich gekündigte Abos und meldet fehlende Spalten", () => {
    const old = csv([["15.01.2025", "Gym", "x", "-30"], ["15.02.2025", "Gym", "x", "-30"], ["15.03.2025", "Gym", "x", "-30"]]);
    expect(analyzeStatement(old, [], T).found).toHaveLength(0);
    expect(analyzeStatement("foo;bar\n1;2", [], T).error).toMatch(/Keine Spalten/);
  });
});
