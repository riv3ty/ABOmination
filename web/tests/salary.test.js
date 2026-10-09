import { describe, it, expect } from "vitest";
import { BigDecimal } from "../src/lib/pap/bigdecimal.js";
import { lohnsteuer2026 } from "../src/lib/pap/lohnsteuer2026.js";
import { calcSalary, sanitizeIncome, leftover, pkvMaxSubsidy, churchRate } from "../src/lib/salary.js";

const bd = s => BigDecimal.valueOf(s);

describe("BigDecimal (Teilmenge für den PAP)", () => {
  it("rechnet exakt ohne Gleitkommafehler", () => {
    expect(bd(0.1).add(bd(0.2)).toString()).toBe("0.3");
    expect(bd("1.10").multiply(bd(3)).toString()).toBe("3.30");
    expect(bd(5).subtract(bd("7.25")).toString()).toBe("-2.25");
  });
  it("divide ohne Skala ist exakt (wie Java) und mit Skala gerundet", () => {
    expect(bd(2.9).divide(bd(2)).divide(bd(100)).toString()).toBe("0.0145");
    expect(() => bd(1).divide(bd(3))).toThrow();
    expect(bd(1).divide(bd(3), 4, BigDecimal.ROUND_DOWN).toString()).toBe("0.3333");
    expect(bd(2).divide(bd(3), 2, BigDecimal.ROUND_UP).toString()).toBe("0.67");
    expect(bd(-2).divide(bd(3), 2, BigDecimal.ROUND_DOWN).toString()).toBe("-0.66");
  });
  it("setScale, compareTo, longValue", () => {
    expect(bd("12.345").setScale(2, BigDecimal.ROUND_DOWN).toString()).toBe("12.34");
    expect(bd("12.341").setScale(2, BigDecimal.ROUND_UP).toString()).toBe("12.35");
    expect(bd("12.5").setScale(0, BigDecimal.ROUND_HALF_UP).toString()).toBe("13");
    expect(bd(3).setScale(2, BigDecimal.ROUND_DOWN).toString()).toBe("3.00");
    expect(bd("1.50").compareTo(bd(1.5))).toBe(0);
    expect(bd(-1).compareTo(BigDecimal.ZERO)).toBe(-1);
    expect(bd("-7.9").longValue()).toBe(-7);
  });
});

// Erwartungswerte aus einer unabhängigen Umsetzung des PAP 2026 (centgenau mit dem BMF-Rechner)
const GOLDEN = [
  [{ LZZ: 2, RE4: 500000, STKL: 1, KVZ: 2.5, PVZ: 1 }, { LSTLZZ: 78583, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 2, RE4: 350000, STKL: 1, KVZ: 2.9, PVZ: 1, R: 1 }, { LSTLZZ: 40550, SOLZLZZ: 0, BK: 40550 }],
  [{ LZZ: 2, RE4: 350000, STKL: 3, KVZ: 2.9, ZKF: 2, PVA: 1, R: 1 }, { LSTLZZ: 11650, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 2, RE4: 420000, STKL: 2, KVZ: 2.9, ZKF: 1 }, { LSTLZZ: 47300, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 2, RE4: 420000, STKL: 4, KVZ: 2.9, ZKF: 1.5 }, { LSTLZZ: 58183, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 2, RE4: 280000, STKL: 5, KVZ: 2.9, PVZ: 1 }, { LSTLZZ: 56625, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 2, RE4: 280000, STKL: 6, KVZ: 2.9, PVZ: 1, R: 1 }, { LSTLZZ: 60583, SOLZLZZ: 0, BK: 60583 }],
  [{ LZZ: 2, RE4: 1200000, STKL: 1, KVZ: 2.9, PVZ: 1, R: 1 }, { LSTLZZ: 347275, SOLZLZZ: 19100, BK: 347275 }],
  [{ LZZ: 2, RE4: 900000, STKL: 1, KVZ: 2.9, PKV: 1, PKPV: 65000, PKPVAGZ: 32500 }, { LSTLZZ: 234108, SOLZLZZ: 7678, BK: 0 }],
  [{ LZZ: 2, RE4: 300000, STKL: 1, KVZ: 2.9, PVS: 1, PVZ: 1 }, { LSTLZZ: 28900, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 2, RE4: 450000, STKL: 1, KVZ: 2.9, KRV: 1, ALV: 1 }, { LSTLZZ: 79816, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 2, RE4: 400000, STKL: 1, KVZ: 2.9, ALTER1: 1, AJAHR: 2025 }, { LSTLZZ: 51583, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 2, RE4: 400000, STKL: 1, KVZ: 2.9, LZZFREIB: 50000 }, { LSTLZZ: 38333, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 1, RE4: 6000000, STKL: 1, KVZ: 2.9, PVZ: 1 }, { LSTLZZ: 938900, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 1, RE4: 25000000, STKL: 3, KVZ: 2.9, R: 1, ZKF: 1 }, { LSTLZZ: 7523200, SOLZLZZ: 362164, BK: 7113400 }],
  [{ LZZ: 2, RE4: 120000, STKL: 1, KVZ: 2.9 }, { LSTLZZ: 0, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 2, RE4: 120000, STKL: 6, KVZ: 2.9 }, { LSTLZZ: 13508, SOLZLZZ: 0, BK: 0 }],
  [{ LZZ: 2, RE4: 0, STKL: 1 }, { LSTLZZ: 0, SOLZLZZ: 0, BK: 0 }]
];

