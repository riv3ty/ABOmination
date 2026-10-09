// Brutto-Netto-Rechner (Deutschland, Abrechnungsjahr 2026): Lohnsteuer und Solidaritätszuschlag nach dem
// amtlichen Programmablaufplan des BMF (lib/pap/, centgenau wie der BMF-Rechner), Kirchensteuer und die
// Arbeitnehmeranteile zur Sozialversicherung nach den Sätzen und Beitragsbemessungsgrenzen 2026.
// Alle Beträge in Euro (intern in Cent gerechnet, Sozialbeiträge kaufmännisch auf Cent gerundet).
import { lohnsteuer2026 } from "./pap/lohnsteuer2026.js";

export const SALARY_YEAR = 2026;
export const SV = {
  bbgKV: 69750, bbgRV: 101400,          // Beitragsbemessungsgrenzen pro Jahr (KV/PV bzw. RV/AV)
  kv: 14.6, kvzAvg: 2.9,                // allgemeiner Beitragssatz, durchschnittlicher Zusatzbeitrag
  pvAN: 1.8, pvANSachsen: 2.3,          // Arbeitnehmeranteil Pflegeversicherung (Sachsen: höher, dafür ein Feiertag)
  pvAGSachsen: 1.3, pvChildless: 0.6, pvPerChild: 0.25,
  rv: 9.3, av: 1.3,                     // Arbeitnehmeranteile Renten- und Arbeitslosenversicherung
  minijob: 603, midijob: 2000,          // Geringfügigkeitsgrenze und Ende des Übergangsbereichs (pro Monat)
  minijobRV: 3.6                        // Eigenanteil Rentenversicherung im Minijob (ohne Befreiung)
};
export const STATES = {
  BW: "Baden-Württemberg", BY: "Bayern", BE: "Berlin", BB: "Brandenburg", HB: "Bremen", HH: "Hamburg", HE: "Hessen",
  MV: "Mecklenburg-Vorpommern", NI: "Niedersachsen", NW: "Nordrhein-Westfalen", RP: "Rheinland-Pfalz", SL: "Saarland",
  SN: "Sachsen", ST: "Sachsen-Anhalt", SH: "Schleswig-Holstein", TH: "Thüringen"
};
export const churchRate = state => (state === "BW" || state === "BY" ? 8 : 9);

export const INCOME_DEFAULT = Object.freeze({
  gross: 0, period: "month", stkl: 1, zkf: 0, church: false, state: "NW", birthYear: 0,
  kv: "gkv", kvz: SV.kvzAvg, pkvPremium: 0, pkvSubsidy: null,
  kids: 0,                              // Kinder für die Pflegeversicherung (0 = kinderlos, sonst Anzahl, Abschlag ab dem 2. Kind unter 25)
  rv: true, av: true, allowance: 0      // renten-/arbeitslosenversichert, Steuerfreibetrag pro Jahr
});

const num = (v, min, max, fb) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : fb; };

// Nur bekannte Felder mit gültigen Werten (Tresor, Sicherung, Abgleich); null = keine Angaben
export function sanitizeIncome(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = INCOME_DEFAULT;
  const out = {
    gross: Math.round(num(raw.gross, 0, 10_000_000, 0) * 100) / 100,
    period: raw.period === "year" ? "year" : "month",
    stkl: Number.isInteger(raw.stkl) && raw.stkl >= 1 && raw.stkl <= 6 ? raw.stkl : d.stkl,
    zkf: Math.round(num(raw.zkf, 0, 20, 0) * 2) / 2,
    church: raw.church === true,
    state: raw.state in STATES ? raw.state : d.state,
    birthYear: Number.isInteger(raw.birthYear) && raw.birthYear >= 1900 && raw.birthYear <= 2100 ? raw.birthYear : 0,
    kv: raw.kv === "pkv" ? "pkv" : "gkv",
    kvz: Math.round(num(raw.kvz, 0, 10, d.kvz) * 100) / 100,
    pkvPremium: Math.round(num(raw.pkvPremium, 0, 10000, 0) * 100) / 100,
    pkvSubsidy: raw.pkvSubsidy === null || raw.pkvSubsidy === undefined || raw.pkvSubsidy === "" ? null : Math.round(num(raw.pkvSubsidy, 0, 10000, 0) * 100) / 100,
    kids: Number.isInteger(raw.kids) && raw.kids >= 0 && raw.kids <= 20 ? raw.kids : 0,
    rv: raw.rv !== false, av: raw.av !== false,
    allowance: Math.round(num(raw.allowance, 0, 1_000_000, 0) * 100) / 100
  };
  if (Number.isFinite(raw.changedAt) && raw.changedAt > 0) out.changedAt = raw.changedAt;
  return out;
}

const cents = eur => Math.round(eur * 100);
// Beitrag in Cent: Bemessung (Cent) × Satz (Prozent, max. 4 Nachkommastellen) – exakt in Ganzzahlen, kaufmännisch gerundet
const contrib = (baseCt, pct) => { const r = Math.round(pct * 10000); return r <= 0 || baseCt <= 0 ? 0 : Math.floor((baseCt * r + 500000) / 1000000); };

// Höchstzuschuss des Arbeitgebers zur privaten Kranken- und Pflegeversicherung pro Monat (Cent)
export function pkvMaxSubsidy(kvz = SV.kvzAvg, state = "NW") {
  const bbg = cents(SV.bbgKV / 12);
  return contrib(bbg, SV.kv / 2 + kvz / 2) + contrib(bbg, state === "SN" ? SV.pvAGSachsen : SV.pvAN);
}

