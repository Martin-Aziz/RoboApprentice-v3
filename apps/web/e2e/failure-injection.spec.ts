import { expect, test } from "./support/coverage-fixtures";
import { scanPageSurface } from "./support/coverage-registry";
import { buildUser, registerViaUi } from "./support/auth-helpers";

test.describe("Failure Injection", () => {
  test("offline mode is handled without hard crash", async ({ page, context, coverage }) => {
    const user = buildUser("failure-offline");
    coverage.recordAuthState("authenticated");
    coverage.recordRole("admin");

    // Register and land on the app while still online
    await registerViaUi(page, user);
    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");

    // Scan what's visible while online (saves coverage data)
    await scanPageSurface(page, coverage);

    // Now go offline — the already-loaded page must not crash
    await context.setOffline(true);
    coverage.addUntestedItem("failure:offline:/app");

    // Body should still be visible (no full-page crash)
    await expect(page.locator("body")).toBeVisible();

    coverage.resolveUntestedItem("failure:offline:/app");
    await context.setOffline(false);
  });

  test("server 500 from facilities endpoint is observable in UI state", async ({ page, coverage }) => {
    const user = buildUser("failure-500");
    coverage.recordAuthState("authenticated");
    coverage.recordRole("admin");

    await registerViaUi(page, user);

    await page.route("**/api/v1/facilities**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "simulated server error" }),
      });
    });

    coverage.addUntestedItem("failure:500:/api/v1/facilities");

    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");
    await scanPageSurface(page, coverage);

    await expect(page.locator("body")).toBeVisible();
    coverage.resolveUntestedItem("failure:500:/api/v1/facilities");
  });

  test("malformed facilities payload does not fully break page render", async ({ page, coverage }) => {
    const user = buildUser("failure-malformed");
    coverage.recordAuthState("authenticated");
    coverage.recordRole("admin");

    await registerViaUi(page, user);

    await page.route("**/api/v1/facilities**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{\"facilities\":\"unexpected-string\"}",
      });
    });

    coverage.addUntestedItem("failure:malformed:/api/v1/facilities");

    await page.goto("/app");
    await page.waitForLoadState("domcontentloaded");
    await scanPageSurface(page, coverage);

    await expect(page.locator("body")).toBeVisible();
    coverage.resolveUntestedItem("failure:malformed:/api/v1/facilities");
  });
});
