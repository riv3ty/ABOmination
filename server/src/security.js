// Kryptografie-Hilfen des Servers: authKey-Hashing, Tokens, Einladungscodes, Scheinsalze
import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, len: 32 };

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
export const sha256 = s => crypto.createHash("sha256").update(s).digest("hex");

// authKey ist bereits ein hochentropischer, im Client per PBKDF2 abgeleiteter Schlüssel (32 Byte).
// scrypt schützt zusätzlich davor, dass ein Datenbank-Leck direkt zum Anmelden taugt.
export async function hashAuthKey(key) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(key, salt, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), h.toString("base64")].join("$");
}
export async function verifyAuthKey(key, stored) {
  const [alg, N, r, p, salt, hash] = String(stored).split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const h = await scrypt(key, Buffer.from(salt, "base64"), expected.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(h, expected);
}
// Für unbekannte Benutzer trotzdem rechnen, damit die Antwortzeit nichts verrät
let dummy = null;
export async function burnAuthCheck(key) {
  dummy ||= await hashAuthKey(crypto.randomBytes(32));
  await verifyAuthKey(key, dummy);
}

// Server-Geheimnis (einmalig erzeugt, in der Datenbank abgelegt)
export function serverSecret(db) {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'secret'").get();
  if (row) return Buffer.from(row.value, "base64");
  const s = crypto.randomBytes(32);
  db.prepare("INSERT INTO meta (key, value) VALUES ('secret', ?)").run(s.toString("base64"));
  return s;
}
// Prelogin für unbekannte Namen: stabiles Scheinsalz, damit nicht erkennbar ist, ob es das Konto gibt
export const fakeSalt = (secret, username) =>
  crypto.createHmac("sha256", secret).update("kdf-salt:" + username).digest().subarray(0, 16).toString("base64");

// Benutzername: 3–32 Zeichen (Buchstaben inkl. Umlaute, Ziffern, . _ -), Vergleich ohne Groß/Klein
export function normalizeUsername(name) {
  const display = String(name ?? "").normalize("NFC").trim();
  if (!/^[\p{L}\p{N}._-]{3,32}$/u.test(display)) return null;
  return { display, key: display.toLocaleLowerCase("de-DE") };
}
// Base64 mit exakter Bytelänge prüfen und dekodieren
export function b64Bytes(s, len) {
  if (typeof s !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
  const buf = Buffer.from(s, "base64");
  return buf.length === len && buf.toString("base64") === s ? buf : null;
}
// Einladungscode: gut abtippbar (Crockford-Base32 ohne verwechselbare Zeichen), 4er-Gruppen
export function newInviteCode() {
  const A = "ABCDEFGHJKMNPQRSTVWXYZ23456789", b = crypto.randomBytes(16);
  const s = [...b].map(x => A[x % A.length]).join("");
  return s.match(/.{4}/g).join("-");
}
export const normalizeInvite = s => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
