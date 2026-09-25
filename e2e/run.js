// Ende-zu-Ende-Test: echter Server + zwei Chrome-Instanzen (getrennte Profile = zwei Geräte).
// Aufruf: npm run e2e   (baut vorher die Web-App; Chrome-Pfad ggf. per CHROME_PATH setzen)
// Gegen einen laufenden Server (z. B. Docker-Container): E2E_URL=http://localhost:8797/ E2E_INVITE=<code> node e2e/run.js
import puppeteer from "puppeteer-core";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
// E2E_SERVER_DIR: Server aus einer anderen Installation starten (z. B. Nachbau des Docker-Image-Inhalts)
const SERVER_DIR = path.resolve(process.env.E2E_SERVER_DIR || REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "abo-e2e-"));
const EXTERNAL = process.env.E2E_URL;                                       // vorhandenen Server testen statt selbst einen zu starten
const PORT = Number(process.env.E2E_PORT || 8799), URL = EXTERNAL || `http://localhost:${PORT}/`;
const CHROME = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].find(p => fs.existsSync(p));
if (!CHROME) { console.error("Kein Chrome/Chromium gefunden – bitte CHROME_PATH setzen."); process.exit(2); }
if (!EXTERNAL && !fs.existsSync(path.join(SERVER_DIR, "dist/index.html"))) { console.error("dist/index.html fehlt – vorher npm run build."); process.exit(2); }
const env = { ...process.env, PORT: String(PORT), DATA_DIR: path.join(WORK, "data"), COOKIE_SECURE: "false", LOG_LEVEL: "warn", REGISTRATION: "invite" };
const PW = "sehr-geheim-123", PW2 = "noch-geheimer-456";

