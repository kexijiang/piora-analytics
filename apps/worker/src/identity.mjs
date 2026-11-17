import { transaction, uuid } from "../../api/src/core.mjs";
import { matchIdentity } from "../../api/src/identity.mjs";

// Bounded, restart-safe upgrade pass. Re-read after taking the same organization
// lock as live reports so a stale worker snapshot can never overwrite a new claim.
export async function reconcileIdentities(pool, limit = 50) {
  const rows = (
    await pool.query(
      "SELECT org_id,id FROM installations WHERE identity_match_version<1 ORDER BY org_id,id LIMIT $1",
      [limit],
    )
  ).rows;
  let processed = 0;
  for (const row of rows)
    await transaction(pool, async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        row.org_id + ":domain-identity",
      ]);
      const installation = (
        await c.query(
          "SELECT identity_match_version FROM installations WHERE org_id=$1 AND id=$2 FOR UPDATE",
          [row.org_id, row.id],
        )
      ).rows[0];
      if (!installation || installation.identity_match_version >= 1) return;
      const identity = (
        await c.query(
          "SELECT claim FROM installation_identities WHERE org_id=$1 AND installation_id=$2",
          [row.org_id, row.id],
        )
      ).rows[0];
      await matchIdentity(c, identity?.claim ?? null, {
        org: row.org_id,
        installation: row.id,
        requestId: uuid(),
      });
      processed++;
    });
  return processed;
}
