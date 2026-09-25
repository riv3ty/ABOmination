# ABOmination – Hinweise fuer Claude

Abo-/Ratenzahlungs-Manager, reiner Web-Client (Vanilla JS, keine Frameworks). UI-Texte und Code-Kommentare auf Deutsch.

## Befehle
- `npm run check` = Lint + Tests + Build (vor jedem Commit)
- `npm test`, `npm run lint`, `npm run build` (-> `dist/index.html`, eine Datei via vite-plugin-singlefile), `npm run dev` (Port 8765)

## Architektur
- `web/src/vault.js`: Profile in localStorage (`abo-users`, `abo-user-<id>`), Daten AES-256-GCM, Schluessel via PBKDF2 (600k). `Vault.get/set` mit verzoegertem, asynchronem `flush()`.
- `web/src/auth.js`: Login-UI; nach dem Entsperren `startApp()` aus `app.js`.
- `web/src/app.js`: gesamte UI. Beim Import nur Definitionen + Event-Handler; Zustand (`subs`, `settings`, `ach`, `cfg`) wird erst in `startApp()`/`loadState()` aus dem Tresor geladen. `render()` baut alles neu.
- `web/src/lib/`: reine Funktionen ohne DOM und ohne globalen Zustand. Abhaengigkeiten (Waehrungsumrechnung, Stichtag, Einstellungen) werden als Parameter uebergeben – so bleiben sie testbar. Neue Logik gehoert hierher, mit Test in `web/tests/`.
- Speicher-Schluessel in `PRIVATE_KEYS` (app.js) landen im Tresor, alles andere unverschluesselt im localStorage.

## Server (`server/`)
- Fastify 5 + `node:sqlite` (keine nativen Module), Node >= 22.13. `buildApp({config, db})` in `server/src/app.js` (Tests nutzen `app.inject()` mit `:memory:`).
- E2E-Protokoll und Endpunkte: `server/API.md` – bei API-Änderungen mitpflegen. Der Server sieht nur `authKey` (gehasht mit scrypt) und den verschlüsselten Tresor-Blob.
- Schema-Änderungen nur als neue Migration in `MIGRATIONS` (db.js), nie bestehende ändern.
- Auth-Routen: Session per Cookie (Web, CSRF-Header `X-Requested-With: abomination`) oder Bearer (App). Verwaltung per CLI `server/src/cli.js`.
- CSP wird aus den Inline-Skripten von `dist/index.html` berechnet: keine Inline-Event-Handler (`onclick=` usw.) im Markup verwenden.

## Regeln
- Alles, was in HTML landet, mit `esc()` escapen. Importierte/synchronisierte Daten laufen durch `normalizeSub()`.
- Das Inline-Skript im `<head>` von `web/index.html` (Microsoft-OAuth-Ruecksprung) muss vor dem Modul laufen – nicht entfernen.
- Port 8765 ist bei Google/Microsoft als Ursprung registriert.

## Geplant (Server-Deployment)
Phase 0 (Module/Tests) und 1 (Backend) fertig; offen: 2 Web-Client im Server-Modus, 3 Docker, 4 Haertung, 5 PWA/Android. Docker-Container auf Ubuntu hinter dem vorhandenen Reverse Proxy des Users; Server speichert nur verschluesselte Tresor-Blobs (E2E, getrennter Auth-/Enc-Key), Registrierung nur per Einladung, spaeter Android-App. Lokaler Modus mit den bisherigen Sync-Anbietern bleibt erhalten.
