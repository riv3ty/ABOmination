// App-Icons erzeugen (SVG → PNG über Chrome): node scripts/make-icons.js
// Ergebnis liegt in web/public/icons/ und wird eingecheckt; nur bei Designänderungen neu ausführen.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../web/public/icons");
const CHROME = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].find(p => fs.existsSync(p));

// Kalender-Symbol aus der App (24er-Raster), weiß auf violettem Verlauf
const glyph = (x, scale) => `<g transform="translate(${x} ${x}) scale(${scale})" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/><path d="M7.5 14h3M13.5 14h3M7.5 17.5h3" stroke-width="1.5"/></g>`;
const svg = ({ rounded, x, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="url(#g)"/>${glyph(x, scale)}</svg>`;

// normal: abgerundet, großes Symbol · maskable/apple: vollflächig, Symbol in der sicheren Zone (Android schneidet zu)
const VARIANTS = {
  normal: svg({ rounded: true, x: 106, scale: 12.5 }),
  maskable: svg({ rounded: false, x: 146, scale: 9.17 }),
  apple: svg({ rounded: false, x: 116, scale: 11.67 })
};
const FILES = [
  ["icon-192.png", "normal", 192], ["icon-512.png", "normal", 512],
  ["maskable-512.png", "maskable", 512], ["maskable-192.png", "maskable", 192],
  ["apple-touch-icon.png", "apple", 180], ["favicon-32.png", "normal", 32]
];

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "icon.svg"), VARIANTS.normal);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
for (const [name, variant, size] of FILES) {
  await page.setViewport({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${VARIANTS[variant].replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(OUT, name), omitBackground: true });
  console.log("erzeugt:", name);
}
await browser.close();
