// Feste Tabellen und Beschriftungen (keine Abhängigkeiten)
// Ratenkredit (Annuität, Zahlung am Periodenende): Zinssatz p. a. wird auf den Ratenrhythmus umgelegt
export const PERIODS = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 };
export const CYCLES = {
  weekly:    { label: "Wöchentlich",     perMonth: 52 / 12, months: 0 },
  monthly:   { label: "Monatlich",       perMonth: 1,       months: 1 },
  quarterly: { label: "Vierteljährlich", perMonth: 1 / 3,   months: 3 },
  yearly:    { label: "Jährlich",        perMonth: 1 / 12,  months: 12 }
};
export const STATUS = { active: "Aktiv", paused: "Pausiert", cancelled: "Gekündigt", done: "Abbezahlt" };
export const USAGE = { often: "Oft", sometimes: "Manchmal", rarely: "Selten" };
// Kategorie-Farben: gedämpft, auf Violett und Neutraltöne beschränkt (passt zum strengen Farbschema)
export const PALETTE = ["#8b5cf6","#c4b5fd","#71717a","#a78bfa","#a1a1aa","#6d28d9","#52525b","#7c3aed","#d8b4fe","#78716c"];
export const CURRENCIES = ["EUR","USD","GBP","CHF","PLN","CZK","SEK","NOK","DKK","HUF","CAD","AUD","JPY","TRY"];
// Näherungswerte, falls keine Live-Kurse geladen werden konnten (1 EUR = x Fremdwährung)
export const FALLBACK_RATES = { EUR:1, USD:1.17, GBP:0.86, CHF:0.94, PLN:4.25, CZK:24.3, SEK:11, NOK:11.7, DKK:7.46, HUF:395, CAD:1.61, AUD:1.78, JPY:172, TRY:48 };
