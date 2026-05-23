import { test, expect } from "@playwright/test";

test.describe("Aurevix v3 full flow", () => {
  test("cold visit produces a working application", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Aurevix/i);
    await page.getByRole("link", { name: /open console/i }).first().click();
    await expect(page).toHaveURL(/\/app/);
    await expect(page.locator('[data-testid="robot-card"]')).toHaveCount(3);
  });

  test("3D viewport loads URDF and animates", async ({ page }) => {
    await page.goto("/app/teach");
    await page.waitForSelector("canvas", { timeout: 15_000 });
    await expect(page.locator('[data-testid="joint-panel"]')).toBeVisible();
    const initialPose = await page.locator('[data-testid="ee-pose-x"]').textContent();
    await page.getByTestId("auto-play-demo").click();
    await page.waitForSelector('[data-testid="result-panel"]', { timeout: 15_000 });
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-testid="ee-pose-x"]')).not.toHaveText(initialPose ?? "");
  });

  test("persistence works across reloads", async ({ page }) => {
    await page.goto("/app/teach");
    await page.getByTestId("auto-play-demo").click();
    await page.waitForSelector('[data-testid="result-panel"]', { timeout: 15_000 });
    await page.getByRole("button", { name: /deploy to robot/i }).click();
    await page.getByTestId("deploy-skill").click();
    await expect(page.getByText("Skill is now live")).toBeVisible({ timeout: 10_000 });
    await page.goto("/app/skills");
    await expect(page.locator('[data-testid="skill-card"]')).toHaveCount(6);
  });

  test("locale switching updates ROI currency", async ({ page }) => {
    await page.goto("/app/roi");
    await page.locator('[data-testid="locale-switcher"]').first().getByTitle("de-DE").click();
    await expect(page.locator("body")).toContainText("€");
    await page.locator('[data-testid="locale-switcher"]').first().getByTitle("en-US").click();
    await expect(page.locator("body")).toContainText("$");
  });

  test("robot detail page renders viewport correctly", async ({ page }) => {
    await page.goto("/app/robots");
    await page.locator('[data-testid="robot-card"]').first().click();
    await page.getByRole("tab", { name: "Visualization" }).click();
    await page.waitForSelector("canvas", { timeout: 15_000 });
    await expect(page.locator('[data-testid="joint-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="ee-pose"]')).toBeVisible();
  });
});
