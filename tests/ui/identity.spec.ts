import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
test("unbound device statistics, empty employee guidance and domain auto matching", async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(10000);
  const server = spawn(process.execPath, ["scripts/ui-api-fixture.mjs"], {
    env: { ...process.env, IDENTITY_UI_FIXTURE: "true" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true,
  });
  let logs = "";
  server.stdout.on("data", (b) => (logs += b));
  server.stderr.on("data", (b) => (logs += b));
  try {
    const fixture = await new Promise<{ bearer: string; installation: string }>(
      (resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(logs)), 60000);
        server.once("message", (m: any) => {
          clearTimeout(timer);
          m.ready ? resolve(m) : reject(new Error(logs));
        });
        server.once("exit", () => {
          clearTimeout(timer);
          reject(new Error(logs));
        });
      },
    );
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByLabel("后台账号").fill("browser-admin");
    await page.getByLabel("密码", { exact: true }).fill("Browser-fixture-123");
    await page.getByRole("button", { name: "登录看板" }).click();
    await expect(page.getByText(/已接入 1 台未关联员工/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "这个范围内还没有数据" }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "使用趋势" })).toBeVisible();
    await page.getByRole("button", { name: /采集健康/ }).click();
    await page.getByRole("button", { name: "绑定员工", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "确认绑定", exact: true }),
    ).toBeDisabled();
    await expect(page.getByText(/暂无员工，请先创建员工/)).toBeVisible();
    await page.getByRole("button", { name: "创建员工", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "关闭表单" }).click();
    await page.getByLabel("启用域账号自动关联").check();
    await page.getByLabel("不存在时自动创建员工").check();
    await page.getByRole("button", { name: "添加域规则", exact: true }).click();
    await page.getByLabel("域名 1", { exact: true }).fill("CHINA");
    await page
      .getByRole("button", { name: "保存域账号规则", exact: true })
      .click();
    await expect(page.getByText(/域账号规则已保存/)).toBeVisible();
    // The authenticated device request prepares the real automatic-matching result.
    const response = await page.request.post("/v1/installations/identity", {
      headers: {
        authorization: fixture.bearer,
        "Idempotency-Key": crypto.randomUUID(),
      },
      data: {
        identity: {
          account_type: "domain",
          domain: "CHINA",
          account_name: "001234",
          source: "windows_logon",
        },
      },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).data.state).toBe("matched");
    await page.reload();
    await page.getByRole("button", { name: /采集健康/ }).click();
    await expect(page.getByText("域账号匹配成功 · 自动关联")).toBeVisible();
    await expect(
      page.getByRole("table").getByText("001234", { exact: true }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "员工每日明细", exact: true })
      .click();
    await expect(
      page.getByRole("table").getByText("001234", { exact: true }).first(),
    ).toBeVisible();
    // An administrator can correct an automatic association in the browser.
    await page.getByRole("button", { name: "组织设置", exact: true }).click();
    await page.getByRole("button", { name: "添加员工", exact: true }).click();
    await page.getByRole("dialog").getByLabel("名称").fill("人工确认员工");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "创建", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: /采集健康/ }).click();
    await page.getByRole("button", { name: "绑定员工", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "纠正安装归属" }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByLabel("归属员工")
      .selectOption({ label: "人工确认员工 ·" });
    await page
      .getByLabel("绑定或纠错原因")
      .fill("合成浏览器验证：人工纠错优先");
    await page.getByRole("button", { name: "保存纠错", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("保留人工确认的归属")).toBeVisible();
    await expect(
      page
        .getByRole("table")
        .getByText("人工确认员工", { exact: true })
        .first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "组织设置", exact: true }).click();
    await expect(page.getByLabel("域名 1", { exact: true })).toHaveValue(
      "CHINA",
    );
    await page.screenshot({
      path: ".verification/domain-identity-browser.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    if (server.connected) {
      const done = once(server, "exit");
      server.send("stop");
      await done;
    }
  }
});
