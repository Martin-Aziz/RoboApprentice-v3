import { expect, test } from "./support/coverage-fixtures";
import { scanPageSurface } from "./support/coverage-registry";
import { buildUser, registerViaUi } from "./support/auth-helpers";

const PROTECTED_ROUTES = ["/app", "/app/robots", "/app/skills", "/app/teach", "/app/library", "/app/settings"];

test.describe("Auth Matrix", () => {
  test("anonymous user is blocked from protected routes", async ({ page, coverage }) => {
    coverage.recordAuthState("anonymous");
    coverage.recordRole("none");

    await page.context().clearCookies();

    for (const route of PROTECTED_ROUTES) {
      coverage.addUntestedItem(`auth-anonymous:${route}`);
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await scanPageSurface(page, coverage);
      await expect(page).toHaveURL(/\/login|\/$/, { timeout: 15_000 });
      coverage.resolveUntestedItem(`auth-anonymous:${route}`);
    }
  });

  test("authenticated user can load protected routes", async ({ page, coverage }) => {
    const user = buildUser("auth-matrix");
    coverage.recordAuthState("authenticated");
    coverage.recordRole("admin");

    await registerViaUi(page, user);

    for (const route of PROTECTED_ROUTES) {
      coverage.addUntestedItem(`auth-authenticated:${route}`);
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await scanPageSurface(page, coverage);
      await expect(page).toHaveURL(new RegExp(route.replace("/", "\\/")), { timeout: 15_000 });
      coverage.resolveUntestedItem(`auth-authenticated:${route}`);
    }
  });
});
