// Taschenrechner: wertet einfache Rechenausdrücke sicher aus (kein eval – die CSP verbietet es ohnehin).
// Unterstützt + − × ÷ (auch * / : x), Klammern, Vorzeichen, Dezimalkomma oder -punkt und Prozent wie ein
// Tischrechner: „200 + 19 %“ = 238, „80 − 25 %“ = 60, „50 × 10 %“ = 5, „19 %“ allein = 0,19.

const OPS = { "+": "+", "-": "-", "−": "-", "*": "*", "×": "*", "x": "*", "X": "*", "·": "*", "/": "/", "÷": "/", ":": "/" };

// Zahl lesen: mit Komma → Komma ist Dezimaltrenner, Punkte sind Tausender („1.234,5“);
// ohne Komma → ein Punkt ist Dezimaltrenner („12.99“), mehrere Punkte sind Tausender („1.000.000“)
export function parseNumber(str) {
  const s = String(str).trim();
  if (!/^(\d[\d.]*)?(,\d*)?$/.test(s) || !/\d/.test(s)) return NaN;
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  return (s.match(/\./g) || []).length > 1 ? Number(s.replace(/\./g, "")) : Number(s);
}

function tokenize(src) {
  const out = [];
  const s = String(src).replace(/\s+/g, "");
  for (let i = 0; i < s.length;) {
    const c = s[i];
    const num = /^(\d[\d.]*(,\d*)?|,\d+)/.exec(s.slice(i));
    if (num) {
      const v = parseNumber(num[0].startsWith(",") ? "0" + num[0] : num[0]);
      if (!Number.isFinite(v)) throw new Error(`Zahl nicht lesbar: ${num[0]}`);
      out.push({ t: "num", v }); i += num[0].length; continue;
    }
    if (OPS[c]) { out.push({ t: "op", v: OPS[c] }); i++; continue; }
    if (c === "(" || c === ")" || c === "%") { out.push({ t: c }); i++; continue; }
    throw new Error(`Unbekanntes Zeichen: ${c}`);
  }
  return out;
}

// Rekursiver Abstieg: expr = term (± term)* · term = factor (×÷ factor)* · factor = ±factor | (expr) | Zahl, jeweils mit optionalem %
export function evaluate(src) {
  const tk = tokenize(src);
  if (!tk.length) throw new Error("Bitte eine Rechnung eingeben.");
  let i = 0;
  const peek = () => tk[i], next = () => tk[i++];

  function factor() {
    const t = next();
    if (!t) throw new Error("Rechnung unvollständig.");
    let r;
    if (t.t === "op" && (t.v === "-" || t.v === "+")) { const f = factor(); r = { v: t.v === "-" ? -f.v : f.v, pct: f.pct }; return r; }
    if (t.t === "num") r = { v: t.v, pct: false };
    else if (t.t === "(") {
      const e = expr();
      if (next()?.t !== ")") throw new Error("Klammer nicht geschlossen.");
      r = { v: e.v, pct: false };
    } else throw new Error("Rechnung unvollständig.");
    if (peek()?.t === "%") { next(); r = { v: r.v, pct: true }; }
    return r;
  }
  function term() {
    let a = factor();
    while (peek()?.t === "op" && (peek().v === "*" || peek().v === "/")) {
      const op = next().v, b = factor(), bv = b.pct ? b.v / 100 : b.v;
      const av = a.pct ? a.v / 100 : a.v;
      if (op === "/" && bv === 0) throw new Error("Division durch 0 ist nicht möglich.");
      a = { v: op === "*" ? av * bv : av / bv, pct: false };
    }
    return a;
  }
  function expr() {
    let a = term();
    while (peek()?.t === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = next().v, b = term();
      const av = a.pct ? a.v / 100 : a.v;
      const bv = b.pct ? av * b.v / 100 : b.v;                       // „a + b %“ = a + a·b/100
      a = { v: op === "+" ? av + bv : av - bv, pct: false };
    }
    return a;
  }

  const r = expr();
  if (i < tk.length) throw new Error(peek().t === ")" ? "Zu viele schließende Klammern." : "Rechnung nicht lesbar.");
  const v = r.pct ? r.v / 100 : r.v;
  if (!Number.isFinite(v)) throw new Error("Ergebnis ist zu groß.");
  return Math.round(v * 1e10) / 1e10;                                  // Gleitkomma-Reste wie 0,30000000000000004 glätten
}

export const formatNumber = n =>
  n.toLocaleString("de-DE", { maximumFractionDigits: 10, useGrouping: Math.abs(n) >= 10000 });
