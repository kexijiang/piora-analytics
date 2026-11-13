import fs from "node:fs/promises";
import path from "node:path";
import { transaction } from "../../api/src/core.mjs";
export async function maintain(pool, config) {
  await transaction(pool, async (c) => {
    const lock = (
      await c.query("SELECT pg_try_advisory_xact_lock(71203003) AS ok")
    ).rows[0].ok;
    if (!lock) return;
    await c.query(
      "DO $$ DECLARE m timestamptz; n text; BEGIN FOR offset_month IN 0..2 LOOP m := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + (offset_month || ' months')::interval; n := 'telemetry_events_' || to_char(m AT TIME ZONE 'UTC','YYYYMM'); EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF telemetry_events FOR VALUES FROM (%L) TO (%L)',n,m,m+interval '1 month'); END LOOP; END $$;",
    );
    const orgs = (
      await c.query(
        "SELECT o.id,s.value FROM organizations o JOIN org_settings s ON s.org_id=o.id AND s.name='retention'",
      )
    ).rows;
    for (const org of orgs) {
      const p = org.value,
        cutoff = new Date(Date.now() - p.raw_days * 86400000);
      if (
        (
          await c.query(
            "SELECT 1 FROM aggregation_jobs WHERE org_id=$1 AND completed_revision<requested_revision AND day<($2::timestamptz AT TIME ZONE 'Asia/Shanghai')::date LIMIT 1",
            [org.id, cutoff],
          )
        ).rowCount
      )
        continue;
      for (const [table, col] of [
        ["queries", "accepted_at"],
        ["model_calls", "COALESCE(finished_at,started_at)"],
        ["runs", "COALESCE(finished_at,started_at)"],
        ["file_changes", "occurred_at"],
        ["app_launches", "started_at"],
        ["activity_intervals", "upper(span)"],
      ])
        await c.query(
          "DELETE FROM " + table + " WHERE org_id=$1 AND " + col + "<$2",
          [org.id, cutoff],
        );
      await c.query(
        "DELETE FROM telemetry_events WHERE org_id=$1 AND received_at<$2",
        [org.id, cutoff],
      );
      await c.query(
        "DELETE FROM event_receipts r WHERE org_id=$1 AND expires_at<now() AND NOT EXISTS(SELECT 1 FROM telemetry_events e WHERE e.org_id=r.org_id AND e.installation_id=r.installation_id AND e.event_id=r.event_id)",
        [org.id],
      );
      for (const table of [
        "installation_daily_metrics",
        "installation_daily_activity",
        "installation_daily_models",
        "daily_file_keys",
        "daily_query_models",
        "data_quality_daily",
      ])
        await c.query(
          "DELETE FROM " +
            table +
            " WHERE org_id=$1 AND day < ((now() AT TIME ZONE 'Asia/Shanghai')::date - make_interval(months=>$2))::date",
          [org.id, p.daily_months],
        );
      await c.query(
        "DELETE FROM audit_logs WHERE org_id=$1 AND occurred_at < now()-make_interval(days=>$2)",
        [org.id, p.audit_days],
      );
      await c.query(
        "DELETE FROM aggregation_jobs WHERE org_id=$1 AND completed_revision=requested_revision AND day < (now() AT TIME ZONE 'Asia/Shanghai')::date-90",
        [org.id],
      );
    }
    await c.query("DELETE FROM idempotency_keys WHERE expires_at<now()");
    await c.query("DELETE FROM admin_sessions WHERE expires_at<now()");
    const expired = (
      await c.query(
        "UPDATE export_jobs SET status='expired' WHERE expires_at<now() AND status<>'expired' RETURNING id,object_key",
      )
    ).rows;
    for (const r of expired)
      if (r.object_key && /^[a-f0-9-]{36}\.csv$/.test(r.object_key))
        await fs
          .unlink(path.join(config.exportDir, r.object_key))
          .catch((e) => {
            if (e.code !== "ENOENT") throw e;
          });
    await c.query(
      "DELETE FROM export_jobs WHERE expires_at<now()-interval '7 days'",
    );
    const partitions = (
      await c.query(
        "SELECT relname FROM pg_class c JOIN pg_inherits i ON c.oid=i.inhrelid WHERE i.inhparent='telemetry_events'::regclass",
      )
    ).rows;
    for (const { relname } of partitions)
      if (
        /^telemetry_events_\d{6}$/.test(relname) &&
        relname <
          "telemetry_events_" +
            new Date(Date.now() - 400 * 86400000)
              .toISOString()
              .slice(0, 7)
              .replace("-", "")
      ) {
        if (!(await c.query("SELECT 1 FROM " + relname + " LIMIT 1")).rowCount)
          await c.query("DROP TABLE " + relname);
      }
  });
}
