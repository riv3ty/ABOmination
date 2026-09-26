// Erfundene Beispieldaten (Sicherung Version 3) für Screenshots und die Demo auf der Website.
// Termine relativ zum Stichtag, damit Zeitleiste und Erinnerungen immer gefüllt sind.
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function demoData(today = new Date()) {
  const inDays = n => { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n); return iso(d); };
  let n = 0;
  const sub = o => ({ id: `demo-${++n}`, status: "active", currency: "EUR", cycle: "monthly", category: "", account: "Girokonto", usage: "", noticeDays: 0, payment: "", notes: "", ...o });
  return {
    app: "abo-manager", version: 3, exportedAt: Date.now(), updatedAt: Date.now(),
    subs: [
      sub({ name: "Netflix", price: 13.99, category: "Streaming", nextDate: inDays(2), usage: "sometimes", payment: "Visa", account: "Kreditkarte" }),
      sub({ name: "Disney+", price: 9.99, category: "Streaming", nextDate: inDays(11), usage: "rarely", account: "Kreditkarte" }),
      sub({ name: "Spotify Family", price: 17.99, category: "Musik", nextDate: inDays(6), usage: "often", payment: "PayPal" }),
      sub({ name: "iCloud+ 200 GB", price: 2.99, category: "Cloud", nextDate: inDays(19), usage: "often", account: "Kreditkarte" }),
      sub({ name: "Adobe Creative Cloud", price: 66.45, category: "Software", nextDate: inDays(24), usage: "sometimes", yearlyAlt: 719.88, noticeDays: 14 }),
      sub({ name: "ChatGPT Plus", price: 20, currency: "USD", category: "Software", nextDate: inDays(9), usage: "often", account: "Kreditkarte" }),
      sub({ name: "Fitnessstudio", price: 29.9, category: "Fitness", nextDate: inDays(4), usage: "rarely", noticeDays: 30, notes: "Mindestlaufzeit bis März" }),
      sub({ name: "Handyvertrag", price: 24.99, category: "Mobilfunk/Internet", nextDate: inDays(15), usage: "often", noticeDays: 30 }),
      sub({ name: "Glasfaser 500", price: 44.95, category: "Mobilfunk/Internet", nextDate: inDays(27), usage: "often" }),
      sub({ name: "Amazon Prime", price: 89.9, cycle: "yearly", category: "Shopping", nextDate: inDays(38), usage: "often" }),
      sub({ name: "Haftpflichtversicherung", price: 64.8, cycle: "yearly", category: "Versicherung", nextDate: inDays(71), noticeDays: 90 }),
      sub({ name: "Zeitung digital", price: 14.99, category: "News", nextDate: inDays(13), usage: "rarely", noticeDays: 7 }),
      sub({ name: "Smartphone", kind: "installment", price: 0, principal: 1199, interestRate: 5.9, totalPayments: 24, paidCount: 9,
        category: "Technik", nextDate: inDays(8), payment: "Ratenkauf Händler" }),
      sub({ name: "Sofa", kind: "installment", price: 0, principal: 1450, interestRate: 0, totalPayments: 10, paidCount: 7,
        category: "Wohnen", nextDate: inDays(17), account: "Kreditkarte" }),
      sub({ name: "E-Bike", kind: "installment", price: 0, principal: 3290, interestRate: 3.9, totalPayments: 36, paidCount: 30, cycle: "monthly",
        category: "Mobilität", nextDate: inDays(21) })
    ].map(s => s.kind === "installment" ? { ...s, price: rate(s.principal, s.totalPayments, s.interestRate) } : s),
    settings: { base: "EUR", remindDays: 3, noticeRemind: 14, notif: false, autoLock: 15 },
    achievements: null
  };
}

// Annuität wie in der App (lib/loan.js calcRate), hier ohne Import, damit das Skript eigenständig läuft
function rate(p, n, pct) {
  const i = pct / 100 / 12;
  return Math.round((i > 0 ? p * i / (1 - Math.pow(1 + i, -n)) : p / n) * 100) / 100;
}
