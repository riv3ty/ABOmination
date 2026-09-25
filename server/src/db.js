// SQLite-Datenbank (node:sqlite, ohne native Module). Schema-Migrationen über PRAGMA user_version.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS = [
  // 1: Grundschema
  `CREATE TABLE users (
     id          INTEGER PRIMARY KEY,
     username    TEXT NOT NULL UNIQUE,          -- normalisiert (NFC, klein) für die Anmeldung
     display     TEXT NOT NULL,                 -- wie eingegeben
     kdf_salt    TEXT NOT NULL,                 -- Base64, für die Schlüsselableitung im Client
     kdf_iter    INTEGER NOT NULL,
     auth_hash   TEXT NOT NULL,                 -- scrypt(authKey)
     created_at  INTEGER NOT NULL,
     updated_at  INTEGER NOT NULL
   );
   CREATE TABLE vaults (
     user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     version     INTEGER NOT NULL,
     blob        TEXT NOT NULL,                 -- verschlüsselt; der Server kann ihn nicht lesen
     updated_at  INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     id          TEXT PRIMARY KEY,              -- öffentliche ID (Geräteliste, Abmelden)
     user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     token_hash  TEXT NOT NULL UNIQUE,          -- SHA-256 des Tokens; das Token selbst wird nicht gespeichert
     kind        TEXT NOT NULL,                 -- web | app
     label       TEXT NOT NULL,
     created_at  INTEGER NOT NULL,
     last_seen   INTEGER NOT NULL,
     expires_at  INTEGER NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE TABLE invites (
     code_hash   TEXT PRIMARY KEY,
     note        TEXT NOT NULL DEFAULT '',
     uses_left   INTEGER NOT NULL,
     created_at  INTEGER NOT NULL,
     expires_at  INTEGER NOT NULL
   );
   CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`
];

export function openDb(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

function migrate(db) {
  const current = db.prepare("PRAGMA user_version").get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    tx(db, () => { db.exec(MIGRATIONS[v]); db.exec(`PRAGMA user_version = ${v + 1}`); });
  }
}

// Transaktion: fn() läuft atomar, bei einer Exception wird zurückgerollt
export function tx(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (e) { db.exec("ROLLBACK"); throw e; }
}
