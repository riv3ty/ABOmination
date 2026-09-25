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

## Regeln
- Alles, was in HTML landet, mit `esc()` escapen. Importierte/synchronisierte Daten laufen durch `normalizeSub()`.
- Das Inline-Skript im `<head>` von `web/index.html` (Microsoft-OAuth-Ruecksprung) muss vor dem Modul laufen – nicht entfernen.
- Port 8765 ist bei Google/Microsoft als Ursprung registriert.

## Geplant (Server-Deployment)
Docker-Container auf Ubuntu hinter dem vorhandenen Reverse Proxy des Users; Server speichert nur verschluesselte Tresor-Blobs (E2E, getrennter Auth-/Enc-Key), Registrierung nur per Einladung, spaeter Android-App. Lokaler Modus mit den bisherigen Sync-Anbietern bleibt erhalten.
