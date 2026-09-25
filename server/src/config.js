// Konfiguration aus Umgebungsvariablen (siehe .env.example)
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const bool = (v, fb) => v === undefined || v === "" ? fb : /^(1|true|yes|on)$/i.test(v);
const int = (v, fb, min, max) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
};
// TRUST_PROXY: "true"/"false", Anzahl Hops ("1") oder IP/CIDR-Liste ("127.0.0.1,172.16.0.0/12")
function trustProxy(v) {
  if (v === undefined || v === "") return false;
  if (/^(true|false)$/i.test(v)) return /^true$/i.test(v);
  if (/^\d+$/.test(v)) return Number(v);
  return v.split(",").map(s => s.trim()).filter(Boolean);
}

export function loadConfig(env = process.env) {
  const registration = (env.REGISTRATION || "invite").toLowerCase();
  if (!["invite", "open", "closed"].includes(registration)) throw new Error(`REGISTRATION ungültig: ${env.REGISTRATION}`);
  return {
    host: env.HOST || "127.0.0.1",
    port: int(env.PORT, 8080, 1, 65535),
    dataDir: path.resolve(env.DATA_DIR || path.join(ROOT, "data")),
    staticDir: path.resolve(env.STATIC_DIR || path.join(ROOT, "dist")),
    registration,                                   // invite = nur mit Einladungscode
    trustProxy: trustProxy(env.TRUST_PROXY),
    cookieSecure: bool(env.COOKIE_SECURE, true),
    sessionDays: int(env.SESSION_DAYS, 30, 1, 365),
    maxVaultBytes: int(env.MAX_VAULT_BYTES, 5 * 1024 * 1024, 64 * 1024, 50 * 1024 * 1024),
    logLevel: env.LOG_LEVEL || "info"
  };
}
