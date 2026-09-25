// Die eigentliche App (Dashboard, Tabelle, Dialoge, Sync). Wird nach dem Entsperren über startApp() gestartet;
// beim Import werden nur Funktionen definiert und Event-Handler an das (statische) Markup gehängt.
import { Vault } from "./vault.js";
import { $, esc } from "./lib/dom.js";
import { CYCLES, STATUS, USAGE, CURRENCIES, FALLBACK_RATES } from "./lib/constants.js";
import { parseISO, toISO, fmtDate, today, daysBetween, addDays, whenText } from "./lib/dates.js";
import { money, convertWith } from "./lib/money.js";
import { calcRate, instModel, simulate } from "./lib/loan.js";
import { uid, normalizeSub, clean, computeView, catName, catColor } from "./lib/model.js";
import { optimize as optimizeWith } from "./lib/optimize.js";
import { computeReminders as remindersFor } from "./lib/reminders.js";
import { buildIcs } from "./lib/ics.js";
import { analyzeStatement } from "./lib/bank.js";

/* ================= Konstanten ================= */
const KEY = "abo-manager-v1", META_KEY = "abo-manager-meta", SET_KEY = "abo-manager-settings",
      RATES_KEY = "abo-manager-rates", NOTIF_KEY = "abo-manager-notified", ACH_KEY = "abo-manager-achievements";


/* ================= Speicher ================= */
// Private Daten (Abos, Einstellungen, Sync-Zugang) liegen verschlüsselt im Profil-Tresor (Vault),
// alles andere (Wechselkurse, Benachrichtigungs-Merker) unverschlüsselt im localStorage.
const PRIVATE_KEYS = ["abo-manager-v1", "abo-manager-meta", "abo-manager-settings", "abo-manager-sync", "abo-manager-achievements"];
const lsGet = (k, fb) => {
  if (PRIVATE_KEYS.includes(k)) return Vault.get(k, fb);
  try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fb; } catch { return fb; }
};
const lsSet = (k, v) => {
  if (PRIVATE_KEYS.includes(k)) return Vault.set(k, v);
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
};

// Zustand; befüllt in loadState() (erst nach dem Entsperren ist der Tresor lesbar)
let subs = [], meta = { updatedAt: 0 }, settings = {}, ratesInfo = null, rates = FALLBACK_RATES;
let sort = { key: "next", dir: 1 };
let editId = null;

