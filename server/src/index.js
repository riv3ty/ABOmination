// Server-Start: node server/src/index.js (Konfiguration über Umgebungsvariablen, siehe .env.example)
import path from "node:path";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { buildApp } from "./app.js";

const config = loadConfig();
const db = openDb(path.join(config.dataDir, "abomination.db"));
const app = await buildApp({ config, db });

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, async () => {
  app.log.info(`${sig} empfangen, fahre herunter …`);
  await app.close(); db.close(); process.exit(0);
});

try {
  await app.listen({ host: config.host, port: config.port });
  app.log.info(`Registrierung: ${config.registration} · Daten: ${config.dataDir}`);
} catch (e) { app.log.error(e); process.exit(1); }
