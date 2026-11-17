import assert from "node:assert/strict";
import fs from "node:fs";
import {
  uuid,
  transaction,
  secretHash,
  migrate,
} from "../apps/api/src/core.mjs";
import { passwordHash } from "../apps/api/src/auth.mjs";
import { createServer } from "../apps/api/src/server.mjs";
import { testDatabase } from "./support/postgres.mjs";
import { dayOf } from "../packages/contracts/telemetry.mjs";
const upgradeOrg = uuid(),
  upgradeEmployee = uuid(),
  upgradeInstallation = uuid(),
  upgradeBinding = uuid();
const db = await testDatabase({
  beforeMigrate: async (pool) => {
    await pool.query(
      fs.readFileSync(
        new URL("../database/migrations/0001_initial.sql", import.meta.url),
        "utf8",
      ),
    );
    await pool.query(
      "CREATE TABLE schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now()); INSERT INTO schema_migrations(name) VALUES('0001_initial.sql')",
    );
    await pool.query(
      "INSERT INTO organizations(id,name) VALUES($1,'Upgrade fixture')",
      [upgradeOrg],
    );
    await pool.query(
      "INSERT INTO employees(id,org_id,name,employee_no) VALUES($1,$2,'Existing fixture','007')",
      [upgradeEmployee, upgradeOrg],
    );
    await pool.query(
      "INSERT INTO installations(id,org_id,registration_id,registration_hash,windows_username,device_label,app_version,sdk_version,capabilities) VALUES($1,$2,$3,$4,'fixture','fixture','old','old','{}')",
      [upgradeInstallation, upgradeOrg, uuid(), Buffer.from("synthetic")],
    );
    await pool.query(
      "INSERT INTO installation_bindings(id,org_id,installation_id,employee_id,valid_days,reason) VALUES($1,$2,$3,$4,daterange(current_date-1,NULL,'[)'),'Existing manual decision')",
      [upgradeBinding, upgradeOrg, upgradeInstallation, upgradeEmployee],
    );
    await pool.query(
      fs.readFileSync(
        new URL(
          "../database/migrations/0002_domain_identity.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await pool.query(
      "INSERT INTO schema_migrations(name) VALUES('0002_domain_identity.sql')",
    );
    await pool.query(
      "INSERT INTO org_settings(org_id,name,value) VALUES($1,'identity',$2)",
      [
        upgradeOrg,
        {
          version: 1,
          enabled: true,
          auto_create: true,
          rules: [
            {
              domain: "CHINA",
              employee_prefix: "OLD-",
              format: "digits",
              case: "preserve",
            },
          ],
        },
      ],
    );
    await pool.query(
      "INSERT INTO employee_domain_accounts(org_id,domain,account_name,employee_id) VALUES($1,'CHINA','007',$2)",
      [upgradeOrg, upgradeEmployee],
    );
  },
});
let app, app2;
try {
  await migrate(db.pool); // Re-running the upgrade must be harmless.
  const upgraded = (
    await db.pool.query("SELECT * FROM installation_bindings WHERE id=$1", [
      upgradeBinding,
    ])
  ).rows[0];
  assert.equal(upgraded.source, "manual");
  assert.equal(upgraded.employee_id, upgradeEmployee);
  assert.equal(upgraded.reason, "Existing manual decision");
  const upgradedPolicy = (
    await db.pool.query(
      "SELECT value FROM org_settings WHERE org_id=$1 AND name='identity'",
      [upgradeOrg],
    )
  ).rows[0].value;
  assert.equal("employee_prefix" in upgradedPolicy.rules[0], false);
  await db.pool.query(
    "INSERT INTO employee_domain_accounts(org_id,domain,account_name,employee_id) VALUES($1,'OTHER','007',$2)",
    [upgradeOrg, upgradeEmployee],
  );
  const org = uuid(),
    admin = uuid(),
    origin = "http://127.0.0.1:14991";
  await db.pool.query(
    "INSERT INTO organizations(id,name) VALUES($1,'Identity fixture')",
    [org],
  );
  await db.pool.query(
    "INSERT INTO admin_accounts(id,org_id,username,display_name,password_hash,role,must_change_password) VALUES($1,$2,'admin','Fixture',$3,'admin',false)",
    [admin, org, await passwordHash("Synthetic-password-123")],
  );
  app = await createServer(db.pool, {
    org,
    orgName: "Fixture",
    pepper: "synthetic-identity-pepper-32-characters",
    origin,
    allowHttp: true,
  });
  let cookie, csrf;
  async function call(method, url, payload, status = 200, headers = {}) {
    const r = await app.inject({
      method,
      url,
      payload,
      headers: {
        origin,
        ...(cookie ? { cookie, "x-csrf-token": csrf } : {}),
        "idempotency-key": uuid(),
        ...headers,
      },
    });
    assert.equal(r.statusCode, status, url + ": " + r.body);
    return r;
  }
  const login = await call("POST", "/v1/admin/auth/login", {
    username: "admin",
    password: "Synthetic-password-123",
  });
  cookie = login.headers["set-cookie"].split(";")[0];
  csrf = login.json().data.csrf_token;
  assert.deepEqual(
    (await call("GET", "/v1/capabilities")).json().data.capabilities,
    ["windows-domain-identity-v1"],
  );
  let policy = (await call("GET", "/v1/admin/settings/identity")).json().data;
  async function setPolicy(p, status = 200) {
    const r = await call(
      "PATCH",
      "/v1/admin/settings/identity",
      {
        policy: { ...p, version: policy.version + 1 },
        expected_revision: policy.version,
        reason: "Synthetic identity test",
      },
      status,
    );
    if (status === 200) policy = r.json().data;
  }
  const rule = {
    domain: "CHINA",
    format: "digits",
    case: "preserve",
  };
  await setPolicy(
    {
      ...policy,
      enabled: true,
      auto_create: true,
      rules: [rule, { ...rule, domain: "china" }],
    },
    422,
  );
  await setPolicy({
    ...policy,
    enabled: true,
    auto_create: true,
    rules: [rule, { ...rule, domain: "OTHER" }],
  });
  const enrollment = (
    await call(
      "POST",
      "/v1/admin/enrollment-keys",
      {
        label: "Synthetic",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        max_registrations: 30,
      },
      201,
    )
  ).json().data;
  const identity = (account_name = "001234", domain = "CHINA") => ({
    account_type: "domain",
    domain,
    account_name,
    source: "windows_logon",
  });
  const reg = (claim) => ({
    registration_id: uuid(),
    installation_id: uuid(),
    credential: { credential_id: uuid(), secret: "A".repeat(43) },
    windows_username: "fixture-name",
    device_label: "FIXTURE",
    app_version: "test",
    sdk_version: "test",
    protocol_version: "1.0",
    capabilities: ["desktop_activity"],
    ...(claim ? { windows_identity: claim } : {}),
  });
  const register = (b) =>
    call("POST", "/v1/installations/register", b, 201, {
      authorization: "Bearer " + enrollment.secret,
      "idempotency-key": b.registration_id,
    });
  const report = (b, claim) =>
    call("POST", "/v1/installations/identity", { identity: claim }, 200, {
      authorization:
        "Bearer pa1." + b.credential.credential_id + "." + b.credential.secret,
    });
  const get = async (b) =>
    (await call("GET", "/v1/admin/installations/" + b.installation_id)).json()
      .data;
  const a = reg(identity()),
    b = reg(identity("001234", "OTHER"));
  await Promise.all([register(a), register(a), register(b)]);
  assert.equal(
    (
      await db.pool.query(
        "SELECT count(*)::int AS n FROM employees WHERE org_id=$1",
        [org],
      )
    ).rows[0].n,
    1,
  );
  const employee = (
    await db.pool.query("SELECT * FROM employees WHERE org_id=$1", [org])
  ).rows[0];
  assert.equal(employee.employee_no, "001234");
  assert.equal((await get(a)).employee_id, employee.id);
  assert.equal((await get(b)).identity_status.binding_source, "domain");
  assert.equal(
    (
      await db.pool.query(
        "SELECT used_registrations FROM enrollment_keys WHERE org_id=$1",
        [org],
      )
    ).rows[0].used_registrations,
    2,
  );
  assert.equal((await report(a, identity())).json().data.state, "matched");
  const auditCount = async () =>
    Number(
      (
        await db.pool.query(
          "SELECT count(*) FROM audit_logs WHERE target_id=$1 AND action='identity.reported'",
          [a.installation_id],
        )
      ).rows[0].count,
    );
  const beforeRepeat = await auditCount();
  await Promise.all([report(a, identity()), report(a, identity())]);
  assert.equal(
    await auditCount(),
    beforeRepeat,
    "Repeated claims do not duplicate audit or bindings",
  );
  const changed = (await report(a, identity("999999"))).json().data;
  assert.equal(changed.state, "identity_conflict");
  assert.equal(changed.employee_id, employee.id);
  const other = reg(identity("001234", "OTHER"));
  await register(other);
  assert.equal((await get(other)).employee_id, employee.id);
  assert.equal(
    (await report(b, identity("001234", "OTHER"))).json().data.state,
    "matched",
  );
  assert.equal((await get(b)).employee_id, employee.id);
  const legacy = reg();
  await register(legacy);
  assert.equal((await get(legacy)).identity_status.state, "missing");
  assert.equal(
    (await report(legacy, identity())).json().data.employee_id,
    employee.id,
  );
  const local = reg({
    account_type: "local",
    domain: null,
    account_name: "Administrator",
    source: "windows_logon",
  });
  await register(local);
  assert.equal((await get(local)).identity_status.state, "local");
  const foreign = reg(identity("001234", "UNCONFIGURED"));
  await register(foreign);
  assert.equal(
    (await get(foreign)).identity_status.state,
    "domain_not_allowed",
  );
  const invalid = reg(identity("someone"));
  await register(invalid);
  assert.equal((await get(invalid)).identity_status.state, "invalid_account");
  const manual = reg();
  await register(manual);
  await call(
    "POST",
    `/v1/admin/installations/${manual.installation_id}/bindings`,
    {
      employee_id: employee.id,
      valid_from: dayOf(Date.now()),
      valid_to: null,
      expected_revision: 1,
      reason: "Manual fixture",
    },
    201,
  );
  assert.equal(
    (await report(manual, identity("999999"))).json().data.state,
    "binding_preserved",
  );
  assert.equal((await get(manual)).employee_id, employee.id);
  // Correcting an auto binding permanently gives manual decisions priority.
  const binding = (
    await db.pool.query(
      "SELECT id,revision FROM installation_bindings WHERE installation_id=$1",
      [b.installation_id],
    )
  ).rows[0];
  await call("PATCH", "/v1/admin/bindings/" + binding.id, {
    employee_id: employee.id,
    valid_from: dayOf(Date.now()),
    valid_to: null,
    reason: "Manual confirmation",
    expected_revision: binding.revision,
  });
  assert.equal(
    (await report(b, identity("999999"))).json().data.state,
    "binding_preserved",
  );
  await db.pool.query("UPDATE employees SET status='archived' WHERE id=$1", [
    employee.id,
  ]);
  const archived = reg(identity());
  await register(archived);
  assert.equal(
    (await get(archived)).identity_status.state,
    "employee_archived",
  );
  await db.pool.query("UPDATE employees SET status='active' WHERE id=$1", [
    employee.id,
  ]);
  await setPolicy({ ...policy, auto_create: false });
  const missing = reg(identity("333333"));
  await register(missing);
  assert.equal((await get(missing)).identity_status.state, "employee_missing");
  const existing = uuid();
  await db.pool.query(
    "INSERT INTO employees(id,org_id,name,employee_no) VALUES($1,$2,'Existing','333333')",
    [existing, org],
  );
  assert.equal(
    (await report(missing, identity("333333"))).json().data.employee_id,
    existing,
  );
  // Allowed domains use the same organization-wide employee number.
  await setPolicy({
    ...policy,
    auto_create: true,
    rules: [{ ...rule, domain: "OTHER" }],
  });
  const conflict = reg(identity("001234", "OTHER"));
  await register(conflict); // Existing OTHER mapping remains stable.
  assert.equal(
    (await get(conflict)).employee_id,
    (await get(other)).employee_id,
  );
  const cross = reg(identity("333333", "OTHER"));
  await register(cross);
  assert.equal((await get(cross)).identity_status.state, "matched");
  assert.equal((await get(cross)).employee_id, existing);
  await setPolicy({ ...policy, enabled: false, rules: [rule] });
  const disabled = reg(identity("004444"));
  await register(disabled);
  assert.equal((await get(disabled)).identity_status.state, "disabled");
  await setPolicy({ ...policy, enabled: true });
  await register(disabled); // Registration replay keeps its original decision.
  assert.equal((await get(disabled)).identity_status.state, "disabled");
  assert.equal(
    (await report(disabled, identity("004444"))).json().data.state,
    "matched",
  );
  const unknown = reg({
    account_type: "unknown",
    domain: null,
    account_name: null,
    source: "unavailable",
  });
  await register(unknown);
  assert.equal((await get(unknown)).identity_status.state, "unknown");
  await setPolicy({
    ...policy,
    rules: [
      { ...rule, domain: "china", format: "alphanumeric", case: "lower" },
    ],
  });
  const mixedCase = reg(identity("AbC007", "china")),
    lowerCase = reg(identity("abc007"));
  await Promise.all([register(mixedCase), register(lowerCase)]);
  assert.equal(
    (await get(mixedCase)).employee_id,
    (await get(lowerCase)).employee_id,
  );
  assert.equal(
    (
      await db.pool.query("SELECT employee_no FROM employees WHERE id=$1", [
        (await get(mixedCase)).employee_id,
      ])
    ).rows[0].employee_no,
    "abc007",
  );
  // Organization-scoped foreign keys and matching do not share employee identities.
  const org2 = uuid();
  await db.pool.query(
    "INSERT INTO organizations(id,name) VALUES($1,'Other fixture')",
    [org2],
  );
  const key2 = uuid(),
    secret2 = "synthetic-other-tenant";
  await db.pool.query(
    "INSERT INTO org_settings(org_id,name,value) VALUES($1,'identity',$2)",
    [org2, { version: 1, enabled: true, auto_create: true, rules: [rule] }],
  );
  await db.pool.query(
    "INSERT INTO enrollment_keys(id,org_id,label,secret_hash,expires_at,max_registrations) VALUES($1,$2,'Tenant fixture',$3,now()+interval '1 hour',10)",
    [
      key2,
      org2,
      secretHash(secret2, "synthetic-identity-pepper-32-characters"),
    ],
  );
  const tenantDevice = reg(identity());
  // The primary organization's registration endpoint rejects another org's enrollment.
  await call("POST", "/v1/installations/register", tenantDevice, 401, {
    authorization: `Bearer enroll.${key2}.${secret2}`,
    "idempotency-key": tenantDevice.registration_id,
  });
  app2 = await createServer(db.pool, {
    org: org2,
    orgName: "Other fixture",
    pepper: "synthetic-identity-pepper-32-characters",
    origin,
    allowHttp: true,
  });
  const registered2 = await app2.inject({
    method: "POST",
    url: "/v1/installations/register",
    payload: tenantDevice,
    headers: {
      authorization: `Bearer enroll.${key2}.${secret2}`,
      "idempotency-key": tenantDevice.registration_id,
    },
  });
  assert.equal(registered2.statusCode, 201, registered2.body);
  const tenantResult = (await report(tenantDevice, identity())).json().data;
  assert.notEqual(tenantResult.employee_id, employee.id);
  assert.equal(tenantResult.state, "matched");
  await call(
    "GET",
    "/v1/admin/installations/" + tenantDevice.installation_id,
    undefined,
    404,
  );
  const otherEmployee = (
    await db.pool.query("SELECT * FROM employees WHERE id=$1", [
      tenantResult.employee_id,
    ])
  ).rows[0];
  assert.equal(otherEmployee.org_id, org2);
  assert.equal(otherEmployee.employee_no, "001234");
  await assert.rejects(
    transaction(db.pool, (c) =>
      c.query(
        "INSERT INTO employee_domain_accounts(org_id,domain,account_name,employee_id) VALUES($1,$2,$3,$4)",
        [org2, "CHINA", "999995", employee.id],
      ),
    ),
    (e) => e.code === "23503",
  );
  assert.equal(
    (
      await db.pool.query(
        "SELECT count(*)::int AS n FROM installation_bindings WHERE source='domain' AND lower(valid_days)<>(now() AT TIME ZONE 'Asia/Shanghai')::date",
      )
    ).rows[0].n,
    0,
  );
  console.log(
    "Identity HTTP + disposable PostgreSQL passed: concurrent/replayed registration, existing/new employees, leading zeros, multiple domains, legacy identity update, local/unknown domains, invalid account, manual priority, archived employees, policy updates and tenant constraints.",
  );
} finally {
  if (app) await app.close();
  if (app2) await app2.close();
  await db.close();
}
