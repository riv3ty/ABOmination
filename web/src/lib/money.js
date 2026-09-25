// Währungsformat und Umrechnung (Kurse: 1 EUR = x Fremdwährung)
const nfCache = {};
export const money = (v, c = "EUR") => (nfCache[c] ||= new Intl.NumberFormat("de-DE", { style: "currency", currency: c })).format(v);
export function convertWith(rates, amount, from, to) {
  if (from === to || !rates[from] || !rates[to]) return amount;
  return amount / rates[from] * rates[to];
}
