import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("真实浏览器登录、Cookie/CSRF、组织管理与报表 API", async ({ page }) => {
  test.setTimeout(120000);
  const server = spawn(process.execPath, ["scripts/ui-api-fixture.mjs"], {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true,
  });
  let logs = "";
  server.stdout.on("data", (b) => {
    logs += b;
  });
  server.stderr.on("data", (b) => {
    logs += b;
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("API fixture timeout: " + logs)),
        60000,
      );
      server.once("message", (message) => {
        clearTimeout(timeout);
        message === "ready" ? resolve() : reject(new Error(logs));
      });
      server.once("exit", () => {
        clearTimeout(timeout);
        reject(new Error(logs));
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const failures: string[] = [];
    page.on("response", (r) => {
      if (
        r.url().includes("/v1/") &&
        r.status() >= 400 &&
        !r.url().endsWith("/auth/session")
      )
        failures.push(r.status() + " " + r.url());
    });
    await page.goto("/");
    await page.getByLabel("后台账号").fill("browser-admin");
    await page.getByLabel("密码", { exact: true }).fill("Browser-fixture-123");
    await page.getByRole("button", { name: "登录看板" }).click();
    await expect(
      page.getByRole("heading", { name: "使用总览", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "组织设置", exact: true }).click();
    const minSync = page.getByLabel("最短同步间隔"),
      maxSync = page.getByLabel("最长同步间隔");
    await expect(minSync).toHaveValue("25");
    await minSync.fill("5");
    await maxSync.fill("15");
    await expect(page.locator(".sync-mini")).toContainText(
      "随机间隔 25–35 分钟",
    );
    await page
      .getByRole("button", { name: "保存同步策略", exact: true })
      .click();
    await expect(page.locator(".sync-mini")).toContainText(
      "随机间隔 5–15 分钟",
    );
    await page.reload();
    await page.getByRole("button", { name: "组织设置", exact: true }).click();
    await expect(minSync).toHaveValue("5");
    await expect(maxSync).toHaveValue("15");
    await minSync.fill("180");
    await maxSync.fill("1440");
    await page
      .getByRole("button", { name: "保存同步策略", exact: true })
      .click();
    await expect(page.locator(".sync-mini")).toContainText(
      "随机间隔 180–1440 分钟",
    );
    await minSync.fill("20");
    await maxSync.fill("5");
    await page
      .getByRole("button", { name: "保存同步策略", exact: true })
      .click();
    await expect(page.locator(".toast")).toContainText(
      "最长同步间隔不能小于最短同步间隔",
    );
    await expect(page.locator(".sync-mini")).toContainText(
      "随机间隔 180–1440 分钟",
    );
    await minSync.fill("1");
    await maxSync.fill("1");
    await page
      .getByRole("button", { name: "保存同步策略", exact: true })
      .click();
    await expect(page.locator(".sync-mini")).toContainText("随机间隔 1–1 分钟");
    await page.getByRole("button", { name: "添加部门", exact: true }).click();
    await page.getByRole("dialog").getByLabel("名称").fill("浏览器创建部门");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "创建", exact: true })
      .click();
    await expect(
      page.getByText("浏览器创建部门", { exact: true }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "使用总览", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "组织设置", exact: true }).click();
    await expect(
      page.getByText("浏览器创建部门", { exact: true }).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
  } finally {
    if (server.connected) {
      const done = once(server, "exit");
      server.send("stop");
      await done;
    }
  }
});