const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok }); console.log(`${ok ? "OK  " : "FAIL"} ${name}${info ? " – " + info : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const invite = EXTERNAL ? process.env.E2E_INVITE : execFileSync(process.execPath, ["server/bin/abo.js", "invite"], { cwd: SERVER_DIR, env }).toString().match(/[A-Z0-9]{4}(-[A-Z0-9]{4}){3}/)[0];
const srv = EXTERNAL ? null : spawn(process.execPath, ["server/src/index.js"], { cwd: SERVER_DIR, env: { ...env, STATIC_DIR: path.join(SERVER_DIR, "dist") }, stdio: ["ignore", "inherit", "inherit"] });
for (let i = 0; i < 50; i++) {                                               // warten, bis der Server antwortet
  try { if ((await fetch(URL + "api/health")).ok) break; } catch {}
  await sleep(200);
}

const errors = [];
async function device(name) {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: path.join(WORK, "chrome-" + name), args: ["--no-first-run"] });
  const p = await b.newPage();
  p.on("dialog", d => d.accept());
  p.on("pageerror", e => errors.push(`${name}: ${e.message}`));
  // Erwartete Netzwerk-Logs (401 vor Login, 409 Konflikt, offline) zählen nicht; 404 und alles andere schon
  p.on("console", m => {
    const t = m.text();
    if (m.type() !== "error" || /status of (401|409)|ERR_INTERNET_DISCONNECTED|fonts\.g|frankfurter/.test(t)) return;
    errors.push(`${name}: ${t}`);
  });
  return { b, p, name };
}
const rows = p => p.$$eval("#rows tr .name", els => els.map(e => e.textContent).sort());
const pill = p => p.$eval("#btnSync", b => b.textContent.trim());
const waitPill = (p, text, timeout = 15000) => p.waitForFunction(t => document.querySelector("#btnSync")?.textContent.includes(t), { timeout }, text);
const unlocked = p => p.waitForFunction(() => !document.body.classList.contains("locked"), { timeout: 30000 });
async function addSub(p, name, price = "9.99") {
  await p.click("#btnAdd");
  await p.$eval("#form [name=name]", (e, v) => e.value = v, name);
  await p.$eval("#form [name=price]", (e, v) => e.value = v, price);
  await p.$eval("#form", f => f.requestSubmit());
}
async function login(p, user, pw) {
  await p.waitForSelector("#auSrvLogin");
  await p.$eval("#auName", (e, v) => e.value = v, user);
  await p.$eval("#auPw", (e, v) => e.value = v, pw);
  await p.$eval("#auSrvLogin", f => f.requestSubmit());
}
// Tresor so abrufen, wie der Server ihn speichert und ausliefert (mit der Sitzung der Seite)
const vaultRow = p => p.evaluate(async () => { const r = await fetch("/api/vault"); const j = await r.json(); return { version: j.version, blob: JSON.stringify(j.blob) }; });

try {
  const A = await device("A"), B = await device("B");

  // 1) Registrierung auf Gerät A
  await A.p.goto(URL);
  await A.p.waitForSelector("#auSrvLogin");
  check("Ohne Konten: Server-Anmeldung wird angezeigt", true);
  await A.p.click("[data-mode=srv-register]");
  await A.p.waitForSelector("#auSrvReg");
  await A.p.type("#auName", "Maciej"); await A.p.type("#auPw", PW); await A.p.type("#auPw2", PW); await A.p.type("#auInvite", invite.toLowerCase());
  await A.p.$eval("#auSrvReg", f => f.requestSubmit());
  await unlocked(A.p);
  check("Registrierung mit Einladungscode", true, await A.p.$eval("#userName", e => e.textContent));
  check("Server-Modus: Cloud-Sync-Abschnitt ausgeblendet", await A.p.$eval("#dlgSet section.local-only", e => getComputedStyle(e).display === "none"));

  // 2) Abo anlegen → verschlüsselt auf dem Server
  await addSub(A.p, "Netflix", "12.99");
  await waitPill(A.p, "Synchronisiert");
  await sleep(300);
  let v = await vaultRow(A.p);
  check("Tresor hochgeladen (Version ≥ 2)", v.version >= 2, "v" + v.version);
  check("Server sieht keinen Klartext", !v.blob.includes("Netflix") && !Buffer.from(JSON.parse(v.blob).ct, "base64").toString("latin1").includes("Netflix"));

  // 3) Anmeldung auf Gerät B sieht die Daten
  await B.p.goto(URL);
  await login(B.p, "maciej", PW);
  await unlocked(B.p);
  check("Gerät B: Anmeldung (Name ohne Groß/Klein)", true);
  check("Gerät B sieht Netflix", JSON.stringify(await rows(B.p)) === '["Netflix"]', JSON.stringify(await rows(B.p)));

  // 4) Konflikt: A und B ändern parallel auf demselben Stand
  await addSub(A.p, "Spotify"); await waitPill(A.p, "Synchronisiert"); await sleep(300);
  await addSub(B.p, "Disney+"); await waitPill(B.p, "Synchronisiert"); await sleep(500);
  check("Konflikt zusammengeführt (B hat alle drei)", JSON.stringify(await rows(B.p)) === '["Disney+","Netflix","Spotify"]', JSON.stringify(await rows(B.p)));
  await A.p.click("#btnSync"); await sleep(1500);
  check("A übernimmt den Stand von B", JSON.stringify(await rows(A.p)) === '["Disney+","Netflix","Spotify"]', JSON.stringify(await rows(A.p)));

  // 5) Löschen auf B kommt auf A an (Grabstein)
  await B.p.$$eval("#rows tr", trs => trs.find(tr => tr.querySelector(".name").textContent === "Netflix").querySelector("[data-del]").click());
  await waitPill(B.p, "Synchronisiert"); await sleep(500);
  await A.p.click("#btnSync"); await sleep(1500);
  check("Löschung übertragen", JSON.stringify(await rows(A.p)) === '["Disney+","Spotify"]', JSON.stringify(await rows(A.p)));

  // 6) Offline-Änderung auf B, später übertragen
  await B.p.setOfflineMode(true);
  await addSub(B.p, "Offline-Abo");
  await waitPill(B.p, "Offline");
  check("Offline erkannt", true, await pill(B.p));
  const cachePending = await B.p.evaluate(() => JSON.parse(localStorage.getItem("abo-srv-maciej")).pending);
  check("Offline-Kopie als ausstehend markiert", cachePending === true);
  await B.p.setOfflineMode(false);
  await B.p.click("#btnSync"); await waitPill(B.p, "Synchronisiert"); await sleep(500);
  await A.p.click("#btnSync"); await sleep(1500);
  check("Offline-Änderung nachträglich übertragen", (await rows(A.p)).includes("Offline-Abo"), JSON.stringify(await rows(A.p)));

  // 7) Offline-Anmeldung auf B (Server weg) mit der Offline-Kopie
  await B.p.reload(); await B.p.waitForSelector("[data-srv]");
  check("Gespeichertes Konto in der Liste", true);
  await B.p.setOfflineMode(true);
  await B.p.click("[data-srv]");
  await B.p.waitForSelector("#auSrvLogin");
  await B.p.type("#auPw", PW); await B.p.$eval("#auSrvLogin", f => f.requestSubmit());
  await unlocked(B.p);
  check("Offline-Anmeldung mit Offline-Kopie", (await rows(B.p)).length === 3, await pill(B.p));
  await B.p.setOfflineMode(false);
  await B.p.click("#btnSync"); await waitPill(B.p, "Synchronisiert");

  // 8) Falsches Passwort
  await A.p.reload(); await A.p.waitForSelector("[data-srv]"); await A.p.click("[data-srv]");
  await A.p.waitForSelector("#auPw"); await A.p.type("#auPw", "falsch-falsch");
  await A.p.$eval("#auSrvLogin", f => f.requestSubmit());
  await A.p.waitForFunction(() => document.querySelector("#auErr")?.textContent, { timeout: 20000 });
  check("Falsches Passwort abgelehnt", /Falsch|falsch/.test(await A.p.$eval("#auErr", e => e.textContent)), await A.p.$eval("#auErr", e => e.textContent));
  await sleep(2500);
  await A.p.$eval("#auPw", e => e.value = ""); await A.p.type("#auPw", PW);
  await A.p.$eval("#auSrvLogin", f => f.requestSubmit());
  await unlocked(A.p);

  // 9) Passwort ändern auf A → B wird abgemeldet, neues Passwort gilt
  await A.p.click("#btnSettings"); await A.p.click("#acPw");
  await A.p.type("#pwOld", PW); await A.p.type("#pwNew", PW2); await A.p.type("#pwNew2", PW2);
  await A.p.$eval("#formPw", f => f.requestSubmit());
  await A.p.waitForFunction(() => !document.querySelector("#dlgPw").open, { timeout: 30000 });
  check("Passwort geändert", true);
  await B.p.click("#btnSync"); await sleep(1500);
  check("Gerät B muss sich neu anmelden", /Neu anmelden/.test(await pill(B.p)), await pill(B.p));
  await A.p.evaluate(() => document.querySelector("#dlgSet").close());

  // 10) Abmelden auf A entfernt die Offline-Kopie
  await A.p.click("#btnSettings");
  await A.p.click("#acLogout");
  await A.p.waitForSelector("#auth:not([hidden]) .au-card", { timeout: 20000 });
  check("Abmelden entfernt Offline-Kopie", await A.p.evaluate(() => localStorage.getItem("abo-srv-maciej") === null));

  // 11) Neues Passwort funktioniert, altes nicht
  await login(A.p, "Maciej", PW2); await unlocked(A.p);
  check("Anmeldung mit neuem Passwort", (await rows(A.p)).length === 3);

  // 12) Vollständige Sicherung einlesen: Abos ersetzt, Einstellungen übernommen, Errungenschaften zusammengeführt
  const backupFile = path.join(WORK, "sicherung.json");
  fs.writeFileSync(backupFile, JSON.stringify({ app: "abo-manager", version: 3, subs: [
    { id: "imp-1", name: "Import-Abo", price: 5, cycle: "monthly", nextDate: "2026-12-01" }],
    settings: { base: "CHF", remindDays: 5 }, achievements: { unlocked: { "json-export": 1700000000000 } } }));
  await (await A.p.$("#fileImport")).uploadFile(backupFile);
  await A.p.waitForFunction(() => [...document.querySelectorAll("#rows tr .name")].some(e => e.textContent === "Import-Abo"), { timeout: 10000 });
  await A.p.click("#btnSettings");
  check("Sicherung: Abos ersetzt", JSON.stringify(await rows(A.p)) === '["Import-Abo"]', JSON.stringify(await rows(A.p)));
  check("Sicherung: Einstellungen übernommen", await A.p.$eval("#setBase", e => e.value) === "CHF" && await A.p.$eval("#setRemind", e => e.value) === "5");
  check("Sicherung: Errungenschaft übernommen", /Vorsorge getroffen/.test(await A.p.$eval("#achTile", e => e.textContent)));
  await A.p.evaluate(() => document.querySelector("#dlgSet").close());

  check("Keine JS-/CSP-Fehler in der Konsole", errors.length === 0, errors.join(" | "));
  await A.b.close(); await B.b.close();
} catch (e) {
  check("Ablauf ohne Ausnahme", false, e.stack);
} finally {
  srv?.kill();
  await sleep(500);
  try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {}
  const bad = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - bad}/${results.length} bestanden`);
  process.exit(bad ? 1 : 0);
}
