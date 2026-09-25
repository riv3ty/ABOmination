import { PERIODS } from "./constants.js";
import { parseISO, addCycle } from "./dates.js";

export function calcRate(principal, n, annualPct, cycle) {
  const i = annualPct / 100 / PERIODS[cycle];
  const r = i > 0 ? principal * i / (1 - Math.pow(1 + i, -n)) : principal / n;
  return Math.round(r * 100) / 100;
}
// Restschuld (Kapital) nach m gezahlten Raten
export function loanBalance(principal, rate, annualPct, cycle, m) {
  const i = annualPct / 100 / PERIODS[cycle];
  return Math.max(0, i > 0 ? principal * Math.pow(1 + i, m) - rate * (Math.pow(1 + i, m) - 1) / i : principal - rate * m);
}
// Tilgungsplan, Zinsen und Restschuld einer Ratenzahlung
export function instModel(s) {
  const n = s.totalPayments, price = s.price, i = s.interestRate / 100 / PERIODS[s.cycle];
  const base0 = s.byAmount ? Math.floor(s.paidAmount / price + 1e-9) : s.paidCount;     // beim gespeicherten Termin bereits bezahlte Raten
  const fullPaid = price > 0 ? Math.min(n, Math.floor(s.paidAmt / price + 1e-9)) : 0;
  const frac = price > 0 && fullPaid < n ? Math.max(0, s.paidAmt / price - fullPaid) : 0;   // angezahlter Teil der nächsten Rate
  const hasLoan = s.principal > 0 && s.interestRate > 0;
  const anchor = parseISO(s.nextDate);
  const rows = []; let bal = s.principal, intPaid = 0, intTotal = 0;
  for (let j = 1; j <= n; j++) {
    let interest = 0, princ = 0, pay = price;
    if (hasLoan) {
      interest = bal * i;
      if (j === n) pay = bal + interest;                                                 // letzte Rate gleicht Rundung aus
      princ = pay - interest; bal = Math.max(0, bal - princ);
      intTotal += interest; if (j <= fullPaid) intPaid += interest;
    }
    const status = j <= fullPaid ? "paid" : (j === fullPaid + 1 && s.state !== "done") ? (frac > 0.005 ? "partial" : "next") : "open";
    rows.push({ j, date: addCycle(anchor, s.cycle, j - base0 - 1), pay, interest, princ, bal, status });
  }
  const balNow = hasLoan ? loanBalance(s.principal, price, s.interestRate, s.cycle, fullPaid + frac) : s.remainingAmt;
  return { rows, fullPaid, frac, hasLoan, i, balNow, intTotal, intPaid, intOpen: Math.max(0, intTotal - intPaid) };
}
// Restlaufzeit und Zinsen, wenn pro Rate zusätzlich `extra` gezahlt wird
export function simulate(balance, rate, i, extra) {
  let n = 0, interest = 0, bal = balance;
  while (bal > 0.005 && n < 1200) {
    const it = bal * i, pay = Math.min(rate + extra, bal + it);
    bal = bal + it - pay; interest += it; n++;
  }
  return { n, interest };
}
