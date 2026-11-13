import {
  ApiError,
  one,
  uuid,
  digest,
  secretHash,
  sameHash,
  validate,
  validateSchema,
  spec,
} from "./core.mjs";
import {
  defaultPolicy,
  validateEventBusiness,
  dayOf,
  splitDays,
} from "../../../packages/contracts/telemetry.mjs";
export async function getPolicy(c, org) {
  return (
    (
      await c.query(
        "SELECT value FROM org_settings WHERE org_id=$1 AND name='sync'",
        [org],
      )
    ).rows[0]?.value ?? defaultPolicy
  );
}
const future = (days) => new Date(Date.now() + days * 86400000);
export async function register(c, body, req, config) {
  if (req.headers["idempotency-key"] !== body.registration_id)
    throw new ApiError(400, "VALIDATION_ERROR");
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    config.org + body.registration_id,
  ]);
  const old = (
    await c.query(
      "SELECT * FROM installations WHERE org_id=$1 AND registration_id=$2 FOR UPDATE",
      [config.org, body.registration_id],
    )
  ).rows[0];
  let cred;
  if (old) {
    if (!sameHash(old.registration_hash, digest(body)))
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT");
    cred = await one(
      c,
      "SELECT * FROM installation_credentials WHERE org_id=$1 AND id=$2",
      [old.org_id, body.credential.credential_id],
    );
    if (old.status === "revoked" || cred.revoked_at)
      throw new ApiError(403, "INSTALLATION_REVOKED");
  } else {
    const parts = String(req.headers.authorization ?? "").split(".");
    if (
      parts.length !== 3 ||
      parts[0] !== "Bearer enroll" ||
      !/^[0-9a-f-]{36}$/i.test(parts[1])
    )
      throw new ApiError(401, "AUTH_REQUIRED");
    const key = await one(
      c,
      "SELECT * FROM enrollment_keys WHERE org_id=$1 AND id=$2 FOR UPDATE",
      [config.org, parts[1]],
      401,
    );
    if (
      !sameHash(key.secret_hash, secretHash(parts[2], config.pepper)) ||
      key.revoked_at ||
      new Date(key.expires_at) <= new Date() ||
      key.used_registrations >= key.max_registrations
    )
      throw new ApiError(403, "ENROLLMENT_INVALID");
    await c.query(
      "INSERT INTO installations(id,org_id,registration_id,registration_hash,windows_username,device_label,app_version,sdk_version,capabilities) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        body.installation_id,
        config.org,
        body.registration_id,
        digest(body),
        body.windows_username,
        body.device_label,
        body.app_version,
        body.sdk_version,
        body.capabilities,
      ],
    );
    const expiry = future(90);
    await c.query(
      "INSERT INTO installation_credentials(id,org_id,installation_id,rotation_id,secret_hash,expires_at,valid_until) VALUES($1,$2,$3,$4,$5,$6,$6)",
      [
        body.credential.credential_id,
        config.org,
        body.installation_id,
        body.registration_id,
        secretHash(body.credential.secret, config.pepper),
        expiry,
      ],
    );
    await c.query(
      "UPDATE enrollment_keys SET used_registrations=used_registrations+1,revision=revision+1 WHERE id=$1",
      [key.id],
    );
    cred = { expires_at: expiry };
  }
  const bound = (
    await c.query(
      "SELECT 1 FROM installation_bindings WHERE org_id=$1 AND installation_id=$2 AND valid_days @> (now() AT TIME ZONE 'Asia/Shanghai')::date",
      [config.org, body.installation_id],
    )
  ).rowCount;
  return {
    installation_id: body.installation_id,
    status: bound ? "active" : "pending_identity",
    organization_name: config.orgName,
    credential_id: body.credential.credential_id,
    credential_expires_at: new Date(cred.expires_at).toISOString(),
    policy: await getPolicy(c, config.org),
  };
}
export async function rotate(c, b, ctx, req, config) {
  if (req.headers["idempotency-key"] !== b.rotation_id)
    throw new ApiError(400, "VALIDATION_ERROR");
  const installation = await one(
    c,
    "SELECT status FROM installations WHERE org_id=$1 AND id=$2 FOR UPDATE",
    [ctx.org, ctx.installation],
  );
  if (installation.status !== "active")
    throw new ApiError(403, "INSTALLATION_REVOKED");
  const old = (
    await c.query(
      "SELECT * FROM installation_credentials WHERE org_id=$1 AND installation_id=$2 AND rotation_id=$3",
      [ctx.org, ctx.installation, b.rotation_id],
    )
  ).rows[0];
  if (old) {
    if (
      old.id !== b.next_credential.credential_id ||
      !sameHash(
        old.secret_hash,
        secretHash(b.next_credential.secret, config.pepper),
      )
    )
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT");
    return {
      credential_id: old.id,
      expires_at: new Date(old.expires_at).toISOString(),
      previous_valid_until: new Date(
        new Date(old.created_at).getTime() + 86400000,
      ).toISOString(),
    };
  }
  const next = future(90),
    overlap = future(1);
  await c.query(
    "UPDATE installation_credentials SET valid_until=LEAST(valid_until,$3) WHERE org_id=$1 AND installation_id=$2",
    [ctx.org, ctx.installation, overlap],
  );
  await c.query(
    "INSERT INTO installation_credentials(id,org_id,installation_id,rotation_id,secret_hash,expires_at,valid_until) VALUES($1,$2,$3,$4,$5,$6,$6)",
    [
      b.next_credential.credential_id,
      ctx.org,
      ctx.installation,
      b.rotation_id,
      secretHash(b.next_credential.secret, config.pepper),
      next,
    ],
  );
  return {
    credential_id: b.next_credential.credential_id,
    expires_at: next.toISOString(),
    previous_valid_until: overlap.toISOString(),
  };
}
export async function enqueueDay(c, ctx, day) {
  await c.query(
    "INSERT INTO aggregation_jobs(id,org_id,installation_id,day) VALUES($1,$2,$3,$4) ON CONFLICT (org_id,installation_id,day) DO UPDATE SET requested_revision=aggregation_jobs.requested_revision+1,available_at=CASE WHEN aggregation_jobs.completed_revision=aggregation_jobs.requested_revision THEN now() ELSE aggregation_jobs.available_at END,updated_at=now()",
    [uuid(), ctx.org, ctx.installation, day],
  );
}
async function upsert(c, table, row, updates, guard = "") {
  const keys = Object.keys(row),
    vals = Object.values(row);
  await c.query(
    "INSERT INTO " +
      table +
      "(" +
      keys.join(",") +
      ") VALUES(" +
      keys.map((_, i) => "$" + (i + 1)).join(",") +
      ") ON CONFLICT (org_id,installation_id,id) DO UPDATE SET " +
      updates.map((k) => k + "=EXCLUDED." + k).join(",") +
      (guard ? " WHERE " + guard : ""),
    vals,
  );
}
export async function projectEvent(c, e, ctx) {
  const p = e.payload,
    base = { org_id: ctx.org, installation_id: ctx.installation },
    day = dayOf(e.occurred_at);
  await enqueueDay(c, ctx, day);
  if (e.event_type === "desktop.started") {
    await c.query(
      "INSERT INTO app_launches(org_id,installation_id,id,started_at,reason,app_version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [
        ctx.org,
        ctx.installation,
        e.app_launch_id,
        e.occurred_at,
        p.reason,
        e.app_version,
      ],
    );
  } else if (e.event_type === "desktop.activity") {
    const range = "[" + p.start_at + "," + p.end_at + ")",
      multi =
        "{" +
        p.active_ranges
          .map((r) => '["' + r.start_at + '","' + r.end_at + '")')
          .join(",") +
        "}";
    await c.query(
      "INSERT INTO activity_intervals(org_id,installation_id,event_id,span,active_ranges,runtime_ms,app_version) VALUES($1,$2,$3,$4::tstzrange,$5::tstzmultirange,$6,$7) ON CONFLICT DO NOTHING",
      [
        ctx.org,
        ctx.installation,
        e.event_id,
        range,
        multi,
        p.runtime_ms,
        e.app_version,
      ],
    );
    for (const part of splitDays(p.start_at, p.end_at))
      await enqueueDay(c, ctx, part.day);
  } else if (e.event_type === "query.submitted") {
    await c.query(
      "INSERT INTO queries(org_id,installation_id,id,command_id,accepted_at,source,trigger,status,revision,app_version) VALUES($1,$2,$3,$4,$5,$6,$7,'accepted',1,$8) ON CONFLICT DO NOTHING",
      [
        ctx.org,
        ctx.installation,
        p.query_id,
        p.command_id,
        p.accepted_at,
        p.source,
        p.trigger,
        e.app_version,
      ],
    );
    const latest = (
      await c.query(
        "SELECT payload->'payload' AS p FROM telemetry_events WHERE org_id=$1 AND installation_id=$2 AND event_type='query.updated' AND payload->'payload'->>'query_id'=$3 ORDER BY (payload->'payload'->>'revision')::integer DESC LIMIT 1",
        [ctx.org, ctx.installation, p.query_id],
      )
    ).rows[0]?.p;
    if (latest) await updateQuery(c, latest, ctx);
    await enqueueDay(c, ctx, dayOf(p.accepted_at));
  } else if (e.event_type === "query.updated") {
    await updateQuery(c, p, ctx);
  } else if (
    e.event_type === "model.started" ||
    e.event_type === "model.finished"
  ) {
    const finished = e.event_type === "model.finished",
      id = finished ? p.id : p.call_id;
    const old = (
      await c.query(
        "SELECT COALESCE(finished_at,started_at) AS at FROM model_calls WHERE org_id=$1 AND installation_id=$2 AND id=$3",
        [ctx.org, ctx.installation, id],
      )
    ).rows[0];
    const row = {
      ...base,
      id,
      query_id: p.query_id,
      run_id: p.run_id,
      provider: p.provider,
      model: p.model,
      source: p.source,
      status: finished ? p.status : "running",
      started_at: p.started_at,
      finished_at: finished ? p.finished_at : null,
      duration_ms: finished ? p.duration_ms : null,
      usage_status: finished ? p.usage_status : "unavailable",
      input_tokens: finished ? p.input_tokens : null,
      output_tokens: finished ? p.output_tokens : null,
      cache_read_tokens: finished ? p.cache_read_tokens : null,
      cache_write_tokens: finished ? p.cache_write_tokens : null,
      total_tokens: finished ? p.total_tokens : null,
      app_version: e.app_version,
    };
    await upsert(
      c,
      "model_calls",
      row,
      Object.keys(row).filter(
        (k) => !["org_id", "installation_id", "id"].includes(k),
      ),
      finished ? "" : "model_calls.status='running'",
    );
    if (old) await enqueueDay(c, ctx, dayOf(old.at));
    await enqueueDay(c, ctx, dayOf(p.finished_at ?? p.started_at));
  } else if (e.event_type === "file.changed") {
    const run = p.run_id
      ? (
          await c.query(
            "SELECT source FROM runs WHERE org_id=$1 AND installation_id=$2 AND id=$3",
            [ctx.org, ctx.installation, p.run_id],
          )
        ).rows[0]
      : null;
    const row = {
      ...base,
      id: p.operation_id,
      query_id: p.query_id,
      run_id: p.run_id,
      tool_call_id: p.tool_call_id,
      file_key: p.file_key,
      language: p.language,
      file_category: p.file_category,
      kind: p.kind,
      added_lines: p.added_lines,
      deleted_lines: p.deleted_lines,
      measurement_status: p.measurement_status,
      occurred_at: e.occurred_at,
      source: run?.source ?? "system",
      app_version: e.app_version,
    };
    await upsert(c, "file_changes", row, ["id"]);
  } else if (
    e.event_type === "run.started" ||
    e.event_type === "run.finished"
  ) {
    const events = (
      await c.query(
        "SELECT event_type,payload->'payload' AS p FROM telemetry_events WHERE org_id=$1 AND installation_id=$2 AND event_type IN ('run.started','run.finished') AND payload->'payload'->>'run_id'=$3 ORDER BY occurred_at",
        [ctx.org, ctx.installation, p.run_id],
      )
    ).rows;
    const a = events.find((x) => x.event_type === "run.started")?.p,
      b = events.find((x) => x.event_type === "run.finished")?.p;
    if (a) {
      const row = {
        ...base,
        id: p.run_id,
        query_id: a.query_id,
        parent_run_id: a.parent_run_id,
        source: a.source,
        started_at: a.started_at,
        finished_at: b?.finished_at ?? null,
        status: b?.outcome ?? "running",
        duration_ms: b?.duration_ms ?? null,
        waiting_ms: b?.waiting_ms ?? null,
        app_version: e.app_version,
      };
      await upsert(
        c,
        "runs",
        row,
        Object.keys(row).filter(
          (k) => !["org_id", "installation_id", "id"].includes(k),
        ),
      );
      await c.query(
        "UPDATE file_changes SET source=$4 WHERE org_id=$1 AND installation_id=$2 AND run_id=$3",
        [ctx.org, ctx.installation, p.run_id, a.source],
      );
      for (const r of (
        await c.query(
          "SELECT DISTINCT (occurred_at AT TIME ZONE 'Asia/Shanghai')::date::text AS day FROM file_changes WHERE org_id=$1 AND installation_id=$2 AND run_id=$3",
          [ctx.org, ctx.installation, p.run_id],
        )
      ).rows)
        await enqueueDay(c, ctx, r.day);
      await enqueueDay(c, ctx, dayOf(a.started_at));
      if (b?.finished_at)
        for (const part of splitDays(a.started_at, b.finished_at))
          await enqueueDay(c, ctx, part.day);
    }
  } else if (e.event_type === "client.health") {
    await c.query(
      "UPDATE installations SET reported_queue_events=$3 WHERE org_id=$1 AND id=$2",
      [ctx.org, ctx.installation, p.queue_events],
    );
    for (const code of [
      ...p.codes,
      ...(p.dropped_events !== "0" ? ["DATA_LOSS"] : []),
      ...(p.quarantined_events !== "0" ? ["QUARANTINED"] : []),
    ])
      await quality(c, ctx, day, code);
  }
}
async function updateQuery(c, p, ctx) {
  const r = (
    await c.query(
      "SELECT * FROM queries WHERE org_id=$1 AND installation_id=$2 AND id=$3 FOR UPDATE",
      [ctx.org, ctx.installation, p.query_id],
    )
  ).rows[0];
  if (!r) return;
  if (
    r.revision === p.revision &&
    r.status !== p.status &&
    r.status !== "accepted"
  )
    throw new ApiError(409, "EVENT_CONFLICT");
  const terminal = ["completed", "failed", "cancelled", "interrupted"];
  if (
    p.revision > r.revision &&
    terminal.includes(r.status) &&
    r.status !== p.status
  )
    throw new ApiError(409, "EVENT_CONFLICT");
  if (
    p.revision >= r.revision &&
    (!terminal.includes(r.status) || r.status === p.status)
  )
    await c.query(
      "UPDATE queries SET status=$4,revision=$5 WHERE org_id=$1 AND installation_id=$2 AND id=$3",
      [ctx.org, ctx.installation, p.query_id, p.status, p.revision],
    );
  await enqueueDay(c, ctx, dayOf(r.accepted_at));
}
export async function quality(c, ctx, day, code) {
  await c.query(
    "INSERT INTO data_quality_daily(org_id,installation_id,day,code,event_count,last_observed_at) VALUES($1,$2,$3,$4,1,now()) ON CONFLICT(org_id,installation_id,day,code) DO UPDATE SET event_count=data_quality_daily.event_count+1,last_observed_at=now()",
    [ctx.org, ctx.installation, day, code],
  );
}
export async function ingest(c, b, ctx) {
  if (
    !b ||
    typeof b !== "object" ||
    Object.keys(b).some(
      (k) =>
        ![
          "batch_id",
          "protocol_version",
          "client_sent_at",
          "policy_version",
          "events",
        ].includes(k),
    ) ||
    b.protocol_version !== "1.0" ||
    !Array.isArray(b.events) ||
    !b.events.length ||
    b.events.length > 500 ||
    new Set(b.events.map((e) => e?.event_id)).size !== b.events.length
  )
    throw new ApiError(400, "PROTOCOL_INVALID");
  validateSchema(
    {
      ...spec.components.schemas.BatchInput,
      properties: {
        ...spec.components.schemas.BatchInput.properties,
        events: { type: "array", minItems: 1, maxItems: 500 },
      },
    },
    b,
  );
  const ids = b.events.map((e) => e?.event_id);
  if (
    ids.some(
      (x) =>
        typeof x !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          x,
        ),
    )
  )
    throw new ApiError(400, "PROTOCOL_INVALID");
  // Per-installation transaction lock serializes duplicate concurrent batches and revocation.
  const installation = await one(
    c,
    "SELECT status FROM installations WHERE org_id=$1 AND id=$2 FOR UPDATE",
    [ctx.org, ctx.installation],
  );
  if (installation.status !== "active")
    throw new ApiError(403, "INSTALLATION_REVOKED");
  const out = {
    accepted_event_ids: [],
    duplicate_event_ids: [],
    rejected_events: [],
    retry_after_seconds: null,
    policy: await getPolicy(c, ctx.org),
    credential_rotation_due:
      new Date(ctx.credential.expires_at).getTime() - Date.now() < 7 * 86400000,
  };
  for (const e of b.events) {
    const hash = digest(e),
      old = (
        await c.query(
          "SELECT * FROM event_receipts WHERE org_id=$1 AND installation_id=$2 AND event_id=$3",
          [ctx.org, ctx.installation, e.event_id],
        )
      ).rows[0];
    if (old && sameHash(old.content_hash, hash)) {
      out.duplicate_event_ids.push(e.event_id);
      continue;
    }
    await c.query("SAVEPOINT event_write");
    try {
      if (old) throw new Error("EVENT_CONFLICT");
      validate("TelemetryEvent", e);
      validateEventBusiness(e);
      const entityField = {
        "desktop.opened": "activation_id",
        "query.submitted": "query_id",
        "model.started": "call_id",
        "model.finished": "id",
        "run.started": "run_id",
        "run.finished": "run_id",
        "file.changed": "operation_id",
      }[e.event_type];
      if (
        entityField &&
        (
          await c.query(
            "SELECT 1 FROM telemetry_events WHERE org_id=$1 AND installation_id=$2 AND event_type=$3 AND payload->'payload' @> $4::jsonb LIMIT 1",
            [
              ctx.org,
              ctx.installation,
              e.event_type,
              JSON.stringify({ [entityField]: e.payload[entityField] }),
            ],
          )
        ).rowCount
      )
        throw new Error("EVENT_CONFLICT");
      if (
        e.event_type === "desktop.started" &&
        (
          await c.query(
            "SELECT 1 FROM app_launches WHERE org_id=$1 AND installation_id=$2 AND id=$3",
            [ctx.org, ctx.installation, e.app_launch_id],
          )
        ).rowCount
      )
        throw new Error("EVENT_CONFLICT");
      const clash = (
        await c.query(
          "SELECT 1 FROM event_receipts WHERE org_id=$1 AND installation_id=$2 AND (event_seq=$3 OR source_key_hash=$4)",
          [ctx.org, ctx.installation, e.event_seq, digest(e.source_key)],
        )
      ).rowCount;
      if (clash) throw new Error("EVENT_CONFLICT");
      const received = new Date();
      await c.query(
        "INSERT INTO event_receipts(org_id,installation_id,event_id,event_seq,source_key_hash,content_hash,received_at,occurred_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          ctx.org,
          ctx.installation,
          e.event_id,
          e.event_seq,
          digest(e.source_key),
          hash,
          received,
          e.occurred_at,
          future(90),
        ],
      );
      await c.query(
        "INSERT INTO telemetry_events(org_id,installation_id,event_id,received_at,occurred_at,event_type,payload) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          ctx.org,
          ctx.installation,
          e.event_id,
          received,
          e.occurred_at,
          e.event_type,
          e,
        ],
      );
      await projectEvent(c, e, ctx);
      await c.query(
        "UPDATE installations SET last_received_at=$3,last_event_at=GREATEST(last_event_at,$4),app_version=$5 WHERE org_id=$1 AND id=$2",
        [ctx.org, ctx.installation, received, e.occurred_at, e.app_version],
      );
      out.accepted_event_ids.push(e.event_id);
      await c.query("RELEASE SAVEPOINT event_write");
    } catch (err) {
      await c.query("ROLLBACK TO SAVEPOINT event_write");
      if (err.code && /^[0-9A-Z]{5}$/.test(err.code)) throw err;
      const code = [
        "EVENT_TOO_OLD",
        "CLOCK_SUSPECT",
        "EVENT_CONFLICT",
      ].includes(err.message)
        ? err.message
        : "INVALID_EVENT";
      out.rejected_events.push({
        event_id: e.event_id,
        code,
        message: code,
        retryable: false,
      });
      await quality(c, ctx, dayOf(Date.now()), code);
    }
  }
  return out;
}
