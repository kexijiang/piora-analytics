import { transaction, uuid } from "../../api/src/core.mjs";
import {
  emptyMetrics,
  emptyCoverage,
  tokenNames,
  splitDays,
  dayOf,
} from "../../../packages/contracts/telemetry.mjs";
const metricColumns = [
  "queries",
  "completed_queries",
  "failed_queries",
  "cancelled_queries",
  "interrupted_queries",
  "pending_queries",
  "opens",
  "launches",
  "unknown_task_runs",
  "model_calls",
  "added_lines",
  "deleted_lines",
  "files_created",
  "file_operations",
  "known_model_calls",
  "unknown_model_calls",
  "measured_file_operations",
  "unmeasured_file_operations",
  "task_ms",
  ...tokenNames,
];
const bump = (o, k, n = 1) => {
  o[k] = (BigInt(o[k] ?? 0) + BigInt(n)).toString();
};
async function insert(c, table, row) {
  const keys = Object.keys(row);
  await c.query(
    "INSERT INTO " +
      table +
      "(" +
      keys.join(",") +
      ") VALUES(" +
      keys.map((_, i) => "$" + (i + 1)).join(",") +
      ")",
    Object.values(row),
  );
}
export async function aggregateDay(c, job) {
  const org = job.org_id,
    inst = job.installation_id,
    day = typeof job.day === "string" ? job.day.slice(0, 10) : dayOf(job.day),
    start = day + "T00:00:00+08:00",
    end = new Date(Date.parse(start) + 86400000).toISOString();
  const groups = new Map(),
    models = new Map(),
    files = new Map(),
    queryModels = new Map();
  const group = (source, version) => {
    const k = source + "|" + version;
    if (!groups.has(k))
      groups.set(k, {
        org_id: org,
        installation_id: inst,
        day,
        source,
        app_version: version,
        ...emptyMetrics(),
        ...emptyCoverage(),
        quality_codes: [],
      });
    return groups.get(k);
  };
  const params = [org, inst, start, end];
  const queries = (
    await c.query(
      "SELECT * FROM queries WHERE org_id=$1 AND installation_id=$2 AND accepted_at >= $3 AND accepted_at < $4 AND trigger='human'",
      params,
    )
  ).rows;
  for (const q of queries) {
    const g = group(q.source, q.app_version);
    bump(g, "queries");
    bump(
      g,
      ["completed", "failed", "cancelled", "interrupted"].includes(q.status)
        ? q.status + "_queries"
        : "pending_queries",
    );
  }
  const calls = (
    await c.query(
      "SELECT m.*,q.trigger FROM model_calls m LEFT JOIN queries q ON q.org_id=m.org_id AND q.installation_id=m.installation_id AND q.id=m.query_id WHERE m.org_id=$1 AND m.installation_id=$2 AND COALESCE(m.finished_at,m.started_at)>=$3 AND COALESCE(m.finished_at,m.started_at)<$4",
      params,
    )
  ).rows;
  for (const m of calls) {
    const g = group(m.source, m.app_version);
    bump(g, "model_calls");
    bump(
      g,
      m.usage_status === "reported"
        ? "known_model_calls"
        : "unknown_model_calls",
    );
    for (const k of tokenNames) if (m[k] !== null) bump(g, k, m[k]);
    const key = [m.source, m.app_version, m.provider, m.model].join("|");
    if (!models.has(key))
      models.set(key, {
        org_id: org,
        installation_id: inst,
        day,
        source: m.source,
        app_version: m.app_version,
        provider: m.provider,
        model: m.model,
        calls: "0",
        failed_calls: "0",
        known_calls: "0",
        unknown_calls: "0",
        duration_ms: "0",
        ...Object.fromEntries(tokenNames.map((k) => [k, null])),
        aggregated_at: new Date(),
      });
    const v = models.get(key);
    bump(v, "calls");
    if (m.status === "failed") bump(v, "failed_calls");
    bump(v, m.usage_status === "reported" ? "known_calls" : "unknown_calls");
    if (m.duration_ms !== null) bump(v, "duration_ms", m.duration_ms);
    for (const k of tokenNames) if (m[k] !== null) bump(v, k, m[k]);
    if (m.query_id && m.trigger === "human")
      queryModels.set(key + "|" + m.query_id, {
        org_id: org,
        installation_id: inst,
        day,
        source: m.source,
        app_version: m.app_version,
        provider: m.provider,
        model: m.model,
        query_id: m.query_id,
      });
  }
  const changes = (
    await c.query(
      "SELECT * FROM file_changes WHERE org_id=$1 AND installation_id=$2 AND occurred_at>=$3 AND occurred_at<$4",
      params,
    )
  ).rows;
  for (const f of changes) {
    const g = group(f.source, f.app_version);
    bump(g, "file_operations");
    bump(
      g,
      f.measurement_status === "measured"
        ? "measured_file_operations"
        : "unmeasured_file_operations",
    );
    if (f.measurement_status === "measured" && f.file_category === "code") {
      bump(g, "added_lines", f.added_lines);
      bump(g, "deleted_lines", f.deleted_lines);
      if (f.kind === "created") bump(g, "files_created");
    }
    const key = [f.source, f.app_version, f.file_key].join("|");
    if (!files.has(key))
      files.set(key, {
        org_id: org,
        installation_id: inst,
        day,
        source: f.source,
        app_version: f.app_version,
        file_key: f.file_key,
        language: f.language,
        file_category: f.file_category,
        added_lines: "0",
        deleted_lines: "0",
        files_created: "0",
        measured_operations: "0",
        unmeasured_operations: "0",
      });
    const v = files.get(key);
    if (f.measurement_status === "measured") {
      bump(v, "added_lines", f.added_lines);
      bump(v, "deleted_lines", f.deleted_lines);
      if (f.kind === "created") bump(v, "files_created");
      bump(v, "measured_operations");
    } else bump(v, "unmeasured_operations");
  }
  for (const e of (
    await c.query(
      "SELECT event_type,payload->>'app_version' AS app_version FROM telemetry_events WHERE org_id=$1 AND installation_id=$2 AND occurred_at>=$3 AND occurred_at<$4 AND event_type IN ('desktop.started','desktop.opened')",
      params,
    )
  ).rows)
    bump(
      group("system", e.app_version),
      e.event_type === "desktop.started" ? "launches" : "opens",
    );
  for (const r of (
    await c.query(
      "SELECT * FROM runs WHERE org_id=$1 AND installation_id=$2 AND started_at<$4 AND (finished_at>=$3 OR finished_at IS NULL AND started_at>=$3)",
      params,
    )
  ).rows) {
    const g = group(r.source, r.app_version);
    if (r.duration_ms === null) {
      if (dayOf(r.started_at) === day) bump(g, "unknown_task_runs");
      continue;
    }
    const parts = splitDays(r.started_at, r.finished_at),
      total = parts.reduce((s, p) => s + p.end - p.start, 0),
      part = parts.find((p) => p.day === day);
    if (part && total > 0)
      bump(
        g,
        "task_ms",
        (BigInt(r.duration_ms) *
          BigInt(part.end - new Date(r.started_at).getTime())) /
          BigInt(total) -
          (BigInt(r.duration_ms) *
            BigInt(part.start - new Date(r.started_at).getTime())) /
            BigInt(total),
      );
    if (total === 0 && dayOf(r.started_at) === day)
      bump(g, "task_ms", r.duration_ms);
  }
  const codes = (
    await c.query(
      "SELECT code FROM data_quality_daily WHERE org_id=$1 AND installation_id=$2 AND day=$3",
      [org, inst, day],
    )
  ).rows.map((x) => x.code);
  for (const table of [
    "installation_daily_metrics",
    "installation_daily_activity",
    "installation_daily_models",
    "daily_query_models",
    "daily_file_keys",
  ])
    await c.query(
      "DELETE FROM " +
        table +
        " WHERE org_id=$1 AND installation_id=$2 AND day=$3",
      [org, inst, day],
    );
  for (const g of groups.values()) {
    await insert(c, "installation_daily_metrics", {
      org_id: org,
      installation_id: inst,
      day,
      source: g.source,
      app_version: g.app_version,
      ...Object.fromEntries(metricColumns.map((k) => [k, g[k]])),
      quality_codes: [
        ...codes,
        ...(g.unknown_model_calls !== "0" ? ["UNKNOWN_USAGE"] : []),
      ],
      aggregated_at: new Date(),
    });
  }
  for (const [table, items] of [
    ["installation_daily_models", models],
    ["daily_query_models", queryModels],
    ["daily_file_keys", files],
  ])
    for (const row of items.values()) await insert(c, table, row);
  await c.query(
    "INSERT INTO installation_daily_activity(org_id,installation_id,day,app_version,active_ranges,runtime_ms,aggregated_at) SELECT $1,$2,$5::date,app_version,COALESCE((SELECT range_agg(r * tstzrange($3,$4,'[)')) FROM activity_intervals x CROSS JOIN LATERAL unnest(x.active_ranges) r WHERE x.org_id=$1 AND x.installation_id=$2 AND x.app_version=a.app_version AND r && tstzrange($3,$4,'[)')),'{}'::tstzmultirange),sum((floor(runtime_ms::numeric*extract(epoch FROM upper(span*tstzrange($3,$4,'[)'))-lower(span))/extract(epoch FROM upper(span)-lower(span)))-floor(runtime_ms::numeric*extract(epoch FROM lower(span*tstzrange($3,$4,'[)'))-lower(span))/extract(epoch FROM upper(span)-lower(span))))::bigint),now() FROM activity_intervals a WHERE org_id=$1 AND installation_id=$2 AND span && tstzrange($3,$4,'[)') GROUP BY app_version",
    [...params, day],
  );
}
export async function runAggregation(pool, max = 100) {
  let done = 0;
  while (done < max) {
    const worker = uuid();
    const job = await transaction(pool, async (c) => {
      const r = (
        await c.query(
          "SELECT * FROM aggregation_jobs WHERE completed_revision<requested_revision AND available_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (!r) return null;
      await c.query(
        "UPDATE aggregation_jobs SET lease_owner=$2,lease_until=now()+interval '60 seconds' WHERE id=$1",
        [r.id, worker],
      );
      return r;
    });
    if (!job) break;
    try {
      await transaction(pool, async (c) => {
        const current = (
          await c.query(
            "SELECT * FROM aggregation_jobs WHERE id=$1 AND lease_owner=$2 AND lease_until>now() FOR UPDATE",
            [job.id, worker],
          )
        ).rows[0];
        if (!current) return;
        await aggregateDay(c, job);
        await c.query(
          "UPDATE aggregation_jobs SET completed_revision=$2,lease_owner=NULL,lease_until=NULL,last_error_code=NULL WHERE id=$1 AND lease_owner=$3",
          [job.id, job.requested_revision, worker],
        );
      });
      done++;
    } catch (e) {
      await pool.query(
        "UPDATE aggregation_jobs SET lease_owner=NULL,lease_until=NULL,attempts=attempts+1,last_error_code=$2,available_at=now()+interval '60 seconds' WHERE id=$1 AND lease_owner=$3",
        [job.id, String(e.code ?? "AGGREGATION_FAILED").slice(0, 64), worker],
      );
      throw e;
    }
  }
  return done;
}
