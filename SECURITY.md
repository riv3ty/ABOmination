# Security Policy

**English** · [Deutsch](SECURITY.de.md)

ABOmination handles personal financial data, so security reports are taken seriously.

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private reporting instead:
**Security → [Report a vulnerability](https://github.com/riv3ty/ABOmination/security/advisories/new)**.

Please include what you found, how to reproduce it and the impact you expect. You'll get a first response within 7 days. Fixes are released as soon as possible and credited if you wish.

## Scope

In scope: the web app, the API server, the Docker image and the key/encryption protocol ([server/API.md](server/API.md)).
Especially interesting: anything that lets the server or a third party read vault contents, bypass authentication, or run script in the app (XSS).

Out of scope: denial of service through excessive traffic, findings that require a compromised device or browser, missing best-practice headers without a concrete impact.

## Supported versions

Only the latest version on `main` (and the `latest` Docker image) receives security fixes.

## Design summary

- Data is encrypted in the browser (PBKDF2-SHA256 600k → HKDF → AES-256-GCM); the server stores only ciphertext and `scrypt(authKey)`.
- Sessions: httpOnly/SameSite=Strict cookies with CSRF header, or bearer tokens for apps; stored as SHA-256 hashes.
- Brute-force protection, rate limits, strict Content-Security-Policy, non-root read-only container.
