// Website für GitHub Pages zusammenbauen: npm run build && node scripts/build-site.js [ausgabe]
// Ergebnis (Standard: _site/): Englisch unter /, Deutsch unter /de/ – Landingpage, Rechtsseiten, Roadmap-Grafik –
// und die App als Live-Demo unter /app/.
// Newsletter, Rechtsseiten und „Unterstützen“ werden nur eingebunden, wenn site/site.config.json entsprechend ausgefüllt ist.
import fs from "node:fs";
import path from "node:path";
import { demoData } from "./demo-data.js";

const REPO = path.resolve(import.meta.dirname, "..");
const OUT = path.resolve(REPO, process.argv[2] || "_site");
// SITE_CONFIG: andere Konfigurationsdatei (z. B. zum Testen mit Beispielangaben)
const cfg = JSON.parse(fs.readFileSync(process.env.SITE_CONFIG || path.join(REPO, "site/site.config.json"), "utf8"));
const roadmap = JSON.parse(fs.readFileSync(path.join(REPO, "docs/roadmap.json"), "utf8"));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LANGS = ["en", "de"];

const L = cfg.legal || {};
const legalReady = ["name", "street", "postalCity", "email"].every(k => String(L[k] || "").trim());
const newsletterReady = legalReady && /^https:\/\/[^\s"]+$/.test(cfg.newsletter?.brevoFormAction || "");

// Unterstützen: nur Plattformen mit gültigem Benutzernamen
const FUNDING = [
  { key: "githubSponsors", name: "GitHub Sponsors", url: u => `https://github.com/sponsors/${u}`, color: "#db61a2",
    en: "Monthly or one-time, directly on GitHub.", de: "Monatlich oder einmalig, direkt über GitHub." },
  { key: "kofi", name: "Ko-fi", url: u => `https://ko-fi.com/${u}`, color: "#ff5e5b",
    en: "Buy a coffee – one-time, no account needed.", de: "Einen Kaffee ausgeben – einmalig, ohne Konto." },
  { key: "liberapay", name: "Liberapay", url: u => `https://liberapay.com/${u}/donate`, color: "#f6c915",
    en: "Recurring donations via a non-profit platform.", de: "Regelmäßige Spenden über eine gemeinnützige Plattform." }
].filter(f => /^[A-Za-z0-9_-]{1,39}$/.test(String(cfg.funding?.[f.key] || "")));
const fundingHtml = `<div class="funding">${FUNDING.map(f => `
  <a class="card fund" href="${esc(f.url(cfg.funding[f.key]))}" rel="noopener"><i style="background:${f.color}"></i>
    <b>${esc(f.name)}</b><span lang="en">${esc(f.en)}</span><span lang="de">${esc(f.de)}</span></a>`).join("")}</div>`;

const flags = { legal: legalReady, newsletter: newsletterReady, funding: FUNDING.length > 0, phone: !!String(L.phone || "").trim() };

// Roadmap-Spalten (Erledigt, In Arbeit, Als Nächstes, Später) – Details unter der Grafik
const roadmapHtml = `<div class="roadmap">${roadmap.stages.filter(s => s.id !== "exploring").map(st => `
  <div class="stage ${esc(st.id)}"><h3><i></i><span lang="en">${esc(st.title.en)}</span><span lang="de">${esc(st.title.de)}</span></h3><ul>${st.items.map(it => `
    <li><b><span lang="en">${esc(it.en[0])}</span><span lang="de">${esc(it.de[0])}</span></b><span lang="en">${esc(it.en[1])}</span><span lang="de">${esc(it.de[1])}</span></li>`).join("")}
  </ul></div>`).join("")}</div>`;

// Aus zweisprachigem Markup eine Sprache machen: <span lang="xx">…</span> (verschachtelte <span> werden mitgezählt)
// und <!--xx-->…<!--/xx--> (für Attribute und <title>) – die andere Sprache entfernen, die eigene auspacken.
function onlyLang(html, lang) {
  html = html.replace(/<!--(en|de)-->([\s\S]*?)<!--\/\1-->/g, (m, l, inner) => l === lang ? inner : "");
  const open = /<span lang="(en|de)">/g;
  let m;
  while ((m = open.exec(html))) {
    let depth = 1, i = m.index + m[0].length;
    const tag = /<span\b[^>]*>|<\/span>/g;
    tag.lastIndex = i;
    let t;
    while (depth && (t = tag.exec(html))) depth += t[0] === "</span>" ? -1 : 1;
    if (depth) throw new Error("Nicht geschlossenes <span lang>");
    const end = t.index + t[0].length, inner = html.slice(i, t.index);
    html = html.slice(0, m.index) + (m[1] === lang ? inner : "") + html.slice(end);
    open.lastIndex = m.index;
  }
  return html;
}

// Seitenweise Angaben je Sprache (Deutsch liegt eine Ebene tiefer unter /de/)
const DOC = (lang, file) => `${cfg.repo}/blob/main/${lang === "de" ? file.replace(/\.md$/, ".de.md") : file}`;
function render(file, lang) {
  let html = fs.readFileSync(path.join(REPO, "site", file), "utf8");
  const de = lang === "de", page = file === "index.html" ? "" : file;
  for (const [flag, on] of Object.entries(flags))                              // <!--if:x--> … <!--endif:x-->
    html = html.replace(new RegExp(`<!--if:${flag}-->([\\s\\S]*?)<!--endif:${flag}-->`, "g"), on ? "$1" : "");
  html = html.replace("<!--roadmap-->", roadmapHtml).replace("<!--funding-->", fundingHtml);
  html = onlyLang(html, lang);
  const vars = {
    siteUrl: cfg.siteUrl, repo: cfg.repo, image: cfg.image, today: new Date().toISOString().slice(0, 10), lang,
    canonical: cfg.siteUrl + (de ? "de/" : "") + page,
    altLang: de ? "en" : "de", altLabel: de ? "EN" : "DE", altHref: de ? `../${page}?lang=en` : `de/${page}`,
    "doc.readme": de ? `${cfg.repo}/blob/main/README.de.md` : `${cfg.repo}#readme`,
    "doc.deployment": DOC(lang, "DEPLOYMENT.md"), "doc.roadmap": DOC(lang, "ROADMAP.md"), "doc.security": DOC(lang, "SECURITY.md"),
    "newsletter.brevoFormAction": cfg.newsletter?.brevoFormAction, ...Object.fromEntries(Object.entries(L).map(([k, v]) => ["legal." + k, v]))
  };
  html = html.replace(/\{\{([\w.]+)\}\}/g, (m, k) => { if (!(k in vars)) throw new Error(`${file}: unbekannter Platzhalter ${m}`); return esc(vars[k]); });
  // Deutsche Seiten: gemeinsame Dateien (Styles, Skript, Bilder, Demo) liegen eine Ebene höher
  if (de) html = html.replace(/(\b(?:href|src|srcset)=")(?=(?:assets\/|app\/|site\.css|site\.js))/g, "$1../");
  const dir = path.join(OUT, de ? "de" : "");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), html);
}
const copyDir = (from, to, filter = () => true) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) if (filter(f)) fs.cpSync(path.join(from, f), path.join(to, f), { recursive: true });
};

