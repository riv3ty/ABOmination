// ROADMAP.md und ROADMAP.de.md aus docs/roadmap.json erzeugen: node scripts/build-roadmap.js
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(REPO, "docs/roadmap.json"), "utf8"));
const MARK = { shipped: "✅", now: "🚧", next: "⏭️", later: "🗓️", exploring: "💡" };
const T = {
  en: { title: "Roadmap", intro: "Where ABOmination is heading. Priorities can change – ideas and feedback are welcome in the [issues](https://github.com/riv3ty/ABOmination/issues).",
        updated: "Last updated", other: "[Deutsch](ROADMAP.de.md)", gen: "Generated from `docs/roadmap.json` – edit that file and run `node scripts/build-roadmap.js`." },
  de: { title: "Roadmap", intro: "Wohin sich ABOmination entwickelt. Prioritäten können sich ändern – Ideen und Feedback gern in den [Issues](https://github.com/riv3ty/ABOmination/issues).",
        updated: "Stand", other: "[English](ROADMAP.md)", gen: "Erzeugt aus `docs/roadmap.json` – dort ändern und `node scripts/build-roadmap.js` ausführen." }
};

for (const lang of ["en", "de"]) {
  const t = T[lang];
  const out = [`# ${t.title}`, "", `${t.other} · ${t.updated}: ${data.updated}`, "", t.intro, ""];
  for (const st of data.stages) {
    out.push(`## ${MARK[st.id] || ""} ${st.title[lang]}`.trim(), "");
    for (const it of st.items) out.push(`- **${it[lang][0]}** – ${it[lang][1]}`);
    out.push("");
  }
  out.push(`<sub>${t.gen}</sub>`, "");
  fs.writeFileSync(path.join(REPO, lang === "en" ? "ROADMAP.md" : "ROADMAP.de.md"), out.join("\n"));
  console.log("erzeugt:", lang === "en" ? "ROADMAP.md" : "ROADMAP.de.md");
}
