// Unterstützen-Links aus site/site.config.json erzeugen: node scripts/build-funding.js (oder npm run docs)
//   - .github/FUNDING.yml (Sponsor-Knopf im GitHub-Repo)
//   - Abschnitt zwischen <!-- support:start --> und <!-- support:end --> in README.md / README.de.md
// Leere Benutzernamen = Plattform wird nicht angezeigt; ohne Namen verschwinden Knopf und Abschnitt.
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
const cfg = JSON.parse(fs.readFileSync(process.env.SITE_CONFIG || path.join(REPO, "site/site.config.json"), "utf8"));
const f = cfg.funding || {};
const valid = v => /^[A-Za-z0-9_-]{1,39}$/.test(String(v || ""));

const P = [
  { key: "githubSponsors", yml: v => `github: [${v}]`, url: v => `https://github.com/sponsors/${v}`, name: "GitHub Sponsors",
    badge: "GitHub%20Sponsors-EA4AAA?logo=githubsponsors&logoColor=white", en: "monthly or one-time", de: "monatlich oder einmalig" },
  { key: "kofi", yml: v => `ko_fi: ${v}`, url: v => `https://ko-fi.com/${v}`, name: "Ko-fi",
    badge: "Ko--fi-FF5E5B?logo=kofi&logoColor=white", en: "buy a coffee, no account needed", de: "einen Kaffee ausgeben, ohne Konto" },
  { key: "liberapay", yml: v => `liberapay: ${v}`, url: v => `https://liberapay.com/${v}/donate`, name: "Liberapay",
    badge: "Liberapay-F6C915?logo=liberapay&logoColor=black", en: "recurring, non-profit platform", de: "regelmäßig, gemeinnützige Plattform" }
].filter(p => valid(f[p.key]));

// FUNDING.yml
const yml = ["# Erzeugt aus site/site.config.json (npm run docs) – dort die Benutzernamen eintragen.",
  ...(P.length ? P.map(p => p.yml(f[p.key])) : ["# Noch keine Plattform eingetragen – daher kein Sponsor-Knopf."]), ""].join("\n");
fs.writeFileSync(path.join(REPO, ".github/FUNDING.yml"), yml);

// README-Abschnitte
const section = lang => !P.length ? "" : [
  lang === "en" ? "## Support" : "## Unterstützen", "",
  lang === "en"
    ? "ABOmination is free for personal use, without ads or tracking. If it saves you money, you can support its development:"
    : "ABOmination ist für die private Nutzung kostenlos, ohne Werbung und Tracking. Wenn es dir Geld spart, kannst du die Weiterentwicklung unterstützen:",
  "",
  P.map(p => `<a href="${p.url(f[p.key])}"><img alt="${p.name}" src="https://img.shields.io/badge/${p.badge}"></a>`).join("\n"),
  "",
  ...P.map(p => `- **[${p.name}](${p.url(f[p.key])})** – ${p[lang]}`),
  ""
].join("\n");
for (const [file, lang] of [["README.md", "en"], ["README.de.md", "de"]]) {
  const p = path.join(REPO, file), s = fs.readFileSync(p, "utf8");
  const re = /<!-- support:start -->[\s\S]*?<!-- support:end -->/;
  if (!re.test(s)) throw new Error(`${file}: Markierung <!-- support:start --> fehlt`);
  fs.writeFileSync(p, s.replace(re, `<!-- support:start -->\n${section(lang)}<!-- support:end -->`));
}
console.log(`erzeugt: .github/FUNDING.yml, README-Abschnitte (${P.length ? P.map(p => p.name).join(", ") : "keine Plattform eingetragen"})`);
