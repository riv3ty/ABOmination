// Angebote von MyDealz (öffentliche RSS-Feeds). Der Browser darf fremde Feeds nicht direkt laden (CORS),
// deshalb holt der Server sie – nur feste Adressen bei mydealz.de, zwischengespeichert. Welche Abos jemand hat,
// erfährt MyDealz dabei nicht: abgefragt werden nur Gruppen-Feeds (z. B. „netflix“), gefiltert wird in der App.
const BASE = "https://www.mydealz.de/rss/";
const FIXED = { trending: "trending", deals: "deals" };
const SLUG = /^[a-z0-9]+(-[a-z0-9]+){0,5}$/;
const TTL = 30 * 60000, TTL_MISSING = 6 * 3600000, MAX_GROUPS = 12, MAX_ITEMS = 30;

const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&").trim();
const tag = (xml, name) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml); return m ? decode(m[1]) : ""; };
const attr = (xml, el, name) => { const m = new RegExp(`<${el}\\b[^>]*\\b${name}="([^"]*)"`).exec(xml); return m ? decode(m[1]) : ""; };

// RSS → [{ title, url, price, merchant, category, date }]; nur Links zu mydealz.de
export function parseFeed(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1], url = tag(it, "link");
    if (!/^https:\/\/www\.mydealz\.de\/[\w\-/.%]+$/.test(url)) continue;
    const date = Date.parse(tag(it, "pubDate"));
    out.push({
      title: tag(it, "title").slice(0, 200), url,
      price: attr(it, "pepper:merchant", "price").slice(0, 30), merchant: attr(it, "pepper:merchant", "name").slice(0, 60),
      category: tag(it, "category").slice(0, 60), date: Number.isFinite(date) ? date : 0
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export default async function dealsRoutes(app, { fetchImpl = fetch, version }) {
  const cache = new Map();                                    // Feed-Pfad → { at, items, missing }
  async function feed(pathPart) {
    const hit = cache.get(pathPart), now = Date.now();
    if (hit && now - hit.at < (hit.missing ? TTL_MISSING : TTL)) return hit.items;
    try {
      const r = await fetchImpl(BASE + pathPart, { headers: { "User-Agent": `ABOmination/${version} (+https://github.com/riv3ty/ABOmination)`, Accept: "application/rss+xml" }, signal: AbortSignal.timeout(8000), redirect: "follow" });
      if (r.status === 404) { cache.set(pathPart, { at: now, items: [], missing: true }); return []; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      const items = parseFeed(await r.text());
      cache.set(pathPart, { at: now, items });
      return items;
    } catch (e) {
      app.log.warn({ feed: pathPart, err: e.message }, "MyDealz-Feed nicht abrufbar");
      return hit ? hit.items : [];                            // im Zweifel den alten Stand liefern
    }
  }

  // GET /api/deals?groups=netflix,spotify → { trending: [...], groups: { netflix: [...], ... }, fetchedAt }
  app.get("/api/deals", {
    preHandler: app.requireAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    schema: { querystring: { type: "object", properties: { groups: { type: "string", maxLength: 600 } } } }
  }, async (req, reply) => {
    const groups = [...new Set(String(req.query.groups || "").split(",").map(s => s.trim()).filter(Boolean))];
    if (groups.length > MAX_GROUPS || groups.some(g => !SLUG.test(g) || g.length > 40))
      return reply.code(400).send({ error: "invalid_groups", message: `Höchstens ${MAX_GROUPS} Gruppen (Kleinbuchstaben, Ziffern, Bindestriche).` });
    const [trending, ...lists] = await Promise.all([feed(FIXED.trending), ...groups.map(g => feed("gruppe/" + g))]);
    return { trending, groups: Object.fromEntries(groups.map((g, i) => [g, lists[i]])), fetchedAt: Date.now() };
  });
}
