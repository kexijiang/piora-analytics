import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";

test.use({ trace: "off", screenshot: "off", video: "off" });

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
    const employeePanel = page.getByRole("region", {name: "员工管理"});
    await expect(employeePanel.locator("tbody tr")).toHaveCount(20);
    await expect(employeePanel).toContainText("共 25 条 · 第 1 页");
    await employeePanel.getByRole("button", {name: "下一页员工"}).click();
    await expect(employeePanel.locator("tbody tr")).toHaveCount(5);
    await expect(employeePanel.getByRole("button", {name: "下一页员工"})).toBeDisabled();
    await employeePanel.getByRole("button", {name: "上一页员工"}).click();
    await expect(employeePanel.locator("tbody tr")).toHaveCount(20);
    await page.getByLabel("搜索姓名或工号").fill("staff-25");
    await page.getByRole("button", {name: "搜索员工", exact: true}).click();
    await expect(employeePanel.locator("tbody tr")).toHaveCount(1);
    await expect(employeePanel).toContainText("员工合成25");
    await page.getByLabel("搜索姓名或工号").fill("员工合成24");
    await page.getByLabel("搜索姓名或工号").press("Enter");
    await expect(employeePanel).toContainText("STAFF-24");
    await page.getByLabel("搜索姓名或工号").fill("不存在的员工");
    await page.getByLabel("搜索姓名或工号").press("Enter");
    await expect(employeePanel).toContainText("没有匹配的员工");
    await page.getByRole("button", {name: "清除员工搜索"}).click();
    await expect(employeePanel.locator("tbody tr")).toHaveCount(20);
    await expect(employeePanel).toContainText("共 25 条 · 第 1 页");
    expect(await employeePanel.locator(".table-wrap").evaluate(el => el.clientHeight)).toBeLessThanOrEqual(480);
    await employeePanel.screenshot({path: ".verification/employee-pagination.png"});
    await page.setViewportSize({width: 800, height: 1100});
    await employeePanel.screenshot({path: ".verification/employee-pagination-narrow.png"});
    await page.setViewportSize({width: 1600, height: 1050});
    await page.getByRole("button", {name: "添加员工", exact: true}).click();
    await page.getByRole("dialog").getByLabel("名称", {exact: true}).fill("新建合成员工");
    await page.getByRole("dialog").getByRole("button", {name: "创建", exact: true}).click();
    await expect(employeePanel).toContainText("共 26 条");
    await page.getByLabel("搜索姓名或工号").fill("新建合成员工");
    await page.getByRole("button", {name: "搜索员工", exact: true}).click();
    await expect(employeePanel.locator("tbody tr")).toHaveCount(1);
    await expect(employeePanel.locator("tbody")).toContainText("新建合成员工");
    const keyPanel = page.getByRole("region", {name: "接入凭证管理"});
    await expect(keyPanel.locator("tbody tr")).toHaveCount(20);
    await expect(keyPanel).toContainText("共 25 条 · 第 1 页");
    await keyPanel.getByRole("button", {name: "下一页凭证"}).click();
    await expect(keyPanel.locator("tbody tr")).toHaveCount(5);
    await expect(keyPanel).toContainText("第 2 页");
    await expect(keyPanel.getByRole("button", {name: "下一页凭证"})).toBeDisabled();
    await keyPanel.getByRole("button", {name: "上一页凭证"}).click();
    await expect(keyPanel.locator("tbody tr")).toHaveCount(20);
    await page.getByLabel("搜索用途名称").fill("fixture-25");
    await page.getByRole("button", {name: "搜索凭证", exact: true}).click();
    await expect(keyPanel.locator("tbody tr")).toHaveCount(1);
    await expect(keyPanel).toContainText("Search-Fixture-25");
    await expect(keyPanel).toContainText("共 1 条 · 第 1 页");
    await page.getByLabel("搜索用途名称").fill("不存在的用途");
    await page.getByLabel("搜索用途名称").press("Enter");
    await expect(keyPanel).toContainText("没有匹配的接入凭证");
    await page.getByRole("button", {name: "清除搜索"}).click();
    await expect(keyPanel.locator("tbody tr")).toHaveCount(20);
    await expect(keyPanel).toContainText("共 25 条 · 第 1 页");
    await page.setViewportSize({width: 800, height: 1100});
    await keyPanel.screenshot({path: ".verification/enrollment-pagination-narrow.png"});
    await page.setViewportSize({width: 1600, height: 1050});
    await keyPanel.screenshot({path: ".verification/enrollment-pagination.png"});
    // Synthetic credentials only. Disable trace/screenshots for this test below.
    await page
      .getByRole("button", { name: "创建接入凭证", exact: true })
      .click();
    await page.getByLabel("用途名称", {exact: true}).fill("浏览器合成凭证");
    await page.getByLabel("有效期（天）").fill("2");
    await page.getByLabel("允许注册次数", { exact: true }).fill("3");
    await page.getByRole("button", { name: "创建", exact: true }).click();
    const secretDialog = page.getByRole("dialog", { name: "保存接入凭证" });
    await expect(secretDialog).toBeVisible();
    await expect(secretDialog).toContainText(
      "明文仅本次显示，关闭后无法再次查看",
    );
    // Stub the clipboard, compare inside the browser so keys never enter assertion logs.
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            if (
              value !==
                (
                  document.querySelector(
                    "dialog textarea",
                  ) as HTMLTextAreaElement
                ).value ||
              !value.startsWith("enroll.")
            )
              throw new Error("Incomplete copy");
          },
        },
      }),
    );
    await page.getByRole("button", { name: "复制完整凭证" }).click();
    await expect(secretDialog.getByRole("status")).toContainText(
      "已复制完整凭证",
    );
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("denied");
          },
        },
      }),
    );
    await page.getByRole("button", { name: "复制完整凭证" }).click();
    await expect(secretDialog.getByRole("status")).toContainText("复制失败");
    expect(
      await page
        .getByLabel("完整接入凭证")
        .evaluate(
          (el: HTMLTextAreaElement) =>
            el.selectionStart === 0 && el.selectionEnd === el.value.length,
        ),
    ).toBe(true);
    page.once("dialog", (d) => d.dismiss());
    await page.getByLabel("关闭接入凭证弹窗").click();
    await expect(secretDialog).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.keyboard.press("Escape");
    await expect(secretDialog).not.toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "组织设置", exact: true }).click();
    const keyRow = page.getByRole("row").filter({ hasText: "浏览器合成凭证" });
    await expect(keyRow).toContainText("可用");
    await expect(keyRow.getByRole("cell").nth(2)).toHaveText("3");
    await expect(keyRow.getByRole("cell").nth(3)).toHaveText("0");
    await keyRow.getByRole("button", { name: "撤销", exact: true }).click();
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect(keyRow).toContainText("可用");
    await keyRow.getByRole("button", { name: "撤销", exact: true }).click();
    await page.getByRole("button", { name: "确认撤销", exact: true }).click();
    await expect(keyRow).toContainText("已撤销");
    await page.getByRole("button", { name: "刷新凭证" }).click();
    await expect(
      keyRow.getByRole("button", { name: "撤销", exact: true }),
    ).toBeDisabled();
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
