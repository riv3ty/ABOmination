import { describe, it, expect } from "vitest";
import { normalizeSub, clean, computeView, catName, catColor } from "../src/lib/model.js";
import { convertWith, money } from "../src/lib/money.js";
import { parseISO, toISO } from "../src/lib/dates.js";

const T = parseISO("2026-03-10");
const RATES = { EUR: 1, USD: 1.25 };
const toEur = (a, from) => convertWith(RATES, a, from, "EUR");
const sub = o => normalizeSub({ name: "X", price: 10, cycle: "monthly", nextDate: "2026-03-20", ...o });

describe("normalizeSub", () => {
  it("verwirft Einträge ohne Namen, mit unbekanntem Rhythmus oder kaputtem Datum", () => {
    expect(normalizeSub(null)).toBeNull();
    expect(sub({ name: "" })).toBeNull();
    expect(sub({ cycle: "daily" })).toBeNull();
    expect(sub({ nextDate: "<b>x</b>" })).toBeNull();
    expect(sub({ nextDate: "20.03.2026" })).toBeNull();
  });

  it("ersetzt unsichere IDs (HTML in Attributen) durch neue", () => {
    const evil = '"><img src=x onerror=alert(1)>';
    const s = sub({ id: evil });
    expect(s.id).not.toBe(evil);
    expect(s.id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sub({ id: "abc-123_X" }).id).toBe("abc-123_X");
  });

  it("begrenzt und bereinigt Werte", () => {
    const s = sub({ price: -5, currency: "XXX", status: "weird", usage: "nie", account: "  Giro  " });
    expect(s).toMatchObject({ price: 0, currency: "EUR", status: "active", usage: "", account: "Giro", kind: "subscription" });
    const r = sub({ kind: "installment", totalPayments: 6.7, paidCount: 99, interestRate: 150, noticeDays: 30 });
    expect(r).toMatchObject({ kind: "installment", totalPayments: 6, paidCount: 6, interestRate: 100, noticeDays: 0, paidAmount: null });
    expect(sub({ kind: "installment", totalPayments: 0 }).kind).toBe("subscription");
  });

  it("paidAmount wird auf Raten × Betrag gedeckelt", () => {
    expect(sub({ kind: "installment", totalPayments: 3, price: 10, paidAmount: 50 }).paidAmount).toBe(30);
    expect(sub({ kind: "installment", totalPayments: 3, price: 10, paidAmount: "" }).paidAmount).toBeNull();
  });

  it("clean filtert ungültige Einträge und verträgt Nicht-Arrays", () => {
    expect(clean([{ name: "A", cycle: "monthly", nextDate: "2026-01-01" }, { name: "B" }])).toHaveLength(1);
    expect(clean({ foo: 1 })).toEqual([]);
  });
});

describe("computeView", () => {
  it("Abo: nächster Termin, Tage bis dahin, Monatswert in Hauptwährung", () => {
    const [v] = computeView([sub({ price: 125, currency: "USD", cycle: "yearly", nextDate: "2026-03-15" })], toEur, T);
    expect(toISO(v.next)).toBe("2026-03-15");
    expect(v.inDays).toBe(5);
    expect(v.monthly).toBeCloseTo(100 / 12, 6);
    expect(v.priceBase).toBe(100);
    expect(v.state).toBe("active");
  });

  it("Ratenzahlung: verstrichene Termine zählen als bezahlt", () => {
    // gespeichert: nächste Rate am 09.01., 2 von 6 bezahlt → bis 10.03. sind 09.01., 09.02. und 09.03. verstrichen
    const [v] = computeView([sub({ kind: "installment", totalPayments: 6, paidCount: 2, price: 50, nextDate: "2026-01-09" })], toEur, T);
    expect(v.paid).toBe(5);
    expect(v.remaining).toBe(1);
    expect(v.remainingAmt).toBe(50);
    expect(toISO(v.next)).toBe("2026-04-09");
    expect(toISO(v.endDate)).toBe("2026-04-09");
  });

  it("Ratenzahlung mit exaktem Betrag: letzte Rate kann kleiner sein", () => {
    const [v] = computeView([sub({ kind: "installment", totalPayments: 4, price: 100, paidAmount: 330, nextDate: "2026-03-20" })], toEur, T);
    expect(v.byAmount).toBe(true);
    expect(v.remaining).toBe(1);
    expect(v.due).toBe(70);
  });

  it("abbezahlte Ratenzahlung hat Status done und kein Enddatum", () => {
    const [v] = computeView([sub({ kind: "installment", totalPayments: 2, paidCount: 1, nextDate: "2026-01-01" })], toEur, T);
    expect(v.state).toBe("done");
    expect(v.endDate).toBeNull();
  });

  it("Kredit-Kennzahlen aus Kaufpreis", () => {
    const [v] = computeView([sub({ kind: "installment", totalPayments: 12, price: 110, principal: 1200 })], toEur, T);
    expect(v.loan).toEqual({ total: 1320, interest: 120 });
  });
});

