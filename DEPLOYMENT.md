# Running ABOmination on your own server (Docker)

**English** · [Deutsch](DEPLOYMENT.de.md)

The container includes the API server and the built web app. It only listens locally on the server (`127.0.0.1:8080`); your existing reverse proxy makes it available via HTTPS on a (sub)domain, e.g. `https://abo.example.com`.

> **HTTPS is required.** Encryption in the browser (WebCrypto) only works on `https://` (or `localhost`), and the login cookie is only sent over HTTPS.

The app's interface is German; UI labels are quoted below with a translation in brackets.

## 1. Requirements

- Linux (e.g. Ubuntu) with **Docker Engine** and the **Compose plugin** (`docker compose version` ≥ 2.20).
  Installation: <https://docs.docker.com/engine/install/ubuntu/>
- A domain or subdomain pointing to the server, and your reverse proxy with a valid certificate.

## 2. Installation

### Option A: prebuilt image (recommended)

The image is built automatically on every update and published to the GitHub Container Registry (`ghcr.io/riv3ty/abomination`, for amd64 and arm64). Two files are enough on the server:

```bash
sudo mkdir -p /opt/abomination && sudo chown "$USER" /opt/abomination && cd /opt/abomination
curl -fsSLO https://raw.githubusercontent.com/riv3ty/ABOmination/main/compose.yaml
curl -fsSL https://raw.githubusercontent.com/riv3ty/ABOmination/main/.env.example -o .env   # review the settings
docker compose pull
docker compose up -d
docker compose ps                             # should be "healthy" after ~10 s
curl -s http://127.0.0.1:8080/api/health      # {"ok":true,...}
```

To pin a version instead of `latest`, set e.g. `ABO_VERSION=0.3.0` in `.env`.

### Option B: build it yourself

```bash
git clone https://github.com/riv3ty/ABOmination.git /opt/abomination
cd /opt/abomination
cp .env.example .env
docker compose up -d --build
```

In both cases the data lives in the Docker volume `abomination_abo-data` (SQLite database under `/data` in the container).

## 3. Reverse proxy

