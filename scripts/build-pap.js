// Übersetzt den amtlichen Programmablaufplan (PAP) des BMF für die maschinelle Lohnsteuerberechnung
// (XML-Pseudocode mit Java-BigDecimal-Ausdrücken) in ein JS-Modul: web/src/lib/pap/lohnsteuer<Jahr>.js
// Aufruf: node scripts/build-pap.js [scripts/pap/Lohnsteuer2026.xml]
// Quelle: https://www.bmf-steuerrechner.de → Programmablaufpläne → XML
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2] || join(root, "scripts/pap/Lohnsteuer2026.xml");
const xml = readFileSync(src, "utf8").replace(/^\uFEFF/, "").replace(/<!--[\s\S]*?-->/g, "");

const decode = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const attrs = s => Object.fromEntries([...s.matchAll(/(\w+)\s*=\s*"([^"]*)"/g)].map(m => [m[1], decode(m[2])]));

// Minimaler XML-Baum (der PAP enthält nur Elemente mit Attributen, kein Text)
function parse(text) {
  const rootNode = { tag: "#root", attrs: {}, children: [] }, stack = [rootNode];
  for (const m of text.matchAll(/<(\/?)([A-Za-z_][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, close, tag, rest, selfClose] = m;
    if (close) {
      const top = stack.pop();
      if (top.tag !== tag) throw new Error(`XML: </${tag}> schließt <${top.tag}>`);
      continue;
    }
    const node = { tag, attrs: attrs(rest), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  if (stack.length !== 1) throw new Error("XML: nicht geschlossene Elemente");
  return rootNode.children[0];
}

const pap = parse(xml);
if (pap.tag !== "PAP") throw new Error("Kein PAP-Dokument");
const find = (node, tag) => node.children.filter(c => c.tag === tag);
const all = (node, tag) => [...find(node, tag), ...node.children.flatMap(c => all(c, tag))];

const vars = pap;
const inputs = all(vars, "INPUT").map(n => n.attrs);
const outputs = all(vars, "OUTPUT").map(n => n.attrs);
const internals = all(vars, "INTERNAL").map(n => n.attrs);
const constants = all(vars, "CONSTANT").map(n => n.attrs);
const methods = all(pap, "METHOD");
const main = all(pap, "MAIN")[0];

// Java-Ausdruck → JS: Array-Literale {…} → […]; sonst ist die Syntax (Methodenaufrufe, ==, &&, <) identisch
const expr = s => s.trim().replace(/^\{([\s\S]*)\}$/, "[$1]");
const defaultOf = v => (v.default !== undefined ? expr(v.default) : v.type === "BigDecimal" ? "BigDecimal.ZERO" : "0");

function body(nodes, ind) {
  const out = [];
  for (const n of nodes) {
    if (n.tag === "EVAL") out.push(`${ind}${expr(n.attrs.exec)};`);
    else if (n.tag === "EXECUTE") out.push(`${ind}${n.attrs.method}();`);
    else if (n.tag === "IF") {
      const then = find(n, "THEN")[0], els = find(n, "ELSE")[0];
      out.push(`${ind}if (${expr(n.attrs.expr)}) {`, ...body(then ? then.children : [], ind + "  "));
      if (els) out.push(`${ind}} else {`, ...body(els.children, ind + "  "));
      out.push(`${ind}}`);
    } else throw new Error("Unbekanntes Element <" + n.tag + ">");
  }
  return out;
}

// Prüfen, dass keine unbekannten Java-Methoden vorkommen (sonst würde das Modul erst zur Laufzeit scheitern)
const KNOWN = new Set(["add", "subtract", "multiply", "divide", "setScale", "compareTo", "longValue", "valueOf"]);
for (const m of xml.matchAll(/\.\s*([a-zA-Z]+)\s*\(/g)) if (!KNOWN.has(m[1])) throw new Error("Nicht unterstützte Methode: " + m[1]);

const name = pap.attrs.name;                                      // z. B. "Lohnsteuer2026"
const fn = name[0].toLowerCase() + name.slice(1);
const stand = (readFileSync(src, "utf8").match(/Stand:\s*([^-]+?-\d\d-\d\d[^-]*?)\s*-->/) || [])[1] || "";
const bdInputs = inputs.filter(i => i.type === "BigDecimal").map(i => i.name);

const code = [
  "/* eslint-disable */",
  `// AUTOMATISCH ERZEUGT aus ${basename(src)} (amtlicher PAP des BMF${stand ? ", Stand " + stand.trim() : ""}) – nicht von Hand ändern.`,
  "// Neu erzeugen: node scripts/build-pap.js",
  `// Eingaben wie im PAP (Beträge in Cent, KVZ in Prozent). Ausgaben: BigDecimal in Cent.`,
  'import { BigDecimal } from "./bigdecimal.js";',
  "",
  ...constants.map(c => `const ${c.name} = ${expr(c.value)};`),
  "",
  `export const INPUTS = ${JSON.stringify(inputs.map(i => i.name))};`,
  "",
  `export function ${fn}(input = {}) {`,
  `  for (const k of Object.keys(input)) if (!INPUTS.includes(k)) throw new Error("Unbekannte PAP-Eingabe: " + k);`,
  `  const bd = (k, d) => (input[k] === undefined ? d : BigDecimal.valueOf(input[k]));`,
  `  const num = (k, d) => (input[k] === undefined ? d : Number(input[k]));`,
  ...inputs.map(i => `  let ${i.name} = ${i.type === "BigDecimal" ? "bd" : "num"}(${JSON.stringify(i.name)}, ${defaultOf(i)});`),
  ...outputs.map(o => `  let ${o.name} = ${defaultOf(o)};`),
  ...internals.map(v => `  let ${v.name} = ${defaultOf(v)};`),
  "",
  ...methods.flatMap(m => [`  function ${m.attrs.name}() {`, ...body(m.children, "    "), "  }", ""]),
  ...body(main.children, "  "),
  `  return { ${outputs.map(o => o.name).join(", ")} };`,
  "}",
  ""
].join("\n");

const target = join(root, "web/src/lib/pap", fn + ".js");
writeFileSync(target, code);
console.log(`${target}: ${methods.length} Methoden, ${inputs.length} Eingaben (${bdInputs.length} BigDecimal), ${outputs.length} Ausgaben`);
