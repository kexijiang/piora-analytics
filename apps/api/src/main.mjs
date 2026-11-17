import path from "node:path";
import { createPool, root } from "./core.mjs";
import { createServer } from "./server.mjs";
const pool = createPool(process.env.DATABASE_URL);
const org = (await pool.query("SELECT id,name FROM organizations LIMIT 2"))
  .rows;
if (org.length !== 1)
  throw new Error("Initialize exactly one organization with npm run setup");
const app = await createServer(pool, {
  org: org[0].id,
  orgName: org[0].name,
  pepper: process.env.ANALYTICS_PEPPER,
  origin: process.env.ANALYTICS_ORIGIN,
  allowHttp: process.env.ALLOW_HTTP === "true",
  development: process.env.NODE_ENV !== "production",
  serveDashboard: process.env.SERVE_DASHBOARD === "true",
  exportDir: process.env.EXPORT_DIR ?? path.join(root, ".local/exports"),
  logger: true,
});
await app.listen({
  port: Number(process.env.PORT ?? 4319),
  host: process.env.HOST ?? "127.0.0.1",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await app.close();
    await pool.end();
  });
