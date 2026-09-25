# ABOmination auf dem eigenen Server (Docker)

Der Container enthält den API-Server und die gebaute Web-App. Er lauscht nur lokal auf dem Server (`127.0.0.1:8080`); dein vorhandener Reverse Proxy stellt ihn per HTTPS unter einer (Sub-)Domain bereit, z. B. `https://abo.example.de`.

> **HTTPS ist Pflicht.** Die Verschlüsselung im Browser (WebCrypto) funktioniert nur über `https://` (oder `localhost`), und das Anmelde-Cookie wird nur über HTTPS gesendet.

## 1. Voraussetzungen

- Ubuntu mit **Docker Engine** und dem **Compose-Plugin** (`docker compose version` ≥ 2.20).
  Installation: <https://docs.docker.com/engine/install/ubuntu/>
- Eine Domain oder Subdomain, die auf den Server zeigt, und dein Reverse Proxy mit gültigem Zertifikat.

## 2. Installation

```bash
# Code auf den Server holen (Git-Remote oder Kopie des Repos)
sudo mkdir -p /opt/abomination && sudo chown "$USER" /opt/abomination
git clone <dein-repo> /opt/abomination        # oder: rsync/scp des Repos nach /opt/abomination
cd /opt/abomination

cp .env.example .env                          # Einstellungen prüfen (Standard passt meist)
docker compose up -d --build                  # baut das Image und startet den Container
docker compose ps                             # Status sollte nach ~10 s "healthy" sein
curl -s http://127.0.0.1:8080/api/health      # {"ok":true,...}
```

Die Daten liegen im Docker-Volume `abomination_abo-data` (SQLite-Datenbank unter `/data` im Container).

## 3. Reverse Proxy

Wichtig für alle Varianten:
- an `http://127.0.0.1:8080` weiterleiten,
- der Container braucht ausgehend nur `https://api.frankfurter.dev` (Wechselkurse; ohne Zugang gibt es Näherungswerte),
- die Header `Host`, `X-Forwarded-For` und `X-Forwarded-Proto` setzen (sonst: Sperre nach Fehlversuchen trifft alle, und HTTPS wird nicht erkannt),
- Anfragen bis mindestens **6 MB** erlauben (Tresor bis 5 MB),
- **keine eigene Content-Security-Policy** setzen – die App liefert eine passende mit.

### nginx (auf dem Host)

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name abo.example.de;
    # ssl_certificate / ssl_certificate_key wie bei deinen anderen Seiten

    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy (auf dem Host)

```caddy
abo.example.de {
    reverse_proxy 127.0.0.1:8080
}
```
(Caddy setzt die Forwarded-Header und das Zertifikat automatisch.)

### Nginx Proxy Manager

Neuer *Proxy Host*: Domain `abo.example.de`, Scheme `http`, Forward Hostname `abomination` (wenn NPM im selben Docker-Netz ist, siehe unten) bzw. die Server-IP, Port `8080`, *SSL* mit Let's Encrypt und *Force SSL*. Unter *Advanced* ggf. `client_max_body_size 6m;` eintragen.

### Traefik oder ein anderer Proxy **im Docker-Netz**

Dann braucht der Container keinen Port auf dem Host. In `compose.yaml` den Block `ports:` entfernen und ergänzen (Netzwerkname an deinen Proxy anpassen):

```yaml
services:
  app:
    # ports: entfernt
    networks: [proxy]
    labels:                                     # nur für Traefik
      - traefik.enable=true
      - traefik.http.routers.abo.rule=Host(`abo.example.de`)
      - traefik.http.routers.abo.entrypoints=websecure
      - traefik.http.routers.abo.tls.certresolver=letsencrypt
      - traefik.http.services.abo.loadbalancer.server.port=8080
networks:
  proxy:
    external: true
```

`TRUST_PROXY=true` (Standard) ist sicher, solange der Container **nicht direkt** aus dem Internet erreichbar ist – also Port nur auf `127.0.0.1` bzw. nur im Proxy-Netz.

## 4. Erstes Konto

Die Registrierung braucht einen Einladungscode:

```bash
docker compose exec app abo invite --note "Maciej"          # 1× nutzbar, 7 Tage gültig
docker compose exec app abo invite --uses 3 --days 14 --note "Familie"
```