// Gerechnet wird wie in der Lohnabrechnung pro Monat (Lohnzahlungszeitraum Monat); ein Jahresgehalt wird
// auf 12 gleiche Monatsgehälter verteilt, die Jahreswerte sind das Zwölffache.
export function calcSalary(input, year = SALARY_YEAR) {
  const p = { ...INCOME_DEFAULT, ...sanitizeIncome(input) };
  const yearly = p.period === "year";
  const inCt = cents(p.gross), grossCt = yearly ? Math.round(inCt / 12) : inCt;      // Monatsbrutto in Cent
  const notes = [];
  const age = p.birthYear ? year - p.birthYear : null;
  const kind = grossCt <= cents(SV.minijob) ? "minijob" : grossCt <= cents(SV.midijob) ? "midijob" : "normal";

  // ---------- Steuern (PAP) ----------
  let lst = 0, soli = 0, kist = 0;
  const pkv = p.kv === "pkv";
  const pkvSub = pkv ? (p.pkvSubsidy === null ? Math.min(Math.round(cents(p.pkvPremium) / 2), pkvMaxSubsidy(p.kvz, p.state)) : cents(p.pkvSubsidy)) : 0;
  const childless = p.kids === 0 && (age === null || age >= 23);
  const pva = p.kids >= 2 ? Math.min(4, p.kids - 1) : 0;
  if (kind === "minijob") notes.push("Minijob: Die Lohnsteuer wird in der Regel pauschal vom Arbeitgeber getragen.");
  else if (grossCt > 0) {
    const r = lohnsteuer2026({
      LZZ: 2, RE4: grossCt, STKL: p.stkl, ZKF: p.stkl <= 4 ? p.zkf : 0, R: p.church ? 1 : 0,
      KVZ: p.kvz, PKV: pkv ? 1 : 0, PKPV: pkv ? cents(p.pkvPremium) : 0, PKPVAGZ: pkvSub,
      PVS: p.state === "SN" ? 1 : 0, PVZ: !pkv && childless ? 1 : 0, PVA: pkv ? 0 : pva,
      KRV: p.rv ? 0 : 1, ALV: p.av ? 0 : 1,
      LZZFREIB: Math.round(cents(p.allowance) / 12),
      ALTER1: age !== null && age >= 65 ? 1 : 0, AJAHR: p.birthYear ? p.birthYear + 65 : 0
    });
    lst = Number(r.LSTLZZ.toString());
    soli = Number(r.SOLZLZZ.toString());
    if (p.church) kist = Math.floor(Number(r.BK.toString()) * churchRate(p.state) / 100);
  }

  // ---------- Sozialversicherung (Arbeitnehmeranteil) ----------
  let base = grossCt;
  if (kind === "midijob") {
    // Übergangsbereich: beitragspflichtige Einnahme des Arbeitnehmers = OG / (OG − G) × (Entgelt − G)
    const G = cents(SV.minijob), OG = cents(SV.midijob);
    base = Math.round(OG / (OG - G) * (grossCt - G));
    notes.push("Midijob (Übergangsbereich): reduzierte Arbeitnehmerbeiträge, Ergebnis ist eine Näherung.");
  }
  let kv = 0, pv = 0, rv = 0, av = 0;
  const pvRate = (p.state === "SN" ? SV.pvANSachsen : SV.pvAN) + (childless ? SV.pvChildless : 0) - pva * SV.pvPerChild;
  if (kind === "minijob") {
    if (p.rv) rv = contrib(grossCt, SV.minijobRV);
  } else {
    const kvBase = Math.min(base, cents(SV.bbgKV / 12)), rvBase = Math.min(base, cents(SV.bbgRV / 12));
    if (pkv) kv = Math.max(0, cents(p.pkvPremium) - pkvSub);       // privat: Beitrag abzüglich Arbeitgeberzuschuss
    else {
      kv = contrib(kvBase, SV.kv / 2 + p.kvz / 2);
      pv = contrib(kvBase, pvRate);
    }
    if (p.rv) rv = contrib(rvBase, SV.rv);
    if (p.av) av = contrib(rvBase, SV.av);
  }
  if (p.stkl === 6) notes.push("Steuerklasse VI: für einen Zweitjob – die Freibeträge stecken bereits im Hauptjob.");
  if (age !== null && age >= 67) notes.push("Ab der Regelaltersgrenze entfallen meist Renten- und Arbeitslosenversicherung – bei Bedarf abwählen.");

  const tax = lst + soli + kist, social = kv + pv + rv + av;
  const m = { gross: grossCt, lst, soli, kist, tax, kv, pv, rv, av, social, net: grossCt - tax - social };
  const y = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v * 12]));
  if (yearly) { y.gross = inCt; y.net = inCt - y.tax - y.social; }                 // Rundungsrest des Jahresgehalts
  const eur = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / 100]));
  return {
    period: p.period, kind, notes, taxYear: year,
    month: eur(m), year: eur(y),
    rates: { kv: pkv ? null : SV.kv / 2 + p.kvz / 2, pv: pkv ? null : pvRate, rv: p.rv ? (kind === "minijob" ? SV.minijobRV : SV.rv) : 0, av: p.av && kind !== "minijob" ? SV.av : 0, church: p.church ? churchRate(p.state) : 0 },
    pkvSubsidy: pkvSub / 100
  };
}

// Was nach Steuern, Abgaben und festen Ausgaben übrig bleibt (pro Monat)
export function leftover(netMonth, expensesMonth) {
  const left = netMonth - expensesMonth;
  return { left, share: netMonth > 0 ? Math.min(1, Math.max(0, expensesMonth / netMonth)) : 0 };
}
