# Development

**English** · [Deutsch](DEVELOPMENT.de.md)

Requirements: **Node.js 22.13+** (24 recommended) and, for the end-to-end test and screenshots, Chrome/Chromium (`CHROME_PATH` if it isn't found automatically).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Web app with live reload on http://localhost:8765 (proxies `/api` to :8080) |
| `npm run server:dev` | API server on :8080 with auto-restart (reads `.env`) |
| `npm test` | Unit and API tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | Build `dist/index.html` (single file) + PWA files |
| `npm run check` | Lint + tests + build – run before every commit |
| `npm run e2e` | Real server + two Chrome instances: sync, conflicts, offline, password change, backups, PWA |
| `npm run site` | Build the website incl. live demo into `_site/` |
| `npm run screenshots` | Regenerate `docs/screenshots/` with sample data |
| `npm run docs` | Regenerate roadmap (Markdown + SVG graph) and funding links from `docs/roadmap.json` / `site/site.config.json` |
| `npm run abo -- invite` | Server admin CLI (invites, users, backups) |

End-to-end test against a running server or container: `E2E_URL=http://localhost:8080/ E2E_INVITE=<code> node e2e/run.js` (use a fresh volume).

Note: browsers store data per origin. The dev server, `npm run preview` and the Windows launcher all use `http://localhost:8765` and therefore share the same local profiles.

## Layout

```
web/index.html            Markup (dialogs, tiles)
web/src/main.js           Entry point
web/src/vault.js          Profiles + encrypted vault (local or server mode)
web/src/auth.js           Login UI, account actions, demo mode (?demo)
web/src/app.js            App UI, dialogs, cloud sync (starts after unlocking)
web/src/server/store.js   Server account: login, offline copy, sync with conflict merge
web/src/cryptoutil.js     Key derivation, AES-GCM
web/src/pwa.js            Manifest/service worker registration, "install app"
web/src/lib/              Pure logic without DOM/state (dates, loans, view model, optimizer, ICS, bank import, merge, backup)
web/public/               sw.js, manifest.webmanifest, icons/ (copied to dist/ as-is)
web/tests/                Unit tests for lib/
server/src/               API server (app.js, routes/, db.js, cli.js)
server/tests/             API tests
e2e/run.js                End-to-end test (Puppeteer)
site/                     Website templates (bilingual; built into / = English and /de/ = German)
scripts/                  Icons, screenshots, demo data, roadmap, website build
docs/                     Screenshots, roadmap source + generated SVGs, this file
Dockerfile, compose.yaml  Container deployment (see DEPLOYMENT.md)
```

## Server without Docker

```bash
npm run build                      # the server delivers dist/
npm run abo -- invite              # invite code for registration
COOKIE_SECURE=false npm start      # http://127.0.0.1:8080 (settings: .env.example)
```

API and key protocol: [server/API.md](../server/API.md).

## Privacy of this repository

The repository contains code only. Local profiles keep all data in the browser (localStorage/IndexedDB); server accounts additionally store an encrypted vault that the server cannot read. Exports (`abos-*.json`), sync files and `.ics` files are excluded via `.gitignore`.
