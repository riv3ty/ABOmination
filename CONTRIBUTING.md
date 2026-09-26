# Contributing

Thanks for your interest in ABOmination!

## Issues are welcome

- **Bugs:** use the [bug report template](https://github.com/riv3ty/ABOmination/issues/new?template=bug_report.yml). Please never attach real financial data – screenshots with sample data are perfect (the [live demo](https://riv3ty.github.io/ABOmination/app/?demo) has some).
- **Ideas:** use the [feature request template](https://github.com/riv3ty/ABOmination/issues/new?template=feature_request.yml) or check the [roadmap](ROADMAP.md) first.
- **Security issues:** please report privately, see [SECURITY.md](SECURITY.md).

## Pull requests

ABOmination is source-available but **not open source** (free for personal use, see [LICENSE](LICENSE)). Pull requests are only accepted after prior agreement in an issue; by submitting one you agree that your contribution may be used under the project's terms.

If we agreed on a change:

1. `npm ci`, then work on a branch.
2. Keep the conventions: vanilla JS, German UI texts and code comments, pure logic in `web/src/lib/` with tests, escape everything that ends up in HTML.
3. `npm run check` must pass; run `npm run e2e` for changes to login, sync or the server.
4. Describe what and why in the PR template.

More details: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

**Deutsch:** Fehlerberichte und Ideen gern als Issue (bitte ohne echte Finanzdaten). Pull Requests nur nach vorheriger Absprache, da das Projekt nicht Open Source ist.
