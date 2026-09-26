// Fastify-App zusammensetzen (für Server-Start und Tests)
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { serverSecret } from "./security.js";
import { readSession, purgeExpired, Throttle } from "./sessions.js";
import { KDF } from "./schemas.js";
import authRoutes from "./routes/auth.js";
import vaultRoutes from "./routes/vault.js";
import ratesRoutes from "./routes/rates.js";

export const VERSION = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;   // eine Quelle für die Versionsnummer

// Content-Security-Policy für die Web-App. Inline-Skripte (Build als Einzeldatei) werden per Hash erlaubt.
export function buildCsp(html) {
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => `'sha256-${crypto.createHash("sha256").update(m[1]).digest("base64")}'`);
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(" ")} https://accounts.google.com`,       // Google-Anmeldung (Drive-Sync)
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "font-src 'self' data:",                                                  // selbst gehostete Schriften, eingebettet
    "img-src 'self' data:",
    "connect-src 'self' https:",                                               // Wechselkurse, Sync-Anbieter (Nextcloud: beliebiger Host)
    "frame-src https://accounts.google.com",
    "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'"
  ].join("; ");
}

export async function buildApp({ config, db, logger = { level: config.logLevel }, fetchImpl }) {
  const app = Fastify({ logger, trustProxy: config.trustProxy, bodyLimit: config.maxVaultBytes + 64 * 1024 });
  const secret = serverSecret(db), throttle = new Throttle();

  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 300, timeWindow: "1 minute" });

  // Anmeldung prüfen; bei Cookie-Sessions zusätzlich CSRF-Schutz für ändernde Anfragen
  app.decorate("requireAuth", async (req, reply) => {
    const s = readSession(db, config, req);
    if (!s) return reply.code(401).send({ error: "unauthorized", message: "Nicht angemeldet oder Sitzung abgelaufen." });
    if (s.viaCookie && req.method !== "GET" && req.headers["x-requested-with"] !== "abomination")
      return reply.code(403).send({ error: "csrf", message: "Anfrage abgelehnt (Header X-Requested-With fehlt)." });
    req.session = s;
  });

  // Allgemeine Sicherheits-Header; API-Antworten nie zwischenspeichern
  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");   // OAuth-Popups (Google/Microsoft) brauchen window.opener
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header("X-Frame-Options", "DENY");                                   // ältere Browser (neuere: frame-ancestors)
    reply.header("Cross-Origin-Resource-Policy", "same-origin");
    if (req.protocol === "https") reply.header("Strict-Transport-Security", "max-age=31536000");
    if (req.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
      reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");   // JSON braucht nichts
    }
    return payload;
  });

  app.get("/favicon.ico", async (req, reply) => reply.code(204).send());      // Browser fragen danach; keine Datei nötig
  // Prüft auch die Datenbank. Docker fragt alle 30 s – deshalb nicht ins Request-Log.
  app.get("/api/health", { logLevel: "warn" }, async () => {
    db.prepare("SELECT 1").get();
    return { ok: true, version: VERSION };
  });
  app.get("/api/config", async () => ({ version: VERSION, registration: config.registration, maxVaultBytes: config.maxVaultBytes, kdf: KDF }));

  await app.register(authRoutes, { config, db, secret, throttle });
  await app.register(vaultRoutes, { config, db });
  await app.register(ratesRoutes, { fetchImpl });

  // Web-App ausliefern (dist/ aus dem Build), falls vorhanden
  const index = path.join(config.staticDir, "index.html");
  if (fs.existsSync(index)) {
    const csp = buildCsp(fs.readFileSync(index, "utf8"));
    await app.register(fastifyStatic, {
      root: config.staticDir, index: ["index.html"], wildcard: false,
      setHeaders: (reply, file) => {                                           // @fastify/static ≥ 10: Fastify-Reply
        if (file.endsWith(".html")) reply.header("Content-Security-Policy", csp).header("Cache-Control", "no-cache");
        else if (/sw\.js$|\.webmanifest$/.test(file)) reply.header("Cache-Control", "no-cache");   // Updates sofort erkennen
        else reply.header("Cache-Control", "public, max-age=86400");
      }
    });
  } else app.log.warn(`Keine Web-App gefunden (${index}) – nur die API läuft. Vorher "npm run build" ausführen.`);

  app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: "not_found", message: "Nicht gefunden." }));
  app.setErrorHandler((error, req, reply) => {
    if (error.validation) return reply.code(400).send({ error: "invalid_request", message: "Ungültige Anfrage: " + error.message });
    if (error.statusCode && (error.statusCode < 500 || error.statusCode === 503)) return reply.code(error.statusCode).send({ error: error.code || "error", message: error.message });
    req.log.error(error);
    return reply.code(500).send({ error: "internal", message: "Interner Fehler." });
  });

  purgeExpired(db);
  const timer = setInterval(() => purgeExpired(db), 3600000); timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));
  return app;
}
