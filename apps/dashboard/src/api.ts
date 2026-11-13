import type { components } from "../../../packages/contracts/src/api.generated";
import data from "./demo/data.json";
type S = components["schemas"];
export const isDemo =
  new URLSearchParams(location.search).get("demo") === "1" ||
  import.meta.env.VITE_DEMO_MODE === "true";
let csrf = "";
export function setCsrf(v: string) {
  csrf = v;
}
export async function api<T>(
  url: string,
  body?: unknown,
  method = body ? "POST" : "GET",
): Promise<T> {
  if (isDemo) return demo(url, body, method) as T;
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(method !== "GET"
        ? { "X-CSRF-Token": csrf, "Idempotency-Key": crypto.randomUUID() }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.code ?? "REQUEST_FAILED");
  if (result.data?.csrf_token) csrf = result.data.csrf_token;
  return result;
}
function sum(rows: S["Metrics"][]): S["Metrics"] {
  const keys = Object.keys(data.daily[0].metrics) as (keyof S["Metrics"])[];
  return Object.fromEntries(
    keys.map((k) => [
      k,
      rows.some((r) => r[k] !== null)
        ? rows.reduce((s, r) => s + BigInt(r[k] ?? 0), 0n).toString()
        : null,
    ]),
  ) as S["Metrics"];
}
const cov = (rows: typeof data.daily) => ({
  ...data.daily[0].coverage,
  state: rows.length ? "partial" : "no_reports",
  known_model_calls: rows
    .reduce((s, r) => s + Number(r.coverage.known_model_calls), 0)
    .toString(),
  unknown_model_calls: String(rows.length),
});
const policy = {
  version: 1,
  enabled: true,
  interval_min_seconds: 1500,
  interval_max_seconds: 2100,
  initial_delay_min_seconds: 60,
  initial_delay_max_seconds: 300,
  reconnect_min_seconds: 120,
  reconnect_max_seconds: 600,
  max_batch_events: 500,
  max_batch_bytes: 262144,
  queue_max_days: 30,
  queue_max_bytes: 268435456,
};
function demo(url: string, body: unknown, method: string): unknown {
  const u = new URL(url, location.origin),
    q = u.searchParams,
    from = q.get("from") ?? "2026-11-07",
    to = q.get("to") ?? "2026-11-14";
  const rows = data.daily.filter(
    (r) =>
      r.date >= from &&
      r.date < to &&
      (!q.get("department_ids") ||
        r.department_id === q.get("department_ids")) &&
      (!q.get("employee_ids") || r.employee_id === q.get("employee_ids")) &&
      (!q.get("app_versions") || r.app_version === q.get("app_versions")),
  );
  const metrics = sum(rows.map((r) => r.metrics)),
    meta = {
      request_id: crypto.randomUUID(),
      server_time: "2026-11-13T09:45:00Z",
      timezone: "Asia/Shanghai",
      aggregation_as_of: "2026-11-13T09:43:10Z",
      from,
      to,
      coverage: cov(rows),
    };
  let result: unknown = { ok: true };
  const p = u.pathname;
  if (p.endsWith("/auth/session") || p.endsWith("/auth/login"))
    result = {
      user: {
        id: "70000000-0000-4000-8000-000000000999",
        username: "demo.admin",
        display_name: "演示管理员",
        role: "admin",
        status: "active",
        revision: 1,
        must_change_password: false,
      },
      csrf_token: "demo",
      expires_at: "2026-12-01T00:00:00Z",
    };
  else if (p.endsWith("/catalog"))
    result = {
      employees: data.employees,
      departments: data.departments,
      app_versions: ["0.5.11-beta.4", "0.5.10"],
      sources: ["chat", "room", "automation"],
      languages: ["TypeScript", "Python", "CSS", "JSON"],
    };
  else if (p.endsWith("/overview"))
    result = {
      confirmed_employees: String(data.employees.length),
      active_employees: String(new Set(rows.map((r) => r.employee_id)).size),
      unconfirmed_installations: "3",
      metrics,
    };
  else if (p.endsWith("/trends"))
    result = {
      items: [...new Set(rows.map((r) => r.date))].map((date) => ({
        bucket: date,
        active_employees: String(
          new Set(rows.filter((r) => r.date === date).map((r) => r.employee_id))
            .size,
        ),
        metrics: sum(rows.filter((r) => r.date === date).map((r) => r.metrics)),
      })),
    };
  else if (p.endsWith("/employees/daily")) {
    const sort = q.get("sort") ?? "date",
      direction = q.get("direction") === "asc" ? 1 : -1;
    const sorted = [...rows].sort((a, b) =>
      sort === "date"
        ? direction * a.date.localeCompare(b.date)
        : sort === "employee_name"
          ? direction * a.employee_name.localeCompare(b.employee_name)
          : direction *
            (Number(a.metrics[sort as keyof S["Metrics"]]) -
              Number(b.metrics[sort as keyof S["Metrics"]])),
    );
    const offset = Number(q.get("cursor") ?? 0),
      limit = Number(q.get("limit") ?? 20);
    result = {
      items: sorted.slice(offset, offset + limit),
      total: String(sorted.length),
      next_cursor:
        offset + limit < sorted.length ? String(offset + limit) : null,
    };
  } else if (p.includes("/analytics/employees/")) {
    const id = p.split("/").at(-1);
    result = {
      employee: data.employees.find((e) => e.id === id),
      daily: rows.filter((r) => r.employee_id === id),
      installations: data.installations.filter((i) => i.employee_id === id),
    };
  } else if (p.endsWith("/models")) {
    const shares = [0.5, 0.3, 0.2],
      names = ["Claude Sonnet 4.6", "GPT-5", "Gemini 2.5 Pro"];
    result = {
      items: names.map((model, i) => {
        const usage = Object.fromEntries(
          [
            "input_tokens",
            "output_tokens",
            "cache_read_tokens",
            "cache_write_tokens",
            "total_tokens",
          ].map((k) => [
            k,
            String(
              Math.round(Number(metrics[k as keyof S["Metrics"]]) * shares[i]),
            ),
          ]),
        );
        return {
          provider: ["anthropic", "openai", "google"][i],
          model,
          calls: String(Math.round(Number(metrics.model_calls) * shares[i])),
          queries: String(Math.round(Number(metrics.queries) * shares[i])),
          failed_calls: String(3 + i),
          known_calls: String(
            Math.round(Number(metrics.model_calls) * shares[i]) - 5,
          ),
          unknown_calls: "5",
          duration_ms: String(500000 + i * 83000),
          ...usage,
        };
      }),
    };
  } else if (p.endsWith("/code"))
    result = {
      items: ["TypeScript", "Python", "CSS", "JSON", "Markdown"].map(
        (language, i) => ({
          language,
          file_category: i < 3 ? "code" : i === 3 ? "config" : "document",
          added_lines: String(
            Math.round(
              Number(metrics.added_lines) * [0.55, 0.28, 0.17, 0.12, 0.06][i],
            ),
          ),
          deleted_lines: String(
            Math.round(
              Number(metrics.deleted_lines) * [0.55, 0.28, 0.17, 0.12, 0.06][i],
            ),
          ),
          files_touched: String(21 - i * 3),
          measured_operations: String(95 - i * 13),
          unmeasured_operations: String(i + 1),
        }),
      ),
    };
  else if (p.endsWith("/health"))
    result = {
      installations: data.installations,
      unbound_count: "3",
      stale_report_count: "1",
      rejected_events: "2",
      aggregation_lag_seconds: 14,
      warning_codes: ["UNKNOWN_USAGE"],
    };
  else if (p.endsWith("/queries"))
    result = {
      items: rows.slice(0, 15).map((r, i) => ({
        id: "70000000-0000-4000-8000-" + String(800 + i).padStart(12, "0"),
        installation_id: data.installations[0].id,
        employee_id: r.employee_id,
        source: "chat",
        accepted_at: r.date + "T06:" + String(10 + i).padStart(2, "0") + ":00Z",
        status: i === 3 ? "failed" : "completed",
        revision: 3,
        run_ids: [],
        metrics: {
          ...r.metrics,
          queries: "1",
          model_calls: "3",
          total_tokens: "20700",
        },
        coverage: r.coverage,
      })),
      next_cursor: null,
      total: String(Math.min(15, rows.length)),
    };
  else if (p.includes("/queries/")) {
    const id = p.split("/").at(-1),
      r = rows[0] ?? data.daily[0];
    result = {
      query: {
        id,
        installation_id: data.installations[0].id,
        employee_id: r.employee_id,
        source: "chat",
        accepted_at: r.date + "T06:10:00Z",
        status: "completed",
        revision: 3,
        run_ids: [],
        metrics: {
          ...r.metrics,
          queries: "1",
          model_calls: "1",
          total_tokens: "6900",
        },
        coverage: r.coverage,
      },
      calls: [
        {
          id: "70000000-0000-4000-8000-000000000901",
          query_id: id,
          run_id: null,
          provider: "anthropic",
          model: "Claude Sonnet 4.6",
          source: "chat",
          status: "completed",
          started_at: r.date + "T06:10:00Z",
          finished_at: r.date + "T06:11:00Z",
          duration_ms: "60000",
          usage_status: "reported",
          input_tokens: "3450",
          output_tokens: "1380",
          cache_read_tokens: "2070",
          cache_write_tokens: "0",
          total_tokens: "6900",
        },
      ],
      file_changes: [],
      truncated: false,
    };
  } else if (p.endsWith("/settings/sync"))
    result =
      method === "PATCH"
        ? (body as { policy: S["SyncPolicy"] }).policy
        : policy;
  else if (p.endsWith("/settings/retention"))
    result = { raw_days: 90, daily_months: 24, audit_days: 365, revision: 1 };
  else if (p.endsWith("/accounts"))
    result = {
      items: [
        {
          id: "70000000-0000-4000-8000-000000000999",
          username: "demo.admin",
          display_name: "演示管理员",
          role: "admin",
          status: "active",
          revision: 1,
          must_change_password: false,
        },
      ],
      total: "1",
      next_cursor: null,
    };
  else if (p.includes("/installations/") && p.endsWith("/bindings")) {
    const b = body as S["BindingInput"],
      id = p.split("/")[3],
      inst = data.installations.find((i) => i.id === id);
    if (inst) inst.employee_id = b.employee_id;
    result = {
      id: crypto.randomUUID(),
      installation_id: id,
      ...b,
      revision: 1,
    };
  } else if (p.endsWith("/employees"))
    result = {
      items: data.employees,
      total: String(data.employees.length),
      next_cursor: null,
    };
  else if (p.endsWith("/departments"))
    result = {
      items: data.departments,
      total: String(data.departments.length),
      next_cursor: null,
    };
  else if (p.endsWith("/installations"))
    result = {
      items: data.installations,
      total: String(data.installations.length),
      next_cursor: null,
    };
  else if (p.endsWith("/enrollment-keys") && method === "POST")
    result = {
      key: { id: crypto.randomUUID() },
      secret: "DEMO-ONLY-THIS-IS-NOT-A-REAL-REGISTRATION-KEY",
    };
  else if (p.endsWith("/audit-logs"))
    result = { items: [], next_cursor: null, total: "0" };
  return { data: result, meta };
}
