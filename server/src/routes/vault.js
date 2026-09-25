// Tresor lesen/schreiben. Optimistische Sperre: Schreiben nur auf Basis der aktuellen Version,
// sonst 409 mit dem aktuellen Stand, damit der Client zusammenführen kann (nichts wird still überschrieben).
import { tx } from "../db.js";
import * as S from "../schemas.js";

export default async function vaultRoutes(app, { db }) {
  const out = v => ({ version: v.version, updatedAt: v.updated_at, blob: JSON.parse(v.blob) });

  app.get("/api/vault", { preHandler: app.requireAuth }, async req =>
    out(db.prepare("SELECT version, blob, updated_at FROM vaults WHERE user_id = ?").get(req.session.user.id)));

  app.put("/api/vault", {
    preHandler: app.requireAuth,
    schema: S.body({ blob: S.blob, baseVersion: { type: "integer", minimum: 1 } })
  }, async (req, reply) => {
    const uid = req.session.user.id, now = Date.now();
    const res = tx(db, () => {
      const cur = db.prepare("SELECT version, blob, updated_at FROM vaults WHERE user_id = ?").get(uid);
      if (cur.version !== req.body.baseVersion) return { conflict: cur };
      db.prepare("UPDATE vaults SET version = ?, blob = ?, updated_at = ? WHERE user_id = ?").run(cur.version + 1, JSON.stringify(req.body.blob), now, uid);
      return { version: cur.version + 1 };
    });
    if (res.conflict) return reply.code(409).send({ error: "conflict", message: "Der Tresor wurde auf einem anderen Gerät geändert.", ...out(res.conflict) });
    return { version: res.version, updatedAt: now };
  });
}
