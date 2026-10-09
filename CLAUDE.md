# ABOmination – Hinweise fuer Claude

Abo-/Ratenzahlungs-Manager, reiner Web-Client (Vanilla JS, keine Frameworks). UI-Texte und Code-Kommentare auf Deutsch.

## Befehle
- `npm run check` = Lint + Tests + Build (vor jedem Commit)
- `npm run e2e` = Build + echter Server + zwei Chrome-Instanzen (Sync, Konflikt, offline, Passwortwechsel); bei Aenderungen an Login/Sync/Server laufen lassen. Docker-Test: `docker compose -p abotest up -d --build` (HOST_PORT=8797), Einladung per `docker compose -p abotest exec app abo invite`, dann `E2E_URL=http://localhost:8797/ E2E_INVITE=<code> node e2e/run.js`; danach `docker compose -p abotest down -v`
- `npm test`, `npm run lint`, `npm run build` (-> `dist/index.html`, eine Datei via vite-plugin-singlefile), `npm run dev` (Port 8765)

## Architektur
- `web/src/vault.js`: Profile in localStorage (`abo-users`, `abo-user-<id>`), Daten AES-256-GCM, Schluessel via PBKDF2 (600k). `Vault.get/set` mit verzoegertem, asynchronem `flush()`.
- `web/src/auth.js`: Login-UI; nach dem Entsperren `startApp()` aus `app.js`.
- `web/src/app.js`: gesamte UI. Beim Import nur Definitionen + Event-Handler; Zustand (`subs`, `settings`, `ach`, `cfg`) wird erst in `startApp()`/`loadState()` aus dem Tresor geladen. `render()` baut alles neu.
- `web/src/lib/`: reine Funktionen ohne DOM und ohne globalen Zustand. Abhaengigkeiten (Waehrungsumrechnung, Stichtag, Einstellungen) werden als Parameter uebergeben – so bleiben sie testbar. Neue Logik gehoert hierher, mit Test in `web/tests/`.
- Speicher-Schluessel in `PRIVATE_KEYS` (app.js) landen im Tresor, alles andere unverschluesselt im localStorage.
- Gehaltsrechner: `lib/salary.js` (Sozialabgaben, Kirchensteuer, Werte in `SV`) + `lib/pap/lohnsteuer2026.js` – AUTOMATISCH erzeugt aus dem amtlichen BMF-PAP (`scripts/pap/*.xml`) per `node scripts/build-pap.js`, nie von Hand aendern; rechnet mit `lib/pap/bigdecimal.js` (BigInt). Gehalt liegt im Tresor unter `abo-manager-income` (Entfernen = Merker `{removed, changedAt}`), Zusammenfuehren nach `changedAt`, Sicherung mit `sanitizeIncome()`. Jaehrliche Aktualisierung: docs/DEVELOPMENT.md.
- `Vault.mode`: `local` (Profil im Browser) oder `server` (Konto; `web/src/server/store.js` = ServerStore: Login inkl. Offline-Login, verschluesselte Offline-Kopie `abo-srv-<name>`, `save()`/`pull()` mit 409-Zusammenfuehrung). Neue Server-Staende kommen per Event `abo:remote` (App ruft `loadState()` + `render()`), Status per `abo:serverstatus`.
- Zusammenfuehren: `lib/merge.js`. Deshalb bei jeder Aenderung an einem Abo `updatedAt` setzen, beim Loeschen einen Grabstein in `meta.deleted`; `saveSettings`/`saveCfg` setzen `changedAt`.
- PWA: `web/src/pwa.js` (nur http/https, SW nur im Build), `web/public/sw.js` (Seite network-first, Icons cache-first, `/api` nie). Bei neuen Dateien in `SHELL` die Cache-Version `CACHE` in sw.js erhoehen. Icons: `node scripts/make-icons.js`.
- Markup: `.srv-only` / `.local-only` blenden je nach Modus ein/aus (Klasse `server-mode` am body).

