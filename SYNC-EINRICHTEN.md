# Cloud-Sync einrichten

Es gibt vier Wege. Der erste ist der einfachste und braucht keine Zugangsdaten.

| Weg | Aufwand | Braucht `http://localhost` |
|---|---|---|
| **Datei im Cloud-Ordner** (OneDrive, Google Drive für Desktop, Nextcloud-Client, Dropbox) | keiner | nein |
| **Nextcloud (WebDAV)** | App-Passwort + CORS-Freigabe am Server | empfohlen |
| **Google Drive** | eigene Client-ID in der Google Cloud Console | ja |
| **OneNote** | eigene App-Registrierung im Azure-Portal | ja |

> Tipp: Wenn du OneDrive, Google Drive für Desktop oder den Nextcloud-Client ohnehin installiert hast, wähle
> „Datei im Cloud-Ordner“. Die Datei liegt dann in einem synchronisierten Ordner, und die Anbieter-Programme
> erledigen den Rest. Funktioniert in Chrome und Edge.

## App über http://localhost starten (für Google Drive, OneNote, Nextcloud)

Doppelklick auf **`Abo-Manager-starten.cmd`**. Das öffnet `http://localhost:8765/`. Das Fenster muss offen bleiben. Der Starter ist nur auf diesem Rechner erreichbar.

**Wichtig:** Der Browser speichert Daten pro Adresse. Unter `http://localhost:8765` ist die App zunächst leer.
Übernimm deine Abos einmalig: in der alten Ansicht ⚙ → **Sicherung (JSON)**, in der neuen ⚙ → **Sicherung einlesen**.

## Google Drive

1. <https://console.cloud.google.com> → neues Projekt anlegen.
2. „APIs & Dienste“ → **Google Drive API** aktivieren.
3. „OAuth-Zustimmungsbildschirm“ → Nutzertyp *Extern*, App-Name beliebig; Status *Testing* genügt. Füge dich unter **Testnutzer** hinzu.
4. „Anmeldedaten“ → *OAuth-Client-ID erstellen* → Typ **Webanwendung** → bei „Autorisierte JavaScript-Quellen“ eintragen: `http://localhost:8765`.
5. Client-ID kopieren → in der App: ⚙ → Cloud-Sync → Google Drive → einfügen → **Mit Google verbinden**.

Gespeichert wird im versteckten App-Ordner (Scope `drive.appdata`): Die Datei taucht in deinem normalen Drive nicht auf, und die App sieht nichts anderes.
Das Zugriffstoken gilt etwa 1 Stunde; danach zeigt die App „Sync fortsetzen“ (ein Klick genügt).

## OneNote

1. <https://portal.azure.com> → *Microsoft Entra ID* → *App-Registrierungen* → **Neue Registrierung**.
2. Unterstützte Kontotypen: „Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten“.
3. Redirect-URI: Plattform **Single-Page-Anwendung (SPA)**, Wert `http://localhost:8765/` (mit abschließendem Schrägstrich).
4. „API-Berechtigungen“ → *Microsoft Graph* → Delegiert → **Notes.ReadWrite**.
5. „Anwendungs-(Client-)ID“ kopieren → in der App: ⚙ → Cloud-Sync → OneNote → einfügen → **Mit Microsoft verbinden**.

Die App legt in deinem Standard-Notizbuch eine Seite **„ABOmination Sync“** an. Oben steht eine lesbare Liste deiner Abos; darunter ein Datenblock, den die App liest und schreibt. Bitte nicht bearbeiten.
Das Token gilt etwa 1 Stunde; danach „Sync fortsetzen“.

## Nextcloud

1. In Nextcloud: *Einstellungen → Sicherheit → Geräte & Sitzungen* → **App-Passwort** erzeugen.
2. In der App: ⚙ → Cloud-Sync → Nextcloud → Adresse (`https://cloud.example.com`), Benutzername, App-Passwort, Dateipfad → **Verbinden**.
3. **CORS:** Browser dürfen nur auf Nextcloud zugreifen, wenn der Server die Herkunft der App erlaubt (`http://localhost:8765`).
   - Entweder mit der Nextcloud-App *WebAppPassword* (Herkunft dort eintragen),
   - oder per Header am Reverse Proxy, zum Beispiel nginx (an deinen Aufbau anpassen, keine doppelten Header setzen):

```nginx
location /remote.php/dav/ {
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin "http://localhost:8765" always;
        add_header Access-Control-Allow-Methods "GET, PUT, MKCOL, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, If-Match, If-None-Match" always;
        add_header Access-Control-Max-Age 86400 always;
        return 204;
    }
    add_header Access-Control-Allow-Origin "http://localhost:8765" always;
    add_header Access-Control-Expose-Headers "ETag" always;
    # ... dein bisheriges proxy_pass / fastcgi-Setup
}
```

Das App-Passwort wird im Browser (localStorage) gespeichert. Du kannst es in Nextcloud jederzeit widerrufen.
„Trennen“ in der App löscht es wieder.

## Gut zu wissen

- **Profile:** Der Sync-Zugang (Client-ID, Nextcloud-App-Passwort, gewählte Sync-Datei) gehört zum jeweiligen Profil und wird mit dessen Passwort verschlüsselt gespeichert. Jedes Profil richtet seinen Sync selbst ein. Nach dem Sperren oder Neuladen musst du das Profil erst entsperren, dann läuft der Sync weiter.
- **Nicht verschlüsselt:** Was an Google Drive, OneNote oder Nextcloud übertragen wird, liegt dort im Klartext (bei OneNote sogar als lesbare Liste). Nur die lokale Ablage im Browser ist verschlüsselt.

- Es ist immer **ein** Anbieter aktiv. Bei gleichzeitigen Änderungen auf zwei Geräten gewinnt die neuere Version (der ganze Datenbestand, kein Zusammenführen).
- Änderungen ohne Verbindung bleiben lokal und werden beim nächsten Abgleich übertragen (beim Fokussieren des Fensters und minütlich).
- Diese Anbieter-Anbindungen wurden ohne Zugangsdaten geschrieben. Wenn beim ersten Verbinden etwas hakt, steht die Fehlermeldung im Einstellungsdialog und in der Browser-Konsole (F12).
