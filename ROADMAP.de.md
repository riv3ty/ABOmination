# Roadmap

[English](ROADMAP.md) · **Deutsch** · Stand: 2026-09-26

Wohin sich ABOmination entwickelt. Prioritäten können sich ändern – Ideen und Feedback gern in den [Issues](https://github.com/riv3ty/ABOmination/issues).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/roadmap/roadmap-de-dark.svg">
  <img alt="Roadmap-Übersicht" src="docs/roadmap/roadmap-de-light.svg" width="100%">
</picture>

## ✅ Erledigt

- **Ende-zu-Ende-verschlüsselte Server-Konten** – Abgleich zwischen Geräten; der Server speichert nur verschlüsselte Daten. Konflikte werden pro Eintrag zusammengeführt.
- **Selbst hosten mit Docker** – Gehärteter Container, Registrierung nur per Einladung, Backups, Anleitungen für Reverse Proxys.
- **Installierbare Web-App (PWA)** – Funktioniert offline, installierbar auf Android, iOS und Desktop.
- **Ratenkäufe mit Zinsen** – Tilgungsplan, Restschuld, Simulator für Sondertilgungen.
- **Kontoauszug-Import** – Erkennt wiederkehrende Zahlungen in CSV-Exporten deutscher Banken.

## 🚧 In Arbeit

- **Native Android-App** – Kotlin & Jetpack Compose: Entsperren per Fingerabdruck, Erinnerungen im Hintergrund, Widget – mit demselben verschlüsselten Konto.
- **Website, Live-Demo & Newsletter** – ABOmination im Browser ausprobieren und das Projekt verfolgen.

## ⏭️ Als Nächstes

- **Passkeys** – Entsperren per Passkey (WebAuthn PRF) statt Passworteingabe.
- **Verschlüsselte Sicherungen** – Passwortgeschützter JSON-Export zusätzlich zum unverschlüsselten.
- **Preisverlauf & Preiserhöhungen** – Preisänderungen je Abo verfolgen und bei Erhöhungen benachrichtigt werden.
- **Kündigungsassistent** – Kündigungsschreiben oder -mail mit der passenden Frist erzeugen.
- **Geräteverwaltung** – Angemeldete Geräte sehen und direkt in der App abmelden.
- **Englische Oberfläche** – Die App ist heute deutsch; Englisch und Sprachumschaltung ergänzen.

## 🗓️ Später

- **Gemeinsamer Haushalt** – Ausgewählte Abos Ende-zu-Ende-verschlüsselt mit Familienmitgliedern teilen.
- **Push-Erinnerungen in der Web-App** – Erinnerungen auch bei geschlossenem Browser – ohne dem Server Termine zu verraten.
- **Verträge & Belege** – Verschlüsselte PDFs und Fotos an ein Abo anhängen.
- **Budgets & Jahresbericht** – Ausgabenziele je Kategorie und ein Jahresrückblick.
- **Mehr Importformate** – CAMT-/MT940-Kontoauszüge und weitere Bank-CSV-Formate.
- **Admin-Oberfläche** – Einladungen und Konten im Browser statt per Kommandozeile verwalten.

## 💡 Ideen

- **iOS-App** – Native iPhone-App nach Android.
- **Browser-Erweiterung** – Abo direkt beim Abschluss im Onlineshop erfassen.
- **Kalender-Abo** – Optionaler abonnierbarer Kalender (freiwillig, da er dem Server Termine zeigt).

<sub>Erzeugt aus `docs/roadmap.json` – dort ändern und `npm run docs` ausführen.</sub>
