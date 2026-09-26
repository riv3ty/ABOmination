# Setting up cloud sync

**English** · [Deutsch](SYNC.de.md)

Applies to **local profiles**. With a server account (see [DEPLOYMENT.md](DEPLOYMENT.md)) no additional sync is needed.

There are four options. The first one is the easiest and needs no credentials. The app's interface is German; UI labels are quoted with a translation in brackets.

| Option | Effort | Needs `http://localhost` |
|---|---|---|
| **File in a cloud folder** (OneDrive, Google Drive for desktop, Nextcloud client, Dropbox) | none | no |
| **Nextcloud (WebDAV)** | app password + CORS on the server | recommended |
| **Google Drive** | your own client ID in the Google Cloud Console | yes |
| **OneNote** | your own app registration in the Azure portal | yes |

> Tip: if you already have OneDrive, Google Drive for desktop or the Nextcloud client installed, choose
> „Datei im Cloud-Ordner“ (file in a cloud folder). The file then lives in a synced folder and the provider's
> client does the rest. Works in Chrome and Edge.

## Start the app via http://localhost (for Google Drive, OneNote, Nextcloud)

Double-click **`Abo-Manager-starten.cmd`** (Windows). It opens `http://localhost:8765/`. Keep the window open. The launcher is only reachable from this computer.

**Important:** browsers store data per address. At `http://localhost:8765` the app starts empty.
Move your data over once: in the previous address ⚙ → „Sicherung (JSON)“ (backup), then in the new one ⚙ → „Sicherung einlesen“ (import backup).

## Google Drive

1. <https://console.cloud.google.com> → create a new project.
2. "APIs & Services" → enable the **Google Drive API**.
3. "OAuth consent screen" → user type *External*, any app name; status *Testing* is enough. Add yourself under **Test users**.
4. "Credentials" → *Create OAuth client ID* → type **Web application** → under "Authorized JavaScript origins" enter: `http://localhost:8765`.
5. Copy the client ID → in the app: ⚙ → Cloud-Sync → Google Drive → paste → „Mit Google verbinden“ (connect with Google).

Data is stored in the hidden app folder (scope `drive.appdata`): the file doesn't show up in your normal Drive, and the app can't see anything else.
The access token is valid for about one hour; afterwards the app shows „Sync fortsetzen“ (resume sync) – one click is enough.

## OneNote

1. <https://portal.azure.com> → *Microsoft Entra ID* → *App registrations* → **New registration**.
2. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts".
3. Redirect URI: platform **Single-page application (SPA)**, value `http://localhost:8765/` (with trailing slash).
4. "API permissions" → *Microsoft Graph* → Delegated → **Notes.ReadWrite**.
5. Copy the "Application (client) ID" → in the app: ⚙ → Cloud-Sync → OneNote → paste → „Mit Microsoft verbinden“ (connect with Microsoft).

The app creates a page **"ABOmination Sync"** in your default notebook. At the top there is a readable list of your subscriptions; below it a data block that the app reads and writes. Please don't edit it.
The token is valid for about one hour; afterwards use „Sync fortsetzen“ (resume sync).

## Nextcloud

1. In Nextcloud: *Settings → Security → Devices & sessions* → create an **app password**.
2. In the app: ⚙ → Cloud-Sync → Nextcloud → address (`https://cloud.example.com`), username, app password, file path → „Verbinden“ (connect).
3. **CORS:** browsers may only access Nextcloud if the server allows the app's origin (`http://localhost:8765`).
   - Either with the Nextcloud app *WebAppPassword* (enter the origin there),
   - or with headers on your reverse proxy, for example nginx (adapt to your setup, don't set headers twice):

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
    # ... your existing proxy_pass / fastcgi setup
}
```

The app password is stored in the browser (encrypted with your profile). You can revoke it in Nextcloud at any time.
„Trennen“ (disconnect) in the app deletes it.

## Good to know

- **Profiles:** sync credentials (client ID, Nextcloud app password, chosen sync file) belong to the respective profile and are stored encrypted with its password. Each profile sets up its own sync. After locking or reloading, unlock the profile first; then sync continues.
- **Not encrypted:** what is sent to Google Drive, OneNote or Nextcloud is stored there in plain text (on OneNote even as a readable list). Only the local storage in the browser is encrypted. Server accounts, in contrast, are end-to-end encrypted.
- Only **one** provider is active at a time. With simultaneous changes on two devices the newer version wins (the whole data set, no merging – server accounts merge per entry).
- Changes made offline stay local and are transferred on the next sync (when the window gets focus and every minute).
- These provider integrations were written without test credentials. If something fails on the first connection, the error message is shown in the settings dialog and in the browser console (F12).
