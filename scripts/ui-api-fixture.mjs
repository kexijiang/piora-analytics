import { testDatabase } from "../tests/support/postgres.mjs";
import { runAggregation } from "../apps/worker/src/aggregate.mjs";
import { secretHash } from "../apps/api/src/core.mjs";
import { uuid } from "../apps/api/src/core.mjs";
import { passwordHash } from "../apps/api/src/auth.mjs";
import { createServer } from "../apps/api/src/server.mjs";
import { defaultPolicy } from "../packages/contracts/telemetry.mjs";
const db = await testDatabase({ isolatedDatabase: true }),
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
  for (let i = 1; process.env.IDENTITY_UI_FIXTURE !== "true" && i <= 25; i++) {
    await db.pool.query(
      "INSERT INTO enrollment_keys(id,org_id,label,secret_hash,expires_at,max_registrations,created_at) VALUES($1,$2,$3,$4,now()+interval '7 days',50,now()-($5::int * interval '1 minute'))",
      [uuid(), org, "Search-Fixture-" + String(i).padStart(2, "0"), Buffer.alloc(32), i],
    );
  }
  for (let i = 1; process.env.IDENTITY_UI_FIXTURE !== "true" && i <= 25; i++) {
    await db.pool.query("INSERT INTO employees(id,org_id,name,employee_no) VALUES($1,$2,$3,$4)",
      [uuid(), org, "员工合成" + String(i).padStart(2, "0"), "STAFF-" + String(i).padStart(2, "0")]);
  }
  server = await createServer(db.pool, {
    org,
    orgName: "浏览器合成测试组织",
    pepper: "browser-fixture-pepper-only-not-production",
    origin: process.env.UI_ORIGIN ?? "http://127.0.0.1:4318",
    development: true,
  });
  await server.listen({
    port: Number(process.env.UI_API_PORT ?? 4319),
    host: "127.0.0.1",
  });
  if (process.env.IDENTITY_UI_FIXTURE === "true") {
    const key = uuid(),
      secret = "synthetic-enrollment",
      registration = {
        registration_id: uuid(),
        installation_id: uuid(),
        credential: { credential_id: uuid(), secret: "A".repeat(43) },
        windows_username: "fixture-user",
        device_label: "UNBOUND-FIXTURE",
        app_version: "fixture",
        sdk_version: "fixture",
        protocol_version: "1.0",
        capabilities: ["desktop_activity"],
      };
    await db.pool.query(
      "INSERT INTO enrollment_keys(id,org_id,label,secret_hash,expires_at,max_registrations) VALUES($1,$2,'Browser identity fixture',$3,now()+interval '1 hour',10)",
      [
        key,
        org,
        secretHash(secret, "browser-fixture-pepper-only-not-production"),
      ],
    );
    const registered = await server.inject({
      method: "POST",
      url: "/v1/installations/register",
      headers: {
        authorization: `Bearer enroll.${key}.${secret}`,
        "idempotency-key": registration.registration_id,
      },
      payload: registration,
    });
    if (registered.statusCode !== 201) throw new Error(registered.body);
    const bearer = `Bearer pa1.${registration.credential.credential_id}.${registration.credential.secret}`;
    const received = await server.inject({
      method: "POST",
      url: "/v1/telemetry/batches",
      headers: { authorization: bearer },
      payload: {
        batch_id: uuid(),
        protocol_version: "1.0",
        client_sent_at: new Date().toISOString(),
        policy_version: 1,
        events: [
          {
            event_id: uuid(),
            event_seq: "1",
            source_key: "browser:launch",
            event_type: "desktop.started",
            occurred_at: new Date().toISOString(),
            app_launch_id: uuid(),
            app_version: "fixture",
            payload: { reason: "manual" },
          },
        ],
      },
    });
    if (received.statusCode !== 200) throw new Error(received.body);
    await runAggregation(db.pool, 50);
    process.send?.({
      ready: true,
      bearer,
      installation: registration.installation_id,
    });
  } else process.send?.("ready");
} catch (error) {
  await stop();
  throw error;
}
