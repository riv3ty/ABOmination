# ABOmination

Abo- und Ratenzahlungs-Manager im Browser. Der Build erzeugt eine einzige HTML-Datei (`dist/index.html`), die ohne Server funktioniert.

- Abos, Ratenzahlungen (Zins/Annuitaet), Mehrwaehrung, Erinnerungen/ICS, Kontoauszug-Import, Bankkonto-Auswertung, Optimierungstipps, Errungenschaften
- Profile mit Login, Daten AES-256-GCM-verschluesselt im Browser (PBKDF2)
- Optional Sync: Datei, Nextcloud, Google Drive, OneNote (siehe SYNC-EINRICHTEN.md)
- Geplant: Betrieb als Docker-Container mit Server-Konten (Ende-zu-Ende-verschluesselt)

Externe Aufrufe (optional, die App funktioniert auch offline):
- Schriften von Google Fonts (ohne Verbindung werden Systemschriften genutzt)
- Wechselkurse von api.frankfurter.dev (nur bei Fremdwaehrungen, sonst Naeherungswerte)
- Google-/Microsoft-Anmeldung und APIs nur, wenn der jeweilige Cloud-Sync eingerichtet ist

## Start

Voraussetzung: Node.js 22 oder neuer.

```
npm install
npm run build
```

Danach Doppelklick auf `Abo-Manager-starten.cmd` (oeffnet http://localhost:8765/) oder `dist/index.html` direkt oeffnen.

## Entwicklung

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver mit Live-Reload auf http://localhost:8765/ |
| `npm test` | Unit-Tests (Vitest) fuer die Logik in `web/src/lib/` |
| `npm run lint` | ESLint |
| `npm run build` | `dist/index.html` bauen |
| `npm run check` | Lint + Tests + Build |

Hinweis: Der Browser speichert Daten pro Adresse. Dev-Server, `npm run preview` und der Starter laufen alle unter `http://localhost:8765` und teilen sich daher dieselben Profile.

Aufbau:

```
web/index.html          Markup (Dialoge, Kacheln)
web/src/main.js         Einstieg
web/src/vault.js        Profile + verschluesselter Tresor (PBKDF2/AES-GCM)
web/src/auth.js         Anmelde-Oberflaeche, Konto-Funktionen
web/src/app.js          App-Oberflaeche, Dialoge, Cloud-Sync (startet erst nach dem Entsperren)
web/src/server/store.js Server-Konto: Anmeldung, Offline-Kopie, Abgleich
web/src/cryptoutil.js   Schluesselableitung, AES-GCM
web/src/lib/            reine Logik ohne DOM/Zustand (Datum, Kredit, Auswertung, Optimierung, ICS, Kontoauszug)
web/tests/              Tests zu lib/
server/src/             API-Server (app.js, routes/, db.js, cli.js)
server/tests/           API-Tests
```

## Server (in Arbeit)

Node-Server (Fastify + SQLite) mit Konten und Ende-zu-Ende-verschluesseltem Tresor. API und Schluesselprotokoll: [server/API.md](server/API.md).

```
npm run build                       # Web-App bauen (wird vom Server ausgeliefert)
npm run abo -- invite               # Einladungscode fuer die Registrierung
COOKIE_SECURE=false npm start       # http://127.0.0.1:8080 (Konfiguration: .env.example)
```

Laeuft die App ueber den Server, bietet die Anmeldung Server-Konten an (Anmelden, Registrieren, Uebernahme eines lokalen Profils). Die Daten werden im Browser verschluesselt, mit dem Server abgeglichen (Konflikte werden pro Eintrag zusammengefuehrt) und als verschluesselte Offline-Kopie auf dem Geraet gehalten. Lokale Profile funktionieren weiterhin, auch per Doppelklick ohne Server.

Entwicklung mit Server: `npm run server:dev` (API auf :8080) und `npm run dev` (Vite auf :8765 leitet `/api` weiter).

Docker-Setup folgt in Phase 3.

## Datenschutz
Der Repo-Inhalt enthaelt nur Code. Alle Nutzerdaten liegen ausschliesslich im Browser (localStorage/IndexedDB) und sind nicht Teil dieses Repos. Exporte (`abos-*.json`), Sync-Dateien und `.ics` sind per `.gitignore` ausgeschlossen.