describe("Bereits bezahlt (paidThrough)", () => {
  it("Abo springt zum nächsten Termin; gespeichertes Datum bleibt, Monatsenden verrutschen nicht", () => {
    const s = sub({ nextDate: "2026-01-31", paidThrough: "2026-03-31" });
    const [v] = computeView([s], toEur, T);                                 // T = 10.03.2026 → fällig wäre der 31.03.
    expect(toISO(v.next)).toBe("2026-04-30");
    expect(v.nextDate).toBe("2026-01-31");
    const [w] = computeView([{ ...s, paidThrough: "2026-04-30" }], toEur, T);
    expect(toISO(w.next)).toBe("2026-05-31");                               // nicht 30.05. (kein Verrutschen)
  });

  it("Ratenzahlung: vorab bezahlte Rate zählt sofort, auch die letzte", () => {
    const base = sub({ kind: "installment", totalPayments: 6, paidCount: 2, price: 50, nextDate: "2026-03-20" });
    const [a] = computeView([base], toEur, T);
    const [b] = computeView([{ ...base, paidThrough: "2026-03-20" }], toEur, T);
    expect([a.paid, a.remaining]).toEqual([2, 4]);
    expect([b.paid, b.remaining, b.remainingAmt]).toEqual([3, 3, 150]);
    expect(toISO(b.next)).toBe("2026-04-20");
    expect(toISO(b.endDate)).toBe(toISO(a.endDate));                        // Enddatum bleibt gleich
    const [c] = computeView([{ ...base, paidThrough: "2026-07-20" }], toEur, T);
    expect(c.state).toBe("done");
  });

  it("nach Ablauf des Termins wird nichts doppelt gezählt", () => {
    const base = sub({ kind: "installment", totalPayments: 6, paidCount: 2, price: 50, nextDate: "2026-03-20", paidThrough: "2026-03-20" });
    const [v] = computeView([base], toEur, parseISO("2026-03-25"));          // Termin ist inzwischen vorbei
    expect([v.paid, v.remaining]).toEqual([3, 3]);
  });

  it("ungültige Werte werden verworfen, alte Markierungen sind wirkungslos", () => {
    expect(sub({ paidThrough: "morgen" }).paidThrough).toBe("");
    const [v] = computeView([sub({ nextDate: "2026-03-20", paidThrough: "2026-02-01" })], toEur, T);
    expect(toISO(v.next)).toBe("2026-03-20");
  });
});

describe("Kategorien und Geld", () => {
  it("catName/catColor", () => {
    expect(catName({ category: "  " })).toBe("Ohne Kategorie");
    expect(catColor("Streaming")).toBe(catColor("Streaming"));
    expect(catColor("Streaming")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("convertWith: über EUR umrechnen, unbekannte Währung unverändert", () => {
    expect(convertWith(RATES, 100, "EUR", "USD")).toBe(125);
    expect(convertWith(RATES, 125, "USD", "EUR")).toBe(100);
    expect(convertWith(RATES, 7, "XYZ", "EUR")).toBe(7);
  });

  it("money formatiert deutsch", () => {
    expect(money(1234.5, "EUR").replace(/\s/g, " ")).toBe("1.234,50 €");
  });
});
