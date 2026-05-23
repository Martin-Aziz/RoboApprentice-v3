import { expect, test, type Page } from "@playwright/test";

// Seeded demo account (alex@forgeshop.com) has facility "Chen Manufacturing",
// robots "Cobot Alpha" (idle) and "Cobot Beta" (offline), and 3 skills.
const DEMO_EMAIL = "alex@forgeshop.com";
const DEMO_PASSWORD = "password123";

async function loginAsDemoUser(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(DEMO_EMAIL);
  await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/app/, { timeout: 15_000 });
}

test.describe("Robot Management", () => {
  test("user can register a robot", async ({ page }) => {
    // Log in as the seeded demo user who already has a facility
    await loginAsDemoUser(page);

    // Navigate to the Fleet (robots) module
    await page.goto("/app/robots");

    // Open the registration form
    await page.getByRole("button", { name: /register robot/i }).click();

    // Fill in the three required fields (Callsign, Brand, Model)
    await page.getByLabel(/callsign/i).fill("UR5-Test-001");
    await page.getByLabel(/brand/i).fill("universal_robots");
    await page.getByLabel(/model/i).fill("UR5e");

    // Submit the form
    await page.getByRole("button", { name: /add to fleet/i }).click();

    // The new robot should appear in the fleet list
    await expect(page.getByText("UR5-Test-001").first()).toBeVisible({ timeout: 10_000 });
  });

  test("robots page shows empty state when no robots", async ({ page }) => {
    // A fresh user with no facility will see an empty fleet
    const unique = `empty-state-${Date.now()}@forge-mind.dev`;
    await page.goto("/register");
    await page.getByLabel(/full name/i).fill("New Operator");
    await page.getByLabel(/email/i).fill(unique);
    await page.getByLabel(/password/i).fill("SecurePass123!");
    await page.getByRole("button", { name: /create account|register|sign up/i }).click();
    await page.waitForURL(/\/app/, { timeout: 15_000 });

    await page.goto("/app/robots");
    // Fleet is empty for a user without a facility
    await expect(page.getByRole("heading", { name: /fleet is empty/i })).toBeVisible({ timeout: 10_000 });
  });

  test("E-stop button is visible for online robots", async ({ page }) => {
    // Log in as demo user — Cobot Alpha is 'idle' so E-STOP should render
    await loginAsDemoUser(page);
    await page.goto("/app/robots");

    // "Engage E-STOP" button is shown for all non-offline robots
    await expect(page.getByRole("button", { name: /engage e.?stop/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});
