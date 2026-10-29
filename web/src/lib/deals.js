// Angebote & Preissuche: welche MyDealz-Gruppen zu den eigenen Abos passen, Deals zusammenstellen,
// Links zu Preisvergleichen. Abgefragt werden nur Gruppen-Feeds, gefiltert und sortiert wird hier in der App.
export const MAX_GROUPS = 12, MAX_AGE_DAYS = 30;

// Name → MyDealz-Gruppenname („Disney+“ → „disney-plus“, „Amazon Prime“ → „amazon-prime“)
export function slugify(name) {
  return String(name ?? "").toLowerCase()
    .replace(/\+/g, " plus ").replace(/&/g, " und ").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}

// Kategorien (frei eingegeben) → passende Gruppen
const CATEGORY_GROUPS = [
  [/stream|film|serie|video|tv/, "streaming-dienste"], [/musik|music|hörbuch|audio/, "musik-streaming"],
  [/handy|mobilfunk|smartphone|tarif/, "handyvertraege"], [/internet|dsl|glasfaser|festnetz/, "dsl"],
  [/software|cloud|app|lizenz/, "software"], [/fitness|sport|gym/, "fitness"], [/strom|gas|energie/, "strom-gas"], [/vpn/, "vpn"]
];

// Gruppen für die aktiven Abos, wichtigste (teuerste) zuerst; label = wofür die Gruppe gesucht wird
export function groupsForSubs(list) {
  const out = new Map();
  const add = (slug, label, kind) => { if (slug && slug.length >= 2 && !out.has(slug)) out.set(slug, { label, kind }); };
  const active = list.filter(s => s.state === "active" && !s.inst).sort((a, b) => (b.monthly || 0) - (a.monthly || 0));
  for (const s of active) { add(slugify(s.provider || s.name), s.provider || s.name, "name"); if (s.provider) add(slugify(s.name), s.name, "name"); }
  for (const s of active) for (const [re, slug] of CATEGORY_GROUPS) if (re.test((s.category || "").toLowerCase())) add(slug, s.category, "cat");
  return [...out].slice(0, MAX_GROUPS).map(([slug, g]) => ({ slug, ...g }));
}

// Antwort von /api/deals → eine Liste ohne Doppelte, nicht älter als MAX_AGE_DAYS: zuerst Deals zu den eigenen
// Anbietern, danach die aus allgemeinen Kategorien (mehr Rauschen), jeweils neueste zuerst
export function pickDeals(resp, groups, now = Date.now()) {
  const seen = new Set(), out = [];
  for (const g of groups) for (const d of resp?.groups?.[g.slug] || []) {
    if (seen.has(d.url) || (d.date && now - d.date > MAX_AGE_DAYS * 86400000)) continue;
    seen.add(d.url); out.push({ ...d, for: g.label, rank: g.kind === "cat" ? 1 : 0 });
  }
  return out.sort((a, b) => a.rank - b.rank || b.date - a.date);
}

// Suche in bereits geladenen Deals (alle Wörter müssen vorkommen)
export function searchDeals(deals, term) {
  const words = String(term).toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return deals.filter(d => { const t = `${d.title} ${d.merchant} ${d.category}`.toLowerCase(); return words.every(w => t.includes(w)); });
}

// Direktlinks zu Preisvergleichen (öffnen die Ergebnisseite im Browser; keine Daten werden ausgelesen)
export function searchLinks(term) {
  const q = encodeURIComponent(String(term).trim());
  return [
    { label: "Idealo", url: `https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=${q}` },
    { label: "Geizhals", url: `https://geizhals.de/?fs=${q}` },
    { label: "MyDealz", url: `https://www.mydealz.de/search?q=${q}` }
  ];
}
