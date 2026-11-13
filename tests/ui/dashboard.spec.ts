import { test, expect } from "@playwright/test";
import fs from "node:fs";
const dir = "docs/ui/screenshots";
test("看板各页、筛选、详情、导出、权限与 UI 图", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?demo=1");
  await expect(
    page.getByRole("heading", { name: "使用总览", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".metric-value").first()).toHaveText("10人");
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: dir + "/01-overview-light.png",
    fullPage: true,
  });
  await page.getByLabel("部门筛选").selectOption({ label: "产品研发" });
  await expect(page.locator(".metric-value").first()).toHaveText("4人");
  await page.getByLabel("部门筛选").selectOption("");
  await page.getByRole("button", { name: "员工每日明细", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "每人每天的使用情况" }),
  ).toBeVisible();
  await page.screenshot({
    path: dir + "/02-employee-daily.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: /查看 陈一禾/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "员工详情" })).toBeVisible();
  await page.screenshot({ path: dir + "/03-employee-detail.png" });
  await page.getByLabel("关闭员工详情").click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出数据" }).click();
  expect((await download).suggestedFilename()).toContain(".csv");
  await expect(page.locator(".toast")).toBeHidden();
  await page.getByRole("button", { name: "请求与模型", exact: true }).click();
  await page.screenshot({ path: dir + "/04-model-usage.png", fullPage: true });
  await page.getByRole("button", { name: "Query 明细", exact: true }).click();
  await page.getByRole("button", { name: "查看调用" }).first().click();
  await expect(page.getByRole("dialog", { name: "Query 详情" })).toBeVisible();
  await page.screenshot({ path: dir + "/05-query-detail.png" });
  await page.getByLabel("关闭 Query 详情").click();
  await page.getByRole("button", { name: "代码产出", exact: true }).click();
  await page.screenshot({ path: dir + "/06-code-output.png", fullPage: true });
  await page
    .getByRole("button", { name: /采集健康/ })
    .first()
    .click();
  await page.screenshot({
    path: dir + "/07-ingestion-health.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "绑定员工", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog", { name: "绑定员工" })).toBeVisible();
  await page.getByLabel("关闭绑定").click();
  await page.getByRole("button", { name: "组织设置", exact: true }).click();
  await expect(page.getByLabel("最短同步间隔")).toHaveValue("25");
  await page.screenshot({ path: dir + "/08-settings.png", fullPage: true });
  await page.getByRole("button", { name: "演示 · 合成数据" }).click();
  await page.getByLabel("模拟只读权限").check();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "当前账号为只读角色" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "使用总览", exact: true }).click();
  await page.getByLabel("切换深色主题").click();
  await page.screenshot({
    path: dir + "/09-overview-dark.png",
    fullPage: true,
  });
  await page.getByLabel("切换浅色主题").click();
  await page.setViewportSize({ width: 800, height: 1100 });
  await page.screenshot({
    path: dir + "/10-narrow-layout.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "演示 · 合成数据" }).click();
  await page.getByLabel("数据状态").selectOption("error");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "暂时无法获取统计" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重新加载" }).click();
  await page.getByRole("button", { name: "演示 · 合成数据" }).click();
  await page.getByLabel("数据状态").selectOption("empty");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "这个范围内还没有数据" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
