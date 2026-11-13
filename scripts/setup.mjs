import {
  createPool,
  migrate,
  uuid,
  transaction,
} from "../apps/api/src/core.mjs";
import { passwordHash } from "../apps/api/src/auth.mjs";
import { defaultPolicy } from "../packages/contracts/telemetry.mjs";
import readline from "node:readline/promises";
const pool = createPool(process.env.DATABASE_URL);
await migrate(pool);
const cli = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const name =
  process.env.INIT_ORG_NAME ?? (await cli.question("Organization name: "));
const username =
  process.env.INIT_ADMIN_USERNAME ?? (await cli.question("Admin username: "));
// Password is provided through stdin/secret environment, never a CLI argument or repository default.
const password = process.env.INIT_ADMIN_PASSWORD;
cli.close();
if (!password || password.length < 12 || password.length > 256)
  throw new Error(
    "Set INIT_ADMIN_PASSWORD through a secure environment (12–256 characters). No password prompt is echoed.",
  );
if (
  !name.trim() ||
  name.length > 120 ||
  !username.trim() ||
  username.length > 80
)
  throw new Error("Invalid organization name or username");
await transaction(pool, async (c) => {
  await c.query("SELECT pg_advisory_xact_lock(71203002)");
  if ((await c.query("SELECT 1 FROM organizations")).rowCount)
    throw new Error("Already initialized");
  const org = uuid();
  await c.query("INSERT INTO organizations(id,name) VALUES($1,$2)", [
    org,
    name,
  ]);
  await c.query(
    "INSERT INTO admin_accounts(id,org_id,username,display_name,password_hash,role) VALUES($1,$2,$3,$3,$4,'admin')",
    [uuid(), org, username.toLowerCase(), await passwordHash(password)],
  );
  await c.query(
    "INSERT INTO org_settings(org_id,name,value) VALUES($1,'sync',$2),($1,'retention',$3)",
    [
      org,
      defaultPolicy,
      { raw_days: 90, daily_months: 24, audit_days: 365, revision: 1 },
    ],
  );
});
await pool.end();
console.log(
  "Organization initialized. Sign in and change the temporary password.",
);
