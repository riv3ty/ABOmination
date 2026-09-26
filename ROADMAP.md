# Roadmap

[Deutsch](ROADMAP.de.md) · Last updated: 2026-09-26

Where ABOmination is heading. Priorities can change – ideas and feedback are welcome in the [issues](https://github.com/riv3ty/ABOmination/issues).

## ✅ Shipped

- **End-to-end encrypted server accounts** – Sync across devices; the server only ever stores ciphertext. Conflicts are merged per entry.
- **Self-hosting with Docker** – Hardened container, invite-only registration, backups, reverse-proxy guides.
- **Installable web app (PWA)** – Works offline, installs on Android, iOS and desktop.
- **Installments with interest** – Amortization schedule, remaining debt, early-payoff simulator.
- **Bank statement import** – Detects recurring payments in CSV exports from German banks.

## 🚧 In progress

- **Native Android app** – Kotlin & Jetpack Compose: fingerprint unlock, reminders in the background, home-screen widget – same encrypted account.
- **Website, live demo & newsletter** – Try ABOmination in the browser and follow the project.

## ⏭️ Next

- **Passkeys** – Unlock with a passkey (WebAuthn PRF) instead of typing the password.
- **Encrypted backups** – Password-protected JSON export in addition to the plain one.
- **Price history & increase alerts** – Track price changes per subscription and get notified about increases.
- **Cancellation assistant** – Generate a cancellation letter or e-mail with the right deadline.
- **Device management** – See signed-in devices and sign them out from the app.
- **English interface** – The app is German today; add English and a language switch.

## 🗓️ Later

- **Shared household** – Share selected subscriptions end-to-end encrypted with family members.
- **Push reminders for the web app** – Reminders even when the browser is closed – without revealing due dates to the server.
- **Contracts & receipts** – Attach encrypted PDFs and photos to a subscription.
- **Budgets & yearly report** – Spending goals per category and a year-in-review.
- **More import formats** – CAMT/MT940 statements and more bank CSV layouts.
- **Admin web interface** – Manage invites and accounts in the browser instead of the command line.

## 💡 Exploring

- **iOS app** – Native iPhone app after Android.
- **Browser extension** – Suggest adding a subscription right at checkout.
- **Calendar feed** – Optional subscribable calendar (opt-in, as it reveals dates to the server).

<sub>Generated from `docs/roadmap.json` – edit that file and run `node scripts/build-roadmap.js`.</sub>
