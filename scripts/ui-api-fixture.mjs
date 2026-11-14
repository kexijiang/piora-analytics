import { testDatabase } from "../tests/support/postgres.mjs";
import { uuid } from "../apps/api/src/core.mjs";
import { passwordHash } from "../apps/api/src/auth.mjs";
import { createServer } from "../apps/api/src/server.mjs";
import { defaultPolicy } from "../packages/contracts/telemetry.mjs";
const db = await testDatabase(),
  org = uuid();
let server;
async function stop() {
  if (server) await server.close();
  await db.close();
  process.disconnect?.();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
process.on("message", (message) => {
  if (message === "stop") void stop();
});
try {
  await db.pool.query(
    "INSERT INTO organizations(id,name) VALUES($1,'浏览器合成测试组织')",
    [org],
  );
  await db.pool.query(
    "INSERT INTO admin_accounts(id,org_id,username,display_name,password_hash,role,must_change_password) VALUES($1,$2,'browser-admin','合成管理员',$3,'admin',false)",
    [uuid(), org, await passwordHash("Browser-fixture-123")],
  );
  await db.pool.query(
    "INSERT INTO org_settings(org_id,name,value) VALUES($1,'sync',$2),($1,'retention',$3)",
    [
      org,
      defaultPolicy,
      { raw_days: 90, daily_months: 24, audit_days: 365, revision: 1 },
    ],
  );
  server = await createServer(db.pool, {
    org,
    orgName: "浏览器合成测试组织",
    pepper: "browser-fixture-pepper-only-not-production",
    origin: "http://127.0.0.1:4318",
    development: true,
  });
  await server.listen({ port: Number(process.env.UI_API_PORT ?? 4319), host: "127.0.0.1" });
  process.send?.("ready");
} catch (error) {
  await stop();
  throw error;
}
