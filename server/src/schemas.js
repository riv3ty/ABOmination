// JSON-Schemas für die Anfragen (Fastify validiert automatisch; unbekannte Felder werden abgelehnt)
const b64 = { type: "string", pattern: "^[A-Za-z0-9+/]+={0,2}$" };

export const KDF = { name: "PBKDF2-SHA256", minIter: 100000, maxIter: 10000000, defaultIter: 600000 };

export const username = { type: "string", minLength: 1, maxLength: 64 };
export const authKey = { ...b64, minLength: 44, maxLength: 44 };            // 32 Byte
export const salt = { ...b64, minLength: 24, maxLength: 24 };               // 16 Byte
export const iter = { type: "integer", minimum: KDF.minIter, maximum: KDF.maxIter };
export const client = { type: "string", enum: ["web", "app"] };
export const label = { type: "string", maxLength: 80 };

// Verschlüsselter Tresor: AES-GCM, iv = 12 Byte; der Inhalt ist für den Server undurchsichtig
export const blob = {
  type: "object", additionalProperties: false, required: ["v", "iv", "ct"],
  properties: { v: { type: "integer", minimum: 1, maximum: 99 }, iv: { ...b64, minLength: 16, maxLength: 16 }, ct: { ...b64, minLength: 24 } }
};

export const body = (properties, required = Object.keys(properties)) =>
  ({ body: { type: "object", additionalProperties: false, required, properties } });
