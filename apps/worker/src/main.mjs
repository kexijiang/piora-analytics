import { reconcileIdentities } from "./identity.mjs";
import path from "node:path";
import { createPool, root } from "../../api/src/core.mjs";
import { runAggregation } from "./aggregate.mjs";
import { runExports } from "../../api/src/exports.mjs";
import { maintain } from "./maintenance.mjs";
const pool = createPool(process.env.DATABASE_URL),
  config = {
    pepper: process.env.ANALYTICS_PEPPER,
    exportDir: process.env.EXPORT_DIR ?? path.join(root, ".local/exports"),
  };
if (!config.pepper || config.pepper.length < 32)
  throw new Error("ANALYTICS_PEPPER is required");
let stopped = false,
  lastMaintenance = 0;
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    stopped = true;
  });
while (!stopped) {
  try {
    if (Date.now() - lastMaintenance > 3600000) {
      await maintain(pool, config);
      lastMaintenance = Date.now();
    }
    await reconcileIdentities(pool, 50);
    await runAggregation(pool, 50);
    await runExports(pool, config);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "worker_failure",
        code: error.code ?? "WORKER_FAILED",
      }),
    );
  }
  if (!stopped) await new Promise((resolve) => setTimeout(resolve, 3000));
}
await pool.end();
