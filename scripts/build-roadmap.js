// Roadmap aus docs/roadmap.json erzeugen: node scripts/build-roadmap.js (oder npm run docs)
//   - ROADMAP.md / ROADMAP.de.md
//   - docs/roadmap/roadmap-{en,de}-{light,dark}.svg (Grafik für GitHub und Website)
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(REPO, "docs/roadmap.json"), "utf8"));
const MARK = { shipped: "✅", now: "🚧", next: "⏭️", later: "🗓️", exploring: "💡" };
const T = {
  en: { title: "Roadmap", intro: "Where ABOmination is heading. Priorities can change – ideas and feedback are welcome in the [issues](https://github.com/riv3ty/ABOmination/issues).",
        updated: "Last updated", other: "**English** · [Deutsch](ROADMAP.de.md)", gen: "Generated from `docs/roadmap.json` – edit that file and run `npm run docs`.",
        alt: "Roadmap overview", svgUpdated: "Updated" },
  de: { title: "Roadmap", intro: "Wohin sich ABOmination entwickelt. Prioritäten können sich ändern – Ideen und Feedback gern in den [Issues](https://github.com/riv3ty/ABOmination/issues).",
        updated: "Stand", other: "[English](ROADMAP.md) · **Deutsch**", gen: "Erzeugt aus `docs/roadmap.json` – dort ändern und `npm run docs` ausführen.",
        alt: "Roadmap-Übersicht", svgUpdated: "Stand" }
};

/* ---------- SVG-Grafik ---------- */
const xml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const THEME = {
  light: { text: "#0f0f11", muted: "#71717a", card: "#ffffff", stroke: "rgba(15,15,17,0.12)", track: "rgba(15,15,17,0.14)" },
  dark: { text: "#f4f4f5", muted: "#a1a1aa", card: "#17171a", stroke: "rgba(244,244,245,0.12)", track: "rgba(244,244,245,0.16)" }
};
const COLOR = { shipped: "#22c55e", now: "#8b5cf6", next: "#a78bfa", later: "#a1a1aa", exploring: "#a1a1aa" };
const FONT = "Inter, 'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif";

