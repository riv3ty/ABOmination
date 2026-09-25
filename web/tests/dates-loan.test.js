import { describe, it, expect } from "vitest";
import { parseISO, toISO, addCycle, nextInfo, daysBetween, whenText } from "../src/lib/dates.js";
import { calcRate, loanBalance, instModel, simulate } from "../src/lib/loan.js";

const d = parseISO;

describe("Datum", () => {
  it("parseISO/toISO sind umkehrbar (lokale Zeit)", () => {
    expect(toISO(d("2026-02-28"))).toBe("2026-02-28");
  });

  it("addCycle rechnet vom Anker aus und driftet nicht an Monatsenden", () => {
    const anchor = d("2026-01-31");
    expect(toISO(addCycle(anchor, "monthly", 1))).toBe("2026-02-28");
    expect(toISO(addCycle(anchor, "monthly", 2))).toBe("2026-03-31");   // nicht 28.03.
    expect(toISO(addCycle(d("2028-01-31"), "monthly", 1))).toBe("2028-02-29");   // Schaltjahr
    expect(toISO(addCycle(anchor, "quarterly", 1))).toBe("2026-04-30");
    expect(toISO(addCycle(anchor, "yearly", 1))).toBe("2027-01-31");
    expect(toISO(addCycle(anchor, "weekly", 2))).toBe("2026-02-14");
  });

  it("nextInfo zählt verstrichene Termine bis zum Stichtag", () => {
    const s = { nextDate: "2026-01-15", cycle: "monthly" };
    expect(nextInfo(s, d("2026-01-10"))).toEqual({ date: d("2026-01-15"), k: 0 });
    expect(nextInfo(s, d("2026-01-15")).k).toBe(0);                     // heute fällig zählt noch nicht als verstrichen
    const r = nextInfo(s, d("2026-04-16"));
    expect(toISO(r.date)).toBe("2026-05-15");
    expect(r.k).toBe(4);
  });

  it("daysBetween und whenText", () => {
    expect(daysBetween(d("2026-03-28"), d("2026-03-30"))).toBe(2);      // über die Zeitumstellung hinweg
    expect([0, 1, 5, -2].map(whenText)).toEqual(["heute", "morgen", "in 5 Tagen", "vor 2 Tagen"]);
  });
});

describe("Ratenkredit", () => {
  it("calcRate: zinslos = Kaufpreis / Anzahl", () => {
    expect(calcRate(1200, 12, 0, "monthly")).toBe(100);
  });

  it("calcRate: Annuität mit Zins", () => {
    // 10.000 € zu 6 % p. a., 12 Monatsraten → 860,66 €
    expect(calcRate(10000, 12, 6, "monthly")).toBe(860.66);
    expect(calcRate(1000, 4, 8, "quarterly")).toBeCloseTo(262.62, 2);
  });

  it("loanBalance: Restschuld am Anfang und am Ende", () => {
    const rate = calcRate(10000, 12, 6, "monthly");
    expect(loanBalance(10000, rate, 6, "monthly", 0)).toBe(10000);
    expect(loanBalance(10000, rate, 6, "monthly", 12)).toBeLessThan(0.1);
    expect(loanBalance(1200, 100, 0, "monthly", 5)).toBe(700);
  });

  it("instModel: Tilgungsplan mit Status und Zinsen", () => {
    const price = calcRate(1200, 12, 10, "monthly");
    const s = { totalPayments: 12, price, interestRate: 10, principal: 1200, cycle: "monthly", nextDate: "2026-04-01",
      byAmount: false, paidCount: 3, paidAmt: 3 * price, remainingAmt: 9 * price, state: "active" };
    const m = instModel(s);
    expect(m.rows).toHaveLength(12);
    expect(m.rows.filter(r => r.status === "paid")).toHaveLength(3);
    expect(m.rows[3].status).toBe("next");
    expect(toISO(m.rows[3].date)).toBe("2026-04-01");                   // Rate 4 = gespeicherter nächster Termin
    expect(m.rows[11].bal).toBeCloseTo(0, 6);
    expect(m.intTotal).toBeCloseTo(price * 12 - 1200, 1);
    expect(m.intPaid + m.intOpen).toBeCloseTo(m.intTotal, 6);
  });

  it("simulate: Sondertilgung verkürzt Laufzeit und spart Zinsen", () => {
    const i = 0.06 / 12, rate = calcRate(10000, 24, 6, "monthly");
    const base = simulate(10000, rate, i, 0), extra = simulate(10000, rate, i, 200);
    expect(base.n).toBe(24);
    expect(extra.n).toBeLessThan(base.n);
    expect(extra.interest).toBeLessThan(base.interest);
  });
});
