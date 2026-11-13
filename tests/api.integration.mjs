import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { testDatabase } from "./support/postgres.mjs";
import { uuid, root, createPool } from "../apps/api/src/core.mjs";
import { passwordHash } from "../apps/api/src/auth.mjs";
import { createServer } from "../apps/api/src/server.mjs";
import { runAggregation } from "../apps/worker/src/aggregate.mjs";
import { runExports } from "../apps/api/src/exports.mjs";
import { maintain } from "../apps/worker/src/maintenance.mjs";
import { defaultPolicy, dayOf } from "../packages/contracts/telemetry.mjs";
const db = await testDatabase(),
  org = uuid(),
  admin = uuid(),
  now = Date.now(),
  today = dayOf(now),
  tomorrow = dayOf(now + 86400000);
const config = {
  org,
  orgName: "合成测试团队",
  pepper: "local-test-pepper-never-use-in-production",
  origin: "http://127.0.0.1:4318",
  development: true,
  exportDir: path.join(root, ".verification/exports"),
};
let app,
  session,
  csrf,
  device,
  seq = 0;
try {
  await db.pool.query(
    "INSERT INTO organizations(id,name) VALUES($1,'合成测试团队')",
    [org],
  );
  await db.pool.query(
    "INSERT INTO admin_accounts(id,org_id,username,display_name,password_hash,role,must_change_password) VALUES($1,$2,'admin','测试管理员',$3,'admin',false)",
    [admin, org, await passwordHash("Synthetic-password-123")],
  );
  await db.pool.query(
    "INSERT INTO org_settings(org_id,name,value) VALUES($1,'sync',$2),($1,'retention',$3)",
    [
      org,
      defaultPolicy,
      { raw_days: 90, daily_months: 24, audit_days: 365, revision: 1 },
    ],
  );
  app = await createServer(db.pool, config);
  async function call(method, url, payload, status = 200, extra = {}) {
    const response = await app.inject({
      method,
      url,
      payload,
      headers: {
        origin: config.origin,
        ...(session ? { cookie: session, "x-csrf-token": csrf } : {}),
        ...(method !== "GET" ? { "idempotency-key": uuid() } : {}),
        ...extra,
      },
    });
    assert.equal(response.statusCode, status, url + ": " + response.body);
    return response;
  }
  const login = await call("POST", "/v1/admin/auth/login", {
    username: "admin",
    password: "Synthetic-password-123",
  });
  session = login.headers["set-cookie"].split(";")[0];
  csrf = login.json().data.csrf_token;
  await call("GET", "/health/ready");
  await db.pool.query(
    "DELETE FROM schema_migrations WHERE name='0001_initial.sql'",
  );
  await call("GET", "/health/ready", undefined, 503);
  await db.pool.query(
    "INSERT INTO schema_migrations(name) VALUES('0001_initial.sql')",
  );
  const dept = (
    await call("POST", "/v1/admin/departments", { name: "研发部" }, 201)
  ).json().data;
  const employee = (
    await call(
      "POST",
      "/v1/admin/employees",
      { name: "合成人员甲", employee_no: "DEMO-001", department_id: dept.id },
      201,
    )
  ).json().data;
  const enrollment = (
    await call(
      "POST",
      "/v1/admin/enrollment-keys",
      {
        label: "自动测试",
        expires_at: new Date(now + 86400000).toISOString(),
        max_registrations: 2,
      },
      201,
    )
  ).json().data;
  const registration = {
    registration_id: uuid(),
    installation_id: uuid(),
    credential: { credential_id: uuid(), secret: "A".repeat(43) },
    windows_username: "demo-windows-user",
    device_label: "DEMO-PC",
    app_version: "0.5.11",
    sdk_version: "1",
    protocol_version: "1.0",
    capabilities: [
      "desktop_activity",
      "query",
      "model_usage",
      "file_write",
      "file_edit",
    ],
  };
  const rh = {
    authorization: "Bearer " + enrollment.secret,
    "idempotency-key": registration.registration_id,
  };
  await Promise.all([
    call("POST", "/v1/installations/register", registration, 201, rh),
    call("POST", "/v1/installations/register", registration, 201, rh),
  ]);
  assert.equal(
    (await db.pool.query("SELECT used_registrations FROM enrollment_keys"))
      .rows[0].used_registrations,
    1,
  );
  device =
    "Bearer pa1." +
    registration.credential.credential_id +
    "." +
    registration.credential.secret;
  await call(
    "POST",
    "/v1/admin/installations/" + registration.installation_id + "/bindings",
    {
      employee_id: employee.id,
      valid_from: today,
      valid_to: null,
      reason: "测试绑定",
      expected_revision: 1,
    },
    201,
  );
  const qid = uuid(),
    run = uuid(),
    model = uuid(),
    launch = uuid(),
    // Keep the ordinary daily fixture on one Shanghai day even at midnight.
    atMs = Math.max(
      now - 120000,
      Date.parse(today + "T00:00:00+08:00") + 60000,
    ),
    at = new Date(atMs).toISOString();
  const event = (event_type, payload, time = at) => ({
    event_id: uuid(),
    event_seq: String(++seq),
    source_key: "test:" + seq,
    event_type,
    occurred_at: time,
    app_launch_id: launch,
    app_version: "0.5.11",
    payload,
  });
  const rows = [
    event("desktop.started", { reason: "manual" }),
    event("desktop.opened", { activation_id: uuid(), reason: "manual_launch" }),
    event("desktop.activity", {
      start_at: new Date(atMs - 60000).toISOString(),
      end_at: at,
      runtime_ms: "60000",
      active_ranges: [
        { start_at: new Date(atMs - 60000).toISOString(), end_at: at },
      ],
      sample_interval_ms: 5000,
      time_quality: "synchronized",
    }),
    event("query.submitted", {
      query_id: qid,
      command_id: "command-demo",
      source: "chat",
      trigger: "human",
      accepted_at: at,
    }),
    event("query.updated", {
      query_id: qid,
      revision: 2,
      status: "running",
      run_id: run,
    }),
    event("run.started", {
      run_id: run,
      query_id: qid,
      parent_run_id: null,
      source: "chat",
      started_at: at,
    }),
    event("model.finished", {
      id: model,
      query_id: qid,
      run_id: run,
      provider: "synthetic",
      model: "demo-model",
      source: "chat",
      status: "completed",
      started_at: at,
      finished_at: new Date(atMs + 60000).toISOString(),
      duration_ms: "60000",
      usage_status: "reported",
      input_tokens: "1000",
      output_tokens: "300",
      cache_read_tokens: "200",
      cache_write_tokens: "0",
      total_tokens: "1500",
    }),
    event("file.changed", {
      operation_id: uuid(),
      run_id: run,
      query_id: qid,
      tool_call_id: "demo-tool",
      file_key: "a".repeat(64),
      language: "TypeScript",
      file_category: "code",
      kind: "created",
      added_lines: "42",
      deleted_lines: "0",
      measurement_status: "measured",
    }),
    event("run.finished", {
      run_id: run,
      outcome: "completed",
      duration_ms: "60000",
      waiting_ms: "0",
      finished_at: new Date(atMs + 60000).toISOString(),
    }),
    event("query.updated", {
      query_id: qid,
      revision: 3,
      status: "completed",
      run_id: run,
    }),
  ];
  const send = (events) =>
    call(
      "POST",
      "/v1/telemetry/batches",
      {
        batch_id: uuid(),
        protocol_version: "1.0",
        client_sent_at: new Date().toISOString(),
        policy_version: 1,
        events,
      },
      200,
      { authorization: device },
    );
  const first = (await send(rows)).json().data;
  assert.equal(first.accepted_event_ids.length, rows.length);
  assert.equal(first.rejected_events.length, 0);
  const second = (await send(rows)).json().data;
  assert.equal(second.duplicate_event_ids.length, rows.length);
  const terminalConflict = event("query.updated", {
    query_id: qid,
    revision: 4,
    status: "failed",
    run_id: run,
  });
  assert.equal(
    (await send([terminalConflict])).json().data.rejected_events[0].code,
    "EVENT_CONFLICT",
  );
  const conflict = structuredClone(rows[0]);
  conflict.payload.reason = "update";
  assert.equal(
    (await send([conflict])).json().data.rejected_events[0].code,
    "EVENT_CONFLICT",
  );
  const bad = event("desktop.opened", {
    activation_id: uuid(),
    reason: "tray",
    prompt: "must never be accepted",
  });
  assert.equal(
    (await send([bad])).json().data.rejected_events[0].code,
    "INVALID_EVENT",
  );
  await runAggregation(db.pool);
  const query = "?from=" + today + "&to=" + tomorrow;
  const overview = (
    await call("GET", "/v1/admin/analytics/overview" + query)
  ).json().data;
  assert.equal(overview.metrics.queries, "1");
  assert.equal(overview.metrics.opens, "1");
  assert.equal(overview.metrics.total_tokens, "1500");
  assert.equal(overview.metrics.added_lines, "42");
  assert.equal(overview.metrics.active_ms, "60000");
  const listed = (
    await call("GET", "/v1/admin/analytics/queries" + query)
  ).json().data;
  assert.equal(listed.items[0].metrics.total_tokens, "1500");
  assert.equal(listed.items[0].metrics.model_calls, "1");
  await call(
    "GET",
    "/v1/admin/analytics/employees/daily" + query + "&sort=invalid",
    undefined,
    400,
  );
  await call(
    "GET",
    "/v1/admin/analytics/overview?from=2026-02-30&to=2026-03-03",
    undefined,
    400,
  );
  await call("POST", "/v1/admin/departments", { name: "CSRF must fail" }, 403, {
    "x-csrf-token": "invalid",
  });
  const lateStart = event("model.started", {
    call_id: model,
    query_id: qid,
    run_id: run,
    provider: "synthetic",
    model: "demo-model",
    source: "chat",
    started_at: at,
  });
  await send([lateStart]);
  await runAggregation(db.pool);
  assert.equal(
    (await call("GET", "/v1/admin/analytics/overview" + query)).json().data
      .metrics.total_tokens,
    "1500",
  );
  const duplicateEntity = event("file.changed", {
    ...rows[7].payload,
    added_lines: "999",
  });
  assert.equal(
    (await send([duplicateEntity])).json().data.rejected_events[0].code,
    "EVENT_CONFLICT",
  );
  const unknown = event("model.finished", {
    ...rows[6].payload,
    id: uuid(),
    usage_status: "unavailable",
    input_tokens: null,
    output_tokens: null,
    cache_read_tokens: null,
    cache_write_tokens: null,
    total_tokens: null,
  });
  const racing = await Promise.all([send([unknown]), send([unknown])]);
  assert.equal(
    racing.reduce((n, r) => n + r.json().data.accepted_event_ids.length, 0),
    1,
  );
  assert.equal(
    racing.reduce((n, r) => n + r.json().data.duplicate_event_ids.length, 0),
    1,
  );
  const stale = event("query.submitted", {
    query_id: uuid(),
    command_id: "bad-time",
    source: "chat",
    trigger: "human",
    accepted_at: new Date(now + 3600000).toISOString(),
  });
  assert.equal(
    (await send([stale])).json().data.rejected_events[0].code,
    "CLOCK_SUSPECT",
  );
  const secondRegistration = {
    ...registration,
    registration_id: uuid(),
    installation_id: uuid(),
    credential: { credential_id: uuid(), secret: "C".repeat(43) },
  };
  await call("POST", "/v1/installations/register", secondRegistration, 201, {
    authorization: "Bearer " + enrollment.secret,
    "idempotency-key": secondRegistration.registration_id,
  });
  await call(
    "POST",
    "/v1/admin/installations/" +
      secondRegistration.installation_id +
      "/bindings",
    {
      employee_id: employee.id,
      valid_from: today,
      valid_to: null,
      reason: "第二台测试设备",
      expected_revision: 1,
    },
    201,
  );
  await call(
    "POST",
    "/v1/telemetry/batches",
    {
      batch_id: uuid(),
      protocol_version: "1.0",
      client_sent_at: new Date().toISOString(),
      policy_version: 1,
      events: [
        {
          ...rows[2],
          event_id: uuid(),
          event_seq: "1",
          source_key: "second-device:activity",
        },
      ],
    },
    200,
    {
      authorization:
        "Bearer pa1." +
        secondRegistration.credential.credential_id +
        "." +
        secondRegistration.credential.secret,
    },
  );
  await runAggregation(db.pool);
  const multi = (
    await call("GET", "/v1/admin/analytics/overview" + query)
  ).json();
  assert.equal(multi.data.active_employees, "1");
  assert.equal(multi.data.metrics.active_ms, "60000");
  assert.equal(multi.data.metrics.runtime_ms, "120000");
  assert.equal(multi.data.metrics.total_tokens, "1500");
  assert.equal(multi.meta.coverage.unknown_model_calls, "1");
  const secondDept = (
    await call("POST", "/v1/admin/departments", { name: "另一个部门" }, 201)
  ).json().data;
  assert.equal(
    (
      await call(
        "GET",
        "/v1/admin/analytics/health" +
          query +
          "&department_ids=" +
          secondDept.id,
      )
    ).json().data.installations.length,
    0,
  );
  const quiet = (
    await call(
      "POST",
      "/v1/admin/employees",
      {
        name: "无报告历史部门",
        employee_no: null,
        department_id: dept.id,
      },
      201,
    )
  ).json().data;
  await call("PATCH", "/v1/admin/employees/" + quiet.id, {
    name: quiet.name,
    employee_no: null,
    department_id: secondDept.id,
    effective_from: tomorrow,
    expected_revision: quiet.revision,
  });
  const quietDaily = (
    await call(
      "GET",
      "/v1/admin/analytics/employees/daily?from=" +
        today +
        "&to=" +
        dayOf(now + 2 * 86400000) +
        "&employee_ids=" +
        quiet.id,
    )
  ).json().data.items;
  assert.equal(quietDaily.find((r) => r.date === today).department_id, dept.id);
  assert.equal(
    quietDaily.find((r) => r.date === tomorrow).department_id,
    secondDept.id,
  );
  assert(quietDaily.every((r) => r.coverage.state === "not_enrolled"));
  assert.equal(
    (
      await call(
        "GET",
        "/v1/admin/analytics/queries" +
          query +
          "&department_ids=" +
          secondDept.id,
      )
    ).json().data.total,
    "0",
  );
  const page = (await call("GET", "/v1/admin/departments?limit=1")).json().data;
  assert(page.next_cursor);
  await call(
    "GET",
    "/v1/admin/employees?limit=1&cursor=" +
      encodeURIComponent(page.next_cursor),
    undefined,
    400,
  );
  for (const endpoint of [
    "trends",
    "employees/daily",
    "employees/" + employee.id,
    "models",
    "code",
    "health",
    "queries",
    "queries/" + qid,
    "queries/" + qid + "/calls",
    "queries/" + qid + "/file-changes",
  ])
    await call("GET", "/v1/admin/analytics/" + endpoint + query);
  await call("GET", "/v1/admin/analytics/catalog");
  const exp = (
    await call(
      "POST",
      "/v1/admin/exports",
      {
        kind: "employee_daily",
        from: today,
        to: tomorrow,
        employee_ids: [],
        department_ids: [],
        app_versions: [],
      },
      202,
    )
  ).json().data;
  await runExports(db.pool, config);
  await call("GET", "/v1/admin/exports/" + exp.id);
  const download = await call(
    "GET",
    "/v1/admin/exports/" + exp.id + "/download",
  );
  assert.match(download.body, /合成人员甲/);
  // Exercise both sides of a completed Shanghai day in actual HTTP handlers.
  // PostgreSQL must not interpret a bare DATE through its session timezone.
  const boundaryDay = dayOf(now - 3 * 86400000);
  const dayStart = Date.parse(boundaryDay + "T00:00:00+08:00");
  const dayEnd = dayStart + 86400000;
  const boundaryIds = [uuid(), uuid(), uuid(), uuid()];
  const boundaryEvents = [dayStart - 1, dayStart, dayEnd - 1, dayEnd].map(
    (time, index) => {
      const accepted = new Date(time).toISOString();
      return event(
        "query.submitted",
        {
          query_id: boundaryIds[index],
          command_id: "timezone-boundary-" + index,
          source: "chat",
          trigger: "human",
          accepted_at: accepted,
        },
        accepted,
      );
    },
  );
  assert.equal(
    (await send(boundaryEvents)).json().data.accepted_event_ids.length,
    4,
  );
  const boundaryQuery = "?from=" + boundaryDay + "&to=" + dayOf(dayEnd);
  for (const [index, boundary] of boundaryEvents.entries())
    await db.pool.query(
      "INSERT INTO audit_logs(id,org_id,actor_id,action,target_type,target_id,summary,request_id,occurred_at) VALUES($1,$2,$3,'timezone-fixture','organization',$2,'synthetic boundary',$4,$5)",
      [boundaryIds[index], org, admin, uuid(), boundary.occurred_at],
    );
  for (const timezone of ["UTC", "Asia/Shanghai", "America/New_York"]) {
    const url = new URL(db.url);
    url.searchParams.set("options", "-c timezone=" + timezone);
    const timezonePool = createPool(url.toString());
    const originalApp = app;
    try {
      app = await createServer(timezonePool, config);
      const result = (
        await call("GET", "/v1/admin/analytics/queries" + boundaryQuery)
      ).json().data;
      assert.deepEqual(
        result.items.map((row) => row.id),
        [boundaryIds[2], boundaryIds[1]],
        timezone + ": Shanghai [from,to) boundaries",
      );
      const audit = (
        await call("GET", "/v1/admin/audit-logs" + boundaryQuery)
      ).json().data;
      assert.deepEqual(
        audit.items.map((row) => row.id),
        [boundaryIds[2], boundaryIds[1]],
        timezone + ": audit uses the same day boundaries",
      );
      for (const suffix of ["", "/calls", "/file-changes"])
        await call(
          "GET",
          "/v1/admin/analytics/queries/" +
            boundaryIds[1] +
            suffix +
            boundaryQuery,
        );
      await call(
        "GET",
        "/v1/admin/analytics/queries/" + boundaryIds[3] + boundaryQuery,
        undefined,
        404,
      );
    } finally {
      if (app !== originalApp) await app.close();
      app = originalApp;
      await timezonePool.end();
    }
  }
  const midnight = Date.parse(dayOf(now - 86400000) + "T00:00:00+08:00");
  const crossing = event(
    "desktop.activity",
    {
      start_at: new Date(midnight - 5000).toISOString(),
      end_at: new Date(midnight + 5000).toISOString(),
      runtime_ms: "2501",
      active_ranges: [],
      sample_interval_ms: 5000,
      time_quality: "synchronized",
    },
    new Date(midnight + 5000).toISOString(),
  );
  assert.equal(
    (await send([crossing])).json().data.accepted_event_ids.length,
    1,
  );
  await runAggregation(db.pool);
  const crossingDays = (
    await db.pool.query(
      "SELECT day::text,runtime_ms FROM installation_daily_activity WHERE org_id=$1 AND installation_id=$2 AND day<$3::date ORDER BY day",
      [org, registration.installation_id, today],
    )
  ).rows;
  assert.deepEqual(
    crossingDays.map((r) => r.runtime_ms),
    ["1250", "1251"],
  );
  const rotation = {
    rotation_id: uuid(),
    next_credential: { credential_id: uuid(), secret: "B".repeat(43) },
  };
  await call("POST", "/v1/installations/credentials/rotate", rotation, 200, {
    authorization: device,
    "idempotency-key": rotation.rotation_id,
  });
  await call("POST", "/v1/installations/credentials/rotate", rotation, 200, {
    authorization: device,
    "idempotency-key": rotation.rotation_id,
  });
  await maintain(db.pool, config);
  const changed = await call("POST", "/v1/admin/auth/change-password", {
    current_password: "Synthetic-password-123",
    new_password: "Changed-synthetic-123",
  });
  const oldSession = session;
  session = changed.headers["set-cookie"].split(";")[0];
  const renewed = (await call("GET", "/v1/admin/auth/session")).json().data;
  csrf = renewed.csrf_token;
  await call("GET", "/v1/admin/auth/session", undefined, 401, {
    cookie: oldSession,
  });
  const viewer = (
    await call(
      "POST",
      "/v1/admin/accounts",
      {
        username: "viewer",
        display_name: "只读测试",
        role: "viewer",
        temporary_password: "Synthetic-viewer-123",
      },
      201,
    )
  ).json().data;
  await db.pool.query(
    "UPDATE admin_accounts SET must_change_password=false WHERE id=$1",
    [viewer.id],
  );
  const vl = await call("POST", "/v1/admin/auth/login", {
    username: "viewer",
    password: "Synthetic-viewer-123",
  });
  session = vl.headers["set-cookie"].split(";")[0];
  csrf = vl.json().data.csrf_token;
  await call("POST", "/v1/admin/departments", { name: "禁止创建" }, 403);
  await call("GET", "/v1/admin/settings/sync", undefined, 403);
  await call("GET", "/v1/admin/analytics/overview" + query);
  console.log(
    "HTTP + PostgreSQL integration passed: authentication/RBAC, registration replay, binding, ingest/dedup/rejection, aggregation, all reports, CSV export, credential rotation.",
  );
  fs.mkdirSync(path.join(root, ".verification"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".verification/api-result.json"),
    JSON.stringify(
      {
        passed: true,
        time: new Date().toISOString(),
        metrics: overview.metrics,
      },
      null,
      2,
    ),
  );
} finally {
  if (app) await app.close();
  await db.close();
}
