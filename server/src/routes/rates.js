// Wechselkurse (EZB, über frankfurter.dev) zwischengespeichert ausliefern.
// So muss der Browser im Server-Modus keinen externen Dienst kontaktieren.
const SOURCE = "https://api.frankfurter.dev/v1/latest?base=EUR";
const MAX_AGE = 12 * 3600000;

export default async function ratesRoutes(app, { fetchImpl = globalThis.fetch }) {
  let cache = null, pending = null;                          // { date, rates, fetchedAt }

  async function load() {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetchImpl(SOURCE, { signal: ctl.signal, headers: { accept: "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      // nur plausible Werte übernehmen: dreistellige Währungscodes mit positiven Zahlen
      const rates = Object.fromEntries(Object.entries(j?.rates || {})
        .filter(([k, v]) => /^[A-Z]{3}$/.test(k) && typeof v === "number" && v > 0 && Number.isFinite(v)));
      if (!Object.keys(rates).length || !/^\d{4}-\d{2}-\d{2}$/.test(j.date)) throw new Error("unerwartete Antwort");
      cache = { date: j.date, rates, fetchedAt: Date.now() };
    } finally { clearTimeout(t); }
  }

  app.get("/api/rates", async (req, reply) => {
    if (!cache || Date.now() - cache.fetchedAt > MAX_AGE) {
      pending ||= load().catch(e => req.log.warn({ err: e.message }, "Wechselkurse nicht abrufbar")).finally(() => { pending = null; });
      await pending;
    }
    if (!cache) return reply.code(503).send({ error: "rates_unavailable", message: "Wechselkurse sind gerade nicht verfügbar." });
    return { ...cache, source: "EZB (frankfurter.dev)" };
  });
}
