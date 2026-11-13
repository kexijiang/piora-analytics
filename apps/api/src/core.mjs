import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";
import YAML from "yaml";
import Ajv from "ajv/dist/2020.js";
import formats from "ajv-formats";
import { canonicalize } from "json-canonicalize";
export const root = path.resolve(import.meta.dirname, "../../..");
export const migrationNames = fs
  .readdirSync(path.join(root, "database/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
export const spec = YAML.parse(
  fs.readFileSync(path.join(root, "contracts/openapi.yaml"), "utf8"),
);
const ajv = new Ajv({ strict: false, allErrors: true });
formats(ajv);
ajv.addSchema({
  $id: "piora",
  $defs: JSON.parse(
    JSON.stringify(spec.components.schemas).replaceAll(
      "#/components/schemas/",
      "#/$defs/",
    ),
  ),
});
const validators = new Map();
export class ApiError extends Error {
  constructor(status, code, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function validate(name, value) {
  let v = validators.get(name);
  if (!v) {
    v = ajv.compile({ $ref: "piora#/$defs/" + name });
    validators.set(name, v);
  }
  if (!v(value))
    throw new ApiError(400, "VALIDATION_ERROR", "参数不符合 " + name);
  return value;
}
export function validateSchema(schema, value) {
  const key = JSON.stringify(schema);
  let v = validators.get(key);
  if (!v) {
    v = ajv.compile(schema);
    validators.set(key, v);
  }
  if (!v(value)) throw new ApiError(400, "VALIDATION_ERROR");
  return value;
}
export const digest = (value) =>
  crypto.createHash("sha256").update(canonicalize(value)).digest();
export const secretHash = (secret, pepper) =>
  crypto.createHmac("sha256", pepper).update(secret).digest();
export const token = () => crypto.randomBytes(32).toString("base64url");
export const sameHash = (a, b) =>
  a?.length === b?.length && crypto.timingSafeEqual(a, b);
export const clean = (x) => JSON.parse(JSON.stringify(x));
export const uuid = () => crypto.randomUUID();
export const iso = () => new Date().toISOString();
export async function transaction(pool, fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const v = await fn(c);
    await c.query("COMMIT");
    return v;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export function createPool(url) {
  return new pg.Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });
}
export async function migrate(pool) {
  await transaction(pool, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(71203001)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of migrationNames) {
      if (
        (await c.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name]))
          .rowCount
      )
        continue;
      const sql = fs
        .readFileSync(path.join(root, "database/migrations", name), "utf8")
        .replace(/^BEGIN;\s*$/gm, "")
        .replace(/^COMMIT;\s*$/gm, "");
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    }
  });
}
export async function one(c, sql, args = [], status = 404) {
  const r = await c.query(sql, args);
  if (!r.rows.length) throw new ApiError(status, "NOT_FOUND");
  return r.rows[0];
}
export async function audit(c, ctx, action, targetType, targetId, summary) {
  await c.query(
    "INSERT INTO audit_logs(id,org_id,actor_id,action,target_type,target_id,summary,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      uuid(),
      ctx.org,
      ctx.account.id,
      action,
      targetType,
      targetId,
      summary.slice(0, 500),
      ctx.requestId,
    ],
  );
}
export function seal(value, secret) {
  const iv = crypto.randomBytes(12),
    key = crypto.createHash("sha256").update(secret).digest(),
    c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const bytes = Buffer.concat([c.update(JSON.stringify(value)), c.final()]);
  return {
    iv: iv.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
    data: bytes.toString("base64"),
  };
}
export function unseal(value, secret) {
  const d = crypto.createDecipheriv(
    "aes-256-gcm",
    crypto.createHash("sha256").update(secret).digest(),
    Buffer.from(value.iv, "base64"),
  );
  d.setAuthTag(Buffer.from(value.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      d.update(Buffer.from(value.data, "base64")),
      d.final(),
    ]).toString(),
  );
}
export function page(items, q, ctx) {
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
  let offset = 0;
  const filterHash = digest({
      route: ctx.route,
      ...q,
      cursor: undefined,
    }).toString("hex"),
    snapshot = digest(items).toString("hex");
  if (q.cursor) {
    try {
      const v = unseal(
        JSON.parse(Buffer.from(q.cursor, "base64url").toString()),
        ctx.pepper,
      );
      if (
        v.org !== ctx.org ||
        v.hash !== filterHash ||
        v.snapshot !== snapshot ||
        v.expires < Date.now()
      )
        throw 0;
      offset = v.offset;
    } catch {
      throw new ApiError(400, "CURSOR_INVALID");
    }
  }
  const next =
    offset + limit < items.length
      ? Buffer.from(
          JSON.stringify(
            seal(
              {
                org: ctx.org,
                hash: filterHash,
                snapshot,
                offset: offset + limit,
                expires: Date.now() + 900000,
              },
              ctx.pepper,
            ),
          ),
        ).toString("base64url")
      : null;
  return {
    items: items.slice(offset, offset + limit),
    next_cursor: next,
    total: String(items.length),
  };
}
export const adminDTO = (r) => ({
  id: r.id,
  username: r.username,
  display_name: r.display_name,
  role: r.role,
  status: r.status,
  revision: r.revision,
  must_change_password: r.must_change_password,
});
export const departmentDTO = (r) => ({
  id: r.id,
  name: r.name,
  status: r.status,
  revision: r.revision,
});
export const employeeDTO = (r) => ({
  id: r.id,
  name: r.name,
  employee_no: r.employee_no,
  department_id: r.department_id ?? null,
  status: r.status,
  installation_count: Number(r.installation_count ?? 0),
  revision: r.revision,
});
