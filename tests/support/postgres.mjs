import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import { root, createPool, migrate } from "../../apps/api/src/core.mjs";
export async function testDatabase() {
  let server;
  let url = process.env.DATABASE_URL;
  if (!url) {
    const port = await new Promise((resolve) => {
      const s = net.createServer();
      s.listen(0, "127.0.0.1", () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    });
    const dir = path.resolve(
      root,
      ".verification",
      "pg-" + process.pid + "-" + Date.now(),
    );
    if (!dir.startsWith(path.resolve(root, ".verification") + path.sep))
      throw new Error("Unsafe test directory");
    fs.mkdirSync(dir, { recursive: true });
    server = new EmbeddedPostgres({
      databaseDir: dir,
      user: "postgres",
      password: "disposable-test-only",
      port,
      persistent: true,
      initdbFlags: ["--locale=C", "--encoding=UTF8"],
      onLog: () => {},
      onError: () => {},
    });
    await server.initialise();
    await server.start();
    await server.createDatabase("piora_analytics_test");
    url =
      "postgresql://postgres:disposable-test-only@127.0.0.1:" +
      port +
      "/piora_analytics_test";
  }
  if (!new URL(url).pathname.endsWith("_test"))
    throw new Error("Only a disposable *_test database is allowed");
  const pool = createPool(url);
  const exists = (
    await pool.query("SELECT to_regclass('public.organizations') AS name")
  ).rows[0].name;
  if (exists) throw new Error("Test database must be empty");
  await migrate(pool);
  return {
    pool,
    url,
    close: async () => {
      await pool.end();
      if (server) await server.stop();
    },
  };
}
