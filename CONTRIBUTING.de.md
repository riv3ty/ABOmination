# Mitmachen

[English](CONTRIBUTING.md) · **Deutsch**

Danke für dein Interesse an ABOmination!

## Issues sind willkommen

- **Fehler:** bitte die [Vorlage für Fehlerberichte](https://github.com/riv3ty/ABOmination/issues/new?template=bug_report.yml) nutzen. Bitte niemals echte Finanzdaten anhängen – Screenshots mit Beispieldaten sind ideal (die [Live-Demo](https://riv3ty.github.io/ABOmination/app/?demo) hat welche).
- **Ideen:** die [Vorlage für Vorschläge](https://github.com/riv3ty/ABOmination/issues/new?template=feature_request.yml) nutzen oder vorher in die [Roadmap](ROADMAP.de.md) schauen.
- **Sicherheitslücken:** bitte vertraulich melden, siehe [SECURITY.de.md](SECURITY.de.md).

## Pull Requests

ABOmination ist öffentlich einsehbar, aber **keine Open-Source-Software** (privat kostenlos nutzbar, siehe [LICENSE](LICENSE)). Pull Requests werden nur nach vorheriger Absprache in einem Issue angenommen; mit dem Einreichen stimmst du zu, dass dein Beitrag gemäß den Projektbedingungen verwendet werden darf.

Wenn wir eine Änderung abgesprochen haben:

1. `npm ci`, dann auf einem eigenen Branch arbeiten.
2. Konventionen einhalten: Vanilla JS, deutsche UI-Texte und Code-Kommentare, reine Logik in `web/src/lib/` mit Tests, alles escapen, was in HTML landet.
3. `npm run check` muss durchlaufen; bei Änderungen an Anmeldung, Sync oder Server zusätzlich `npm run e2e`.
4. Im PR beschreiben, was und warum.

Mehr Details: [docs/DEVELOPMENT.de.md](docs/DEVELOPMENT.de.md).
