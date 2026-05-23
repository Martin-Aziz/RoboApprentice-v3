import { test } from "./support/coverage-fixtures";
import { scanPageSurface } from "./support/coverage-registry";

const PUBLIC_ROUTES = ["/", "/login", "/register"];
const PROTECTED_ROUTES = ["/app", "/app/robots", "/app/skills", "/app/teach", "/app/library", "/app/settings"];

async function registerFreshUser() {
  return {
    email: `coverage-${Date.now()}-${Math.floor(Math.random() * 10000)}@forge-mind.dev`,
    name: "Coverage Explorer",
    password: "SecurePass123!",
  };
}

test.describe("Coverage Discovery", () => {
  test("anonymous route and element discovery", async ({ page, coverage }) => {
    coverage.recordAuthState("anonymous");
    coverage.recordRole("none");

    for (const route of PUBLIC_ROUTES) {
      coverage.recordRoute(route);
      coverage.addUntestedItem(`route:${route}:anonymous`);
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await scanPageSurface(page, coverage);
      coverage.resolveUntestedItem(`route:${route}:anonymous`);
    }

    for (const route of PROTECTED_ROUTES) {
      coverage.recordRoute(route);
      coverage.addUntestedItem(`route:${route}:anonymous`);
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await scanPageSurface(page, coverage);
      coverage.resolveUntestedItem(`route:${route}:anonymous`);
    }

    // Stop discovery only after 3 stable cycles with no new surface items.
    let stableCycles = 0;
    let previousCount = coverage.discoveredCount();

    while (stableCycles < 3) {
      await scanPageSurface(page, coverage);
      const currentCount = coverage.discoveredCount();

      if (currentCount === previousCount) {
        stableCycles += 1;
      } else {
        stableCycles = 0;
      }

      previousCount = currentCount;
    }
  });

  test("authenticated route and element discovery", async ({ page, coverage }) => {
    const user = await registerFreshUser();
    coverage.recordAuthState("authenticated");
    coverage.recordRole("admin");

    await page.goto("/register");
    await page.getByLabel(/full name/i).fill(user.name);
    await page.getByLabel(/email/i).fill(user.email);
    await page.getByLabel(/password/i).fill(user.password);
    await page.getByRole("button", { name: /create account|register|sign up/i }).click();

    await page.waitForURL(/\/app|\/dashboard|\/onboarding/, { timeout: 20_000 });
    await scanPageSurface(page, coverage);

    for (const route of PROTECTED_ROUTES) {
      coverage.recordRoute(route);
      coverage.addUntestedItem(`route:${route}:authenticated`);
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await scanPageSurface(page, coverage);
      coverage.resolveUntestedItem(`route:${route}:authenticated`);
    }

    let stableCycles = 0;
    let previousCount = coverage.discoveredCount();

    while (stableCycles < 3) {
      await scanPageSurface(page, coverage);
      const currentCount = coverage.discoveredCount();

      if (currentCount === previousCount) {
        stableCycles += 1;
      } else {
        stableCycles = 0;
      }

      previousCount = currentCount;
    }
  });
});
