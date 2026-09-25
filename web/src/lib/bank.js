import { CYCLES } from "./constants.js";
import { toISO, today, daysBetween, addCycle } from "./dates.js";

export function parseCsv(text) {
  const head = text.split(/\r?\n/).slice(0, 30).join("\n");
  const cnt = { ";": 0, ",": 0, "\t": 0 };
  for (const ch of head) if (ch in cnt) cnt[ch]++;
  const delim = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
export const COLS = {
  date:   /^(buchungstag|buchungsdatum|buchung\b|datum|date|booking date|started date|completed date|wertstellung|valuta)/,
  amount: /^(betrag|umsatz|amount)/,
  payee:  /(beg[uü]e?nstigter|zahlungspflichtiger|auftraggeber|empf[aä]nger|zahlungsbeteiligter|payee)|^name$/,
  text:   /(verwendungszweck|buchungstext|buchungsdetails|beschreibung|description|zweck|payment reference|reference)/
};
export function findColumns(row) {
  const h = row.map(x => x.trim().toLowerCase());
  const idx = re => h.map((x, i) => re.test(x) ? i : -1).filter(i => i >= 0);
  const dates = idx(COLS.date);
  return {
    date: dates.find(i => !/valuta|wertstellung/.test(h[i])) ?? dates[0] ?? -1,
    amount: idx(COLS.amount)[0] ?? -1,
    payee: idx(COLS.payee)[0] ?? -1,
    text: idx(COLS.text)[0] ?? -1
  };
}
export function parseAmount(s) {
  s = String(s ?? "").trim();
  const neg = /-\s*$/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[^\d,.\-+]/g, "");
  if (!/\d/.test(s)) return NaN;
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  if (lc > ld) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  let v = parseFloat(s.replace(/-+$/, ""));
  if (neg && v > 0) v = -v;
  return v;
}
export function parseDate(s) {
  s = String(s ?? "").trim(); let m;
  if ((m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/))) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], m[2] - 1, +m[1]);
  if ((m = s.match(/(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], m[2] - 1, +m[3]);
  if ((m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return new Date(+m[3], m[2] - 1, +m[1]);
  return null;
}
export const median = a => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
export const LEGAL = /\b(gmbh|ag|ltd|limited|inc|sa|se|co|kg|ug|llc|bv|b\.v|sarl|europe|deutschland|germany|international|sepa|lastschrift)\b/g;
export const normKey = s => String(s).toLowerCase().replace(LEGAL, " ").replace(/[^a-zäöüß\s]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
export function niceName(s) {
  s = String(s).replace(/\s+/g, " ").trim().slice(0, 40);
  return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase()) : s;
}
export const CAT_HINTS = [
  ["Streaming", /netflix|disney|prime video|dazn|sky|wow|paramount|apple tv|youtube|rtl\+|joyn|crunchyroll/],
  ["Musik", /spotify|deezer|tidal|apple music|amazon music|soundcloud/],
  ["Cloud", /icloud|google one|dropbox|onedrive|ionos|strato|hetzner/],
  ["Software", /adobe|microsoft|jetbrains|github|openai|chatgpt|anthropic|notion|1password|nordvpn|canva/],
  ["Gaming", /playstation|xbox|nintendo|steam|ea play|ubisoft/],
  ["Fitness", /fitx|mcfit|urban sports|fitness|gym|clever fit|john reed/],
  ["Mobilfunk/Internet", /telekom|vodafone|o2|1&1|congstar|otelo|freenet|mobilcom|1und1|drillisch/],
  ["Versicherung", /versicherung|allianz|huk|axa|ergo|debeka|generali/],
  ["News", /spiegel|zeit|faz|bild|handelsblatt|sz\.de|süddeutsche|medium/]
];
export const guessCategory = name => (CAT_HINTS.find(([, re]) => re.test(name.toLowerCase())) || [""])[0];

export const CYCLE_RULES = [
  { cycle: "weekly",    lo: 6,   hi: 8,   days: 7,   min: 3 },
  { cycle: "monthly",   lo: 26,  hi: 35,  days: 30,  min: 2 },
  { cycle: "quarterly", lo: 84,  hi: 98,  days: 91,  min: 2 },
  { cycle: "yearly",    lo: 350, hi: 380, days: 365, min: 2 }
];
// Wiederkehrende Abbuchungen in einem Bank-CSV finden.
// existing = vorhandene Abos (für den Hinweis „bereits vorhanden?“), day = Stichtag (für Tests einstellbar)
export function analyzeStatement(text, existing = [], day = today()) {
  const rows = parseCsv(text);
  let hi = -1, cols;
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const c = findColumns(rows[i]);
    if (c.date >= 0 && c.amount >= 0 && rows[i].length >= 3) { hi = i; cols = c; break; }
  }
  if (hi < 0) return { error: "Keine Spalten für Datum und Betrag gefunden. Erwartet wird ein CSV-Export deiner Bank (z. B. mit „Buchungstag“ und „Betrag“)." };

  const txs = []; let outgoing = 0;
  for (const r of rows.slice(hi + 1)) {
    const date = parseDate(r[cols.date]), amt = parseAmount(r[cols.amount]);
    if (!date || isNaN(amt) || amt >= 0) continue;
    outgoing++;
    const payee = (r[cols.payee] || "").trim(), text2 = (r[cols.text] || "").trim();
    const src = payee && !/paypal/i.test(payee) ? payee : (text2 || payee);
    const key = normKey(src);
    if (key.length >= 3) txs.push({ date, amount: -amt, key, label: payee && !/paypal/i.test(payee) ? payee : text2.split(/[,;]| {2,}/)[0] });
  }

  const groups = new Map();
  for (const t of txs) { if (!groups.has(t.key)) groups.set(t.key, []); groups.get(t.key).push(t); }
  const found = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => a.date - b.date);
    const latest = list[list.length - 1].amount;
    const same = list.filter(t => Math.abs(t.amount - latest) <= Math.max(0.5, latest * 0.15));
    if (same.length < 2) continue;
    const gaps = [];
    for (let i = 1; i < same.length; i++) { const g = daysBetween(same[i - 1].date, same[i].date); if (g > 0) gaps.push(g); }
    if (!gaps.length) continue;
    const med = median(gaps), rule = CYCLE_RULES.find(r => med >= r.lo && med <= r.hi);
    if (!rule || same.length < rule.min) continue;
    if (gaps.filter(g => g >= rule.lo - 2 && g <= rule.hi + 2).length / gaps.length < 0.7) continue;
    const last = same[same.length - 1].date;
    if (daysBetween(last, day) > rule.days * 1.6) continue;       // vermutlich gekündigt
    const freq = {}; same.forEach(t => freq[t.label] = (freq[t.label] || 0) + 1);
    const name = niceName(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] || key);
    const exists = existing.some(s => { const k = normKey(s.name); return k.length >= 3 && (k === key || key.startsWith(k) || k.startsWith(key)); });
    found.push({ name, price: Math.round(latest * 100) / 100, cycle: rule.cycle, nextDate: toISO(addCycle(last, rule.cycle, 1)),
      count: same.length, category: guessCategory(name + " " + key), exists });
  }
  found.sort((a, b) => b.price * CYCLES[b.cycle].perMonth - a.price * CYCLES[a.cycle].perMonth);
  return { found, outgoing };
}