## Server (`server/`)
- Fastify 5 + `node:sqlite` (keine nativen Module), Node >= 22.13. `buildApp({config, db})` in `server/src/app.js` (Tests nutzen `app.inject()` mit `:memory:`).
- E2E-Protokoll und Endpunkte: `server/API.md` – bei API-Änderungen mitpflegen. Der Server sieht nur `authKey` (gehasht mit scrypt) und den verschlüsselten Tresor-Blob.
- Schema-Änderungen nur als neue Migration in `MIGRATIONS` (db.js), nie bestehende ändern.
- Auth-Routen: Session per Cookie (Web, CSRF-Header `X-Requested-With: abomination`) oder Bearer (App). Verwaltung per CLI `server/src/cli.js`.
- Docker: Image enthaelt nur `server/src`, `server/bin`, `dist` + Laufzeit-Abhaengigkeiten; laeuft als `node`, read-only, Daten in `/data`. Neue Laufzeitdateien im Dockerfile ergaenzen.
- Schriften liegen in `web/src/fonts/` und werden eingebettet (CSP `font-src data:`); keine externen Ressourcen (CDN, Google Fonts) einbinden.
- CSP wird aus den Inline-Skripten von `dist/index.html` berechnet: keine Inline-Event-Handler (`onclick=` usw.) im Markup verwenden.

## Oeffentlicher Auftritt
- Alle Doku zweisprachig: `X.md` (EN) + `X.de.md` (DE) inkl. Sprachlink oben – immer beide pflegen (README, DEPLOYMENT, SYNC, server/API, docs/DEVELOPMENT, SECURITY, CONTRIBUTING, ROADMAP). Code-Kommentare bleiben deutsch. Lizenz: eigene "Personal Use License" (privat/nicht-kommerziell frei, inkl. Selbsthosting; kommerziell und Weiterverbreitung nur mit Erlaubnis) – nicht "Open Source" nennen.
- Roadmap nur in `docs/roadmap.json` pflegen, dann `npm run docs` (erzeugt ROADMAP.md/.de.md und SVG-Grafiken in docs/roadmap/; Website liest JSON + SVG). Unterstützen-Links (Ko-fi, Liberapay, GitHub Sponsors) in `site/site.config.json` → `npm run docs` schreibt .github/FUNDING.yml und README-Abschnitt (Markierung support:start/end).
- Website: `site/` (Vorlagen, EN/DE per `<span lang>` bzw. `<!--en-->…<!--/en-->`), Build `npm run site` → `_site/` (Englisch unter /, Deutsch unter /de/) inkl. Demo unter `/app/` (`?demo` laedt Beispieldaten aus `scripts/demo-data.js`). Newsletter (Brevo) und Impressum/Datenschutz erscheinen nur, wenn `site/site.config.json` ausgefuellt ist – keine Personendaten erfinden.
- Screenshots: `npm run screenshots` (nur Beispieldaten). GitHub Actions: ci.yml (check + e2e), docker.yml (GHCR, amd64/arm64), pages.yml, release.yml (bei Tag `vX.Y.Z`: GitHub-Release mit Notizen aus dem Commit-Text + `abomination-X.Y.Z.html`; Tag muss zur Version in package.json passen).
- Neue Version: Version in package.json (`npm version X.Y.Z --no-git-tag-version`) und Beispiele `ABO_VERSION` (.env.example, compose.yaml, DEPLOYMENT*.md) anheben, Commit-Text "Version X.Y.Z: …" mit Aufzaehlung (wird zu den Release-Notizen), `git tag vX.Y.Z`, Branch und Tag pushen.

## Regeln
- Alles, was in HTML landet, mit `esc()` escapen. Importierte/synchronisierte Daten laufen durch `normalizeSub()`.
- Das Inline-Skript im `<head>` von `web/index.html` (Microsoft-OAuth-Ruecksprung) muss vor dem Modul laufen – nicht entfernen.
- Port 8765 ist bei Google/Microsoft als Ursprung registriert.

## Geplant (Server-Deployment)
Phase 0 (Module/Tests), 1 (Backend), 2 (Web-Client im Server-Modus), 3 (Docker: Dockerfile, compose.yaml, DEPLOYMENT.md) 4 (Haertung: eingebettete Schriften, /api/rates, scrypt-Begrenzung, Header) und 5 (PWA: Manifest, Service Worker, Icons, installierbar) fertig. Naechstes Ziel: native Android-App (nutzt dieselbe API und dasselbe Schluesselprotokoll aus server/API.md). Docker-Container auf Ubuntu hinter dem vorhandenen Reverse Proxy des Users; Server speichert nur verschluesselte Tresor-Blobs (E2E, getrennter Auth-/Enc-Key), Registrierung nur per Einladung, spaeter Android-App. Lokaler Modus mit den bisherigen Sync-Anbietern bleibt erhalten.