// Zeilenumbruch nach geschätzter Zeichenbreite (13px fett ≈ 7.3px pro Zeichen)
function wrap(text, max) {
  const lines = [];
  let cur = "";
  for (const w of text.split(" ")) {
    if (cur && (cur + " " + w).length > max) { lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function roadmapSvg(lang, theme) {
  const th = THEME[theme], W = 1200, PAD = 24, stages = data.stages, colW = (W - 2 * PAD) / stages.length;
  const TRACK_Y = 44, ITEMS_Y = 122, BOX_W = colW - 16, LINE_H = 17, GAP = 10;
  const parts = [];
  let bottom = ITEMS_Y;
  const cx = i => PAD + colW * i + colW / 2;

  // Zeitachse mit Verlauf von „erledigt“ (grün) über „in Arbeit“ (violett) zu „später“ (grau)
  parts.push(`<defs><linearGradient id="track" x1="0" x2="1"><stop offset="0" stop-color="${COLOR.shipped}"/><stop offset="0.3" stop-color="${COLOR.now}"/><stop offset="0.7" stop-color="${COLOR.later}" stop-opacity="0.6"/><stop offset="1" stop-color="${COLOR.later}" stop-opacity="0.3"/></linearGradient></defs>`);
  parts.push(`<rect x="${cx(0)}" y="${TRACK_Y - 2}" width="${cx(stages.length - 1) - cx(0)}" height="4" rx="2" fill="url(#track)"/>`);

  stages.forEach((st, i) => {
    const x = cx(i), c = COLOR[st.id] || COLOR.later, dashed = st.id === "exploring";
    // Station
    if (st.id === "now") parts.push(`<circle cx="${x}" cy="${TRACK_Y}" r="17" fill="${c}" fill-opacity="0.18"/>`);
    const filled = st.id === "shipped" || st.id === "now";
    parts.push(`<circle cx="${x}" cy="${TRACK_Y}" r="10" fill="${filled ? c : th.card}" stroke="${c}" stroke-width="2.5"${dashed ? ' stroke-dasharray="3 3"' : ""}/>`);
    if (st.id === "shipped") parts.push(`<path d="M${x - 4.5} ${TRACK_Y} l3 3 l6 -6.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`);
    parts.push(`<text x="${x}" y="${TRACK_Y + 42}" text-anchor="middle" font-family="${FONT}" font-size="12.5" font-weight="700" letter-spacing="1.4" fill="${th.text}">${xml(st.title[lang].toUpperCase())}</text>`);
    parts.push(`<text x="${x}" y="${TRACK_Y + 60}" text-anchor="middle" font-family="${FONT}" font-size="11.5" fill="${th.muted}">${st.items.length}</text>`);
    parts.push(`<line x1="${x}" y1="${TRACK_Y + 70}" x2="${x}" y2="${ITEMS_Y}" stroke="${c}" stroke-width="1.5" stroke-dasharray="2 4" stroke-opacity="0.8"/>`);
    // Einträge
    let y = ITEMS_Y;
    const bx = PAD + colW * i + 8;
    for (const it of st.items) {
      const lines = wrap(it[lang][0], 27), h = lines.length * LINE_H + 22;
      parts.push(`<g><rect x="${bx}" y="${y}" width="${BOX_W}" height="${h}" rx="12" fill="${th.card}" stroke="${dashed ? c : th.stroke}"${dashed ? ' stroke-dasharray="4 4"' : ""}/>`
        + `<rect x="${bx}" y="${y + 10}" width="3.5" height="${h - 20}" rx="1.75" fill="${c}"/>`
        + lines.map((l, k) => `<text x="${bx + 16}" y="${y + 26 + k * LINE_H}" font-family="${FONT}" font-size="13" font-weight="600" fill="${th.text}">${xml(l)}</text>`).join("")
        + `</g>`);
      y += h + GAP;
    }
    bottom = Math.max(bottom, y);
  });
  const H = bottom + 30;
  parts.push(`<text x="${W - PAD}" y="${H - 10}" text-anchor="end" font-family="${FONT}" font-size="11" fill="${th.muted}">ABOmination · ${xml(T[lang].svgUpdated)} ${xml(data.updated)}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${xml(T[lang].alt)}">\n<title>${xml(T[lang].alt)}</title>\n${parts.join("\n")}\n</svg>\n`;
}

// Markdown-Einbindung der Grafik (hell/dunkel je nach GitHub-Design)
export const roadmapPicture = (lang, prefix = "") =>
  `<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="${prefix}docs/roadmap/roadmap-${lang}-dark.svg">\n  <img alt="${T[lang].alt}" src="${prefix}docs/roadmap/roadmap-${lang}-light.svg" width="100%">\n</picture>`;

/* ---------- Ausgabe ---------- */
fs.mkdirSync(path.join(REPO, "docs/roadmap"), { recursive: true });
for (const lang of ["en", "de"]) {
  for (const theme of ["light", "dark"]) fs.writeFileSync(path.join(REPO, `docs/roadmap/roadmap-${lang}-${theme}.svg`), roadmapSvg(lang, theme));
  const t = T[lang];
  const out = [`# ${t.title}`, "", `${t.other} · ${t.updated}: ${data.updated}`, "", t.intro, "", roadmapPicture(lang), ""];
  for (const st of data.stages) {
    out.push(`## ${MARK[st.id] || ""} ${st.title[lang]}`.trim(), "");
    for (const it of st.items) out.push(`- **${it[lang][0]}** – ${it[lang][1]}`);
    out.push("");
  }
  out.push(`<sub>${t.gen}</sub>`, "");
  fs.writeFileSync(path.join(REPO, lang === "en" ? "ROADMAP.md" : "ROADMAP.de.md"), out.join("\n"));
}
console.log("erzeugt: ROADMAP.md, ROADMAP.de.md, docs/roadmap/roadmap-{en,de}-{light,dark}.svg");
