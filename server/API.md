# ABOmination server API

**English** · [Deutsch](API.de.md)

The server knows no subscription data. It stores one **encrypted vault** per account and checks a key derived from the password at login. The password and the decryption key never leave the device.

## Key derivation (client)

```
masterKey = PBKDF2-SHA256(password (UTF-8), salt, iter)            → 32 bytes
authKey   = HKDF-SHA256(masterKey, salt = empty, info = "abomination/auth/v1") → 32 bytes, base64 to the server
encKey    = HKDF-SHA256(masterKey, salt = empty, info = "abomination/enc/v1")  → AES-256-GCM key, stays local
```

- `salt`: 16 random bytes, regenerated on registration and password change (base64).
- `iter`: at least 100,000, default 600,000 (`GET /api/config` → `kdf`).
- Vault: `{ v: 1, iv: base64(12 bytes), ct: base64(AES-GCM(encKey, iv, JSON of the data)) }`.

The server additionally hashes the `authKey` with scrypt, so a database leak yields neither data nor login keys.
There is **no password reset**: without the password the vault cannot be decrypted.

## Authentication

- **Web:** cookie `abo_session` (httpOnly, SameSite=Strict, path `/api`). Mutating requests with a cookie also need the header `X-Requested-With: abomination` (CSRF protection).
- **Apps:** send `client: "app"` on login/registration → `token` in the body; afterwards `Authorization: Bearer <token>`.
- Sessions are extended on use (`SESSION_DAYS`).
- Errors: `{ error: "<code>", message: "<German text>" }` – clients should branch on `error`, not on `message`.

## Endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/health` | – | `{ ok, version }` |
| GET | `/api/config` | – | `{ version, registration, maxVaultBytes, kdf }` |
| GET | `/api/rates` | – | `{ date, rates, fetchedAt, source }` – ECB rates (1 EUR = x), fetched from frankfurter.dev at most every 12 h; 503 if unavailable |
| POST | `/api/auth/prelogin` | `{ username }` | `{ kdf, salt, iter }` (a stable fake salt for unknown names) |
| POST | `/api/auth/register` | `{ username, invite?, salt, iter, authKey, vault, client?, label? }` | 201 `{ user, vault: { version }, sessionId, token? }` |
| POST | `/api/auth/login` | `{ username, authKey, client?, label? }` | `{ user, sessionId, token? }` |
| POST | `/api/auth/logout` | – | 204 |
| GET | `/api/auth/me` | – | `{ user, session }` |
| GET | `/api/auth/sessions` | – | `{ sessions: [{ id, kind, label, createdAt, lastSeen, current }] }` |
| DELETE | `/api/auth/sessions/:id` | – | 204 (sign out a device) |
| POST | `/api/auth/password` | `{ authKey, newSalt, newIter, newAuthKey, vault, baseVersion }` | `{ vault: { version } }`; other sessions are ended |
| DELETE | `/api/account` | `{ authKey }` | 204 (account and vault deleted) |
| GET | `/api/vault` | – | `{ version, updatedAt, blob }` |
| PUT | `/api/vault` | `{ blob, baseVersion }` | `{ version, updatedAt }` or **409** `{ error: "conflict", version, updatedAt, blob }` |

### Conflicts
`PUT /api/vault` only writes if `baseVersion` matches the current version. Otherwise it returns 409 with the current state; the client merges and writes again with the new version.

### Brute-force protection
Per IP and name, an exponentially growing lockout after 5 failed attempts (up to 15 minutes) → 429 with `Retry-After`. Additionally 30 auth requests per minute and IP, 300 requests per minute overall. At most 4 scrypt checks run in parallel (the rest waits; 503 when overloaded).

## Administration

```
abo invite [--uses N] [--days N] [--note TEXT]   invite code (default: single use, 7 days)
abo invites | users
abo logout-all <name>
abo delete-user <name> --yes
abo backup [file] [--keep N]                   database backup (VACUUM INTO)
```
Locally: `npm run abo -- invite`.
