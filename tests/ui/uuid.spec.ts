import { test, expect } from "@playwright/test";

test("login sends a UUID idempotency key without native randomUUID", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined });
  });
  await page.route("**/v1/admin/**", async (route) => {
    await route.fulfill({
      status: 401,
      json: { error: { code: "TEST_LOGIN_REJECTED" } },
    });
  });
  await page.goto("/");
  await page.getByLabel("后台账号").fill("test-admin");
  await page.getByLabel("密码", { exact: true }).fill("test-password");
  const request = page.waitForRequest((r) => r.url().endsWith("/auth/login"));
  await page.getByRole("button", { name: "登录看板" }).click();
  expect((await request).headers()["idempotency-key"]).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  await expect(page.getByText("TEST_LOGIN_REJECTED")).toBeVisible();
});
