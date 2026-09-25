// Verwaltung auf dem Server, z. B.:  docker compose exec app abo invite --days 7 --note "Anna"
import path from "node:path";
import { parseArgs } from "node:util";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { newInviteCode, normalizeInvite, sha256, normalizeUsername } from "./security.js";

const HELP = `Verwendung: abo <befehl> [optionen]

  invite [--uses N] [--days N] [--note TEXT]   Einladungscode erzeugen (Standard: 1 Nutzung, 7 Tage)
  invites                                      offene Einladungen anzeigen
  users                                        Konten anzeigen
  logout-all <name>                            alle Sitzungen eines Kontos beenden
  delete-user <name> --yes                     Konto samt Tresor endgültig löschen`;

const fmt = ts => new Date(ts).toLocaleString("de-DE");

export function run(argv, db, print = console.log) {
  const [cmd, ...rest] = argv;
  const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: {
    uses: { type: "string", default: "1" }, days: { type: "string", default: "7" }, note: { type: "string", default: "" }, yes: { type: "boolean" } } });
  const user = () => {
    const n = normalizeUsername(positionals[0]);
    const u = n && db.prepare("SELECT id, display FROM users WHERE username = ?").get(n.key);
    if (!u) throw new Error(`Konto „${positionals[0] ?? ""}“ nicht gefunden.`);
    return u;
  };
  switch (cmd) {
    case "invite": {
      const uses = Math.max(1, parseInt(values.uses) || 1), days = Math.max(1, parseInt(values.days) || 7);
      const code = newInviteCode(), now = Date.now();
      db.prepare("INSERT INTO invites (code_hash, note, uses_left, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
        .run(sha256(normalizeInvite(code)), values.note, uses, now, now + days * 86400000);
      print(`Einladungscode: ${code}\n(${uses}× nutzbar, gültig bis ${fmt(now + days * 86400000)})`);
      return code;
    }
    case "invites": {
      const rows = db.prepare("SELECT note, uses_left, expires_at FROM invites WHERE expires_at > ? AND uses_left > 0").all(Date.now());
      print(rows.length ? rows.map(r => `${r.note || "(ohne Notiz)"} · noch ${r.uses_left}× · bis ${fmt(r.expires_at)}`).join("\n") : "Keine offenen Einladungen.");
      return rows;
    }
    case "users": {
      const rows = db.prepare(`SELECT u.display, u.created_at, v.updated_at, v.version,
          (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS sessions
        FROM users u JOIN vaults v ON v.user_id = u.id ORDER BY u.created_at`).all(Date.now());
      print(rows.length ? rows.map(r => `${r.display} · seit ${fmt(r.created_at)} · Tresor v${r.version} (${fmt(r.updated_at)}) · ${r.sessions} Sitzung(en)`).join("\n") : "Keine Konten.");
      return rows;
    }
    case "logout-all": {
      const u = user(), n = db.prepare("DELETE FROM sessions WHERE user_id = ?").run(u.id).changes;
      print(`${n} Sitzung(en) von ${u.display} beendet.`);
      return n;
    }
    case "delete-user": {
      const u = user();
      if (!values.yes) throw new Error("Zum Bestätigen --yes anhängen. Das Konto und alle Daten werden endgültig gelöscht.");
      db.prepare("DELETE FROM users WHERE id = ?").run(u.id);
      print(`Konto ${u.display} gelöscht.`);
      return true;
    }
    default:
      print(HELP);
      return null;
  }
}

export function main(argv = process.argv.slice(2)) {
  const config = loadConfig();
  const db = openDb(path.join(config.dataDir, "abomination.db"));
  try { run(argv, db); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { db.close(); }
}
