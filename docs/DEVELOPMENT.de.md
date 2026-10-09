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
web/src/lib/              Reine Logik ohne DOM/Zustand (Datum, Kredit, Auswertung, Optimierung, ICS, Kontoauszug, Zusammenführen, Sicherung, Gehalt)
web/src/lib/pap/          Lohnsteuer: erzeugt aus dem amtlichen Programmablaufplan des BMF (siehe unten) + exaktes BigDecimal
web/public/               sw.js, manifest.webmanifest, icons/ (werden unverändert nach dist/ kopiert)
web/tests/                Unit-Tests zu lib/
server/src/               API-Server (app.js, routes/, db.js, cli.js)
server/tests/             API-Tests
e2e/run.js                Ende-zu-Ende-Test (Puppeteer)
site/                     Website-Vorlagen (zweisprachig; gebaut nach / = Englisch und /de/ = Deutsch)
scripts/                  Icons, Screenshots, Beispieldaten, Roadmap, Website-Build, Lohnsteuer-Generator (build-pap.js, pap/*.xml)
docs/                     Screenshots, Roadmap-Quelle + erzeugte SVGs, diese Datei
Dockerfile, compose.yaml  Container-Betrieb (siehe DEPLOYMENT.de.md)
```

## Lohnsteuer (jährliche Aktualisierung)

Der Gehaltsrechner (`web/src/lib/salary.js`) berechnet Lohnsteuer und Solidaritätszuschlag mit dem amtlichen Programmablaufplan (PAP) des Bundesfinanzministeriums. Das BMF veröffentlicht ihn jedes Jahr als XML-Pseudocode mit Java-`BigDecimal`-Ausdrücken; `scripts/build-pap.js` übersetzt ihn nach `web/src/lib/pap/lohnsteuer<Jahr>.js` (diese Datei nicht von Hand ändern).

Für ein neues Steuerjahr:

1. XML von [bmf-steuerrechner.de](https://www.bmf-steuerrechner.de) (Programmablaufpläne → XML) nach `scripts/pap/Lohnsteuer<Jahr>.xml` laden.
2. `node scripts/build-pap.js scripts/pap/Lohnsteuer<Jahr>.xml`
3. In `salary.js` das neue Modul einbinden, `SALARY_YEAR` und die Sozialversicherungswerte in `SV` anpassen (Beitragsbemessungsgrenzen, Sätze, Mini-/Midijob-Grenzen).
4. Erwartungswerte in `web/tests/salary.test.js` aus einer unabhängigen Quelle (z. B. BMF-Rechner) aktualisieren und `npm test` ausführen.

## Releases

1. Version anheben: `npm version X.Y.Z --no-git-tag-version` sowie die `ABO_VERSION`-Beispiele (.env.example, compose.yaml, DEPLOYMENT*.md).
2. Committen mit einer Nachricht wie `Version X.Y.Z: …` – der Text darunter wird zu den Release-Notizen.
3. `git tag vX.Y.Z && git push origin main vX.Y.Z`

Der Tag startet `docker.yml` (Images `X.Y.Z`, `X.Y`, `X`) und `release.yml` (GitHub-Release mit Notizen, automatisch erzeugter Änderungsliste und der App als Einzeldatei `abomination-X.Y.Z.html`). Der Tag muss zur Version in `package.json` passen. Für einen bestehenden Tag ohne Release den Workflow *Release* von Hand starten und den Tag eintragen.

## Server ohne Docker

```bash
npm run build                      # der Server liefert dist/ aus
npm run abo -- invite              # Einladungscode für die Registrierung
COOKIE_SECURE=false npm start      # http://127.0.0.1:8080 (Einstellungen: .env.example)
```

API und Schlüsselprotokoll: [server/API.de.md](../server/API.de.md).

## Datenschutz dieses Repos

Das Repo enthält nur Code. Lokale Profile halten alle Daten im Browser (localStorage/IndexedDB); Server-Konten speichern zusätzlich einen verschlüsselten Tresor, den der Server nicht lesen kann. Exporte (`abos-*.json`), Sync-Dateien und `.ics`-Dateien sind per `.gitignore` ausgeschlossen.