/* ================= Errungenschaften ================= */
const ACH_DEFAULT = {
  unlocked: {}, maxSubs: 0, cancelled: 0, cycleUpgrades: 0, installmentsPaid: 0, doneInstallmentIds: [],
  savedYearly: 0, optimizerActed: false, importedBank: false, exportedIcs: false, exportedJson: false,
  syncConnected: false, pwChanged: false
};
let ach = structuredClone(ACH_DEFAULT);
const saveAch = () => lsSet(ACH_KEY, ach);
let lastOptFlagged = new Set();     // IDs, die zuletzt in der Optimierung als Spar-Tipp auftauchten
const ACHIEVEMENTS = [
  { id: "first-sub", icon: "🎉", title: "Erste Schritte", desc: "Das erste Abo oder die erste Ratenzahlung angelegt.", test: c => c.a.maxSubs >= 1 },
  { id: "collector-5", icon: "📚", title: "Sammler", desc: "5 Abos gleichzeitig verwaltet.", test: c => c.a.maxSubs >= 5 },
  { id: "collector-10", icon: "🗂️", title: "Großverwalter", desc: "10 Abos gleichzeitig verwaltet.", test: c => c.a.maxSubs >= 10 },
  { id: "first-cancel", icon: "✂️", title: "Aufgeräumt", desc: "Das erste Abo gekündigt.", test: c => c.a.cancelled >= 1 },
  { id: "cancel-5", icon: "🥷", title: "Serienkündiger", desc: "5 Abos gekündigt.", test: c => c.a.cancelled >= 5 },
  { id: "debt-free", icon: "🏁", title: "Schuldenfrei", desc: "Eine Ratenzahlung vollständig abbezahlt.", test: c => c.a.installmentsPaid >= 1 },
  { id: "debt-free-3", icon: "💪", title: "Frei und ledig", desc: "3 Ratenzahlungen vollständig abbezahlt.", test: c => c.a.installmentsPaid >= 3 },
  { id: "yearly-switch", icon: "📅", title: "Jahresplaner", desc: "Von monatlicher auf jährliche Zahlung gewechselt.", test: c => c.a.cycleUpgrades >= 1 },
  { id: "optimizer", icon: "💡", title: "Optimierer", desc: "Einen Tipp aus der Optimierung umgesetzt und gekündigt.", test: c => c.a.optimizerActed },
  { id: "saver-100", icon: "💰", title: "Sparfuchs", desc: "Durch Kündigungen mindestens 100 € pro Jahr gespart.", test: c => c.a.savedYearly >= 100 },
  { id: "all-categorized", icon: "🏷️", title: "Alles sortiert", desc: "Jedem Abo eine Kategorie gegeben.", test: c => c.allCategorized },
  { id: "all-usage", icon: "🔍", title: "Selbsterkenntnis", desc: "Bei jedem aktiven Abo die Nutzung eingetragen.", test: c => c.allUsageSet },
  { id: "bank-import", icon: "🏦", title: "Kontodetektiv", desc: "Abos aus einem Kontoauszug erkannt.", test: c => c.a.importedBank },
  { id: "ics-export", icon: "📆", title: "Gut geplant", desc: "Die Kalender-Datei exportiert.", test: c => c.a.exportedIcs },
  { id: "json-export", icon: "💾", title: "Vorsorge getroffen", desc: "Eine Sicherung erstellt.", test: c => c.a.exportedJson },
  { id: "sync", icon: "☁️", title: "Vernetzt", desc: "Cloud-Sync eingerichtet.", test: c => c.a.syncConnected },
  { id: "foreign-currency", icon: "🌍", title: "Weltbürger", desc: "Ein Abo in einer Fremdwährung angelegt.", test: c => c.foreignCurrency },
  { id: "pw-changed", icon: "🔐", title: "Sicherheitsbewusst", desc: "Das Passwort geändert.", test: c => c.a.pwChanged },
  { id: "one-year", icon: "🕰️", title: "Ein Jahr dabei", desc: "Seit einem Jahr im ABOmination angemeldet.", test: c => c.profileAgeDays >= 365 }
];
function trackCancel(s) {
  ach.cancelled++;
  ach.savedYearly += convert(s.price * CYCLES[s.cycle].perMonth, s.currency, "EUR") * 12;   // immer in EUR (Schwelle „100 €“)
  if (lastOptFlagged.has(s.id)) ach.optimizerActed = true;
}
// wird am Ende von render() mit den aktuellen Abos aufgerufen: leitet Fortschritt ab und schaltet ggf. neu frei
function checkAchievements(rawSubs, viewSubs) {
  let changed = false;
  const activeCount = rawSubs.filter(s => s.status !== "cancelled").length;
  if (activeCount > ach.maxSubs) { ach.maxSubs = activeCount; changed = true; }
  for (const s of viewSubs) if (s.inst && s.state === "done" && !ach.doneInstallmentIds.includes(s.id)) {
    ach.doneInstallmentIds.push(s.id); ach.installmentsPaid++; changed = true;
  }
  const nonInstActive = rawSubs.filter(s => s.status !== "cancelled" && s.kind !== "installment");
  const ctx = {
    a: ach,
    allCategorized: rawSubs.length > 0 && rawSubs.every(s => s.category.trim()),
    allUsageSet: nonInstActive.length > 0 && nonInstActive.every(s => s.usage),
    foreignCurrency: rawSubs.some(s => s.currency !== settings.base),
    profileAgeDays: Vault.created ? (Date.now() - Vault.created) / 86400000 : 0
  };
  const newly = [];
  for (const def of ACHIEVEMENTS) if (!ach.unlocked[def.id] && def.test(ctx)) { ach.unlocked[def.id] = Date.now(); newly.push(def); changed = true; }
  if (changed) saveAch();
  const badge = $("#achCount"); if (badge) badge.textContent = `${Object.keys(ach.unlocked).length}/${ACHIEVEMENTS.length}`;
  renderAchTile();
  if (newly.length) showAchToasts(newly);
}
function renderAch() {
  const n = Object.keys(ach.unlocked).length;
  $("#achProgress").textContent = `${n} von ${ACHIEVEMENTS.length} freigeschaltet`;
  $("#achList").innerHTML = ACHIEVEMENTS.map(a => {
    const ts = ach.unlocked[a.id];
    return `<div class="ach-card${ts ? "" : " locked"}"><span class="ach-ic">${ts ? a.icon : "🔒"}</span>
      <div><b>${esc(a.title)}</b><div class="muted">${esc(a.desc)}</div>${ts ? `<div class="muted" style="margin-top:3px">${fmtDate(new Date(ts))}</div>` : ""}</div></div>`;
  }).join("");
}
function showAchToasts(list) {
  const wrap = $("#toasts");
  list.forEach((a, i) => setTimeout(() => {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<span class="ach-ic">${a.icon}</span><div><b>Errungenschaft freigeschaltet</b><span class="big">${esc(a.title)}</span></div>`;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }, i * 400));
}
$("#btnAch").onclick = () => { renderAch(); $("#dlgAch").showModal(); };
$("#achClose").onclick = () => $("#dlgAch").close();
document.addEventListener("abo:pwchanged", () => { ach.pwChanged = true; saveAch(); checkAchievements(subs, view()); });


// Beide Schlüssel liegen im Tresor; ein Fehlschlag beim (asynchronen) Verschlüsseln/Speichern meldet Vault.flush() selbst.
function persist() { lsSet(KEY, subs); lsSet(META_KEY, meta); }
function save() { meta.updatedAt = Date.now(); persist(); schedulePush(); }
const saveSettings = () => lsSet(SET_KEY, settings);


/* ================= Währungen ================= */
const mb = v => money(v, settings.base);
const convert = (amount, from, to = settings.base) => convertWith(rates, amount, from, to);
async function refreshRates(manual) {
  try {
    const r = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR");
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    rates = { EUR: 1, ...j.rates };
    ratesInfo = { date: j.date, rates, fetchedAt: Date.now() };
    lsSet(RATES_KEY, ratesInfo);
    render(); renderSettingsInfo();
  } catch {
    if (manual) alert("Wechselkurse konnten nicht geladen werden (keine Internetverbindung?). Es werden gespeicherte bzw. Näherungswerte verwendet.");
  }
}
function needRates() { return settings.base !== "EUR" || subs.some(s => s.currency !== "EUR"); }
function maybeRefreshRates() {
  const stale = !ratesInfo || Date.now() - ratesInfo.fetchedAt > 86400000;
  if (stale && needRates()) refreshRates(false);
}

/* ================= Auswertung ================= */
// Dünne Hüllen um die reinen Funktionen aus lib/ (dort getestet), gebunden an den aktuellen Zustand
const view = () => computeView(subs, convert);
const optimize = all => optimizeWith(all, { fmt: mb, convert });
const computeReminders = () => remindersFor(view(), settings);
function exportIcs() { download("abos-kalender.ics", buildIcs(view(), settings), "text/calendar;charset=utf-8"); }

function render() {
  const all = view();
  const active = all.filter(s => s.state === "active");
  const insts = active.filter(s => s.inst);
  const openRates = insts.reduce((a, s) => a + s.remainingBase, 0);
  const lastEnd = insts.reduce((a, s) => (!a || s.endDate > a ? s.endDate : a), null);
  const perMonth = active.reduce((a, s) => a + s.monthly, 0);
  const soon = active.filter(s => s.inDays <= 30).sort((a, b) => a.next - b.next);
  const soonSum = soon.reduce((a, s) => a + convert(s.due, s.currency), 0);
  const first = soon[0];

  // Kennzahlen als Bento-Kacheln (statische Kacheln, damit die Einblend-Animation nicht bei jedem Rendern neu startet)
  const top = [...active].sort((a, b) => b.monthly - a.monthly)[0];
  const optTotal = optimize(all).total;
  const mixMap = {}; active.forEach(s => { const c = catName(s); mixMap[c] = (mixMap[c] || 0) + s.monthly; });
  const mix = Object.entries(mixMap).sort((a, b) => b[1] - a[1]), mixTotal = mix.reduce((a, [, v]) => a + v, 0);
  const mixTop = mix.slice(0, 4), mixRest = mixTotal - mixTop.reduce((a, [, v]) => a + v, 0);
  const dateLong = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("#tHero").innerHTML = `
    <div>
      <div class="eyebrow">Übersicht · ${esc(dateLong)}</div>
      <div class="eyebrow" style="margin-top:34px;color:var(--accent-ink)">Pro Monat</div>
      <div class="display">${mb(perMonth)}</div>
      <p class="lede">${active.length
        ? `${active.length} aktive Abos und Ratenkäufe – zusammen <em>${mb(perMonth * 12)}</em> im Jahr.${top ? ` Der größte Posten ist ${esc(top.name)} mit ${mb(top.monthly)} pro Monat.` : ""}`
        : "Noch nichts erfasst. Lege dein erstes Abo an – ab dann siehst du hier, was wirklich jeden Monat abgeht."}</p>
    </div>
    ${mixTotal > 0 ? `<div class="mix"><div class="eyebrow">Verteilung nach Kategorie</div>
      <div class="mix-bar">${mixTop.map(([c, v]) => `<i style="flex:${v};background:${catColor(c)}" title="${esc(c)}: ${esc(mb(v))}"></i>`).join("")}${mixRest > 0.005 ? `<i style="flex:${mixRest};background:var(--line-strong)" title="Weitere: ${esc(mb(mixRest))}"></i>` : ""}</div>
      <div class="mix-leg">${mixTop.map(([c, v]) => `<span><i style="background:${catColor(c)}"></i>${esc(c)} ${Math.round(v / mixTotal * 100)} %</span>`).join("")}${mixRest > 0.005 ? `<span><i style="background:var(--line-strong)"></i>Weitere ${Math.round(mixRest / mixTotal * 100)} %</span>` : ""}</div></div>` : "<div></div>"}
    <div class="iboxes">
      <div class="ibox"><span class="ic-c">${ICON.wallet}</span><div><div class="k">Aktive Abos</div><div class="v">${active.length}</div></div></div>
      <div class="ibox"><span class="ic-c">${ICON.clock}</span><div><div class="k">Nächste Zahlung</div><div class="v">${first ? `${esc(first.name)} · ${whenText(first.inDays)}` : "keine anstehend"}</div></div></div>
      <div class="ibox"><span class="ic-c">${ICON.bulb}</span><div><div class="k">Sparpotenzial</div><div class="v">${optTotal > 0 ? `bis zu ${mb(optTotal)}/Jahr` : "keine Hinweise"}</div></div></div>
    </div>`;
  $("#tHero").classList.toggle("tall", insts.length > 0);
  $("#tYear").innerHTML = `<div class="tile-top"><span class="eyebrow">Pro Jahr</span><span class="ic-c">${ICON.trend}</span></div>
    <div><div class="num-serif">${mb(perMonth * 12)}</div><div class="muted small" style="margin-top:8px">hochgerechnet</div></div>`;
  $("#t30").innerHTML = `<div class="tile-top"><span class="eyebrow">Nächste 30 Tage</span><span class="ic-c">${ICON.calendar}</span></div>
    <div><div class="num-serif">${mb(soonSum)}</div><div class="muted small" style="margin-top:8px">${soon.length} Zahlung${soon.length === 1 ? "" : "en"}</div></div>`;
  $("#tOpen").hidden = !insts.length;
  if (insts.length) $("#tOpen").innerHTML = `<div class="tile-top"><span class="eyebrow">Offene Raten</span><span class="ic-c">${ICON.receipt}</span></div>
    <div><div class="num-serif">${mb(openRates)}</div><div class="muted small" style="margin-top:8px">${insts.length} Ratenzahlung${insts.length > 1 ? "en" : ""} · letzte Rate ${lastEnd.toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" })}</div></div>`;

  const byCat = {};
  active.forEach(s => { const c = catName(s); byCat[c] = (byCat[c] || 0) + s.monthly; });
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;
  $("#cats").innerHTML = entries.length ? entries.map(([c, v]) => `
    <div class="bar-row"><span title="${esc(c)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c)}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${(v / max * 100).toFixed(1)}%;background:${catColor(c)}"></div></div>
    <span class="amt">${mb(v)}</span></div>`).join("") : `<div class="muted">Keine Daten.</div>`;

  $("#upcoming").innerHTML = soon.length ? soon.map(s => `
    <div class="up"><div><div class="name">${esc(s.name)}</div><div class="muted" style="font-size:13px">${fmtDate(s.next)} · ${whenText(s.inDays)}</div></div>
    <div style="font-variant-numeric:tabular-nums;font-family:var(--f-head);font-weight:700">${money(s.due, s.currency)}</div></div>`).join("") : `<div class="muted">Keine Zahlungen in den nächsten 30 Tagen.</div>`;
  renderTimeline(soon);

  const cats = [...new Set(subs.map(catName))].sort((a, b) => a.localeCompare(b, "de"));
  const cur = $("#fCat").value;
  $("#fCat").innerHTML = `<option value="">Alle Kategorien</option>` + cats.map(c => `<option${c === cur ? " selected" : ""}>${esc(c)}</option>`).join("");
  $("#catList").innerHTML = cats.map(c => `<option value="${esc(c)}">`).join("");

  const accs = [...new Map(subs.filter(s => s.account).map(s => [s.account.toLowerCase(), s.account])).values()].sort((a, b) => a.localeCompare(b, "de"));
  const curAcc = $("#fAcc").value;
  $("#fAcc").innerHTML = `<option value="">Alle Bankkonten</option>` + accs.map(a => `<option${a === curAcc ? " selected" : ""}>${esc(a)}</option>`).join("")
    + (subs.some(s => !s.account) && accs.length ? `<option value="${NO_ACC_FILTER}"${curAcc === NO_ACC_FILTER ? " selected" : ""}>Ohne Bankkonto</option>` : "");
  $("#accList").innerHTML = accs.map(a => `<option value="${esc(a)}">`).join("");
  renderAccounts(active);
  renderInstallments(all);

  const q = $("#q").value.trim().toLowerCase(), fs = $("#fStatus").value, fc = $("#fCat").value, fk = $("#fKind").value, fa = $("#fAcc").value;
  const list = all.filter(s =>
    (!fs || s.state === fs) && (!fc || catName(s) === fc) && (!fk || s.kind === fk) &&
    (!fa || (fa === NO_ACC_FILTER ? !s.account : s.account.toLowerCase() === fa.toLowerCase())) &&
    (!q || [s.name, s.category, s.payment, s.account, s.notes].some(x => (x || "").toLowerCase().includes(q))));
  const get = { name: s => s.name.toLowerCase(), price: s => s.priceBase, monthly: s => s.monthly, next: s => +s.next, status: s => s.state };
  list.sort((a, b) => { const x = get[sort.key](a), y = get[sort.key](b); return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; });

  $("#empty").hidden = subs.length > 0;
  renderOpt(all);
  $("#rows").innerHTML = list.map(s => {
    const deadline = s.state === "active" && !s.inst && s.noticeDays > 0 ? addDays(s.next, -s.noticeDays) : null;
    const pct = s.totalAmt > 0 ? Math.min(100, s.paidAmt / s.totalAmt * 100) : 100;
    const prog = s.inst ? `<div class="prog"><div style="width:${pct.toFixed(0)}%"></div></div>
      <div class="muted small">${s.byAmount ? `${money(s.paidAmt, s.currency)} von ${money(s.totalAmt, s.currency)} bezahlt` : `${s.paid} von ${s.totalPayments} Raten bezahlt`}${s.remaining ? ` · noch ${money(s.remainingAmt, s.currency)}${s.byAmount ? ` (${s.remaining} Rate${s.remaining > 1 ? "n" : ""})` : ""} · letzte Rate ${fmtDate(s.endDate)}` : ""}</div>`
      + (s.loan ? `<div class="muted small">Kaufpreis ${money(s.principal, s.currency)}${s.interestRate > 0 ? ` · ${String(s.interestRate).replace(".", ",")} % p. a.` : " · zinslos"} · Gesamtkosten ${money(s.loan.total, s.currency)}${s.loan.interest > 0 ? ` (davon Zinsen ${money(s.loan.interest, s.currency)})` : ""}</div>` : "") : "";
    const dl = deadline ? daysBetween(today(), deadline) : null;
    const warn = dl !== null && dl >= 0 && dl <= 14 ? `<div class="warn">⚠ Kündigen bis ${fmtDate(deadline)} (${whenText(dl)})</div>` : "";
    const foreign = s.currency !== settings.base ? `<div class="muted small">≈ ${mb(s.priceBase)}</div>` : "";
    return `<tr>
      <td><div class="name">${esc(s.name)}</div>
        <div class="muted small"><span class="chip" style="border-color:${catColor(catName(s))}">${esc(catName(s))}</span>${s.inst ? ` <span class="chip">Ratenzahlung</span>` : ""}${s.account ? ` <span class="chip">🏦 ${esc(s.account)}</span>` : ""}${s.payment ? " · " + esc(s.payment) : ""}</div>${prog}${warn}</td>
      <td class="num">${money(s.price, s.currency)}<div class="muted small">${CYCLES[s.cycle].label}</div>${foreign}</td>
      <td class="num hide-m">${mb(s.monthly)}</td>
      <td>${s.state === "active" ? `${fmtDate(s.next)}<div class="muted small">${whenText(s.inDays)}</div>` : "–"}</td>
      <td class="hide-m"><span class="chip ${s.state}">${STATUS[s.state]}</span></td>
      <td><div class="rowbtns">
        <button class="btn small" data-edit="${esc(s.id)}">Bearbeiten</button>
        <button class="btn small danger" data-del="${esc(s.id)}" aria-label="Löschen">✕</button>
      </div></td></tr>`;
  }).join("");

  checkReminders();
  checkAchievements(subs, all);
}

/* ================= Bankkonten ================= */
const NO_ACC_FILTER = "__none__";
// Monatliche Abgänge je Bankkonto (nur aktive Abos/Raten), unterteilt nach Kategorie
function renderAccounts(active) {
  const groups = new Map();
  for (const s of active) {
    const key = (s.account || "").toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: s.account || "", total: 0, count: 0, cats: {} });
    const g = groups.get(key), c = catName(s);
    g.total += s.monthly; g.count++; g.cats[c] = (g.cats[c] || 0) + s.monthly;
  }
  const el = $("#accts");
  if (!groups.size) { el.innerHTML = `<div class="muted">Keine Daten.</div>`; return; }
  if (groups.size === 1 && groups.has("")) {
    el.innerHTML = `<div class="muted">Noch kein Bankkonto zugeordnet. Trage bei „Bearbeiten“ ein Bankkonto ein, dann siehst du hier, wie viel monatlich von welchem Konto abgeht.</div>`;
    return;
  }
  const list = [...groups.values()].sort((a, b) => (a.name === "") - (b.name === "") || b.total - a.total);   // „Ohne Bankkonto“ zuletzt
  const grand = list.reduce((a, g) => a + g.total, 0), max = Math.max(...list.map(g => g.total));
  el.innerHTML = list.map(g => {
    const cats = Object.entries(g.cats).sort((a, b) => b[1] - a[1]);
    const filterVal = g.name || NO_ACC_FILTER;
    return `<div class="acct">
      <div class="acct-head"><button class="acct-name" data-acc="${esc(filterVal)}" title="Abos dieses Kontos anzeigen">${g.name ? "🏦 " + esc(g.name) : "Ohne Bankkonto"}</button>
        <span class="muted small">${g.count} Abo${g.count > 1 ? "s" : ""} · ${Math.round(g.total / grand * 100)} %</span>
        <span class="amt">${mb(g.total)}</span></div>
      <div class="stack" style="width:${Math.max(6, g.total / max * 100).toFixed(1)}%">${cats.map(([c, v]) =>
        `<div style="flex:${v};background:${catColor(c)}" title="${esc(c)}: ${esc(mb(v))}"></div>`).join("")}</div>
      <div class="acct-cats muted small">${cats.map(([c, v]) => `<span><i style="background:${catColor(c)}"></i>${esc(c)} ${mb(v)}</span>`).join("")}</div>
    </div>`;
  }).join("") + `<div class="acct-total muted small">Gesamt pro Monat: <b>${mb(grand)}</b></div>`;
}
$("#accts").addEventListener("click", e => {
  const b = e.target.closest("[data-acc]"); if (!b) return;
  $("#fAcc").value = b.dataset.acc; $("#fStatus").value = "active";
  render();
  $("#rows").scrollIntoView({ behavior: "smooth", block: "start" });
});

/* ================= Ratenkäufe-Widget ================= */
let instFilter = "run", instSig = "";
const instOpen = new Set(), simExtra = {}, instData = new Map();
const reducedMotion = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const RING_C = 2 * Math.PI * 42;
const INST_STATE = { active: "Läuft", paused: "Pausiert", cancelled: "Gekündigt", done: "Abbezahlt" };

function simHtml(s, mdl, extra) {
  if (extra <= 0) return `Schiebe den Regler, um zu sehen, was zusätzliche Zahlungen bringen.`;
  const b = simulate(mdl.balNow, s.price, mdl.i, 0), e = simulate(mdl.balNow, s.price, mdl.i, extra), saved = b.interest - e.interest;
  return `Mit <b>+${money(extra, s.currency)}</b> pro Rate bist du nach <b>${e.n}</b> statt ${b.n} Raten fertig (${b.n - e.n} früher)`
    + (saved > 0.005 ? ` und sparst etwa <b>${money(saved, s.currency)}</b> Zinsen.` : ".");
}

function instCardHtml(s, idx) {
  const mdl = instModel(s); instData.set(s.id, { s, mdl });
  const pct = s.totalAmt > 0 ? Math.min(100, s.paidAmt / s.totalAmt * 100) : 100;
  const cur = s.currency, done = s.state === "done", n = s.totalPayments;
  const stateChip = `<span class="chip ${done ? "done" : s.state}">${done ? "✅ " : ""}${INST_STATE[s.state]}</span>`;
  const nextLine = s.state === "active"
    ? `Nächste Rate: <b>${fmtDate(s.next)}</b> (${whenText(s.inDays)}) · ${money(s.due, cur)}` : done ? "Alle Raten bezahlt 🎉" : "";
  const dots = n <= 60 ? `<div class="dots">${mdl.rows.map(r => {
      const tip = `Rate ${r.j} · ${fmtDate(r.date)} · ${money(r.pay, cur)} · ${{ paid: "bezahlt", partial: "angezahlt", next: "als Nächstes fällig", open: "offen" }[r.status]}`;
      return `<span class="dot ${r.status}" style="--i:${r.j};--p:${(mdl.frac * 100).toFixed(0)}%" title="${esc(tip)}"></span>`;
    }).join("")}</div>` : "";
  const loanLine = s.loan
    ? `Kaufpreis ${money(s.principal, cur)}${s.interestRate > 0 ? ` · ${String(s.interestRate).replace(".", ",")} % p. a.` : " · zinslos"}` : "";
  const cols = mdl.hasLoan;
  const sched = `<div class="sched-wrap"><table class="sched"><thead><tr><th>#</th><th>Datum</th><th class="num">Rate</th>${cols ? `<th class="num">Zinsen</th><th class="num">Tilgung</th><th class="num">Restschuld</th>` : ""}<th></th></tr></thead><tbody>`
    + mdl.rows.map(r => `<tr class="r-${r.status}"><td>${r.j}</td><td>${fmtDate(r.date)}</td><td class="num">${money(r.pay, cur)}</td>${cols ? `<td class="num">${money(r.interest, cur)}</td><td class="num">${money(r.princ, cur)}</td><td class="num">${money(r.bal, cur)}</td>` : ""}`
      + `<td>${{ paid: "✅", partial: "◐", next: "➡️", open: "" }[r.status]}</td></tr>`).join("") + `</tbody></table></div>`;
  const facts = [];
  if (mdl.hasLoan) {
    facts.push(`Zinsen bisher gezahlt: <b>${money(mdl.intPaid, cur)}</b> · noch offen: <b>${money(mdl.intOpen, cur)}</b> · insgesamt ${money(mdl.intTotal, cur)}`);
    if (s.remaining > 0) facts.push(`Heute komplett ablösen: Restschuld <b>${money(mdl.balNow, cur)}</b> statt noch ${money(s.remainingAmt, cur)} in Raten – etwa <b>${money(Math.max(0, s.remainingAmt - mdl.balNow), cur)}</b> Zinsersparnis (ohne Vorfälligkeitsentschädigung deines Anbieters).`);
  } else if (s.loan) facts.push(`Gesamtkosten ${money(s.loan.total, cur)} bei zinslosem Kauf.`);
  const step = s.price >= 100 ? 10 : s.price >= 20 ? 5 : 1, max = Math.max(step, Math.round(s.price * 2 / step) * step), extra = Math.min(max, simExtra[s.id] || 0);
  const sim = s.remaining > 0 && s.state === "active"
    ? `<div class="sim"><div class="sim-top">Was wäre wenn: zusätzlich pro Rate zahlen <b class="sim-val">+${money(extra, cur)}</b></div>
       <input type="range" class="sim-range" data-id="${esc(s.id)}" min="0" max="${max}" step="${step}" value="${extra}" aria-label="Zusätzliche Zahlung pro Rate">
       <div class="sim-out">${simHtml(s, mdl, extra)}</div></div>` : "";
  const open = instOpen.has(s.id);
  return `<div class="inst-item${open ? " open" : ""}${done ? " is-done" : ""}" data-id="${esc(s.id)}">
    <button class="inst-head" aria-expanded="${open}">
      <div class="inst-top">
        <div><span class="name">${esc(s.name)}</span> ${stateChip}${s.account ? ` <span class="chip">🏦 ${esc(s.account)}</span>` : ""}
          <div class="muted small">${[loanLine, catName(s) !== "Ohne Kategorie" ? esc(catName(s)) : ""].filter(Boolean).join(" · ")}</div></div>
        <div class="inst-pct"><span data-count="${pct.toFixed(2)}" data-kind="pct">0 %</span><span class="chev">▾</span></div>
      </div>
      <div class="inst-bar"><div class="inst-fill${done ? " full" : ""}" data-w="${pct.toFixed(2)}" style="width:0;transition-delay:${idx * 90}ms"></div></div>
      <div class="inst-meta small"><span><b>${money(s.paidAmt, cur)}</b> <span class="muted">von ${money(s.totalAmt, cur)} bezahlt</span></span>
        ${s.remaining > 0 ? `<span><b>noch ${money(s.remainingAmt, cur)}</b> <span class="muted">(${s.remaining} Rate${s.remaining > 1 ? "n" : ""})</span></span>` : ""}
        ${s.endDate ? `<span class="muted">letzte Rate ${fmtDate(s.endDate)}</span>` : ""}</div>
      ${nextLine ? `<div class="small" style="margin-top:4px">${nextLine}</div>` : ""}
      ${dots}
    </button>
    <div class="inst-detail"><div class="inst-detail-in">
      ${facts.map(f => `<p class="small">${f}</p>`).join("")}${sim}${sched}
      <div class="inst-actions"><button class="btn small" data-edit-inst="${esc(s.id)}">Bearbeiten</button> <button class="btn small danger" data-del-inst="${esc(s.id)}">Ratenkauf entfernen</button></div>
    </div></div>
  </div>`;
}

function renderInstallments(all) {
  const card = $("#instCard"), items = all.filter(s => s.inst);
  card.hidden = !items.length;
  if (!items.length) { instSig = ""; return; }
  const isRun = s => s.state === "active" || s.state === "paused";
  const counts = { run: items.filter(isRun).length, done: items.filter(s => s.state === "done").length, all: items.length };
  if (!counts[instFilter]) instFilter = counts.run ? "run" : "all";
  const rank = { active: 0, paused: 1, done: 2, cancelled: 3 };
  const list = items.filter(s => instFilter === "all" || (instFilter === "run" ? isRun(s) : s.state === "done"))
    .sort((a, b) => rank[a.state] - rank[b.state] || a.next - b.next || a.name.localeCompare(b.name, "de"));
  const sig = JSON.stringify([instFilter, settings.base, list.map(s => [s.id, s.name, s.price, s.currency, s.paidAmt, s.remaining, s.state, +s.next, s.principal, s.interestRate, s.account, s.totalPayments, s.category])]);
  if (sig === instSig && $("#instList").children.length) return;                       // nichts geändert: Anzeige und Animation nicht neu starten
  instSig = sig; instData.clear();

  $("#instTabs").innerHTML = [["run", "Laufend"], ["done", "Abbezahlt"], ["all", "Alle"]].map(([k, l]) =>
    `<button class="seg${instFilter === k ? " active" : ""}" data-f="${k}"${counts[k] ? "" : " disabled"}>${l} <span class="seg-n">${counts[k]}</span></button>`).join("")
    + `<button class="seg seg-replay" title="Animation erneut abspielen" aria-label="Animation erneut abspielen">↻</button>`;

  const sumBase = f => list.reduce((a, s) => a + convert(f(s), s.currency), 0);
  const total = sumBase(s => s.totalAmt), paid = sumBase(s => s.paidAmt), open = sumBase(s => s.remainingAmt);
  const interest = sumBase(s => s.loan ? s.loan.interest : 0);
  const monthly = list.filter(s => s.state === "active").reduce((a, s) => a + s.monthly, 0);
  const nextS = list.filter(s => s.state === "active").sort((a, b) => a.next - b.next)[0];
  const pct = total > 0 ? Math.min(100, paid / total * 100) : 0;
  $("#instSummary").innerHTML = `<div class="inst-sum">
    <div class="donut"><svg viewBox="0 0 100 100" width="118" height="118" aria-hidden="true"><circle class="ring-bg" cx="50" cy="50" r="42" fill="none" stroke-width="10"/>
      <circle class="ring-fg" cx="50" cy="50" r="42" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${RING_C.toFixed(2)}" data-off="${(RING_C * (1 - pct / 100)).toFixed(2)}"/></svg>
      <div class="donut-center"><div><span data-count="${pct.toFixed(2)}" data-kind="pct">0 %</span><div class="muted" style="font-size:11px;font-weight:400">bezahlt</div></div></div></div>
    <div class="inst-stats">
      <div><div class="lbl">Gesamtkosten</div><div class="val" data-count="${total.toFixed(2)}" data-kind="base">0</div></div>
      <div><div class="lbl">Bereits bezahlt</div><div class="val ok" data-count="${paid.toFixed(2)}" data-kind="base">0</div></div>
      <div><div class="lbl">Noch offen</div><div class="val" data-count="${open.toFixed(2)}" data-kind="base">0</div></div>
      <div><div class="lbl">Zinsen insgesamt</div><div class="val" data-count="${interest.toFixed(2)}" data-kind="base">0</div></div>
      <div><div class="lbl">Belastung pro Monat</div><div class="val" data-count="${monthly.toFixed(2)}" data-kind="base">0</div></div>
      <div><div class="lbl">Nächste Rate</div><div class="val" style="font-size:14px">${nextS ? `${esc(nextS.name)}<div class="muted small" style="font-weight:400">${fmtDate(nextS.next)} · ${money(nextS.due, nextS.currency)}</div>` : "–"}</div></div>
    </div></div>`;
  $("#instList").innerHTML = list.map(instCardHtml).join("");
  animateInst();
}

// Balken, Ring und Zähler animieren (bei „reduzierte Bewegung“ sofort fertig)
function animateInst() {
  const root = $("#instCard"), quick = reducedMotion();
  const ease = t => 1 - Math.pow(1 - t, 3);
  root.querySelectorAll("[data-count]").forEach(el => {
    const target = parseFloat(el.dataset.count), kind = el.dataset.kind;
    const fmt = v => kind === "pct" ? Math.round(v) + " %" : mb(v);
    if (quick) { el.textContent = fmt(target); return; }
    const t0 = performance.now(), dur = 1200;
    const step = () => { const p = Math.min(1, (performance.now() - t0) / dur); el.textContent = fmt(target * ease(p)); if (p < 1) setTimeout(step, 16); };
    el.textContent = fmt(0); step();
  });
  void root.offsetWidth;                                   // Startzustand festschreiben, damit die CSS-Übergänge laufen
  root.querySelectorAll(".inst-fill").forEach(el => { el.style.width = el.dataset.w + "%"; });
  const ring = root.querySelector(".ring-fg"); if (ring) ring.style.strokeDashoffset = ring.dataset.off;
}

$("#instCard").addEventListener("click", e => {
  const seg = e.target.closest(".seg");
  if (seg) {
    if (seg.classList.contains("seg-replay")) instSig = "";
    else if (seg.dataset.f && !seg.disabled) instFilter = seg.dataset.f;
    renderInstallments(view()); return;
  }
  const del = e.target.closest("[data-del-inst]"), edit = e.target.closest("[data-edit-inst]");
  if (del) { removeSub(del.dataset.delInst); return; }
  if (edit) { openDlg(edit.dataset.editInst); return; }
  const head = e.target.closest(".inst-head");
  if (head) {
    const item = head.closest(".inst-item"), open = !item.classList.contains("open");
    item.classList.toggle("open", open); head.setAttribute("aria-expanded", open);
    open ? instOpen.add(item.dataset.id) : instOpen.delete(item.dataset.id);
  }
});
$("#instCard").addEventListener("input", e => {
  const r = e.target.closest(".sim-range"); if (!r) return;
  const d = instData.get(r.dataset.id); if (!d) return;
  const extra = Number(r.value) || 0; simExtra[r.dataset.id] = extra;
  const box = r.closest(".sim");
  box.querySelector(".sim-val").textContent = "+" + money(extra, d.s.currency);
  box.querySelector(".sim-out").innerHTML = simHtml(d.s, d.mdl, extra);
});

/* ================= Optimierung ================= */
function renderOpt(all) {
  const { tips, total, unknown, flagged } = optimize(all);
  lastOptFlagged = flagged;
  $("#opt").innerHTML =
    (total > 0 ? `<div class="opt-total"><span class="eyebrow">Sparpotenzial · bis zu</span><b>${mb(total)}</b><span>pro Jahr</span></div>` : "")
    + (tips.length ? tips.map(t => `<div class="tip"><div>${t.icon} <strong>${esc(t.title)}</strong><div class="muted small">${esc(t.text)}</div></div>${t.saving > 0 ? `<div class="save">−${mb(t.saving)}/Jahr</div>` : ""}</div>`).join("")
      : `<div class="muted">Keine Auffälligkeiten gefunden.</div>`)
    + (unknown ? `<p class="muted small" style="margin-bottom:0">Für gezieltere Tipps: trage bei „Bearbeiten“ die Nutzung ein (${unknown} Abo${unknown > 1 ? "s" : ""} ohne Angabe).</p>` : "");
}

/* ================= Erinnerungen ================= */
function checkReminders() {
  const rem = computeReminders();
  $("#reminders").innerHTML = rem.length
    ? `<div class="banner">${rem.map(r => `<div>${r.icon} <strong>${esc(r.title)}</strong><div class="b-body">${esc(r.body)}</div></div>`).join("")}</div>` : "";
  if (settings.notif && "Notification" in window && Notification.permission === "granted") {
    const done = lsGet(NOTIF_KEY, {}), now = Date.now();
    for (const k in done) if (now - done[k] > 90 * 86400000) delete done[k];
    for (const r of rem) if (!done[r.key]) {
      try { new Notification(r.title, { body: r.body }); } catch {}
      done[r.key] = now;
    }
    lsSet(NOTIF_KEY, done);
  }
}

/* ================= Kontoauszug-Import (Erkennung: lib/bank.js) ================= */
async function readText(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return new TextDecoder("windows-1252").decode(buf); }
}
let bankFound = [];
function showBankDialog(res) {
  const body = $("#bankBody");
  if (res.error) body.innerHTML = `<p>${esc(res.error)}</p>`;
  else if (!res.found.length) body.innerHTML = `<p>${res.outgoing} Ausgaben gelesen, aber keine regelmäßig wiederkehrenden Zahlungen erkannt. Der Auszug sollte mindestens 2–3 Monate umfassen.</p>`;
  else {
    bankFound = res.found;
    body.innerHTML = `<p class="muted small">${res.outgoing} Ausgaben gelesen, ${res.found.length} wiederkehrende Zahlungen erkannt. Prüfe die Vorschläge und passe Namen bei Bedarf an. Beträge werden in ${settings.base} angenommen.</p>
      <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted);margin:8px 0 12px">Von welchem Bankkonto stammt dieser Auszug? (optional)
        <input type="text" id="bankAcc" list="accList" placeholder="z. B. Girokonto Sparkasse" maxlength="60"></label>
      <div style="overflow-x:auto"><table><thead><tr><th></th><th>Name</th><th class="num">Betrag</th><th>Intervall</th><th>Nächste</th><th class="num">Buchungen</th></tr></thead><tbody>
      ${res.found.map((f, i) => `<tr>
        <td><input type="checkbox" data-i="${i}" ${f.exists ? "" : "checked"}></td>
        <td><input type="text" data-name="${i}" value="${esc(f.name)}" maxlength="80">${f.exists ? '<div class="muted small">bereits vorhanden?</div>' : ""}</td>
        <td class="num">${mb(f.price)}</td><td>${CYCLES[f.cycle].label}</td><td>${fmtDate(parseISO(f.nextDate))}</td><td class="num">${f.count}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="foot"><button class="btn primary" id="bankAdd">Ausgewählte hinzufügen</button></div>`;
  }
  $("#dlgBank").showModal();
}
$("#btnBank").onclick = () => $("#fileBank").click();
$("#fileBank").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try { showBankDialog(analyzeStatement(await readText(f), subs)); }
  catch (err) { console.error(err); alert("Die Datei konnte nicht gelesen werden."); }
});
$("#bankBody").addEventListener("click", e => {
  if (e.target.id !== "bankAdd") return;
  const added = [], account = ($("#bankAcc")?.value || "").trim();
  $("#bankBody").querySelectorAll("input[type=checkbox]:checked").forEach(cb => {
    const i = +cb.dataset.i, f = bankFound[i];
    const name = $("#bankBody").querySelector(`[data-name="${i}"]`).value.trim() || f.name;
    added.push(normalizeSub({ id: uid(), name, price: f.price, cycle: f.cycle, currency: settings.base, nextDate: f.nextDate,
      category: f.category, status: "active", noticeDays: 0, payment: "", account, notes: "Aus Kontoauszug importiert" }));
  });
  if (added.length) { subs = [...subs, ...added]; ach.importedBank = true; saveAch(); save(); render(); }
  $("#dlgBank").close();
});
$("#bankClose").onclick = () => $("#dlgBank").close();

/* ================= Abo-Dialog ================= */
const dlg = $("#dlg"), form = $("#form");
function openDlg(id) {
  editId = id || null;
  const s = subs.find(x => x.id === id);
  $("#dlgTitle").textContent = s ? "Abo bearbeiten" : "Abo hinzufügen";
  form.reset();
  const v = s || { kind: "subscription", cycle: "monthly", status: "active", currency: settings.base, nextDate: toISO(today()) };
  for (const el of form.elements) if (el.name && v[el.name] !== undefined) el.value = v[el.name];
  if (v.kind === "installment") {
    const byAmount = v.paidAmount !== null && v.paidAmount !== undefined;
    form.elements.paidUnit.value = byAmount ? "amount" : "count";
    form.elements.paidValue.value = byAmount ? v.paidAmount : v.paidCount;
  } else form.elements.totalPayments.value = form.elements.paidValue.value = "";   // 0 wäre bei „Raten insgesamt“ ungültig
  if (!(v.principal > 0)) form.elements.principal.value = "";
  if (!(v.interestRate > 0)) form.elements.interestRate.value = "";
  syncFormKind();
  dlg.showModal();
  form.elements.name.focus();
}
function syncFormKind() {
  const inst = form.elements.kind.value === "installment";
  // Ausgeblendete Felder deaktivieren: sie werden dann nicht validiert (ein unsichtbares ungültiges Feld würde das Speichern still blockieren)
  form.querySelectorAll(".inst-only").forEach(e => { e.hidden = !inst; e.querySelectorAll("input,select").forEach(i => i.disabled = !inst); });
  form.querySelectorAll(".sub-only").forEach(e => { e.hidden = inst; e.querySelectorAll("input,select").forEach(i => i.disabled = inst); });
  form.elements.totalPayments.required = inst;
  $("#lblNext").textContent = inst ? "Nächste Rate am" : "Nächste Zahlung";
  syncPaidUnit();
  updateLoanCalc();
}
// Kaufpreis + Anzahl Raten (+ Zinssatz) => Rate, Gesamt- und Zinskosten live berechnen
function updateLoanCalc() {
  const fe = form.elements, box = $("#loanCalc"), inst = fe.kind.value === "installment";
  const P = parseFloat(fe.principal.value), n = parseInt(fe.totalPayments.value), r = parseFloat(fe.interestRate.value) || 0, cur = fe.currency.value;
  const on = inst && P > 0 && n >= 1;
  fe.price.readOnly = on;                                  // berechneter Wert; Kaufpreis leeren = Rate manuell eingeben
  $("#lblPrice").textContent = !inst ? "Preis" : on ? "Betrag pro Rate (berechnet)" : "Betrag pro Rate";
  if (!on) { box.hidden = true; return; }
  const rate = calcRate(P, n, r, fe.cycle.value), total = Math.round(rate * n * 100) / 100, interest = Math.round((total - P) * 100) / 100;
  fe.price.value = rate.toFixed(2);
  box.hidden = false;
  box.innerHTML = `Rate: <b>${money(rate, cur)}</b> × ${n} = <b>${money(total, cur)}</b> Gesamtkosten`
    + (r > 0 ? `<br>Zinskosten: <b>${money(interest, cur)}</b> (${(interest / P * 100).toFixed(1).replace(".", ",")} % des Kaufpreises) bei ${String(r).replace(".", ",")} % p. a.`
             : `<br>Zinslos: Rate = Kaufpreis ÷ Anzahl der Raten.`);
}
["principal", "interestRate", "totalPayments", "cycle", "currency"].forEach(n => form.elements[n].addEventListener("input", updateLoanCalc));
// „Raten“ = ganze Zahl, „Betrag“ = exakter Wert mit Cent
function syncPaidUnit() {
  const amount = form.elements.paidUnit.value === "amount";
  form.elements.paidValue.step = amount ? "0.01" : "1";
  form.elements.paidValue.placeholder = amount ? "z. B. 286,60" : "0";
}
form.elements.kind.addEventListener("change", syncFormKind);
form.elements.paidUnit.addEventListener("change", syncPaidUnit);
form.addEventListener("submit", e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(form));
  // Bei Kaufpreis + Raten ergibt sich die Rate aus der Berechnung (nicht aus dem Feld)
  const loanOn = f.kind === "installment" && parseFloat(f.principal) > 0 && parseInt(f.totalPayments) >= 1;
  if (loanOn) f.price = String(calcRate(parseFloat(f.principal), parseInt(f.totalPayments), parseFloat(f.interestRate) || 0, f.cycle));
  if (f.kind === "installment" && f.paidUnit === "amount" && f.paidValue !== "") {
    const maxAmt = parseInt(f.totalPayments) * parseFloat(f.price);
    if (parseFloat(f.paidValue) > maxAmt + 0.005) {
      alert(`Der bereits gezahlte Betrag (${money(parseFloat(f.paidValue), f.currency)}) ist höher als Raten × Betrag pro Rate (${money(maxAmt, f.currency)}). Bitte Anzahl der Raten oder den Betrag pro Rate prüfen.`);
      return;
    }
  }
  const item = normalizeSub({
    id: editId || uid(), name: f.name.trim(), price: parseFloat(f.price), cycle: f.cycle, currency: f.currency,
    nextDate: f.nextDate, category: f.category.trim(), status: f.status,
    noticeDays: parseInt(f.noticeDays), payment: f.payment.trim(), notes: f.notes.trim(), account: f.account.trim(),
    kind: f.kind, totalPayments: parseInt(f.totalPayments),
    paidCount: f.paidUnit === "amount" ? 0 : parseInt(f.paidValue),
    paidAmount: f.paidUnit === "amount" && f.paidValue !== "" ? parseFloat(f.paidValue) : null,
    principal: parseFloat(f.principal), interestRate: parseFloat(f.interestRate),
    usage: f.usage, yearlyAlt: parseFloat(f.yearlyAlt)
  });
  if (!item) return;
  const old = editId ? subs.find(s => s.id === editId) : null;
  if (old) {
    if (old.status !== "cancelled" && item.status === "cancelled") trackCancel(old);
    if (old.cycle !== "yearly" && item.cycle === "yearly" && old.kind !== "installment") ach.cycleUpgrades++;
    saveAch();
  }
  subs = editId ? subs.map(s => s.id === editId ? item : s) : [...subs, item];
  save(); dlg.close(); render(); maybeRefreshRates();
});
$("#btnCancel").onclick = () => dlg.close();
$("#btnAdd").onclick = () => openDlg();
const curOptions = CURRENCIES.map(c => `<option>${c}</option>`).join("");
form.elements.currency.innerHTML = curOptions;
$("#setBase").innerHTML = curOptions;

/* ================= Einstellungen ================= */
const dlgSet = $("#dlgSet");
function renderSettingsInfo() {
  $("#rateInfo").textContent = ratesInfo
    ? `Wechselkurse (EZB) vom ${ratesInfo.date}, geladen am ${new Date(ratesInfo.fetchedAt).toLocaleDateString("de-DE")}.`
    : "Es werden Näherungswerte verwendet. Live-Kurse werden automatisch geladen, sobald du Abos in Fremdwährung anlegst.";
  renderSync();
}
function openSettings() {
  $("#setBase").value = settings.base;
  $("#setRemind").value = settings.remindDays;
  $("#setNoticeRemind").value = settings.noticeRemind;
  $("#setNotif").checked = settings.notif && "Notification" in window && Notification.permission === "granted";
  selProv = cfg.provider || ""; draft = {};
  $("#setAutoLock").value = String(settings.autoLock);
  $("#acName").textContent = Vault.name;
  renderSettingsInfo();
  dlgSet.showModal();
}
$("#btnSettings").onclick = openSettings;
$("#setClose").onclick = () => dlgSet.close();
$("#setBase").onchange = e => { settings.base = e.target.value; saveSettings(); render(); if (needRates()) refreshRates(false); };
$("#setRemind").onchange = e => { settings.remindDays = Math.max(0, parseInt(e.target.value) || 0); saveSettings(); render(); };
$("#setNoticeRemind").onchange = e => { settings.noticeRemind = Math.max(0, parseInt(e.target.value) || 0); saveSettings(); render(); };
$("#setNotif").onchange = async e => {
  if (!e.target.checked) { settings.notif = false; saveSettings(); return; }
  let p = "denied";
  try { p = "Notification" in window ? await Notification.requestPermission() : "denied"; } catch {}
  settings.notif = p === "granted"; saveSettings();
  if (!settings.notif) {
    e.target.checked = false;
    alert("Der Browser erlaubt keine Benachrichtigungen für diese Seite (bei lokal geöffneten Dateien oft gesperrt). Nutze stattdessen die Kalender-Datei (.ics) für Erinnerungen.");
  } else checkReminders();
};
$("#setAutoLock").onchange = e => { settings.autoLock = Number(e.target.value) || 0; saveSettings(); Vault.bump(); };
$("#btnRates").onclick = () => refreshRates(true);
$("#btnIcs").onclick = () => { exportIcs(); ach.exportedIcs = true; saveAch(); checkAchievements(subs, view()); };

/* ================= Cloud-Sync (Datei, Nextcloud, Google Drive, OneNote) ================= */
const SYNC_KEY = "abo-manager-sync";
const PROV_LABEL = { file: "Datei im Cloud-Ordner", nextcloud: "Nextcloud", gdrive: "Google Drive", onenote: "OneNote" };
let cfg = { provider: null };                   // befüllt in loadCfg()
function loadCfg() {
  cfg = Object.assign({ provider: null }, lsGet(SYNC_KEY, {}));
  cfg.nextcloud = Object.assign({ url: "", user: "", pass: "", path: "abo-manager-sync.json" }, cfg.nextcloud);
  cfg.gdrive = Object.assign({ clientId: "" }, cfg.gdrive);
  cfg.onenote = Object.assign({ clientId: "", pageId: "" }, cfg.onenote);
}
const saveCfg = () => lsSet(SYNC_KEY, cfg);

class AuthError extends Error {}
const b64 = s => btoa(unescape(encodeURIComponent(s)));
const unb64 = s => decodeURIComponent(escape(atob(s)));
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const scripts = new Map();
function loadScript(src) {
  if (!scripts.has(src)) scripts.set(src, new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.async = true; s.onload = res;
    s.onerror = () => { scripts.delete(src); rej(new Error("Skript konnte nicht geladen werden (offline?).")); };
    document.head.appendChild(s);
  }));
  return scripts.get(src);
}
function parsePayload(text) {
  if (!text || !text.trim()) return null;
  const j = JSON.parse(text);
  return Array.isArray(j) ? { subs: j, updatedAt: 0 } : { subs: j.subs || [], updatedAt: Number(j.updatedAt) || 0 };
}
const payload = () => ({ app: "abo-manager", version: 2, updatedAt: meta.updatedAt, subs });

// Zugriff auf Web-APIs mit Bearer-Token; abgelaufenes Token => AuthError => "Sync fortsetzen"
async function bearer(ts, url, opt = {}, who = "Dienst") {
  if (!ts.token || Date.now() > ts.exp) throw new AuthError(`${who}-Anmeldung abgelaufen.`);
  let r;
  try { r = await fetch(url, { ...opt, headers: { Authorization: "Bearer " + ts.token, ...(opt.headers || {}) } }); }
  catch { throw new Error(`${who} nicht erreichbar (offline?).`); }
  if (r.status === 401) { ts.token = null; throw new AuthError(`${who}-Anmeldung abgelaufen.`); }
  return r;
}

const idb = {
  db: null,
  open() { return this.db ||= new Promise((res, rej) => { const r = indexedDB.open("abo-manager", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async run(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const q = fn(db.transaction("kv", mode).objectStore("kv")); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  get(k) { return this.run("readonly", s => s.get(k)); },
  set(k, v) { return this.run("readwrite", s => s.put(v, k)); },
  del(k) { return this.run("readwrite", s => s.delete(k)); }
};
const syncSupported = "showSaveFilePicker" in window;
const HANDLE_KEY = () => "handle:" + Vault.uid;      // Sync-Datei-Zugriff pro Profil getrennt

/* ---- Anbieter 1: Datei in einem Cloud-Ordner (File System Access API) ---- */
function fileBackend() {
  let handle = null;
  return {
    name: "file",
    async init() {
      if (!syncSupported) throw new Error("Dieser Browser unterstützt keine Sync-Datei (Chrome oder Edge nutzen).");
      handle = await idb.get(HANDLE_KEY());
      if (!handle) throw new Error("Sync-Datei nicht mehr gespeichert – bitte neu auswählen.");
      return (await handle.queryPermission({ mode: "readwrite" })) === "granted" ? "ok" : "needs-permission";
    },
    async connect() {
      if (!syncSupported) throw new Error("Dieser Browser unterstützt keine Sync-Datei (Chrome oder Edge nutzen).");
      handle = await showSaveFilePicker({ suggestedName: "abo-manager-sync.json", types: [{ description: "ABOmination Sync-Datei", accept: { "application/json": [".json"] } }] });
      await idb.set(HANDLE_KEY(), handle);
    },
    async authorize() { if (await handle.requestPermission({ mode: "readwrite" }) !== "granted") throw new AuthError("Zugriff nicht erlaubt."); },
    async read() { return parsePayload(await (await handle.getFile()).text()); },
    async write(p) { const w = await handle.createWritable(); await w.write(JSON.stringify(p, null, 2)); await w.close(); return true; },
    async disconnect() { await idb.del(HANDLE_KEY()); },
    describe() { return handle ? `Datei „${handle.name}“` : "Sync-Datei"; }
  };
}

/* ---- Anbieter 2: Nextcloud über WebDAV (App-Passwort, CORS-Freigabe nötig) ---- */
function nextcloudBackend(c) {
  const parts = String(c.path || "").split("/").filter(Boolean);
  const base = String(c.url || "").replace(/\/+$/, "");
  const dav = `${base}/remote.php/dav/files/${encodeURIComponent(c.user)}`;
  const url = `${dav}/${parts.map(encodeURIComponent).join("/")}`;
  const auth = "Basic " + b64(`${c.user}:${c.pass}`);
  let etag = null, missing = false;
  const req = async (u, opt = {}) => {
    let r;
    try { r = await fetch(u, { cache: "no-store", ...opt, headers: { Authorization: auth, ...(opt.headers || {}) } }); }
    catch { throw new Error("Nextcloud nicht erreichbar: Adresse falsch oder CORS nicht freigegeben (siehe SYNC-EINRICHTEN.md)."); }
    if (r.status === 401) throw new AuthError("Benutzername oder App-Passwort falsch.");
    return r;
  };
  return {
    name: "nextcloud",
    async init() { return "ok"; },
    async connect() { await this.read(); },
    async authorize() { await this.read(); },
    async read() {
      const r = await req(url);
      if (r.status === 404) { etag = null; missing = true; return null; }
      if (!r.ok) throw new Error("Nextcloud: HTTP " + r.status);
      missing = false; etag = r.headers.get("ETag");
      return parsePayload(await r.text());
    },
    async write(p) {
      const headers = { "Content-Type": "application/json" };
      if (etag) headers["If-Match"] = etag; else if (missing) headers["If-None-Match"] = "*";
      const body = JSON.stringify(p, null, 2);
      let r = await req(url, { method: "PUT", headers, body });
      if (r.status === 409 && parts.length > 1) {     // Zielordner fehlt
        for (let i = 1; i < parts.length; i++) await req(`${dav}/${parts.slice(0, i).map(encodeURIComponent).join("/")}`, { method: "MKCOL" });
        r = await req(url, { method: "PUT", headers, body });
      }
      if (r.status === 412) return false;             // zwischenzeitlich geändert
      if (!r.ok) throw new Error("Nextcloud: HTTP " + r.status);
      etag = r.headers.get("ETag"); missing = false;
      return true;
    },
    async disconnect() { c.pass = ""; },
    describe() { return `${base} (${c.user})`; }
  };
}

/* ---- Anbieter 3: Google Drive (versteckter App-Ordner, Scope drive.appdata) ---- */
function gdriveBackend(c) {
  const ts = { token: null, exp: 0 };
  const FILE = "abo-manager.json";
  let fileId = null;
  const gf = (url, opt) => bearer(ts, url, opt, "Google");
  const find = async () => {
    if (fileId) return fileId;
    const q = encodeURIComponent(`name='${FILE}' and trashed=false`);
    const r = await gf(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)&pageSize=1`);
    if (!r.ok) throw new Error("Google Drive: HTTP " + r.status);
    fileId = (await r.json()).files?.[0]?.id || null;
    return fileId;
  };
  return {
    name: "gdrive",
    async init() { loadScript("https://accounts.google.com/gsi/client").catch(() => {}); return "needs-permission"; },
    async connect() { await this.authorize(); await this.read(); },
    async authorize() {
      if (!c.clientId) throw new Error("Client-ID fehlt.");
      if (location.protocol === "file:") throw new Error("Für Google Drive muss die App über http://localhost laufen (Abo-Manager-starten.cmd).");
      await loadScript("https://accounts.google.com/gsi/client");
      await new Promise((res, rej) => {
        const tc = google.accounts.oauth2.initTokenClient({
          client_id: c.clientId, scope: "https://www.googleapis.com/auth/drive.appdata",
          callback: r => {
            if (r.error) return rej(new AuthError(r.error_description || r.error));
            ts.token = r.access_token; ts.exp = Date.now() + (Number(r.expires_in) - 60) * 1000; res();
          },
          error_callback: e => rej(new AuthError(e.type === "popup_closed" ? "Anmeldung abgebrochen."
            : e.type === "popup_failed_to_open" ? "Popup blockiert – bitte Popups für diese Seite erlauben."
            : (e.message || "Anmeldung fehlgeschlagen.")))
        });
        tc.requestAccessToken();
      });
    },
    async read() {
      const id = await find();
      if (!id) return null;
      const r = await gf(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
      if (r.status === 404) { fileId = null; return null; }
      if (!r.ok) throw new Error("Google Drive: HTTP " + r.status);
      return parsePayload(await r.text());
    },
    async write(p) {
      const json = JSON.stringify(p), id = await find();
      let r;
      if (id) {
        r = await gf(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
          { method: "PATCH", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: json });
        if (r.status === 404) { fileId = null; return this.write(p); }
      } else {
        const bd = "abo" + Math.random().toString(36).slice(2);
        const body = `--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: FILE, parents: ["appDataFolder"] })}\r\n`
          + `--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${json}\r\n--${bd}--`;
        r = await gf("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
          { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${bd}` }, body });
        if (r.ok) fileId = (await r.json()).id;
      }
      if (!r.ok) throw new Error("Google Drive: HTTP " + r.status);
      return true;
    },
    async disconnect() {
      try { if (ts.token) google.accounts.oauth2.revoke(ts.token); } catch {}
      ts.token = null;
    },
    describe() { return "Google Drive (App-Ordner)"; }
  };
}

/* ---- Microsoft-Anmeldung (OAuth-Code-Flow mit PKCE im Popup) ---- */
async function msAuthorize(clientId) {
  if (!clientId) throw new Error("Anwendungs-ID fehlt.");
  if (location.protocol === "file:") throw new Error("Für OneNote muss die App über http://localhost laufen (Abo-Manager-starten.cmd).");
  const rnd = n => b64url(crypto.getRandomValues(new Uint8Array(n)));
  const win = window.open("", "aboms", "width=520,height=700");   // sofort öffnen (Popup-Blocker), URL folgt
  if (!win) throw new AuthError("Popup blockiert – bitte Popups für diese Seite erlauben.");
  const verifier = rnd(48), state = "aboms-" + rnd(12), redirect = location.origin + location.pathname;
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  win.location.href = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + new URLSearchParams({
    client_id: clientId, response_type: "code", redirect_uri: redirect, response_mode: "query",
    scope: "Notes.ReadWrite", state, code_challenge: challenge, code_challenge_method: "S256"
  });
  const params = await new Promise((resolve, reject) => {
    const done = fn => v => { clearInterval(timer); window.removeEventListener("message", onMsg); try { win.close(); } catch {} fn(v); };
    const ok = done(resolve), fail = done(reject);
    const onMsg = e => { if (e.origin === location.origin && e.data?.type === "aboms") ok(new URL(e.data.href).searchParams); };
    window.addEventListener("message", onMsg);
    const timer = setInterval(() => {
      let href = "";
      try { href = win.location.href; } catch {}          // solange die Login-Seite offen ist: fremde Origin
      if (href.startsWith(redirect) && href.includes("state=")) return ok(new URL(href).searchParams);
      if (win.closed) fail(new AuthError("Anmeldung abgebrochen."));
    }, 300);
  });
  if (params.get("state") !== state) throw new AuthError("Anmeldung ungültig (State).");
  if (params.get("error")) throw new AuthError(params.get("error_description") || params.get("error"));
  const r = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, grant_type: "authorization_code", code: params.get("code"),
      redirect_uri: redirect, code_verifier: verifier, scope: "Notes.ReadWrite" })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new AuthError(j.error_description || "Token konnte nicht abgerufen werden (Redirect-URI als „Single-Page-Anwendung“ registriert?).");
  return { token: j.access_token, exp: Date.now() + (Number(j.expires_in) - 60) * 1000 };
}

/* ---- Anbieter 4: OneNote (Microsoft Graph) – Daten liegen auf einer Notizbuch-Seite ---- */
function onenoteBackend(c) {
  const ts = { token: null, exp: 0 };
  const TITLE = "ABOmination Sync", G = "https://graph.microsoft.com/v1.0/me/onenote/pages";
  let pageId = c.pageId || null;
  const gf = (url, opt) => bearer(ts, url, opt, "Microsoft");
  const summary = p => p.subs.length
    ? p.subs.map(s => `<p>${esc(s.name)} – ${esc(money(s.price, s.currency))} ${esc(CYCLES[s.cycle]?.label || "")}`
        + `${s.kind === "installment" ? ` (Ratenzahlung, ${s.totalPayments} Raten)` : ""} – nächste Zahlung ${esc(s.nextDate)}</p>`).join("")
    : "<p>Keine Abos.</p>";
  const dataBlock = p => `<p>ABO-DATEN-BEGIN ${b64(JSON.stringify(p))} ABO-DATEN-ENDE</p>`;
  const pageHtml = p => `<!DOCTYPE html><html><head><title>${TITLE}</title></head><body>`
    + `<p>Diese Seite wird automatisch vom ABOmination verwaltet. Bitte nicht bearbeiten.</p>`
    + `<div data-id="abo-summary">${summary(p)}</div><div data-id="abo-data">${dataBlock(p)}</div></body></html>`;
  const remember = id => { pageId = id; c.pageId = id || ""; saveCfg(); };
  const find = async () => {
    if (pageId) return pageId;
    const r = await gf(`${G}?$filter=${encodeURIComponent(`title eq '${TITLE}'`)}&$select=id&$top=1`);
    if (!r.ok) throw new Error("OneNote: HTTP " + r.status);
    remember((await r.json()).value?.[0]?.id || null);
    return pageId;
  };
  const create = async p => {
    const r = await gf(G, { method: "POST", headers: { "Content-Type": "text/html" }, body: pageHtml(p) });
    if (!r.ok) throw new Error("OneNote: HTTP " + r.status);
    remember((await r.json()).id);
  };
  return {
    name: "onenote",
    async init() { return "needs-permission"; },
    async connect() { await this.authorize(); await this.read(); },
    async authorize() { Object.assign(ts, await msAuthorize(c.clientId)); },
    async read() {
      const id = await find();
      if (!id) return null;
      const r = await gf(`${G}/${id}/content`);
      if (r.status === 404) { remember(null); return null; }
      if (!r.ok) throw new Error("OneNote: HTTP " + r.status);
      const text = new DOMParser().parseFromString(await r.text(), "text/html").body.textContent;
      const m = /ABO-DATEN-BEGIN\s+([A-Za-z0-9+/=\s]+?)\s+ABO-DATEN-ENDE/.exec(text);
      return m ? parsePayload(unb64(m[1].replace(/\s+/g, ""))) : null;
    },
    async write(p) {
      const id = await find();
      if (!id) { await create(p); return true; }
      const cmds = [
        { target: "#abo-summary", action: "replace", content: `<div data-id="abo-summary">${summary(p)}</div>` },
        { target: "#abo-data", action: "replace", content: `<div data-id="abo-data">${dataBlock(p)}</div>` }];
      const r = await gf(`${G}/${id}/content`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cmds) });
      if (r.ok) return true;
      if (r.status === 400 || r.status === 404) {       // Seite verändert/gelöscht: neu anlegen, alte entfernen
        await create(p);
        await gf(`${G}/${id}`, { method: "DELETE" }).catch(() => {});
        return true;
      }
      throw new Error("OneNote: HTTP " + r.status);
    },
    async disconnect() { ts.token = null; },
    describe() { return "OneNote (Seite „" + TITLE + "“)"; }
  };
}
const BACKENDS = { file: fileBackend, nextcloud: nextcloudBackend, gdrive: gdriveBackend, onenote: onenoteBackend };
const makeBackend = name => BACKENDS[name](cfg[name] || {});

/* ---- Sync-Steuerung ---- */
let backend = null, syncState = "off", syncMsg = "", pushTimer = null, syncing = false, syncAgain = false;
let selProv = "", draft = {};

// Neuere Version gewinnt (ganzer Datenbestand); bei Konflikt (Anbieter meldet false) erneut lesen
async function syncNow() {
  if (!backend || syncState === "needs-permission") return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  try {
    for (let i = 0; i < 3; i++) {
      syncAgain = false;
      const r = await backend.read();
      let conflict = false;
      if (r && r.updatedAt > meta.updatedAt) { subs = clean(r.subs); meta.updatedAt = r.updatedAt; persist(); render(); }
      else if (!r || r.updatedAt < meta.updatedAt) conflict = (await backend.write(payload())) === false;
      if (!conflict && !syncAgain) break;
    }
    syncState = "ok"; syncMsg = "";
  } catch (err) {
    if (err instanceof AuthError) { syncState = "needs-permission"; syncMsg = err.message; }
    else { console.error(err); syncState = "error"; syncMsg = err.message || String(err); }
  } finally { syncing = false; }
  renderSync();
}
function schedulePush() { if (backend) { clearTimeout(pushTimer); pushTimer = setTimeout(syncNow, 600); } }

async function initialMerge() {
  const r = await backend.read();
  if (r && r.subs.length) {
    const remote = clean(r.subs);
    let useRemote = !subs.length;
    if (subs.length && r.updatedAt !== meta.updatedAt)
      useRemote = confirm(`Am Ziel liegen bereits ${remote.length} Abos (lokal: ${subs.length}).\n\nOK = Daten vom Ziel laden (lokale Daten werden ersetzt)\nAbbrechen = lokale Daten dorthin schreiben`);
    if (useRemote) { subs = remote; meta.updatedAt = r.updatedAt || Date.now(); }
    else meta.updatedAt = Date.now();
    persist();
  } else if (!meta.updatedAt) { meta.updatedAt = Date.now(); persist(); }
}

async function connectSelected() {
  const name = selProv, val = id => ($("#" + id)?.value ?? draft[id] ?? "").trim();
  if (name === "nextcloud") {
    cfg.nextcloud = { url: val("ncUrl"), user: val("ncUser"), pass: $("#ncPass")?.value ?? draft.ncPass ?? "", path: val("ncPath") || "abo-manager-sync.json" };
    if (!/^https?:\/\//.test(cfg.nextcloud.url) || !cfg.nextcloud.user || !cfg.nextcloud.pass) return alert("Bitte Adresse (mit https://), Benutzername und App-Passwort eingeben.");
  } else if (name === "gdrive") {
    cfg.gdrive.clientId = val("gdId");
    if (!cfg.gdrive.clientId) return alert("Bitte die Google-Client-ID eingeben.");
  } else if (name === "onenote") {
    cfg.onenote.clientId = val("onId");
    if (!cfg.onenote.clientId) return alert("Bitte die Anwendungs-(Client-)ID eingeben.");
  }
  const nb = makeBackend(name);
  try { await nb.connect(); }                    // Nutzeraktion: Dateiauswahl, Anmeldung bzw. Verbindungstest
  catch (e) { if (e.name !== "AbortError") alert("Verbindung fehlgeschlagen: " + (e.message || e)); return; }
  const old = backend;
  backend = nb; cfg.provider = name; saveCfg(); draft = {};
  ach.syncConnected = true; saveAch();
  if (old && old.name !== nb.name) old.disconnect?.().catch(() => {});
  try { await initialMerge(); syncState = "ok"; syncMsg = ""; await syncNow(); render(); }
  catch (e) { console.error(e); syncState = "error"; syncMsg = e.message || String(e); }
  renderSync();
}
async function resumeSync() {
  try { await backend.authorize(); syncState = "ok"; syncMsg = ""; await syncNow(); }
  catch (e) { if (e.name !== "AbortError") { syncMsg = e.message || String(e); alert("Anmeldung fehlgeschlagen: " + syncMsg); } }
  renderSync();
}
async function disconnectSync() {
  if (backend) { try { await backend.disconnect?.(); } catch {} }
  backend = null; cfg.provider = null; syncState = "off"; syncMsg = ""; saveCfg(); renderSync();
}
async function initSync() {
  try {
    if (!cfg.provider && syncSupported) {          // Übernahme einer früheren Sync-Datei
      try { if (await idb.get(HANDLE_KEY())) { cfg.provider = "file"; selProv = "file"; saveCfg(); } } catch {}
    }
    if (cfg.provider) {
      backend = makeBackend(cfg.provider);
      syncState = await backend.init();
      if (syncState === "ok") await syncNow();
    }
  } catch (e) { console.error(e); syncState = "error"; syncMsg = e.message || String(e); }
  renderSync();
}

/* ---- Oberfläche ---- */
function renderSync() {
  const L = { off: ["☁ Sync aus", ""], ok: ["☁ Sync aktiv", "ok"], "needs-permission": ["☁ Sync fortsetzen", "warn"], error: ["☁ Sync-Fehler", "err"] }[syncState];
  const b = $("#btnSync");
  b.hidden = false; b.innerHTML = `<span class="ic">${ICON.cloud}</span><span>${L[0].replace("☁ ", "")}</span>`; b.className = "btn pill " + L[1];
  renderSyncPanel();
}
function syncForm(sel) {
  const d = (id, def) => esc(draft[id] ?? def ?? "");
  const local = location.protocol === "file:";
  const redirect = esc(location.origin + location.pathname);
  const warn = local && sel !== "file"
    ? `<p class="warn">Die App ist gerade als Datei geöffnet. Für ${PROV_LABEL[sel]} bitte über <b>Abo-Manager-starten.cmd</b> starten (http://localhost:8765) – siehe SYNC-EINRICHTEN.md.</p>` : "";
  if (sel === "file") return `<p class="muted small">Wähle eine Datei in einem Ordner, den ein Sync-Programm abgleicht (OneDrive, Google Drive für Desktop, Nextcloud-Client, Dropbox …). Die App hält sie automatisch aktuell. Auf dem zweiten Gerät wählst du dieselbe Datei. Funktioniert in Chrome und Edge.</p>
    <div class="row-btns"><button class="btn small primary" data-sync="connect"${syncSupported ? "" : " disabled"}>Sync-Datei wählen …</button></div>`;
  if (sel === "nextcloud") return warn + `
    <label>Server-Adresse<input id="ncUrl" placeholder="https://cloud.example.com" value="${d("ncUrl", cfg.nextcloud.url)}"></label>
    <label>Benutzername<input id="ncUser" autocomplete="off" value="${d("ncUser", cfg.nextcloud.user)}"></label>
    <label>App-Passwort<input id="ncPass" type="password" autocomplete="new-password" value="${d("ncPass", cfg.nextcloud.pass)}"></label>
    <label>Dateipfad in deiner Nextcloud<input id="ncPath" value="${d("ncPath", cfg.nextcloud.path)}"></label>
    <p class="muted small">App-Passwort erzeugst du in Nextcloud unter Einstellungen → Sicherheit (es wird in diesem Browser gespeichert und lässt sich dort jederzeit widerrufen). Dein Server muss die Herkunft <b>${esc(location.origin)}</b> per CORS erlauben.</p>
    <div class="row-btns"><button class="btn small primary" data-sync="connect">Verbinden</button></div>`;
  if (sel === "gdrive") return warn + `
    <label>Google-Client-ID<input id="gdId" placeholder="123…apps.googleusercontent.com" value="${d("gdId", cfg.gdrive.clientId)}"></label>
    <p class="muted small">Autorisierte JavaScript-Quelle in der Google Cloud Console: <b>${esc(location.origin)}</b>. Die Daten liegen im versteckten App-Ordner deines Drive (nur diese App sieht sie).</p>
    <div class="row-btns"><button class="btn small primary" data-sync="connect">Mit Google verbinden</button></div>`;
  if (sel === "onenote") return warn + `
    <label>Anwendungs-(Client-)ID<input id="onId" placeholder="00000000-0000-0000-0000-000000000000" value="${d("onId", cfg.onenote.clientId)}"></label>
    <p class="muted small">Redirect-URI (Plattform „Single-Page-Anwendung“): <b>${redirect}</b>. Die Daten werden auf einer Seite „ABOmination Sync“ in deinem Standard-Notizbuch gespeichert.</p>
    <div class="row-btns"><button class="btn small primary" data-sync="connect">Mit Microsoft verbinden</button></div>`;
  return "";
}
function renderSyncPanel() {
  const el = $("#syncPanel"); if (!el) return;
  $("#syncProv").value = selProv;
  if (!selProv) { el.innerHTML = `<p class="muted small">Ohne Sync liegen die Daten nur in diesem Browser. Sichern kannst du sie jederzeit unter „Daten“.</p>`; return; }
  if (backend && cfg.provider === selProv) {
    const st = { ok: "Verbunden und aktuell.", "needs-permission": "Anmeldung nötig oder abgelaufen.", error: "Letzter Abgleich fehlgeschlagen.", off: "" }[syncState];
    el.innerHTML = `<p class="small">Verbunden mit <b>${esc(backend.describe())}</b>. ${esc(st)}${syncMsg ? `<br><span class="${syncState === "ok" ? "muted" : "warn"}">${esc(syncMsg)}</span>` : ""}</p>
      <div class="row-btns">${syncState === "needs-permission"
        ? `<button class="btn small primary" data-sync="resume">Anmelden</button>`
        : `<button class="btn small" data-sync="now">Jetzt abgleichen</button>`}
      <button class="btn small danger" data-sync="off">Trennen</button></div>`;
  } else el.innerHTML = syncForm(selProv);
}
$("#syncProv").addEventListener("change", async e => {
  selProv = e.target.value; draft = {};
  if (!selProv && backend && confirm("Sync trennen? Die Daten bleiben lokal erhalten.")) await disconnectSync();
  renderSyncPanel();
});
$("#syncPanel").addEventListener("input", e => { if (e.target.id) draft[e.target.id] = e.target.value; });
$("#syncPanel").addEventListener("click", e => {
  const a = e.target.dataset.sync;
  if (a === "connect") connectSelected(); else if (a === "resume") resumeSync();
  else if (a === "now") syncNow(); else if (a === "off") disconnectSync();
});
$("#btnSync").onclick = () => { if (syncState === "needs-permission") resumeSync(); else openSettings(); };

/* ================= Tabelle / Filter ================= */
$("#rows").addEventListener("click", e => {
  const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]");
  if (ed) openDlg(ed.dataset.edit);
  if (del) removeSub(del.dataset.del);
});
// Löschen (Tabelle und Ratenkauf-Widget). Aktive Abos zählen als Kündigung; eine bereits abbezahlte
// Ratenzahlung nicht – dort kann ein Eingabefehler auch aus den Errungenschaften zurückgenommen werden.
function removeSub(id) {
  const s = subs.find(x => x.id === id); if (!s) return;
  const v = view().find(x => x.id === id), paidOff = !!v && v.inst && v.state === "done";
  if (!confirm(`„${s.name}“ wirklich löschen?`)) return;
  if (paidOff) {
    if (ach.doneInstallmentIds.includes(id) && confirm("War das ein Eingabefehler?\n\nOK = Die Zählung „Ratenzahlung abbezahlt“ zurücknehmen (auch dadurch erhaltene Errungenschaften)\nAbbrechen = Fortschritt behalten")) {
      ach.doneInstallmentIds = ach.doneInstallmentIds.filter(x => x !== id);
      ach.installmentsPaid = Math.max(0, ach.installmentsPaid - 1);
      if (ach.installmentsPaid < 1) delete ach.unlocked["debt-free"];
      if (ach.installmentsPaid < 3) delete ach.unlocked["debt-free-3"];
      saveAch();
    }
  } else if (s.status !== "cancelled") { trackCancel(s); saveAch(); }
  subs = subs.filter(x => x.id !== id); save(); render();
}
document.querySelector("thead").addEventListener("click", e => {
  const th = e.target.closest("[data-sort]"); if (!th) return;
  const k = th.dataset.sort;
  sort = { key: k, dir: sort.key === k ? -sort.dir : 1 };
  render();
});
["#q", "#fStatus", "#fCat", "#fKind", "#fAcc"].forEach(s => $(s).addEventListener("input", render));

/* ================= Export / Import ================= */
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("#btnExport").onclick = () => {
  download(`abos-${toISO(today())}.json`, JSON.stringify({ app: "abo-manager", version: 2, updatedAt: meta.updatedAt, subs }, null, 2), "application/json");
  ach.exportedJson = true; saveAch(); checkAchievements(subs, view());
};
$("#btnCsv").onclick = () => {
  const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`, num = v => v.toFixed(2).replace(".", ",");
  const head = ["Name","Art","Kategorie","Preis","Währung","Abrechnung",`Pro Monat (${settings.base})`,"Nächste Zahlung","Status","Raten bezahlt/gesamt","Kaufpreis","Zinssatz p. a. (%)","Gesamtkosten Raten","Nutzung","Bankkonto","Zahlungsart","Kündigungsfrist (Tage)","Notizen"];
  const rows = view().map(s => [s.name, s.inst ? "Ratenzahlung" : "Abo", s.category, num(s.price), s.currency, CYCLES[s.cycle].label, num(s.monthly),
    toISO(s.next), STATUS[s.state], s.inst ? `${s.paid}/${s.totalPayments}` : "",
    s.loan ? num(s.principal) : "", s.loan && s.interestRate > 0 ? String(s.interestRate).replace(".", ",") : "", s.loan ? num(s.loan.total) : "", USAGE[s.usage] || "", s.account, s.payment, s.noticeDays, s.notes]);
  download(`abos-${toISO(today())}.csv`, "\ufeff" + [head, ...rows].map(r => r.map(cell).join(";")).join("\r\n"), "text/csv;charset=utf-8");
};
$("#btnImport").onclick = () => $("#fileImport").click();
$("#fileImport").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.subs;
    if (!Array.isArray(list)) throw 0;
    const c = clean(list);
    if (!confirm(`${c.length} Abos importieren? Die aktuellen Daten (${subs.length}) werden ersetzt.`)) return;
    subs = c; save(); render(); maybeRefreshRates();
  } catch { alert("Datei konnte nicht gelesen werden. Erwartet wird eine JSON-Sicherung aus dieser App."); }
});

/* ================= Design: Icons, Zeitleiste, Effekte ================= */
const svg = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const ICON = {
  wallet: svg('<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/><path d="M21 10h-5a2 2 0 0 0 0 4h5z"/>'),
  calendar: svg('<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  trend: svg('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  bank: svg('<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>'),
  bulb: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
  receipt: svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a2 2 0 0 0 0 4h3M16 6h3a2 2 0 0 1 0 4h-3"/><path d="M12 13v4M8.5 20h7"/>'),
  pie: svg('<path d="M12 3v9h9"/><path d="M20.4 15A9 9 0 1 1 9 3.6"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  lock: svg('<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  cloud: svg('<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>')
};
// Zeitleiste der nächsten 30 Tage: Punkte nach Tagen positioniert, Karten auf 3 Bahnen verteilt (überlappungsarm)
function renderTimeline(soon) {
  const el = $("#timeline"), DAYS = 30;
  if (!soon.length) { el.innerHTML = `<div class="muted" style="padding:28px 0">Keine Zahlungen in den nächsten 30 Tagen.</div>`; return; }
  const last = [-99, -99, -99];
  const marks = soon.map(s => {
    const x = Math.min(100, Math.max(0, s.inDays / DAYS * 100));
    let lane = [0, 1, 2].find(l => x - last[l] >= 15);                // erste Bahn mit genug Abstand
    if (lane === undefined) lane = last.indexOf(Math.min(...last));
    last[lane] = x;
    const edge = x < 9 ? " edge-l" : x > 91 ? " edge-r" : "";
    return `<div class="tl-mark lane${lane}${s.inst ? " inst" : ""}${edge}" style="left:${x.toFixed(2)}%" tabindex="0" title="${esc(s.name)} · ${fmtDate(s.next)} · ${esc(money(s.due, s.currency))}">
      <span class="tl-stem"></span><span class="tl-dot"></span>
      <span class="tl-card"><b>${esc(s.name)}</b><small>${fmtDate(s.next)} · ${money(s.due, s.currency)}</small></span></div>`;
  }).join("");
  const ticks = [0, 7, 14, 21, 30].map(d => `<span class="tl-tick" style="left:${d / DAYS * 100}%"><i></i><em>${d === 0 ? "Heute" : "+" + d + " Tage"}</em></span>`).join("");
  el.innerHTML = `<div class="tl"><div class="tl-line"></div>${ticks}${marks}</div>`;
}
// Errungenschaften-Kachel auf dem Dashboard
function renderAchTile() {
  const el = $("#achTile"); if (!el) return;
  const n = Object.keys(ach.unlocked).length, tot = ACHIEVEMENTS.length;
  const recent = ACHIEVEMENTS.filter(a => ach.unlocked[a.id]).sort((a, b) => ach.unlocked[b.id] - ach.unlocked[a.id]).slice(0, 6);
  const nexts = ACHIEVEMENTS.filter(a => !ach.unlocked[a.id]).slice(0, 3);
  el.innerHTML = `<div class="tile-head"><span class="ic-c">${ICON.trophy}</span><h2>Errungenschaften</h2></div>
    <div class="ach-tile-body">
      <div class="ach-big"><span class="num-serif">${n}</span><span class="muted">von ${tot} freigeschaltet</span></div>
      <div class="ach-bar"><i style="width:${(n / tot * 100).toFixed(0)}%"></i></div>
      ${recent.length ? `<div><div class="eyebrow" style="margin-bottom:10px">Zuletzt freigeschaltet</div><div class="ach-recent">${recent.map(a => `<span class="ach-pill">${a.icon} ${esc(a.title)}</span>`).join("")}</div></div>` : `<p class="muted small" style="margin:0">Noch nichts freigeschaltet. Lege dein erstes Abo an.</p>`}
      ${nexts.length ? `<div><div class="eyebrow" style="margin-bottom:10px">Nächste Ziele</div><ul class="ach-next">${nexts.map(a => `<li><span class="ach-ic">${a.icon}</span><div><b>${esc(a.title)}</b><div class="muted small">${esc(a.desc)}</div></div></li>`).join("")}</ul></div>` : ""}
      <button class="btn small" data-open-ach>Alle ansehen <span class="ic">${ICON.arrow}</span></button>
    </div>`;
}
$("#achTile").addEventListener("click", e => { if (e.target.closest("[data-open-ach]")) $("#btnAch").click(); });

function initTheme() {
  document.querySelectorAll("[data-ic]").forEach(el => { el.innerHTML = ICON[el.dataset.ic] || ""; });
  // Scroll-Einblendung (Fade-in mit leichtem Versatz), gestaffelt
  const els = [...document.querySelectorAll(".reveal")];
  if (!("IntersectionObserver" in window) || reducedMotion()) { els.forEach(e => e.classList.add("in")); }
  else {
    const io = new IntersectionObserver(list => list.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }),
      { threshold: 0.06, rootMargin: "0px 0px -4% 0px" });
    els.forEach((e, i) => { e.style.setProperty("--d", (i % 4) * 80 + "ms"); io.observe(e); });
  }
  // Glow folgt dem Mauszeiger
  $(".bento").addEventListener("pointermove", e => {
    const t = e.target.closest(".tile"); if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", (e.clientX - r.left) + "px"); t.style.setProperty("--my", (e.clientY - r.top) + "px");
  });
}

/* ================= Start ================= */
function loadState() {
  subs = clean(lsGet(KEY, []));
  meta = Object.assign({ updatedAt: 0 }, lsGet(META_KEY, {}));
  settings = Object.assign({ base: "EUR", remindDays: 3, noticeRemind: 7, notif: false, autoLock: 15 }, lsGet(SET_KEY, {}));
  ratesInfo = lsGet(RATES_KEY, null);          // { date, rates, fetchedAt }
  rates = ratesInfo?.rates || FALLBACK_RATES;
  ach = Object.assign(structuredClone(ACH_DEFAULT), lsGet(ACH_KEY, {}));
  loadCfg();
  selProv = cfg.provider || "";
}
let started = false;
export function startApp() {
  if (started) return;
  started = true;
  loadState();
  initTheme();
  render();
  renderSync();
  maybeRefreshRates();
  initSync();
  setInterval(checkReminders, 30 * 60 * 1000);
  window.addEventListener("focus", () => { if (backend && syncState !== "needs-permission") syncNow(); });
  setInterval(() => { if (backend && (syncState === "ok" || syncState === "error") && !document.hidden) syncNow(); }, 60000);
}