Dann `https://abo.example.de` öffnen → *Neues Server-Konto registrieren* → Name, Passwort (mind. 10 Zeichen) und Code eingeben.
Bestehende lokale Profile aus dem Browser lassen sich dabei übernehmen (*Daten übernehmen aus*). Liegen sie in einem anderen Browser bzw. unter einer anderen Adresse: dort *Einstellungen → Sicherung (JSON)* exportieren und im neuen Konto *Sicherung einlesen*.

> **Kein Passwort-Reset:** Die Daten werden im Browser mit deinem Passwort verschlüsselt; der Server kann sie nicht lesen. Wer das Passwort vergisst, verliert den Zugriff. Regelmäßig *Sicherung (JSON)* exportieren.

## 5. Verwaltung

```bash
docker compose exec app abo                     # Hilfe
docker compose exec app abo users               # Konten, Tresor-Version, Sitzungen
docker compose exec app abo invites             # offene Einladungen
docker compose exec app abo logout-all <name>   # alle Geräte eines Kontos abmelden
docker compose exec app abo delete-user <name> --yes
docker compose logs -f app                      # Logs
```

Einstellungen stehen in `.env` (siehe `.env.example`), z. B. `REGISTRATION=closed`, sobald alle Konten angelegt sind. Nach Änderungen: `docker compose up -d`.

## 6. Updates

```bash
cd /opt/abomination
git pull                                        # bzw. neue Dateien kopieren
docker compose up -d --build
docker image prune -f                           # alte Images aufräumen
```
Datenbank-Migrationen laufen beim Start automatisch. Vorher eine Sicherung anlegen (siehe unten).

## 7. Sicherung und Wiederherstellung

Sicherung im laufenden Betrieb (konsistente Kopie, behält die letzten 14):

```bash
docker compose exec -T app abo backup --keep 14
```

Täglich per Cron (`crontab -e`), inklusive Kopie aus dem Volume heraus nach `/opt/abomination/backups`:

```cron
15 3 * * * cd /opt/abomination && docker compose exec -T app abo backup --keep 14 >/dev/null && docker compose cp app:/data/backups/. ./backups/
```

Die Sicherung enthält nur verschlüsselte Tresore, aber auch die Anmelde-Hashes – bitte trotzdem geschützt aufbewahren (und idealerweise zusätzlich auf einem anderen Rechner).

Wiederherstellen:

```bash
docker compose stop app
docker run --rm -v abomination_abo-data:/data -v "$PWD/backups":/b alpine \
  sh -c 'rm -f /data/abomination.db-wal /data/abomination.db-shm && cp /b/<sicherung>.db /data/abomination.db && chown 1000:1000 /data/abomination.db'
docker compose start app
```

## 8. Fehlersuche

| Symptom | Ursache / Lösung |
|---|---|
| Anmeldung klappt, aber sofort wieder abgemeldet | Seite läuft nicht über HTTPS oder `X-Forwarded-Proto` fehlt → Cookie wird nicht gesendet. |
| „Nicht unterstützt (crypto.subtle)“ | Seite über `http://` aufgerufen → HTTPS verwenden. |
| „Zu viele Fehlversuche“ trifft alle Nutzer | `X-Forwarded-For` fehlt oder `TRUST_PROXY=false`. |
| Speichern schlägt bei vielen Daten fehl (413) | `client_max_body_size` am Proxy erhöhen. |
| Container „unhealthy“ | `docker compose logs app`; Rechte am Volume (Besitzer UID 1000). |
| Login-Seite zeigt nur lokale Profile | `/api/config` wird nicht an den Container weitergeleitet (Proxy-Pfad prüfen). |

## Sicherheit auf einen Blick

- Der Container läuft als unprivilegierter Benutzer, mit schreibgeschütztem Dateisystem (außer `/data`), ohne Zusatzrechte.
- Nur `authKey`-Hashes (scrypt) und verschlüsselte Tresore liegen auf dem Server; Passwort und Datenschlüssel verlassen das Gerät nie.
- Sperre nach Fehlversuchen, Rate-Limits, begrenzte parallele Passwortprüfungen, CSRF-Schutz, strenge Content-Security-Policy.
- Keine Aufrufe fremder Dienste aus dem Browser: Schriften sind eingebettet, Wechselkurse holt der Server (ausgehend nur zu `api.frankfurter.dev`).
- Details zum Protokoll: [server/API.md](server/API.md).
