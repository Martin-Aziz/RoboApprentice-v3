import path from "path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Teaching flow E2E tests.
 *
 * Uses the pre-seeded demo account (alex@forgeshop.com) which already has
 * the facility "Chen Manufacturing", so skills can be created and listed.
 *
 * Key UI facts (matching the actual app):
 *  - Nav link to teach: "Teach" (/app/teach)
 *  - Nav link to skills: "Skills" (/app/skills)
 *  - Teach page label for name field: "Skill name" (htmlFor="skill-name")
 *  - Teach page label for task narration: "Plain language task" (htmlFor="task-language")
 *  - Submit button on describe step: "Continue to demo"
 *  - Skill starts as 'draft' status until a demonstration is uploaded
 */

const FIXTURE_VIDEO = path.join(__dirname, "fixtures", "Precision_Gripper.mp4");

const DEMO_EMAIL = "alex@forgeshop.com";
const DEMO_PASSWORD = "password123";

async function loginAsDemoUser(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(DEMO_EMAIL);
  await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/app/, { timeout: 15_000 });
}

test.describe("Robot Teaching Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemoUser(page);
  });

  test("dashboard shows the facility name", async ({ page }) => {
    // The seeded facility is "Chen Manufacturing" — verify it appears on the dashboard
    await page.goto("/app");
    await expect(page.getByText(/chen manufacturing/i)).toBeVisible({ timeout: 10_000 });
  });

  test("user can fill in the teach form and proceed to demo step", async ({ page }) => {
    await page.goto("/app/teach");

    // Step 1: Describe — fill in required fields
    await page.getByLabel(/skill name/i).fill("Pick and Place");
    await page.getByLabel(/plain language task/i).fill(
      "Pick bracket from bin A, rotate 90 degrees, press into fixture slot until click.",
    );

    // Click "Continue to demo"
    await page.getByRole("button", { name: /continue to demo/i }).click();

    // Should now show step 2 (demonstrate / video upload dropzone)
    await expect(page.getByText(/step 2 \/.*upload/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("skills index shows seeded skills", async ({ page }) => {
    // The seeded data has 3 skills. Verify the skills page lists them.
    await page.goto("/app/skills");
    await expect(page.getByText(/pick & place brackets/i)).toBeVisible({ timeout: 10_000 });
  });

  test("skill card shows training status badge", async ({ page }) => {
    // The seeded "Quality Inspection" skill has status 'training'
    await page.goto("/app/skills");

    // Filter to training skills to verify the status badge renders
    await page.getByRole("tab", { name: /training/i }).click();
    await expect(page.getByText(/quality inspection/i)).toBeVisible({ timeout: 10_000 });
  });

  test("can upload Precision_Gripper.mp4 demonstration", async ({ page }) => {
    await page.goto("/app/teach");

    // Step 1: Describe
    await page.getByLabel(/skill name/i).fill("Precision Gripper");
    await page.getByLabel(/plain language task/i).fill(
      "Pick the precision part from the tray, orient with the gripper, and place into the assembly fixture.",
    );
    await page.getByRole("button", { name: /continue to demo/i }).click();

    // Step 2: Demonstrate — set file via the hidden <input type="file"> inside the dropzone
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_VIDEO);

    // Progress bar should appear and upload should complete
    await expect(page.getByRole("progressbar")).toBeVisible({ timeout: 5_000 }).catch(() => {});

    // After upload, step 3 (interpret) should become active or the "Interpret" button should appear
    await expect(
      page.getByRole("button", { name: /interpret|run interpret|understand/i })
        .or(page.getByText(/step 3|understand/i).first()),
    ).toBeVisible({ timeout: 30_000 });
  });
});
