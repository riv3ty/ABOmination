# ABOmination

Lokaler Abo- und Ratenzahlungs-Manager als einzelne HTML-Datei (kein Server, kein Build, keine Bibliotheken).

Externe Aufrufe (optional, die App funktioniert auch offline):
- Schriften von Google Fonts (ohne Verbindung werden Systemschriften genutzt)
- Wechselkurse von api.frankfurter.dev (nur bei Fremdwaehrungen, sonst Naeherungswerte)
- Google-/Microsoft-Anmeldung und APIs nur, wenn der jeweilige Cloud-Sync eingerichtet ist

- Abos, Ratenzahlungen (Zins/Annuitaet), Mehrwaehrung, Erinnerungen/ICS, Kontoauszug-Import, Bankkonto-Auswertung, Optimierungstipps, Errungenschaften
- Profile mit Login, Daten AES-256-GCM-verschluesselt im Browser (PBKDF2)
- Optional Sync: Datei, Nextcloud, Google Drive, OneNote (siehe SYNC-EINRICHTEN.md)

## Start
Doppelklick auf `Abo-Manager-starten.cmd` (oeffnet http://localhost:8765/) oder `abo-manager.html` direkt oeffnen.

## Datenschutz
Der Repo-Inhalt enthaelt nur Code. Alle Nutzerdaten liegen ausschliesslich im Browser (localStorage/IndexedDB) und sind nicht Teil dieses Repos. Exporte (`abos-*.json`), Sync-Dateien und `.ics` sind per `.gitignore` ausgeschlossen.
