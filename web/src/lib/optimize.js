import { catName } from "./model.js";
import { fmtDate, today, daysBetween } from "./dates.js";
import { loanBalance } from "./loan.js";
import { normKey } from "./bank.js";

export const OVERLAP = /^(streaming|video|musik|music|cloud|news|zeitung|fitness|gaming|audio|hörbuch)/i;
// fmt = Betrag in der Hauptwährung formatieren, convert = in die Hauptwährung umrechnen
export function optimize(all, { fmt, convert, t = today() }) {
  const active = all.filter(s => s.state === "active");
  const subsA = active.filter(s => !s.inst);
  const tips = [], save = new Map();
  const note = (id, v) => { if (v > 0.005) save.set(id, Math.max(save.get(id) || 0, v)); };   // pro Abo nur einmal zählen
  const yr = s => s.monthly * 12;
  const cheapest = list => [...list].sort((a, b) => a.monthly - b.monthly)[0];

  for (const s of subsA.filter(x => x.usage === "rarely")) {
    tips.push({ icon: "😴", title: `${s.name} nutzt du selten`, text: `Kündigen oder pausieren spart ${fmt(yr(s))} pro Jahr.`, saving: yr(s) });
    note(s.id, yr(s));
  }
  const groups = new Map();
  for (const s of subsA) { const c = catName(s); if (OVERLAP.test(c)) { if (!groups.has(c)) groups.set(c, []); groups.get(c).push(s); } }
  for (const [c, list] of groups) {
    if (list.length < 2) continue;
    const sum = list.reduce((a, s) => a + s.monthly, 0), cheap = cheapest(list);
    tips.push({ icon: "🔁", title: `${list.length} Abos in „${c}“`, saving: yr(cheap),
      text: `Zusammen ${fmt(sum)} pro Monat. Kündigst du „${cheap.name}“ oder nutzt die Dienste abwechselnd, sparst du bis zu ${fmt(yr(cheap))} pro Jahr. Prüfe auch Familien- oder Duo-Tarife.` });
    note(cheap.id, yr(cheap));
  }
  const byName = new Map();
  for (const s of subsA) { const k = normKey(s.name); if (k.length >= 3) { if (!byName.has(k)) byName.set(k, []); byName.get(k).push(s); } }
  for (const list of byName.values()) if (list.length > 1) {
    const cheap = cheapest(list);
    tips.push({ icon: "👯", title: `„${list[0].name}“ ist mehrfach erfasst`, saving: yr(cheap),
      text: `Doppelt abgeschlossen? Das günstigere zu kündigen spart ${fmt(yr(cheap))} pro Jahr.` });
    note(cheap.id, yr(cheap));
  }
  for (const s of subsA) {
    if (!(s.yearlyAlt > 0) || s.cycle === "yearly") continue;
    const alt = convert(s.yearlyAlt, s.currency), diff = yr(s) - alt;
    if (diff > 0.5) {
      tips.push({ icon: "📅", title: `${s.name}: Jahrespreis ist günstiger`, saving: diff,
        text: `Jährlich ${fmt(alt)} statt ${fmt(yr(s))} (−${Math.round(diff / yr(s) * 100)} %). Bedenke die längere Bindung.` });
      note(s.id, diff);
    }
  }
  for (const s of subsA.filter(x => x.usage === "sometimes" && x.monthly >= 10))
    tips.push({ icon: "🤔", title: `${s.name}: ${fmt(s.monthly)} pro Monat bei gelegentlicher Nutzung`, saving: 0,
      text: "Prüfe einen günstigeren oder werbefinanzierten Tarif, oder pausiere in Monaten ohne Nutzung." });
  if (subsA.length >= 4) {
    const top = [...subsA].sort((a, b) => b.monthly - a.monthly).slice(0, 3);
    const share = top.reduce((a, s) => a + s.monthly, 0) / subsA.reduce((a, s) => a + s.monthly, 0);
    tips.push({ icon: "📊", title: `Deine 3 teuersten Abos machen ${Math.round(share * 100)} % der Kosten aus`, saving: 0,
      text: `${top.map(s => `${s.name} (${fmt(s.monthly)}/Monat)`).join(", ")}. Hier lohnt sich der Preisvergleich am meisten.` });
  }
  for (const s of active.filter(x => x.inst && x.loan && x.interestRate > 0 && x.remaining > 0)) {
    // Restzinsen = noch zu zahlende Raten − offenes Kapital (Restschuld nach den bisher bezahlten Raten)
    const rest = Math.max(0, s.remaining * s.price - loanBalance(s.principal, s.price, s.interestRate, s.cycle, s.paid));
    if (rest >= 1) tips.push({ icon: "📉", title: `Ratenzahlung „${s.name}“: noch ${fmt(convert(rest, s.currency))} Zinsen`, saving: 0,
      text: "So viel Zinsen zahlst du bei planmäßiger Rückzahlung noch. Eine vorzeitige Ablösung oder Sondertilgung (falls dein Anbieter das erlaubt) spart einen Teil davon." });
  }
  for (const s of active.filter(x => x.inst && x.endDate && daysBetween(t, x.endDate) <= 183))
    tips.push({ icon: "🏁", title: `Ratenzahlung „${s.name}“ endet am ${fmtDate(s.endDate)}`, saving: 0,
      text: `Danach werden ${fmt(s.monthly)} pro Monat (${fmt(s.monthly * 12)} pro Jahr) frei.` });

  tips.sort((a, b) => b.saving - a.saving);
  return { tips, total: [...save.values()].reduce((a, v) => a + v, 0), unknown: subsA.filter(s => !s.usage).length, flagged: new Set(save.keys()) };
}
