// Exakte Dezimalzahlen für den Lohnsteuer-PAP – die vom BMF-Pseudocode genutzte Teilmenge von Javas BigDecimal:
// add, subtract, multiply, divide (mit/ohne Nachkommastellen), setScale, compareTo, longValue, valueOf.
// Wert = unscaled / 10^scale, gerechnet mit BigInt (keine Gleitkomma-Rundungsfehler).
const P10 = n => 10n ** BigInt(n);
const abs = x => (x < 0n ? -x : x);

// Ganzzahlige Division mit Rundungsart (Java-Semantik: DOWN = Richtung 0, UP = weg von 0, HALF_UP = kaufmännisch)
function divRound(num, den, mode) {
  if (den === 0n) throw new Error("Division durch 0");
  let q = num / den;
  const r = num % den;
  if (r !== 0n) {
    const sign = (num < 0n) !== (den < 0n) ? -1n : 1n;
    if (mode === BigDecimal.ROUND_UP) q += sign;
    else if (mode === BigDecimal.ROUND_HALF_UP && abs(r) * 2n >= abs(den)) q += sign;
    else if (mode !== BigDecimal.ROUND_DOWN && mode !== BigDecimal.ROUND_HALF_UP) throw new Error("Unbekannte Rundungsart " + mode);
  }
  return q;
}

export class BigDecimal {
  constructor(unscaled, scale = 0) {
    this.u = unscaled;
    this.s = scale;
  }

  static fromString(str) {
    const m = /^\s*([+-]?)(\d*)(?:\.(\d*))?\s*$/.exec(String(str));
    if (!m || (m[2] === "" && !m[3])) throw new Error("Keine Dezimalzahl: " + str);
    const frac = m[3] || "";
    return new BigDecimal(BigInt((m[1] === "-" ? "-" : "") + ((m[2] || "0") + frac)), frac.length);
  }
  // wie BigDecimal.valueOf(long|double): Zahlen über ihre kürzeste Dezimaldarstellung (Double.toString)
  static valueOf(v) {
    if (v instanceof BigDecimal) return v;
    if (typeof v === "bigint") return new BigDecimal(v, 0);
    if (typeof v === "number") {
      if (!Number.isFinite(v)) throw new Error("Ungültige Zahl: " + v);
      if (Number.isInteger(v)) return new BigDecimal(BigInt(v), 0);
      const s = String(v);
      if (/e/i.test(s)) return BigDecimal.fromString(v.toFixed(20).replace(/0+$/, ""));
      return BigDecimal.fromString(s);
    }
    return BigDecimal.fromString(v);
  }

  #align(o) {
    const s = Math.max(this.s, o.s);
    return [this.u * P10(s - this.s), o.u * P10(s - o.s), s];
  }
  add(o) { const [a, b, s] = this.#align(o); return new BigDecimal(a + b, s); }
  subtract(o) { const [a, b, s] = this.#align(o); return new BigDecimal(a - b, s); }
  multiply(o) { return new BigDecimal(this.u * o.u, this.s + o.s); }

  // divide(o): exakt (wie Java; nicht abbrechende Division ist ein Fehler) · divide(o, scale, mode): gerundet
  divide(o, scale, mode) {
    if (o.u === 0n) throw new Error("Division durch 0");
    if (scale !== undefined) return new BigDecimal(divRound(this.u * P10(o.s + scale), o.u * P10(this.s), mode), scale);
    const pref = this.s - o.s;
    for (let sc = Math.max(0, pref); sc <= Math.max(0, pref) + 40; sc++) {
      const num = this.u * P10(o.s + sc), den = o.u * P10(this.s);
      if (num % den === 0n) {
        let q = new BigDecimal(num / den, sc);
        while (q.s > Math.max(0, pref) && q.u % 10n === 0n) q = new BigDecimal(q.u / 10n, q.s - 1);   // bevorzugte Skala
        return q;
      }
    }
    throw new Error("Nicht abbrechende Division ohne Nachkommastellen-Angabe");
  }

  setScale(scale, mode) {
    if (scale >= this.s) return new BigDecimal(this.u * P10(scale - this.s), scale);
    return new BigDecimal(divRound(this.u, P10(this.s - scale), mode), scale);
  }
  compareTo(o) { const [a, b] = this.#align(o); return a < b ? -1 : a > b ? 1 : 0; }
  longValue() { return Number(this.u / P10(this.s)); }               // abgeschnitten wie Java
  toNumber() { return Number(this.toString()); }
  toString() {
    const neg = this.u < 0n, digits = abs(this.u).toString().padStart(this.s + 1, "0");
    const int = digits.slice(0, digits.length - this.s), frac = digits.slice(digits.length - this.s);
    return (neg ? "-" : "") + int + (this.s ? "." + frac : "");
  }
}
// Java-Konstanten
BigDecimal.ROUND_UP = 0;
BigDecimal.ROUND_DOWN = 1;
BigDecimal.ROUND_HALF_UP = 4;
BigDecimal.ZERO = new BigDecimal(0n, 0);
BigDecimal.ONE = new BigDecimal(1n, 0);
BigDecimal.TEN = new BigDecimal(10n, 0);
