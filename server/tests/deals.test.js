import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { openDb } from "../src/db.js";
import { buildApp } from "../src/app.js";
import { run } from "../src/cli.js";
import { parseFeed } from "../src/routes/deals.js";

const item = (title, slug, price = "9,99€", merchant = "Netflix") => `<item><category><![CDATA[Streaming]]></category><pepper:merchant name="${merchant}" price="${price}"/>
<title><![CDATA[${title}]]></title><description><![CDATA[<b>x</b>]]></description><link>https://www.mydealz.de/deals/${slug}</link><pubDate>Thu, 29 Oct 2026 23:01:45 +0100</pubDate></item>`;
const rss = (...items) => `<?xml version="1.0"?><rss><channel>${items.join("")}</channel></rss>`;

let app, db, calls;
const fakeFetch = async url => {
  calls.push(url);
  if (url.endsWith("/gruppe/gibtsnicht")) return new Response("nope", { status: 404 });
  if (url.endsWith("/trending")) return new Response(rss(item("Beliebt &amp; günstig", "beliebt-1", "1€", "Amazon")));
  return new Response(rss(item("Netflix Standard 3 Monate", "netflix-1"), item("Böser Link", "x\" onclick=\"y")));
};
beforeEach(async () => {
  calls = [];
  db = openDb(":memory:");
  const config = loadConfig({ REGISTRATION: "invite", COOKIE_SECURE: "false", PUSH_INTERVAL_MS: "600000", STATIC_DIR: path.join(os.tmpdir(), "abo-kein-dist") });
  app = await buildApp({ config, db, logger: false, fetchImpl: fakeFetch, pushSend: async () => {} });
});
afterEach(async () => { await app.close(); db.close(); });

async function login() {
  const res = await app.inject({ method: "POST", url: "/api/auth/register", payload: {
    username: "Anna", invite: run(["invite"], db, () => {}), salt: crypto.randomBytes(16).toString("base64"), iter: 600000,
    authKey: crypto.randomBytes(32).toString("base64"), vault: { v: 1, iv: crypto.randomBytes(12).toString("base64"), ct: Buffer.from("x".repeat(40)).toString("base64") } } });
  return { cookie: `abo_session=${res.cookies.find(c => c.name === "abo_session").value}` };
}

describe("Angebote (MyDealz)", () => {
  it("liest RSS-Einträge und verwirft fremde oder kaputte Links", () => {
    const items = parseFeed(rss(item("A &amp; B", "a-1", "12,99€", "Sky"), item("Fremd", "../../evil"), `<item><title>X</title><link>https://evil.example.com/</link></item>`));
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "A & B", url: "https://www.mydealz.de/deals/a-1", price: "12,99€", merchant: "Sky", category: "Streaming" });
    expect(items[0].date).toBeGreaterThan(0);
  });

  it("liefert beliebte Deals und Gruppen, mit Zwischenspeicher", async () => {
    const h = await login();
    expect((await app.inject({ url: "/api/deals?groups=netflix" })).statusCode).toBe(401);
    const r = (await app.inject({ url: "/api/deals?groups=netflix,gibtsnicht", headers: h })).json();
    expect(r.trending[0].title).toBe("Beliebt & günstig");
    expect(r.groups.netflix.map(i => i.title)).toEqual(["Netflix Standard 3 Monate"]);
    expect(r.groups.gibtsnicht).toEqual([]);
    expect(calls).toEqual(["https://www.mydealz.de/rss/trending", "https://www.mydealz.de/rss/gruppe/netflix", "https://www.mydealz.de/rss/gruppe/gibtsnicht"]);
    await app.inject({ url: "/api/deals?groups=netflix,gibtsnicht", headers: h });
    expect(calls).toHaveLength(3);                                         // aus dem Zwischenspeicher
  });

  it("lässt nur harmlose Gruppennamen zu", async () => {
    const h = await login();
    for (const g of ["../admin", "Netflix", "a b", "x".repeat(41), Array.from({ length: 13 }, (_, i) => "g" + i).join(",")])
      expect((await app.inject({ url: "/api/deals?groups=" + encodeURIComponent(g), headers: h })).statusCode).toBe(400);
    expect(calls).toHaveLength(0);
  });
});
