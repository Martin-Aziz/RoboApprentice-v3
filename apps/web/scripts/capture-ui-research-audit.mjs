import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.env.AUREVIX_URL ?? "http://localhost:3100";
const output = "/Users/martin/Documents/RoboApprentice-v3/docs/ui-research-audit-2026-06-20/screenshots";
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1.5,
  colorScheme: "light",
});
const page = await context.newPage();
const results = [];

async function capture(name, url, action, expectedText) {
  try {
    await page.goto(`${base}${url}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1100);
    if (action) await action(page);
    await page.waitForTimeout(500);
    const bodyText = await page.locator("body").innerText();
    if (/404|This page could not be found/i.test(bodyText)) throw new Error("Page rendered a 404 state.");
    if (expectedText && !bodyText.includes(expectedText)) {
      throw new Error(`Expected verified text not found: ${expectedText}`);
    }
    const file = path.join(output, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const size = await (await import("node:fs/promises")).stat(file);
    if (size.size < 20_000) throw new Error(`Screenshot file is unexpectedly small: ${size.size} bytes`);
    results.push({ name, url, status: "captured", bytes: size.size });
  } catch (error) {
    results.push({ name, url, status: "failed", error: String(error) });
  }
}

async function clickText(text) {
  const locator = page.getByText(text, { exact: true }).first();
  await locator.waitFor({ state: "visible", timeout: 10000 });
  await locator.click();
}

await capture("01-landing-page", "/", null, "Teach robots");
await capture("02-dashboard-overview", "/app", null, "See a manual task become robot-ready");
await page.goto(`${base}/app/robots`, { waitUntil: "domcontentloaded" });
await page.getByTestId("robot-card").first().waitFor({ state: "visible", timeout: 20000 });
const robotHref = await page.getByTestId("robot-card").first().getAttribute("href");
await capture("03-robots-fleet", "/app/robots", null, "Robots");
await capture("04-robot-detail-overview", robotHref, null, "Overview");
for (const [index, tab] of ["Visualization", "Skills", "Executions", "Settings"].entries()) {
  await capture(`0${index + 5}-robot-detail-${tab.toLowerCase()}`, robotHref, async () => clickText(tab), tab);
}
await page.goto(`${base}/app/skills`, { waitUntil: "domcontentloaded" });
await page.getByTestId("skill-card").first().waitFor({ state: "visible", timeout: 20000 });
const skillHref = await page.getByTestId("skill-card").first().getAttribute("href");
await capture("09-skills-library", "/app/skills", null, "My Skills");
await capture("10-skill-detail-visualization", skillHref, null, "Visualization");
for (const [index, tab] of ["Waypoints", "Code", "Executions", "Versions"].entries()) {
  await capture(`${11 + index}-skill-detail-${tab.toLowerCase()}`, skillHref, async () => clickText(tab), tab);
}
await capture("15-task-library-my-tasks", "/app/tasks", null, "Task Records");
await capture("16-task-library-shared-with-us", "/app/tasks", async () => page.getByText("Shared with us", { exact: true }).click(), "Shared with us");

await page.goto(`${base}/api/tasks`, { waitUntil: "networkidle" });
const taskData = await page.locator("body").innerText();
let taskId = "";
try {
  const tasks = JSON.parse(taskData);
  taskId = tasks.find((task) => task.status === "done")?.task_id ?? tasks[0]?.task_id ?? "";
} catch {}

if (taskId) {
  await capture("17-task-detail-top", `/app/tasks/${taskId}`, null, "Deployed task record");
  await capture("18-task-detail-passport-modal", `/app/tasks/${taskId}`, async () => clickText("Export as Automation Passport"));
  await capture("19-task-detail-risk-modal", `/app/tasks/${taskId}`, async () => clickText("Generate Risk Assessment Draft"));
  await capture("20-task-detail-recommender-initial", `/app/tasks/${taskId}`, async () => {
    await page.getByText("Recommended End-Effectors").scrollIntoViewIfNeeded();
  });
  await capture("21-task-detail-recommender-results", `/app/tasks/${taskId}`, async () => {
    const weight = page.getByLabel("Part weight (kg)");
    await weight.fill("2");
    await page.getByLabel("Part material").selectOption("plastic");
    await page.getByLabel("Surface texture").selectOption("smooth");
    await clickText("Find matching grippers");
    await page.waitForTimeout(1200);
    await page.getByText("Recommended End-Effectors").scrollIntoViewIfNeeded();
  });
  await capture("22-task-detail-fixture-initial", `/app/tasks/${taskId}`, async () => {
    await page.getByText("Fixture & Jig").scrollIntoViewIfNeeded();
  });
  await capture("23-task-detail-fixture-nest-result", `/app/tasks/${taskId}`, async () => {
    await page.getByText("Fixture & Jig").scrollIntoViewIfNeeded();
    await clickText("Generate fixture design");
    await page.waitForTimeout(1800);
  });
}

await capture("24-teach-workflow-initial", "/app/teach", null, "Video input");
await capture("25-teach-workflow-running", "/app/teach", async () => {
  await page.getByTestId("auto-play-demo").click();
  await page.waitForTimeout(2200);
});
await capture("26-library-ready-skills", "/app/library", null, "Skill Templates");
await capture("27-execution-history", "/app/executions", null, "Execution history");
await capture("28-roi-calculator", "/app/roi", null, "ROI");
await capture("29-workcell-configuration", "/app/workcell", null, "Workcell");
await capture("30-code-export", "/app/export", null, "Code");
await capture("31-settings-light", "/app/settings", null, "Settings");
await capture("32-settings-dark", "/app/settings", async () => clickText("Dark mode"));
await capture("33-billing-plan-selection", "/app/billing");
await capture("34-billing-value-statement", "/app/billing", async () => {
  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.count()) await checkbox.check();
  const activate = page.getByText("Activate outcome-based plan", { exact: true });
  if (await activate.isEnabled()) await activate.click();
  await page.waitForTimeout(500);
  await clickText("Open value statement");
  await page.waitForTimeout(800);
});
await capture("35-admin-pricing", "/app/admin/pricing");

if (taskId) {
  await capture("36-mobile-task-detail", `/app/tasks/${taskId}`, async () => {
    await page.setViewportSize({ width: 430, height: 932 });
  });
  await page.setViewportSize({ width: 430, height: 932 });
  await capture("37-mobile-dashboard", "/app");
  await capture("38-mobile-teach", "/app/teach");
  await page.setViewportSize({ width: 1600, height: 1000 });
}

await writeFile(
  path.resolve(output, "../capture-results.json"),
  JSON.stringify(results, null, 2),
);
await browser.close();
console.log(JSON.stringify({ output, captured: results.filter((r) => r.status === "captured").length, failed: results.filter((r) => r.status === "failed") }, null, 2));