Important for every setup:
- forward to `http://127.0.0.1:8080`,
- outbound, the container only needs `https://api.frankfurter.dev` (exchange rates; without access, approximate rates are used),
- set the headers `Host`, `X-Forwarded-For` and `X-Forwarded-Proto` (otherwise the brute-force lockout hits everyone and HTTPS isn't detected),
- allow request bodies of at least **6 MB** (vaults up to 5 MB),
- **don't set your own Content-Security-Policy** – the app ships a matching one.

### nginx (on the host)

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name abo.example.com;
    # ssl_certificate / ssl_certificate_key as for your other sites

    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy (on the host)

```caddy
abo.example.com {
    reverse_proxy 127.0.0.1:8080
}
```
(Caddy sets the forwarded headers and the certificate automatically.)

### Nginx Proxy Manager

New *Proxy Host*: domain `abo.example.com`, scheme `http`, forward hostname `abomination` (if NPM is on the same Docker network, see below) or the server IP, port `8080`, *SSL* with Let's Encrypt and *Force SSL*. If needed, add `client_max_body_size 6m;` under *Advanced*.

### Traefik or another proxy **on the Docker network**

Then the container doesn't need a host port. In `compose.yaml`, remove the `ports:` block and add (adjust the network name to your proxy):

```yaml
services:
  app:
    # ports: removed
    networks: [proxy]
    labels:                                     # Traefik only
      - traefik.enable=true
      - traefik.http.routers.abo.rule=Host(`abo.example.com`)
      - traefik.http.routers.abo.entrypoints=websecure
      - traefik.http.routers.abo.tls.certresolver=letsencrypt
      - traefik.http.services.abo.loadbalancer.server.port=8080
networks:
  proxy:
    external: true
```

`TRUST_PROXY=true` (default) is safe as long as the container is **not directly** reachable from the internet – i.e. the port is bound to `127.0.0.1` only or lives only on the proxy network.

## 4. First account

Registration requires an invite code:

```bash
docker compose exec app abo invite --note "me"              # single use, valid for 7 days
docker compose exec app abo invite --uses 3 --days 14 --note "family"
```

Then open `https://abo.example.com` → „Neues Server-Konto registrieren“ (register a new server account) → name, password (at least 10 characters) and the code.
Existing local profiles from the same browser can be taken over during registration („Daten übernehmen aus“ – import data from). If they live in a different browser or under a different address: export there via „Einstellungen → Sicherung (JSON)“ (settings → backup) and use „Sicherung einlesen“ (import backup) in the new account.

> **No password reset:** your data is encrypted in the browser with your password; the server cannot read it. If you forget the password, the data is lost. Export a backup regularly.

### Install as an app on your phone

Android (Chrome): open `https://abo.example.com` → menu ⋮ → **Install app** (or *Add to home screen*). On desktop (Chrome/Edge) the install icon appears in the address bar, or use „Einstellungen → App installieren“ in the app.
iPhone (Safari): Share → **Add to Home Screen**.
The installed app also starts offline (login then uses the encrypted offline copy).

## 5. Administration

```bash
docker compose exec app abo                     # help
docker compose exec app abo users               # accounts, vault version, sessions
docker compose exec app abo invites             # open invites
docker compose exec app abo logout-all <name>   # sign out all devices of an account
docker compose exec app abo delete-user <name> --yes
docker compose logs -f app                      # logs
```

Settings live in `.env` (see `.env.example`), e.g. `REGISTRATION=closed` once all accounts exist. After changes: `docker compose up -d`.

## 6. Updates

```bash
cd /opt/abomination
docker compose pull && docker compose up -d     # option A (prebuilt image)
# git pull && docker compose up -d --build      # option B (build yourself)
docker image prune -f                           # remove old images
```
Database migrations run automatically on startup. Create a backup first (see below).

## 7. Backup and restore

Backup while running (consistent copy, keeps the last 14):

```bash
docker compose exec -T app abo backup --keep 14
```

Daily via cron (`crontab -e`), including a copy out of the volume to `/opt/abomination/backups`:

```cron
15 3 * * * cd /opt/abomination && docker compose exec -T app abo backup --keep 14 >/dev/null && docker compose cp app:/data/backups/. ./backups/
```

Backups contain only encrypted vaults, but also the login hashes – please store them securely anyway (ideally also on another machine).

Restore:

```bash
docker compose stop app
docker run --rm -v abomination_abo-data:/data -v "$PWD/backups":/b alpine \
  sh -c 'rm -f /data/abomination.db-wal /data/abomination.db-shm && cp /b/<backup>.db /data/abomination.db && chown 1000:1000 /data/abomination.db'
docker compose start app
```

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Login works but you're signed out right away | The site isn't served via HTTPS or `X-Forwarded-Proto` is missing → the cookie isn't sent. |
| „Nicht unterstützt (crypto.subtle)“ (not supported) | Opened via `http://` → use HTTPS. |
| „Zu viele Fehlversuche“ (too many attempts) hits all users | `X-Forwarded-For` missing or `TRUST_PROXY=false`. |
| Saving fails with a lot of data (413) | Increase `client_max_body_size` on the proxy. |
| Container "unhealthy" | `docker compose logs app`; volume permissions (owner UID 1000). |
| Login page only shows local profiles | `/api/config` isn't forwarded to the container (check the proxy path). |

## Security at a glance

- The container runs as an unprivileged user with a read-only filesystem (except `/data`) and no extra capabilities.
- Only `authKey` hashes (scrypt) and encrypted vaults are stored on the server; password and data key never leave the device.
- Brute-force lockout, rate limits, limited parallel password checks, CSRF protection, strict Content-Security-Policy.
- No third-party requests from the browser: fonts are embedded, exchange rates are fetched by the server (outbound only to `api.frankfurter.dev`).
- Protocol details: [server/API.md](server/API.md).
