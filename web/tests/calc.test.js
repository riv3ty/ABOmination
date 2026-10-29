import { describe, it, expect } from "vitest";
import { evaluate, parseNumber, formatNumber } from "../src/lib/calc.js";

describe("Taschenrechner", () => {
  it.each([
    ["1 + 2 × 3", 7], ["(1 + 2) × 3", 9], ["10 ÷ 4", 2.5], ["10 / 4", 2.5], ["10 : 4", 2.5], ["2 x 3", 6], ["7 − 10", -3],
    ["-5 + 2", -3], ["-(2 + 3) × 2", -10], ["0,1 + 0,2", 0.3], ["12,99 × 12", 155.88], ["12.99 * 12", 155.88],
    ["1.234,50 + 0,50", 1235], ["1.000.000 / 1000", 1000], [",5 + ,5", 1], ["899 ÷ 24", 37.4583333333],
    ["200 + 19 %", 238], ["80 − 25 %", 60], ["50 × 10 %", 5], ["19 %", 0.19], ["200 ÷ 50 %", 400], ["(100 + 10 %) × 2", 220],
    ["  3   +4 ", 7]
  ])("%s = %d", (src, want) => expect(evaluate(src)).toBeCloseTo(want, 9));

  it("meldet verständliche Fehler", () => {
    expect(() => evaluate("")).toThrow(/eingeben/);
    expect(() => evaluate("5 ÷ 0")).toThrow(/Division durch 0/);
    expect(() => evaluate("(1 + 2")).toThrow(/Klammer/);
    expect(() => evaluate("1 + 2)")).toThrow(/Klammern/);
    expect(() => evaluate("3 +")).toThrow(/unvollständig/);
    expect(() => evaluate("2 ^ 3")).toThrow(/Unbekanntes Zeichen/);
    expect(() => evaluate("alert(1)")).toThrow();
  });

  it("liest Zahlen im deutschen und englischen Format", () => {
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("12.99")).toBe(12.99);
    expect(parseNumber("1.000.000")).toBe(1000000);
    expect(parseNumber("abc")).toBeNaN();
  });

  it("formatiert Ergebnisse deutsch", () => {
    expect(formatNumber(1234.5)).toBe("1234,5");
    expect(formatNumber(12345.678)).toBe("12.345,678");
    expect(formatNumber(-0.25)).toBe("-0,25");
  });
});
