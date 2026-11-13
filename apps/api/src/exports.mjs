import fs from "node:fs/promises";
import path from "node:path";
import { ApiError, uuid, one, clean, transaction } from "./core.mjs";
import { validateReportRange, report } from "./reports.mjs";
import { csvCell } from "../../../packages/contracts/telemetry.mjs";
const dto = (r) =>
  clean({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    row_count: r.row_count,
    expires_at: r.expires_at,
    download_path:
      r.status === "completed"
        ? "/v1/admin/exports/" + r.id + "/download"
        : null,
    error_code: r.error_code,
  });
export async function exportOperation(c, id, b, p, ctx) {
  if (id === "createExport") {
    await validateReportRange(c, ctx.org, b);
    await c.query("SELECT id FROM admin_accounts WHERE id=$1 FOR UPDATE", [
      ctx.account.id,
    ]);
    const n = (
      await c.query(
        "SELECT count(*) FROM export_jobs WHERE org_id=$1 AND account_id=$2 AND status IN ('queued','running')",
        [ctx.org, ctx.account.id],
      )
    ).rows[0].count;
    if (Number(n) >= 3) throw new ApiError(422, "EXPORT_LIMIT");
    const key = uuid();
    return dto(
      await one(
        c,
        "INSERT INTO export_jobs(id,org_id,account_id,filters,status,expires_at) VALUES($1,$2,$3,$4,'queued',now()+interval '24 hours') RETURNING *",
        [key, ctx.org, ctx.account.id, b],
      ),
    );
  }
  const r = await one(
    c,
    "SELECT * FROM export_jobs WHERE org_id=$1 AND id=$2 AND account_id=$3",
    [ctx.org, p.id, ctx.account.id],
  );
  if (new Date(r.expires_at) <= new Date()) {
    r.status = "expired";
    if (id === "downloadExport") throw new ApiError(404, "NOT_FOUND");
  }
  if (id === "downloadExport") {
    if (r.status !== "completed") throw new ApiError(409, "EXPORT_NOT_READY");
    return r;
  }
  return dto(r);
}
export async function runExports(pool, config) {
  return transaction(pool, async (c) => {
    const r = (
      await c.query(
        "SELECT * FROM export_jobs WHERE status='queued' OR (status='running' AND lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!r) return false;
    await c.query(
      "UPDATE export_jobs SET status='running',lease_until=now()+interval '5 minutes' WHERE id=$1",
      [r.id],
    );
    await c.query("SAVEPOINT export_write");
    try {
      const ctx = { org: r.org_id, pepper: config.pepper },
        operation = {
          employee_daily: "reportemployeesdaily",
          models: "reportmodels",
          code: "reportcode",
        }[r.filters.kind],
        q = { ...r.filters, limit: 200 };
      let rows = [],
        next;
      do {
        const x = await report(c, operation, { ...q, cursor: next }, {}, ctx);
        rows.push(...x.data.items);
        next = x.data.next_cursor;
        if (rows.length > 1000000) throw new Error("EXPORT_LIMIT");
      } while (next);
      const flat = rows.map(({ metrics, coverage, ...row }) => ({
        ...row,
        ...metrics,
        ...(coverage
          ? {
              data_state: coverage.state,
              warning_codes: coverage.warning_codes.join("|"),
            }
          : {}),
        exported_at: new Date().toISOString(),
      }));
      const columns = flat.length ? Object.keys(flat[0]) : ["empty_result"];
      const csv =
        "\ufeff" +
        [
          columns.map(csvCell).join(","),
          ...flat.map((row) => columns.map((k) => csvCell(row[k])).join(",")),
        ].join("\r\n");
      await fs.mkdir(config.exportDir, { recursive: true });
      const file = path.join(config.exportDir, r.id + ".csv");
      await fs.writeFile(file, csv, { mode: 0o600 });
      await c.query(
        "UPDATE export_jobs SET status='completed',object_key=$2,row_count=$3,lease_until=NULL WHERE id=$1",
        [r.id, r.id + ".csv", String(rows.length)],
      );
    } catch {
      await c.query("ROLLBACK TO SAVEPOINT export_write");
      await c.query(
        "UPDATE export_jobs SET status='failed',error_code='EXPORT_FAILED',lease_until=NULL WHERE id=$1",
        [r.id],
      );
    }
    return true;
  });
}