describe("Lohnsteuer 2026 (amtlicher PAP)", () => {
  it.each(GOLDEN)("%j", (input, want) => {
    const r = lohnsteuer2026(input);
    for (const k of Object.keys(want)) expect(Number(r[k].toString()), k).toBe(want[k]);
  });
  it("lehnt unbekannte Eingaben ab", () => {
    expect(() => lohnsteuer2026({ RE4: 1, Steuerklasse: 1 })).toThrow(/Unbekannte/);
  });
});

describe("calcSalary", () => {
  const base = { gross: 5000, period: "month", stkl: 1, state: "NW", birthYear: 1990, kvz: 2.9, kids: 0 };

  it("Monatsgehalt 5.000 €, Steuerklasse I, kinderlos, NRW", () => {
    const r = calcSalary(base);
    expect(r.month).toMatchObject({ gross: 5000, lst: 782.41, soli: 0, kist: 0, kv: 437.5, pv: 120, rv: 465, av: 65 });
    expect(r.month.net).toBe(3130.09);
    expect(r.year.net).toBeCloseTo(3130.09 * 12, 2);
    expect(r.kind).toBe("normal");
  });
  it("Jahresgehalt wird auf 12 Monate verteilt", () => {
    const m = calcSalary(base), y = calcSalary({ ...base, gross: 60000, period: "year" });
    expect(y.month).toEqual(m.month);
    expect(y.year.gross).toBe(60000);
  });
  it("Kirchensteuer: 8 % in Bayern/Baden-Württemberg, sonst 9 % der Lohnsteuer", () => {
    expect(churchRate("BY")).toBe(8);
    expect(churchRate("NW")).toBe(9);
    const nw = calcSalary({ ...base, church: true }), by = calcSalary({ ...base, church: true, state: "BY" });
    expect(nw.month.kist).toBe(Math.floor(78241 * 9 / 100) / 100);
    expect(by.month.kist).toBe(Math.floor(78241 * 8 / 100) / 100);
  });
  it("Pflegeversicherung: Kinderlosenzuschlag, Abschläge ab dem 2. Kind, Sachsen", () => {
    expect(calcSalary(base).rates.pv).toBeCloseTo(2.4);
    expect(calcSalary({ ...base, kids: 1 }).rates.pv).toBeCloseTo(1.8);
    expect(calcSalary({ ...base, kids: 3 }).rates.pv).toBeCloseTo(1.3);
    expect(calcSalary({ ...base, kids: 9 }).rates.pv).toBeCloseTo(0.8);              // höchstens 4 Abschläge
    expect(calcSalary({ ...base, state: "SN" }).rates.pv).toBeCloseTo(2.9);
    expect(calcSalary({ ...base, birthYear: 2005 }).rates.pv).toBeCloseTo(1.8);      // unter 23: kein Zuschlag
  });
  it("Beitragsbemessungsgrenzen begrenzen die Sozialabgaben", () => {
    const r = calcSalary({ ...base, gross: 15000 });
    expect(r.month.kv).toBe(Math.round(581250 * 0.0875) / 100);
    expect(r.month.rv).toBe(Math.round(845000 * 0.093) / 100);
  });
  it("private Krankenversicherung: Beitrag minus Arbeitgeberzuschuss, keine PV-Pauschale", () => {
    const r = calcSalary({ ...base, gross: 9000, kv: "pkv", pkvPremium: 650 });
    expect(r.pkvSubsidy).toBe(325);
    expect(r.month.kv).toBe(325);
    expect(r.month.pv).toBe(0);
    expect(r.month.lst).toBe(2341.08);
    const cap = calcSalary({ ...base, gross: 9000, kv: "pkv", pkvPremium: 1500 });
    expect(cap.pkvSubsidy * 100).toBe(pkvMaxSubsidy(2.9));
  });
  it("Minijob und Midijob", () => {
    const mini = calcSalary({ ...base, gross: 600 });
    expect(mini.kind).toBe("minijob");
    expect(mini.month).toMatchObject({ lst: 0, kv: 0, rv: 21.6 });
    const midi = calcSalary({ ...base, gross: 1500 });
    expect(midi.kind).toBe("midijob");
    expect(midi.month.kv).toBeLessThan(1500 * 0.0875);
    expect(midi.notes.join(" ")).toMatch(/Midijob/);
  });
  it("Freibetrag senkt die Lohnsteuer, ohne RV/AV entfallen die Beiträge", () => {
    expect(calcSalary({ ...base, gross: 4000, kids: 1, allowance: 6000 }).month.lst).toBe(383.33);
    const r = calcSalary({ ...base, rv: false, av: false });
    expect(r.month.rv + r.month.av).toBe(0);
  });
});

describe("sanitizeIncome / leftover", () => {
  it("übernimmt nur gültige Werte", () => {
    expect(sanitizeIncome(null)).toBeNull();
    const s = sanitizeIncome({ gross: "3500.555", period: "x", stkl: 9, state: "XX", kids: -1, kvz: 99, hack: "<b>", changedAt: 5 });
    expect(s).toMatchObject({ gross: 3500.56, period: "month", stkl: 1, state: "NW", kids: 0, kvz: 2.9, changedAt: 5 });
    expect(s.hack).toBeUndefined();
  });
  it("rechnet aus, was übrig bleibt", () => {
    expect(leftover(3000, 750)).toEqual({ left: 2250, share: 0.25 });
    expect(leftover(1000, 1500).left).toBe(-500);
    expect(leftover(0, 10).share).toBe(0);
  });
});
