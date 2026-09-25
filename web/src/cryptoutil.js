// Kryptografie im Browser (WebCrypto): Schlüsselableitung und AES-256-GCM
const te = new TextEncoder(), td = new TextDecoder();
export const toB64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
export const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));

// Lokale Profile: AES-Schlüssel direkt aus dem Passwort (PBKDF2-SHA256)
export async function deriveLocalKey(pw, salt, iter) {
  const base = await crypto.subtle.importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// Server-Konten (Protokoll siehe server/API.md): PBKDF2 → masterKey, daraus per HKDF
// authKey (geht an den Server) und encKey (verschlüsselt den Tresor, verlässt das Gerät nie)
export async function deriveServerKeys(pw, saltB64, iter) {
  const base = await crypto.subtle.importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const master = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromB64(saltB64), iterations: iter, hash: "SHA-256" }, base, 256);
  const hk = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveBits", "deriveKey"]);
  const hkdf = info => ({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: te.encode(info) });
  const authKey = toB64(new Uint8Array(await crypto.subtle.deriveBits(hkdf("abomination/auth/v1"), hk, 256)));
  const encKey = await crypto.subtle.deriveKey(hkdf("abomination/enc/v1"), hk, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return { authKey, encKey };
}

export async function seal(key, obj) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(obj))));
  return { iv: toB64(iv), ct: toB64(ct) };
}
export async function openBlob(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) }, key, fromB64(blob.ct));
  return JSON.parse(td.decode(pt));
}
