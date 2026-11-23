import {
  ApiError,
  one,
  page,
  employeeDTO,
  departmentDTO,
  clean,
} from "./core.mjs";
import {
  emptyMetrics,
  emptyCoverage,
  sumMetrics,
  sumCoverage,
  intervalMs,
  dayOf,
  tokenNames,
} from "../../../packages/contracts/telemetry.mjs";
import { getPolicy } from "./ingest.mjs";
const arr = (x) => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const allowed = (filter, x) => !arr(filter).length || arr(filter).includes(x);
export function range(
  q,
  detail = false,
  policy = { raw_days: 90, daily_months: 24 },
) {
  if (
    !/^\d{4}-\d\d-\d\d$/.test(q.from ?? "") ||
    !/^\d{4}-\d\d-\d\d$/.test(q.to ?? "")
  )
    throw new ApiError(400, "VALIDATION_ERROR");
  const a = Date.parse(q.from + "T00:00:00+08:00"),
    b = Date.parse(q.to + "T00:00:00+08:00"),
    cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - policy.daily_months);
  const old = detail
    ? Date.now() - policy.raw_days * 86400000
    : cutoff.getTime();
  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    b <= a ||
    b - a > 731 * 86400000
  )
    throw new ApiError(400, "VALIDATION_ERROR");
  if (dayOf(a) !== q.from || dayOf(b) !== q.to)
    throw new ApiError(400, "VALIDATION_ERROR");
  if (a < old - 86400000) throw new ApiError(422, "RANGE_OUT_OF_RETENTION");
  return [q.from, q.to];
}
export async function validateReportRange(c, org, q, detail = false) {
  const policy = (
    await c.query(
      "SELECT value FROM org_settings WHERE org_id=$1 AND name='retention'",
      [org],
    )
  ).rows[0]?.value;
  return range(q, detail, policy);
}
export async function employees(c, org) {
  return (
    await c.query(
      "SELECT e.*,d.department_id,(SELECT count(*) FROM installation_bindings b WHERE b.org_id=e.org_id AND b.employee_id=e.id AND b.valid_days @> (now() AT TIME ZONE 'Asia/Shanghai')::date) AS installation_count FROM employees e LEFT JOIN employee_department_periods d ON d.org_id=e.org_id AND d.employee_id=e.id AND d.valid_days @> (now() AT TIME ZONE 'Asia/Shanghai')::date WHERE e.org_id=$1 ORDER BY e.name,e.id",
      [org],
    )
  ).rows.map(employeeDTO);
}
export async function installations(c, org) {
  const rows = clean(
    (
      await c.query(
        "SELECT i.*,b.employee_id,b.source AS binding_source,di.claim AS identity_claim,di.state AS identity_state FROM installations i LEFT JOIN installation_bindings b ON b.org_id=i.org_id AND b.installation_id=i.id AND b.valid_days @> (now() AT TIME ZONE 'Asia/Shanghai')::date LEFT JOIN installation_identities di ON di.org_id=i.org_id AND di.installation_id=i.id WHERE i.org_id=$1 ORDER BY i.windows_username,i.id",
        [org],
      )
    ).rows,
  ).map((r) => ({
    id: r.id,
    identity_status: {identity:r.identity_claim??null,state:r.binding_source==="manual"?"binding_preserved":r.identity_state??"missing",employee_id:r.employee_id??null,binding_source:r.binding_source??"none"},
    windows_username: r.windows_username,
    device_label: r.device_label,
    employee_id: r.employee_id ?? null,
    app_version: r.app_version,
    status: r.status,
    last_received_at: r.last_received_at,
    last_event_at: r.last_event_at,
    reported_queue_events: r.reported_queue_events,
    revision: r.revision,
    coverage: {
      ...emptyCoverage(r.last_received_at ? "complete" : "no_reports"),
      last_received_at: r.last_received_at,
      data_through: r.last_event_at,
    },
  }));
  return rows;
}
export async function loadReport(c, org, q) {
  await validateReportRange(c, org, q);
  const args = [org, q.from, q.to];
  const allEmployees = await employees(c, org),
    inst = await installations(c, org);
  const joins =
    " LEFT JOIN installation_bindings b ON b.org_id=m.org_id AND b.installation_id=m.installation_id AND b.valid_days @> m.day LEFT JOIN employees e ON e.org_id=b.org_id AND e.id=b.employee_id LEFT JOIN employee_department_periods ep ON ep.org_id=e.org_id AND ep.employee_id=e.id AND ep.valid_days @> m.day LEFT JOIN departments d ON d.org_id=ep.org_id AND d.id=ep.department_id";
  const select = (table) =>
    "SELECT m.*,m.day::text AS date,e.id AS employee_id,COALESCE(e.name,e.employee_no) AS employee_name,d.id AS department_id,d.name AS department_name FROM " +
    table +
    " m" +
    joins +
    " WHERE m.org_id=$1 AND m.day >= $2::date AND m.day < $3::date";
  const matches = (r, activity = false) =>
    allowed(q.employee_ids, r.employee_id) &&
    allowed(q.department_ids, r.department_id) &&
    allowed(q.app_versions, r.app_version) &&
    (activity || allowed(q.sources, r.source));
  const daily = (
    await c.query(select("installation_daily_metrics"), args)
  ).rows.filter((r) => matches(r));
  const activity = (
    await c.query(select("installation_daily_activity"), args)
  ).rows.filter((r) => matches(r, true));
  const activeParts = (
    await c.query(
      "SELECT m.installation_id,m.day::text AS date,m.app_version,lower(r) AS start_at,upper(r) AS end_at FROM installation_daily_activity m CROSS JOIN LATERAL unnest(m.active_ranges) r WHERE m.org_id=$1 AND m.day >= $2::date AND m.day < $3::date",
      args,
    )
  ).rows;
  const activeByKey = new Map();
  for (const a of activeParts) {
    const key = a.installation_id + "|" + a.date + "|" + a.app_version;
    if (!activeByKey.has(key)) activeByKey.set(key, []);
    activeByKey
      .get(key)
      .push([new Date(a.start_at).getTime(), new Date(a.end_at).getTime()]);
  }
  const models = (
    await c.query(select("installation_daily_models"), args)
  ).rows.filter((r) => matches(r));
  const files = (await c.query(select("daily_file_keys"), args)).rows.filter(
    (r) => matches(r),
  );
  const queryModels = (
    await c.query(select("daily_query_models"), args)
  ).rows.filter((r) => matches(r));
  const rows = new Map();
  const get = (r) => {
    const key = r.date + "|" + (r.employee_id ?? r.installation_id);
    if (!rows.has(key))
      rows.set(key, {
        date: r.date,
        employee_id: r.employee_id,
        employee_name: r.employee_name ?? "未绑定安装",
        department_id: r.department_id,
        department_name: r.department_name,
        metrics: emptyMetrics(),
        coverage: emptyCoverage(),
        ranges: [],
        fileKeys: new Set(),
        installations: new Set(),
      });
    const out = rows.get(key);
    out.installations.add(r.installation_id);
    return out;
  };
  for (const r of daily) {
    const out = get(r);
    out.metrics = sumMetrics([
      out.metrics,
      Object.fromEntries(
        Object.keys(out.metrics).map((k) => [k, r[k] ?? null]),
      ),
    ]);
    out.coverage = sumCoverage([
      out.coverage,
      {
        ...emptyCoverage(),
        known_model_calls: r.known_model_calls,
        unknown_model_calls: r.unknown_model_calls,
        measured_file_operations: r.measured_file_operations,
        unmeasured_file_operations: r.unmeasured_file_operations,
        warning_codes: r.quality_codes,
      },
    ]);
  }
  for (const r of activity) {
    const out = get(r);
    out.metrics.runtime_ms = (
      BigInt(out.metrics.runtime_ms) + BigInt(r.runtime_ms)
    ).toString();
    out.ranges.push(
      ...(activeByKey.get(
        r.installation_id + "|" + r.date + "|" + r.app_version,
      ) ?? []),
    );
  }
  for (const r of files)
    if (r.file_category === "code")
      get(r).fileKeys.add(r.installation_id + "|" + r.file_key);
  for (const out of rows.values()) {
    out.metrics.active_ms = String(intervalMs(out.ranges));
    out.metrics.files_touched = String(out.fileKeys.size);
    const receipts = inst.filter((i) => out.installations.has(i.id));
    out.coverage.last_received_at =
      receipts
        .map((r) => r.last_received_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
    out.coverage.data_through =
      receipts
        .map((r) => r.last_event_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
    if (!out.employee_id)
      out.coverage.warning_codes.push("UNBOUND_INSTALLATION");
    if (arr(q.sources).length)
      out.coverage.warning_codes.push(
        "SOURCE_FILTER_NOT_APPLICABLE_TO_ACTIVITY",
      );
    if (out.coverage.warning_codes.length) out.coverage.state = "partial";
  }
  const list = [...rows.values()],
    coverage = sumCoverage(list.map((r) => r.coverage)),
    metrics = sumMetrics(list.map((r) => r.metrics));
  metrics.files_touched = String(
    new Set(
      files
        .filter((f) => f.file_category === "code")
        .map((f) => f.installation_id + "|" + f.file_key),
    ).size,
  );
  const watermark = (
    await c.query(
      "SELECT max(aggregated_at) AS at FROM installation_daily_metrics WHERE org_id=$1",
      [org],
    )
  ).rows[0].at;
  return {
    rows: list,
    allEmployees,
    installations: inst,
    models,
    files,
    queryModels,
    metrics,
    coverage,
    watermark,
  };
}
const dailyDTO = (r) => ({
  date: r.date,
  employee_id: r.employee_id,
  employee_name: r.employee_name,
  department_id: r.department_id ?? null,
  department_name: r.department_name ?? null,
  metrics: r.metrics,
  coverage: r.coverage,
});
function sortRows(rows, q) {
  const k = q.sort ?? "date",
    dir = q.direction === "asc" ? 1 : -1;
  return rows.sort((a, b) => {
    const av = k in a ? a[k] : a.metrics[k],
      bv = k in b ? b[k] : b.metrics[k];
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    let diff =
      k === "date" || k === "employee_name"
        ? String(av).localeCompare(String(bv), "zh-CN")
        : BigInt(av) > BigInt(bv)
          ? 1
          : BigInt(av) < BigInt(bv)
            ? -1
            : 0;
    return (
      diff * dir ||
      a.employee_id.localeCompare(b.employee_id) ||
      a.date.localeCompare(b.date)
    );
  });
}
export async function report(c, id, q, params, ctx) {
  if (id === "catalog")
    return {
      data: {
        employees: await employees(c, ctx.org),
        departments: (
          await c.query(
            "SELECT * FROM departments WHERE org_id=$1 ORDER BY name",
            [ctx.org],
          )
        ).rows.map(departmentDTO),
        app_versions: (
          await c.query(
            "SELECT DISTINCT app_version FROM installations WHERE org_id=$1 ORDER BY app_version",
            [ctx.org],
          )
        ).rows.map((r) => r.app_version),
        sources: [
          "chat",
          "room",
          "remote",
          "automation",
          "system",
          "compaction",
          "review",
          "vision",
          "prompt_optimize",
          "prediction",
          "model_test",
          "shell",
          "companion",
        ],
        languages: (
          await c.query(
            "SELECT DISTINCT language FROM daily_file_keys WHERE org_id=$1",
            [ctx.org],
          )
        ).rows.map((r) => r.language),
      },
    };
  if (id.startsWith("reportqueries")) return queryReport(c, id, q, params, ctx);
  const data = await loadReport(c, ctx.org, q),
    meta = {
      timezone: "Asia/Shanghai",
      aggregation_as_of: data.watermark
        ? new Date(data.watermark).toISOString()
        : null,
      from: q.from,
      to: q.to,
      coverage: data.coverage,
    };
  if (id === "reportoverview")
    return {
      data: {
        confirmed_employees: String(
          data.allEmployees.filter(
            (e) =>
              e.status === "active" &&
              allowed(q.employee_ids, e.id) &&
              allowed(q.department_ids, e.department_id),
          ).length,
        ),
        active_employees: String(
          new Set(
            data.rows
              .filter(
                (r) =>
                  r.employee_id &&
                  (BigInt(r.metrics.active_ms) > 0n ||
                    BigInt(r.metrics.queries) > 0n),
              )
              .map((r) => r.employee_id),
          ).size,
        ),
        unconfirmed_installations: String(
          data.installations.filter((i) => !i.employee_id).length,
        ),
        metrics: data.metrics,
      },
      meta,
    };
  if (id === "reporttrends") {
    const items = [];
    for (
      let d = Date.parse(q.from + "T00:00:00+08:00");
      d < Date.parse(q.to + "T00:00:00+08:00");
      d += 86400000
    ) {
      const day = dayOf(d),
        rows = data.rows.filter((r) => r.date === day);
      items.push({
        bucket: day,
        active_employees: String(
          new Set(
            rows
              .filter(
                (r) =>
                  r.employee_id &&
                  (BigInt(r.metrics.active_ms) > 0n ||
                    BigInt(r.metrics.queries) > 0n),
              )
              .map((r) => r.employee_id),
          ).size,
        ),
        metrics: sumMetrics(rows.map((r) => r.metrics)),
      });
    }
    return { data: { items }, meta };
  }
  if (id === "reportemployeesdaily") {
    const rows = data.rows.filter((r) => r.employee_id).map(dailyDTO);
    const existing = new Set(rows.map((r) => r.employee_id + "|" + r.date));
    const expected = (
      await c.query(
        "SELECT e.id,COALESCE(e.name,e.employee_no) AS name,day::date::text AS date,ep.department_id,d.name AS department_name,EXISTS(SELECT 1 FROM installation_bindings b WHERE b.org_id=e.org_id AND b.employee_id=e.id AND b.valid_days @> day::date) AS enrolled FROM employees e CROSS JOIN generate_series($2::date::timestamp,($3::date-1)::timestamp,interval '1 day') day LEFT JOIN employee_department_periods ep ON ep.org_id=e.org_id AND ep.employee_id=e.id AND ep.valid_days @> day::date LEFT JOIN departments d ON d.org_id=ep.org_id AND d.id=ep.department_id WHERE e.org_id=$1 AND e.status='active'",
        [ctx.org, q.from, q.to],
      )
    ).rows;
    for (const e of expected) {
      if (
        allowed(q.employee_ids, e.id) &&
        allowed(q.department_ids, e.department_id) &&
        !existing.has(e.id + "|" + e.date)
      )
        rows.push({
          date: e.date,
          employee_id: e.id,
          employee_name: e.name,
          department_id: e.department_id,
          department_name: e.department_name,
          metrics: emptyMetrics(),
          coverage: emptyCoverage(e.enrolled ? "no_reports" : "not_enrolled"),
        });
    }
    return { data: page(sortRows(rows, q), q, ctx), meta };
  }
  if (id === "reportemployeesid") {
    const employee = data.allEmployees.find((e) => e.id === params.id);
    if (!employee) throw new ApiError(404, "NOT_FOUND");
    return {
      data: {
        employee,
        daily: data.rows
          .filter((r) => r.employee_id === params.id)
          .map(dailyDTO),
        installations: data.installations.filter(
          (i) => i.employee_id === params.id,
        ),
      },
      meta,
    };
  }
  if (id === "reportmodels") {
    const rows = new Map();
    for (const m of data.models) {
      const key = m.provider + "|" + m.model;
      if (!rows.has(key))
        rows.set(key, {
          provider: m.provider,
          model: m.model,
          calls: "0",
          queries: "0",
          failed_calls: "0",
          known_calls: "0",
          unknown_calls: "0",
          duration_ms: "0",
          ...Object.fromEntries(tokenNames.map((k) => [k, null])),
        });
      const out = rows.get(key);
      for (const k of [
        "calls",
        "failed_calls",
        "known_calls",
        "unknown_calls",
        "duration_ms",
        ...tokenNames,
      ])
        if (m[k] !== null)
          out[k] = (BigInt(out[k] ?? 0) + BigInt(m[k])).toString();
    }
    for (const r of rows.values())
      r.queries = String(
        new Set(
          data.queryModels
            .filter((m) => m.provider === r.provider && m.model === r.model)
            .map((m) => m.installation_id + "|" + m.query_id),
        ).size,
      );
    return {
      data: {
        items: [...rows.values()].sort((a, b) =>
          Number(BigInt(b.calls) - BigInt(a.calls)),
        ),
      },
      meta,
    };
  }
  if (id === "reportcode") {
    const rows = new Map();
    for (const f of data.files) {
      const key = f.language + "|" + f.file_category;
      if (!rows.has(key))
        rows.set(key, {
          language: f.language,
          file_category: f.file_category,
          added_lines: "0",
          deleted_lines: "0",
          files_touched: "0",
          measured_operations: "0",
          unmeasured_operations: "0",
          keys: new Set(),
        });
      const out = rows.get(key);
      for (const k of [
        "added_lines",
        "deleted_lines",
        "measured_operations",
        "unmeasured_operations",
      ])
        out[k] = (BigInt(out[k]) + BigInt(f[k])).toString();
      out.keys.add(f.installation_id + "|" + f.file_key);
    }
    return {
      data: {
        items: [...rows.values()].map(({ keys, ...r }) => ({
          ...r,
          files_touched: String(keys.size),
        })),
      },
      meta,
    };
  }
  if (id === "reporthealth") {
    const policy = await getPolicy(c, ctx.org);
    // Keep the 40-minute grace floor for legacy collectors, whose compatible
    // policy can still use 25–35 minutes when the configured interval is short.
    const staleAfterMs =
      Math.max(40 * 60, policy.interval_max_seconds + 5 * 60) * 1000;
    const now = Date.now();
    const employeeDepartments = new Map(
      data.allEmployees.map((e) => [e.id, e.department_id]),
    );
    const inst = data.installations.filter(
      (i) =>
        allowed(q.employee_ids, i.employee_id) &&
        allowed(q.department_ids, employeeDepartments.get(i.employee_id)) &&
        allowed(q.app_versions, i.app_version),
    );
    const rejected = await c.query(
      "SELECT COALESCE(sum(event_count),0)::text AS n FROM data_quality_daily WHERE org_id=$1 AND day>=$2::date AND day<$3::date AND installation_id=ANY($4::uuid[]) AND code IN ('INVALID_EVENT','EVENT_CONFLICT','CLOCK_SUSPECT','EVENT_TOO_OLD')",
      [ctx.org, q.from, q.to, inst.map((i) => i.id)],
    );
    const lag = (
      await c.query(
        "SELECT COALESCE(extract(epoch FROM now()-min(available_at)),0)::int AS seconds FROM aggregation_jobs WHERE org_id=$1 AND installation_id=ANY($2::uuid[]) AND completed_revision<requested_revision",
        [ctx.org, inst.map((i) => i.id)],
      )
    ).rows[0].seconds;
    return {
      data: {
        installations: inst,
        unbound_count: String(inst.filter((i) => !i.employee_id).length),
        stale_report_count: String(
          inst.filter(
            (i) =>
              !i.last_received_at ||
              now - Date.parse(i.last_received_at) > staleAfterMs,
          ).length,
        ),
        rejected_events: rejected.rows[0].n,
        aggregation_lag_seconds: Math.max(0, lag),
        warning_codes: data.coverage.warning_codes,
      },
      meta,
    };
  }
  throw new ApiError(404, "NOT_FOUND");
}
export const callDTO = (r) =>
  clean(
    Object.fromEntries(
      [
        "id",
        "query_id",
        "run_id",
        "provider",
        "model",
        "source",
        "status",
        "started_at",
        "finished_at",
        "duration_ms",
        "usage_status",
        ...tokenNames,
      ].map((k) => [k, r[k]]),
    ),
  );
export const fileDTO = (r) => ({
  operation_id: r.id,
  run_id: r.run_id,
  query_id: r.query_id,
  tool_call_id: r.tool_call_id,
  file_key: r.file_key,
  language: r.language,
  file_category: r.file_category,
  kind: r.kind,
  added_lines: r.added_lines,
  deleted_lines: r.deleted_lines,
  measurement_status: r.measurement_status,
});
async function queryReport(c, id, q, params, ctx) {
  await validateReportRange(c, ctx.org, q, true);
  const rows = clean(
    (
      await c.query(
        "SELECT q.*,b.employee_id,ep.department_id FROM queries q LEFT JOIN installation_bindings b ON b.org_id=q.org_id AND b.installation_id=q.installation_id AND b.valid_days @> (q.accepted_at AT TIME ZONE 'Asia/Shanghai')::date LEFT JOIN employee_department_periods ep ON ep.org_id=b.org_id AND ep.employee_id=b.employee_id AND ep.valid_days @> (q.accepted_at AT TIME ZONE 'Asia/Shanghai')::date WHERE q.org_id=$1 AND q.accepted_at>=($2::date::timestamp AT TIME ZONE 'Asia/Shanghai') AND q.accepted_at<($3::date::timestamp AT TIME ZONE 'Asia/Shanghai') ORDER BY q.accepted_at DESC,q.id",
        [ctx.org, q.from, q.to],
      )
    ).rows,
  ).filter(
    (r) =>
      allowed(q.employee_ids, r.employee_id) &&
      allowed(q.department_ids, r.department_id) &&
      allowed(q.app_versions, r.app_version) &&
      allowed(q.sources, r.source) &&
      (!q.status || q.status === r.status),
  );
  const toDTO = (r) => ({
    id: r.id,
    installation_id: r.installation_id,
    employee_id: r.employee_id,
    source: r.source,
    accepted_at: r.accepted_at,
    status: r.status,
    revision: r.revision,
    run_ids: [],
    metrics: { ...emptyMetrics(), queries: r.trigger === "human" ? "1" : "0" },
    coverage: emptyCoverage(),
  });
  const meta = {
    timezone: "Asia/Shanghai",
    aggregation_as_of: null,
    from: q.from,
    to: q.to,
    coverage: emptyCoverage(rows.length ? "complete" : "no_reports"),
  };
  if (id === "reportqueries") {
    const result = page(rows.map(toDTO), q, ctx);
    for (const item of result.items) {
      const usage = (
        await c.query(
          "SELECT count(*)::text AS model_calls,count(*) FILTER(WHERE usage_status='reported')::text AS known,count(*) FILTER(WHERE usage_status<>'reported')::text AS unknown," +
            tokenNames.map((k) => "sum(" + k + ")::text AS " + k).join(",") +
            " FROM model_calls WHERE org_id=$1 AND installation_id=$2 AND query_id=$3",
          [ctx.org, item.installation_id, item.id],
        )
      ).rows[0];
      item.metrics = {
        ...item.metrics,
        model_calls: usage.model_calls,
        ...Object.fromEntries(tokenNames.map((k) => [k, usage[k]])),
      };
      item.coverage.known_model_calls = usage.known;
      item.coverage.unknown_model_calls = usage.unknown;
      if (usage.unknown !== "0") {
        item.coverage.state = "partial";
        item.coverage.warning_codes = ["UNKNOWN_USAGE"];
      }
    }
    return { data: result, meta };
  }
  const r = rows.find((r) => r.id === params.id);
  if (!r) throw new ApiError(404, "NOT_FOUND");
  const calls = (
    await c.query(
      "SELECT * FROM model_calls WHERE org_id=$1 AND installation_id=$2 AND query_id=$3 AND status<>'running' ORDER BY started_at,id",
      [ctx.org, r.installation_id, r.id],
    )
  ).rows.map(callDTO);
  const files = (
    await c.query(
      "SELECT * FROM file_changes WHERE org_id=$1 AND installation_id=$2 AND query_id=$3 ORDER BY occurred_at,id",
      [ctx.org, r.installation_id, r.id],
    )
  ).rows.map(fileDTO);
  if (id === "reportqueriesidcalls") return { data: page(calls, q, ctx), meta };
  if (id === "reportqueriesidfilechanges")
    return { data: page(files, q, ctx), meta };
  const query = toDTO(r);
  query.run_ids = [...new Set(calls.map((c) => c.run_id).filter(Boolean))];
  query.metrics = {
    ...query.metrics,
    model_calls: String(calls.length),
    ...Object.fromEntries(
      tokenNames.map((k) => [
        k,
        calls.some((c) => c[k] !== null)
          ? calls.reduce((s, c) => s + BigInt(c[k] ?? 0), 0n).toString()
          : null,
      ]),
    ),
    added_lines: files
      .filter((f) => f.file_category === "code")
      .reduce((s, f) => s + BigInt(f.added_lines ?? 0), 0n)
      .toString(),
    deleted_lines: files
      .filter((f) => f.file_category === "code")
      .reduce((s, f) => s + BigInt(f.deleted_lines ?? 0), 0n)
      .toString(),
  };
  query.coverage.unknown_model_calls = String(
    calls.filter((c) => c.usage_status !== "reported").length,
  );
  if (query.coverage.unknown_model_calls !== "0")
    query.coverage.state = "partial";
  return {
    data: {
      query,
      calls: calls.slice(0, 500),
      file_changes: files.slice(0, 500),
      truncated: calls.length > 500 || files.length > 500,
    },
    meta,
  };
}
