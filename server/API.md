# ABOmination Server-API

Der Server kennt keine Abo-Daten. Er speichert pro Konto einen **verschlüsselten Tresor** und prüft beim Anmelden einen aus dem Passwort abgeleiteten Schlüssel. Passwort und Entschlüsselungsschlüssel verlassen das Gerät nie.

## Schlüsselableitung (Client)

```
masterKey = PBKDF2-SHA256(passwort (UTF-8), salt, iter)          → 32 Byte
authKey   = HKDF-SHA256(masterKey, salt = leer, info = "abomination/auth/v1") → 32 Byte, Base64 an den Server
encKey    = HKDF-SHA256(masterKey, salt = leer, info = "abomination/enc/v1")  → AES-256-GCM-Schlüssel, bleibt lokal
```

- `salt`: 16 zufällige Byte, bei Registrierung und Passwortwechsel neu erzeugt (Base64).
- `iter`: mindestens 100.000, Standard 600.000 (`GET /api/config` → `kdf`).
- Tresor: `{ v: 1, iv: Base64(12 Byte), ct: Base64(AES-GCM(encKey, iv, JSON der Daten)) }`.

Der Server hasht den `authKey` zusätzlich mit scrypt. Ein Datenbank-Leck liefert also weder Daten noch Anmeldeschlüssel.
Es gibt **keinen Passwort-Reset**: ohne Passwort ist der Tresor nicht zu entschlüsseln.

## Authentifizierung

- **Web:** Cookie `abo_session` (httpOnly, SameSite=Strict, Pfad `/api`). Ändernde Anfragen mit Cookie brauchen zusätzlich den Header `X-Requested-With: abomination` (CSRF-Schutz).
- **App:** bei Login/Registrierung `client: "app"` senden → `token` im Body; danach `Authorization: Bearer <token>`.
- Sitzungen verlängern sich bei Nutzung (`SESSION_DAYS`).
- Fehler: `{ error: "<code>", message: "<deutscher Text>" }`.

## Endpunkte

| Methode | Pfad | Body | Antwort |
|---|---|---|---|
| GET | `/api/health` | – | `{ ok, version }` |
| GET | `/api/config` | – | `{ version, registration, maxVaultBytes, kdf }` |
| POST | `/api/auth/prelogin` | `{ username }` | `{ kdf, salt, iter }` (für unbekannte Namen ein stabiles Scheinsalz) |
| POST | `/api/auth/register` | `{ username, invite?, salt, iter, authKey, vault, client?, label? }` | 201 `{ user, vault: { version }, sessionId, token? }` |
| POST | `/api/auth/login` | `{ username, authKey, client?, label? }` | `{ user, sessionId, token? }` |
| POST | `/api/auth/logout` | – | 204 |
| GET | `/api/auth/me` | – | `{ user, session }` |
| GET | `/api/auth/sessions` | – | `{ sessions: [{ id, kind, label, createdAt, lastSeen, current }] }` |
| DELETE | `/api/auth/sessions/:id` | – | 204 (Gerät abmelden) |
| POST | `/api/auth/password` | `{ authKey, newSalt, newIter, newAuthKey, vault, baseVersion }` | `{ vault: { version } }`; andere Sitzungen werden beendet |
| DELETE | `/api/account` | `{ authKey }` | 204 (Konto + Tresor gelöscht) |
| GET | `/api/vault` | – | `{ version, updatedAt, blob }` |
| PUT | `/api/vault` | `{ blob, baseVersion }` | `{ version, updatedAt }` oder **409** `{ error: "conflict", version, updatedAt, blob }` |

### Konflikte
`PUT /api/vault` schreibt nur, wenn `baseVersion` der aktuellen Version entspricht. Sonst kommt 409 mit dem aktuellen Stand; der Client führt zusammen und schreibt erneut mit der neuen Version.

### Schutz vor Passwort-Raten
Pro IP und Name ab 5 Fehlversuchen exponentiell wachsende Sperre (bis 15 Minuten) → 429 mit `Retry-After`. Zusätzlich 30 Auth-Anfragen pro Minute und IP, allgemein 300 Anfragen pro Minute.

## Verwaltung

```
abo invite [--uses N] [--days N] [--note TEXT]   Einladungscode (Standard: 1× nutzbar, 7 Tage)
abo invites | users
abo logout-all <name>
abo delete-user <name> --yes
```
Lokal: `npm run abo -- invite`.
