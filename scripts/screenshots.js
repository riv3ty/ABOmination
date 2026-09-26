// Screenshots mit Beispieldaten erzeugen: npm run build && node scripts/screenshots.js
// Ergebnis: docs/screenshots/*.webp (für README und Website). Nutzt ein frisches Browserprofil, keine echten Daten.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { demoData } from "./demo-data.js";

const REPO = path.resolve(import.meta.dirname, "..");
const OUT = path.join(REPO, "docs/screenshots");
const APP = pathToFileURL(path.join(REPO, "dist/index.html")).href;
const CHROME = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].find(p => fs.existsSync(p));
if (!fs.existsSync(path.join(REPO, "dist/index.html"))) { console.error("Vorher npm run build."); process.exit(2); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "abo-shots-"));
const demoFile = path.join(tmp, "demo.json");
fs.writeFileSync(demoFile, JSON.stringify(demoData()));
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: path.join(tmp, "profile"), args: process.env.CI ? ["--no-sandbox"] : [] });
const page = await browser.newPage();
page.on("dialog", d => d.accept());
const theme = t => page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: t }, { name: "prefers-reduced-motion", value: "reduce" }]);
const shot = async (name, opts = {}) => {
  // Errungenschafts-Hinweise erscheinen zeitversetzt – per CSS dauerhaft ausblenden
  // Navigation nicht fixieren, sonst liegt sie bei Element-Aufnahmen über dem Inhalt
  await page.addStyleTag({ content: ".toast-wrap{display:none!important}" + (opts.el ? ".nav{position:static!important}" : "") });
  await new Promise(r => setTimeout(r, 400));
  const file = path.join(OUT, name + ".webp");
  await (opts.el ? (await page.$(opts.el)).screenshot({ path: file, type: "webp", quality: 82 }) : page.screenshot({ path: file, type: "webp", quality: 82, ...opts }));
  console.log("erzeugt:", path.relative(REPO, file));
};

try {
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 2 });
  await theme("dark");
  await page.goto(APP);
  await page.waitForSelector("#auCreate");
  await shot("login-dark", { el: "#auth .au-card" });

  await page.type("#auName", "Demo"); await page.type("#auPw", "demo-demo-123"); await page.type("#auPw2", "demo-demo-123");
  await page.$eval("#auCreate", f => f.requestSubmit());
  await page.waitForFunction(() => !document.body.classList.contains("locked"), { timeout: 30000 });
  await (await page.$("#fileImport")).uploadFile(demoFile);
  await page.waitForFunction(() => document.querySelectorAll("#rows tr").length >= 10, { timeout: 10000 });
  await page.$eval("#fStatus", s => { s.value = "active"; s.dispatchEvent(new Event("input")); });

  for (const t of ["light", "dark"]) {
    await theme(t);
    await page.evaluate(() => scrollTo(0, 0));
    await shot(`dashboard-${t}`, { clip: { x: 0, y: 0, width: 1440, height: 1100 } });
  }
  await theme("light");
  await page.click("#instList .inst-item .inst-head");                                   // ersten Ratenkauf aufklappen
  await shot("installments-light", { el: "#instCard" });
  await shot("table-light", { el: "#verwalten .table-card" });
  await theme("dark");
  await shot("insights-dark", { el: "#optTile" });

  // Wechsel auf Mobilansicht lädt die Seite neu (App sperrt sich) → erneut entsperren
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.waitForSelector("[data-login]");
  await page.click("[data-login]");
  await page.waitForSelector("#auPw"); await page.type("#auPw", "demo-demo-123");
  await page.$eval("#auLogin", f => f.requestSubmit());
  await page.waitForFunction(() => !document.body.classList.contains("locked"), { timeout: 30000 });
  for (const t of ["light", "dark"]) {
    await theme(t);
    await page.evaluate(() => scrollTo(0, 0));
    await shot(`mobile-${t}`);
  }
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
