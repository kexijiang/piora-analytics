// Only run against the disposable Compose deployment created by release CI.
import assert from "node:assert/strict";
const origin = process.env.ANALYTICS_ORIGIN;
assert.equal(new URL(origin).hostname, "127.0.0.1");
const page = await fetch(origin);
assert.equal(page.status, 200);
assert.match(await page.text(), /<html/);
const login = await fetch(`${origin}/v1/admin/auth/login`, {
  method: "POST",
  headers: { origin, "content-type": "application/json" },
  body: JSON.stringify({ username: "admin", password: process.env.INIT_ADMIN_PASSWORD }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie");
assert.match(cookie, /^piora_analytics=/);
assert.doesNotMatch(cookie, /; Secure/);
const session = await fetch(`${origin}/v1/admin/auth/session`, {
  headers: { cookie: cookie.split(";")[0] },
});
assert.equal(session.status, 200);
console.log("Compose static dashboard and HTTP session passed (synthetic administrator).");
