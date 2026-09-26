// Website für GitHub Pages zusammenbauen: npm run build && node scripts/build-site.js [ausgabe]
// Ergebnis (Standard: _site/): Landingpage, Rechtsseiten, Roadmap und die App als Live-Demo unter /app/.
// Newsletter und Rechtsseiten werden nur eingebunden, wenn site/site.config.json vollständig ausgefüllt ist.
import fs from "node:fs";
import path from "node:path";
import { demoData } from "./demo-data.js";

const REPO = path.resolve(import.meta.dirname, "..");
const OUT = path.resolve(REPO, process.argv[2] || "_site");
// SITE_CONFIG: andere Konfigurationsdatei (z. B. zum Testen mit Beispielangaben)
const cfg = JSON.parse(fs.readFileSync(process.env.SITE_CONFIG || path.join(REPO, "site/site.config.json"), "utf8"));
const roadmap = JSON.parse(fs.readFileSync(path.join(REPO, "docs/roadmap.json"), "utf8"));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const L = cfg.legal || {};
const legalReady = ["name", "street", "postalCity", "email"].every(k => String(L[k] || "").trim());
const newsletterReady = legalReady && /^https:\/\/[^\s"]+$/.test(cfg.newsletter?.brevoFormAction || "");
const flags = { legal: legalReady, newsletter: newsletterReady, phone: !!String(L.phone || "").trim() };

// Roadmap-Spalten (Erledigt, In Arbeit, Als Nächstes, Später)
const roadmapHtml = `<div class="roadmap">${roadmap.stages.filter(s => s.id !== "exploring").map(st => `
  <div class="stage ${esc(st.id)}"><h3><i></i><span lang="en">${esc(st.title.en)}</span><span lang="de">${esc(st.title.de)}</span></h3><ul>${st.items.map(it => `
    <li><b><span lang="en">${esc(it.en[0])}</span><span lang="de">${esc(it.de[0])}</span></b><span lang="en">${esc(it.en[1])}</span><span lang="de">${esc(it.de[1])}</span></li>`).join("")}
  </ul></div>`).join("")}</div>`;

function render(file) {
  let html = fs.readFileSync(path.join(REPO, "site", file), "utf8");
  for (const [flag, on] of Object.entries(flags))                              // <!--if:x--> … <!--endif:x-->
    html = html.replace(new RegExp(`<!--if:${flag}-->([\\s\\S]*?)<!--endif:${flag}-->`, "g"), on ? "$1" : "");
  html = html.replace("<!--roadmap-->", roadmapHtml);
  const vars = { siteUrl: cfg.siteUrl, repo: cfg.repo, image: cfg.image, today: new Date().toISOString().slice(0, 10),
    "newsletter.brevoFormAction": cfg.newsletter?.brevoFormAction, ...Object.fromEntries(Object.entries(L).map(([k, v]) => ["legal." + k, v])) };
  html = html.replace(/\{\{([\w.]+)\}\}/g, (m, k) => { if (!(k in vars)) throw new Error(`${file}: unbekannter Platzhalter ${m}`); return esc(vars[k]); });
  fs.writeFileSync(path.join(OUT, file), html);
}
const copyDir = (from, to, filter = () => true) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) if (filter(f)) fs.cpSync(path.join(from, f), path.join(to, f), { recursive: true });
};

if (!fs.existsSync(path.join(REPO, "dist/index.html"))) { console.error("dist/ fehlt – vorher npm run build."); process.exit(2); }
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

render("index.html");
if (legalReady) { render("impressum.html"); render("datenschutz.html"); }
for (const f of ["site.css", "site.js"]) fs.copyFileSync(path.join(REPO, "site", f), path.join(OUT, f));
copyDir(path.join(REPO, "web/src/fonts"), path.join(OUT, "assets/fonts"), f => f.endsWith(".woff2"));
copyDir(path.join(REPO, "web/public/icons"), path.join(OUT, "assets/icons"));
copyDir(path.join(REPO, "docs/screenshots"), path.join(OUT, "assets/screenshots"));
copyDir(path.join(REPO, "dist"), path.join(OUT, "app"));                      // Live-Demo (lokaler Modus)
fs.writeFileSync(path.join(OUT, "app/demo-data.json"), JSON.stringify(demoData()));
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

console.log(`Website gebaut: ${path.relative(REPO, OUT) || OUT}`);
console.log(`  Rechtsseiten: ${legalReady ? "ja" : "NEIN – legal.* in site/site.config.json ausfüllen"}`);
console.log(`  Newsletter:   ${newsletterReady ? "ja" : "NEIN – " + (legalReady ? "newsletter.brevoFormAction eintragen" : "erst Rechtsangaben ausfüllen")}`);
