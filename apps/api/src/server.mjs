import { matchIdentity } from "./identity.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import Fastify, { LogController } from "fastify";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import {
  ApiError,
  spec,
  root,
  databaseReady,
  uuid,
  iso,
  transaction,
  validate,
  validateSchema,
  digest,
  sameHash,
  seal,
  unseal,
  clean,
} from "./core.mjs";
import { authenticate, authOperation, passwordHash } from "./auth.mjs";
import { register, rotate, ingest } from "./ingest.mjs";
import { adminOperation } from "./admin.mjs";
import { report } from "./reports.mjs";
import { exportOperation } from "./exports.mjs";

export async function createServer(pool, config) {
  if (!config.pepper || config.pepper.length < 32)
    throw new Error("ANALYTICS_PEPPER must contain at least 32 characters");
  if (!config.org || !config.origin)
    throw new Error("Organization and origin are required");
  if (!config.origin.startsWith("https://") && !config.development && !config.allowHttp)
    throw new Error("Production origin must be HTTPS");
  const origin = new URL(config.origin);
  if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== config.origin)
    throw new Error("ANALYTICS_ORIGIN must be an HTTP(S) origin without a path");
  config.secureCookies = origin.protocol === "https:";
  config.cookieName = config.secureCookies ? "__Host-piora_analytics" : "piora_analytics";
  config.dummyPasswordHash = await passwordHash("unmatchable-" + uuid());
  config.exportDir ??= path.join(root, ".local/exports");
  const app = Fastify({
    bodyLimit: 262144,
    requestTimeout: 15000,
    genReqId: uuid,
    logger: config.logger ?? false,
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: false,
  });
  await app.register(cookie);
  const rates = new Map();
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer");
    const login = req.url.startsWith("/v1/admin/auth/login"),
      key = (login ? "login:" : "all:") + req.ip;
    const now = Date.now(),
      window = login ? 900000 : 60000;
    let r = rates.get(key);
    if (!r || r.until <= now) {
      r = { count: 0, until: now + window };
      rates.set(key, r);
    }
    if (++r.count > (login ? 1000 : 10000)) {
      reply.header("Retry-After", Math.ceil((r.until - now) / 1000));
      throw new ApiError(429, "RATE_LIMITED");
    }
    if (req.method !== "GET" && req.headers["sec-fetch-site"] === "cross-site")
      throw new ApiError(403, "CSRF_INVALID");
    if (rates.size > 20000)
      for (const [k, v] of rates) if (v.until < now) rates.delete(k);
  });
  app.setErrorHandler((error, req, reply) => {
    let status = error.status ?? error.statusCode ?? 500,
      code = error.code ?? "INTERNAL_ERROR";
    if (error.code === "23505") {
      status = 409;
      code = "DUPLICATE_RESOURCE";
    }
    if (error.code === "23P01") {
      status = 409;
      code = "BINDING_OVERLAP";
    }
    if (error.code === "23503") {
      status = 404;
      code = "NOT_FOUND";
    }
    if (
      error.code === "22P02" ||
      error.code === "22007" ||
      error.code === "22008"
    ) {
      status = 400;
      code = "VALIDATION_ERROR";
    }
    if (error.code === "23514") {
      status = 422;
      code = "POLICY_INVALID";
    }
    if (status >= 500) {
      status = 503;
      code = "STORAGE_UNAVAILABLE";
      app.log.error({ code: error.code, request_id: req.id }, "request failed");
    }
    reply.code(status).send({
      error: {
        code,
        message:
          status >= 500
            ? "服务暂时不可用"
            : error instanceof ApiError
              ? error.message
              : code,
        retryable: [429, 503].includes(status),
        request_id: req.id,
        field_errors: [],
      },
    });
  });
  for (const [url, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const pathURL = url.replace(/\{(\w+)\}/g, ":$1"),
        id = op.operationId,
        role = op["x-required-role"],
        status = Number(
          Object.keys(op.responses).find((x) => x.startsWith("2")),
        );
      app.route({
        method: method.toUpperCase(),
        url: pathURL,
        handler: async (req, reply) => {
          for (const param of op.parameters.filter((p) => p.in === "path"))
            if (
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                req.params[param.name],
              )
            )
              throw new ApiError(400, "VALIDATION_ERROR");
          for (const param of op.parameters.filter(
            (p) => p.required && p.in !== "path",
          ))
            if (
              (param.in === "query"
                ? req.query[param.name]
                : req.headers[param.name.toLowerCase()]) === undefined
            )
              throw new ApiError(400, "VALIDATION_ERROR");
          const queryParams = op.parameters.filter((p) => p.in === "query");
          if (
            Object.keys(req.query).some(
              (k) => !queryParams.some((p) => p.name === k),
            )
          )
            throw new ApiError(400, "VALIDATION_ERROR");
          for (const p of queryParams)
            if (req.query[p.name] !== undefined) {
              let v = req.query[p.name];
              if (
                p.schema.type === "integer" &&
                typeof v === "string" &&
                /^\d+$/.test(v)
              )
                v = Number(v);
              if (p.schema.type === "array" && !Array.isArray(v)) v = [v];
              req.query[p.name] = validateSchema(p.schema, v);
            }
          const requestSchema = op.requestBody?.content[
            "application/json"
          ].schema.$ref
            .split("/")
            .at(-1);
          if (requestSchema && id !== "ingestBatch")
            validate(requestSchema, req.body);
          if (id === "serverCapabilities") return {data: {capabilities: ["windows-domain-identity-v1", "windows-display-name-v1"]}, meta: {request_id:req.id,server_time:iso()}};
          if (id === "liveness")
            return {
              data: { status: "ok" },
              meta: { request_id: req.id, server_time: iso() },
            };
          if (id === "readiness") {
            if (!(await databaseReady(pool)))
              throw new ApiError(503, "NOT_READY");
            return {
              data: { status: "ok" },
              meta: { request_id: req.id, server_time: iso() },
            };
          }
          const result = await transaction(pool, async (c) => {
            const auth = await authenticate(c, req, role, config),
              ctx = {
                ...auth,
                requestId: req.id,
                pepper: config.pepper,
                route: method + " " + req.url.split("?")[0],
              };
            const mutation =
                ctx.account && method !== "get" && !url.includes("/auth/"),
              key = req.headers["idempotency-key"];
            if (ctx.account)
              for (const [field, table] of [
                ["employee_ids", "employees"],
                ["department_ids", "departments"],
              ]) {
                const ids = req.query[field];
                if (!ids?.length) continue;
                const count = (
                  await c.query(
                    "SELECT count(*)::int AS n FROM " +
                      table +
                      " WHERE org_id=$1 AND id=ANY($2::uuid[])",
                    [ctx.org, ids],
                  )
                ).rows[0].n;
                if (count !== new Set(ids).size)
                  throw new ApiError(404, "NOT_FOUND");
              }
            if (mutation) {
              if (typeof key !== "string" || key.length > 128)
                throw new ApiError(400, "VALIDATION_ERROR");
              await c.query(
                "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
                [ctx.org + ctx.account.id + ctx.route + key],
              );
              const old = (
                await c.query(
                  "SELECT * FROM idempotency_keys WHERE org_id=$1 AND actor_id=$2 AND route=$3 AND key=$4 AND expires_at>now()",
                  [ctx.org, ctx.account.id, ctx.route, key],
                )
              ).rows[0];
              if (old) {
                if (!sameHash(old.request_hash, digest(req.body ?? {})))
                  throw new ApiError(409, "IDEMPOTENCY_CONFLICT");
                return unseal(old.response_body, config.pepper);
              }
            }
            let body,
              extraMeta = {};
            if (url.includes("/auth/"))
              body = await authOperation(
                c,
                id,
                req.body,
                ctx,
                req,
                reply,
                config,
              );
            else if (id === "registerInstallation")
              body = await register(c, req.body, req, config);
            else if (id === "updateIdentity")
              body = await matchIdentity(c, req.body.identity, ctx);
            else if (id === "rotateCredential")
              body = await rotate(c, req.body, ctx, req, config);
            else if (id === "ingestBatch") {
              const rkey = "device:" + ctx.installation,
                now = Date.now();
              let r = rates.get(rkey);
              if (!r || r.until <= now) {
                r = { count: 0, until: now + 60000 };
                rates.set(rkey, r);
              }
              if (++r.count > 20) {
                reply.header("Retry-After", 60);
                throw new ApiError(429, "RATE_LIMITED");
              }
              body = await ingest(c, req.body, ctx, req);
            } else if (url.includes("/analytics/")) {
              const r = await report(c, id, req.query, req.params, ctx);
              body = r.data;
              extraMeta = r.meta ?? {};
            } else if (url.includes("/exports")) {
              body = await exportOperation(c, id, req.body, req.params, ctx);
              if (id === "downloadExport") return { download: body.object_key };
            } else
              body = await adminOperation(
                c,
                id,
                req.body,
                req.query,
                req.params,
                ctx,
              );
            const envelope = {
              data: clean(body),
              meta: { request_id: req.id, server_time: iso(), ...extraMeta },
            };
            validate(id + "Response", envelope);
            if (mutation)
              await c.query(
                "INSERT INTO idempotency_keys(org_id,actor_id,route,key,request_hash,response_status,response_body,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '24 hours') ON CONFLICT(org_id,actor_id,route,key) DO UPDATE SET request_hash=EXCLUDED.request_hash,response_status=EXCLUDED.response_status,response_body=EXCLUDED.response_body,expires_at=EXCLUDED.expires_at",
                [
                  ctx.org,
                  ctx.account.id,
                  ctx.route,
                  key,
                  digest(req.body ?? {}),
                  status,
                  seal(envelope, config.pepper),
                ],
              );
            return envelope;
          });
          if (result.download) {
            reply
              .header("Content-Type", "text/csv; charset=utf-8")
              .header(
                "Content-Disposition",
                'attachment; filename="piora-analytics.csv"',
              );
            return fs.readFile(path.join(config.exportDir, result.download));
          }
          return reply.code(status).send(result);
        },
      });
    }
  }
  const dist = path.join(root, "apps/dashboard/dist");
  if (config.serveDashboard) {
    await app.register(staticFiles, { root: dist, prefix: "/" });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/v1/")
        ? reply.code(404).send({
            error: {
              code: "NOT_FOUND",
              message: "NOT_FOUND",
              retryable: false,
              request_id: req.id,
              field_errors: [],
            },
          })
        : reply.sendFile("index.html"),
    );
  }
  return app;
}