if (!fs.existsSync(path.join(REPO, "dist/index.html"))) { console.error("dist/ fehlt – vorher npm run build."); process.exit(2); }
if (!fs.existsSync(path.join(REPO, "docs/roadmap/roadmap-en-light.svg"))) { console.error("Roadmap-Grafik fehlt – vorher npm run docs."); process.exit(2); }
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const lang of LANGS) {
  render("index.html", lang);
  if (legalReady) { render("impressum.html", lang); render("datenschutz.html", lang); }
}
for (const f of ["site.css", "site.js"]) fs.copyFileSync(path.join(REPO, "site", f), path.join(OUT, f));
copyDir(path.join(REPO, "web/src/fonts"), path.join(OUT, "assets/fonts"), f => f.endsWith(".woff2"));
copyDir(path.join(REPO, "web/public/icons"), path.join(OUT, "assets/icons"));
copyDir(path.join(REPO, "docs/screenshots"), path.join(OUT, "assets/screenshots"));
copyDir(path.join(REPO, "docs/roadmap"), path.join(OUT, "assets/roadmap"), f => f.endsWith(".svg"));
copyDir(path.join(REPO, "dist"), path.join(OUT, "app"));                      // Live-Demo (lokaler Modus)
fs.writeFileSync(path.join(OUT, "app/demo-data.json"), JSON.stringify(demoData()));
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

console.log(`Website gebaut: ${path.relative(REPO, OUT) || OUT} (Englisch unter /, Deutsch unter /de/)`);
console.log(`  Rechtsseiten: ${legalReady ? "ja" : "NEIN – legal.* in site/site.config.json ausfüllen"}`);
console.log(`  Newsletter:   ${newsletterReady ? "ja" : "NEIN – " + (legalReady ? "newsletter.brevoFormAction eintragen" : "erst Rechtsangaben ausfüllen")}`);
console.log(`  Unterstützen: ${FUNDING.length ? FUNDING.map(f => f.name).join(", ") : "NEIN – funding.* in site/site.config.json eintragen"}`);
