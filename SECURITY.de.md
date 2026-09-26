# Sicherheitsrichtlinie

[English](SECURITY.md) · **Deutsch**

ABOmination verarbeitet persönliche Finanzdaten – Hinweise auf Sicherheitslücken werden daher ernst genommen.

## Sicherheitslücke melden

**Bitte kein öffentliches Issue eröffnen.** Nutze stattdessen die vertrauliche Meldung auf GitHub:
**Security → [Report a vulnerability](https://github.com/riv3ty/ABOmination/security/advisories/new)**.

Bitte beschreibe, was du gefunden hast, wie es sich nachstellen lässt und welche Auswirkung du erwartest. Eine erste Antwort gibt es innerhalb von 7 Tagen. Korrekturen werden so schnell wie möglich veröffentlicht und – wenn du möchtest – mit Nennung deines Namens.

## Umfang

Im Umfang: die Web-App, der API-Server, das Docker-Image und das Schlüssel-/Verschlüsselungsprotokoll ([server/API.de.md](server/API.de.md)).
Besonders interessant: alles, womit der Server oder Dritte Tresor-Inhalte lesen, die Anmeldung umgehen oder Skripte in der App ausführen können (XSS).

Nicht im Umfang: Überlastung durch übermäßigen Datenverkehr, Befunde, die ein bereits kompromittiertes Gerät oder einen kompromittierten Browser voraussetzen, fehlende Best-Practice-Header ohne konkrete Auswirkung.

## Unterstützte Versionen

Sicherheitskorrekturen gibt es nur für den aktuellen Stand auf `main` (und das Docker-Image `latest`).

## Überblick über das Sicherheitskonzept

- Daten werden im Browser verschlüsselt (PBKDF2-SHA256 600k → HKDF → AES-256-GCM); der Server speichert nur Chiffretext und `scrypt(authKey)`.
- Sitzungen: httpOnly-/SameSite=Strict-Cookies mit CSRF-Header oder Bearer-Tokens für Apps; gespeichert als SHA-256-Hashes.
- Schutz vor Passwort-Raten, Rate-Limits, strenge Content-Security-Policy, Container ohne Root-Rechte und mit schreibgeschütztem Dateisystem.
