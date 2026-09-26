# Entwicklung

[English](DEVELOPMENT.md) · **Deutsch**

Voraussetzungen: **Node.js 22.13+** (empfohlen 24) und für den Ende-zu-Ende-Test sowie die Screenshots Chrome/Chromium (`CHROME_PATH` setzen, falls es nicht automatisch gefunden wird).

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Web-App mit Live-Reload auf http://localhost:8765 (leitet `/api` an :8080 weiter) |
| `npm run server:dev` | API-Server auf :8080 mit automatischem Neustart (liest `.env`) |
| `npm test` | Unit- und API-Tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | `dist/index.html` (eine Datei) + PWA-Dateien bauen |
| `npm run check` | Lint + Tests + Build – vor jedem Commit |
| `npm run e2e` | Echter Server + zwei Chrome-Instanzen: Sync, Konflikte, offline, Passwortwechsel, Sicherungen, PWA |
| `npm run site` | Website inkl. Live-Demo nach `_site/` bauen |
| `npm run screenshots` | `docs/screenshots/` mit Beispieldaten neu erzeugen |
| `npm run docs` | Roadmap (Markdown + SVG-Grafik) und Unterstützen-Links aus `docs/roadmap.json` / `site/site.config.json` erzeugen |
| `npm run abo -- invite` | Verwaltung des Servers (Einladungen, Konten, Sicherungen) |

Ende-zu-Ende-Test gegen einen laufenden Server oder Container: `E2E_URL=http://localhost:8080/ E2E_INVITE=<code> node e2e/run.js` (mit frischem Volume).

Hinweis: Browser speichern Daten pro Adresse. Dev-Server, `npm run preview` und der Windows-Starter laufen alle unter `http://localhost:8765` und teilen sich daher dieselben lokalen Profile.

## Aufbau

```
web/index.html            Markup (Dialoge, Kacheln)
web/src/main.js           Einstieg
web/src/vault.js          Profile + verschlüsselter Tresor (lokal oder Server-Modus)
web/src/auth.js           Anmelde-Oberfläche, Konto-Funktionen, Demo-Modus (?demo)
web/src/app.js            App-Oberfläche, Dialoge, Cloud-Sync (startet erst nach dem Entsperren)
web/src/server/store.js   Server-Konto: Anmeldung, Offline-Kopie, Abgleich mit Konflikt-Zusammenführung
web/src/cryptoutil.js     Schlüsselableitung, AES-GCM
web/src/pwa.js            Manifest/Service Worker einbinden, „App installieren“
web/src/lib/              Reine Logik ohne DOM/Zustand (Datum, Kredit, Auswertung, Optimierung, ICS, Kontoauszug, Zusammenführen, Sicherung)
web/public/               sw.js, manifest.webmanifest, icons/ (werden unverändert nach dist/ kopiert)
web/tests/                Unit-Tests zu lib/
server/src/               API-Server (app.js, routes/, db.js, cli.js)
server/tests/             API-Tests
e2e/run.js                Ende-zu-Ende-Test (Puppeteer)
site/                     Website-Vorlagen (zweisprachig; gebaut nach / = Englisch und /de/ = Deutsch)
scripts/                  Icons, Screenshots, Beispieldaten, Roadmap, Website-Build
docs/                     Screenshots, Roadmap-Quelle + erzeugte SVGs, diese Datei
Dockerfile, compose.yaml  Container-Betrieb (siehe DEPLOYMENT.de.md)
```

## Server ohne Docker

```bash
npm run build                      # der Server liefert dist/ aus
npm run abo -- invite              # Einladungscode für die Registrierung
COOKIE_SECURE=false npm start      # http://127.0.0.1:8080 (Einstellungen: .env.example)
```

API und Schlüsselprotokoll: [server/API.de.md](../server/API.de.md).

## Datenschutz dieses Repos

Das Repo enthält nur Code. Lokale Profile halten alle Daten im Browser (localStorage/IndexedDB); Server-Konten speichern zusätzlich einen verschlüsselten Tresor, den der Server nicht lesen kann. Exporte (`abos-*.json`), Sync-Dateien und `.ics`-Dateien sind per `.gitignore` ausgeschlossen.
