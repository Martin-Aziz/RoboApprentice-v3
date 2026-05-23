import { expect, test } from "@playwright/test";

test.describe("Authentication Flow", () => {
  const unique = () => `test-${Date.now()}-${Math.floor(Math.random() * 100000)}@forge-mind.dev`;
  const postAuthRoute = /app|dashboard|onboarding/;

  test("user can register a new account", async ({ page }) => {
    const email = unique();
    await page.goto("/register");
    await page.getByLabel(/full name/i).fill("Test User");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("SecurePass123!");
    await page.getByRole("button", { name: /create account|register|sign up/i }).click();
    await expect(page).toHaveURL(postAuthRoute);
  });

  test("user can log in with valid credentials", async ({ page }) => {
    // Seed user via API before test (uses NEXT_PUBLIC_API_URL env)
    const email = unique();
    await page.goto("/register");
    await page.getByLabel(/full name/i).fill("Login Tester");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("SecurePass123!");
    await page.getByRole("button", { name: /create account|register|sign up/i }).click();
    await expect(page).toHaveURL(postAuthRoute);

    // Now log out and log back in
    await page.getByRole("button", { name: /logout|sign out/i }).click();
    await expect(page).toHaveURL(/login|$/);

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("SecurePass123!");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(postAuthRoute);
  });

  test("login fails with wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("nobody@forge-mind.dev");
    await page.getByLabel(/password/i).fill("WrongPassword!");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    // Error message should appear, URL should stay on /login
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/login/);
  });

  test("protected route redirects unauthenticated user to login", async ({ page }) => {
    // Ensure no existing session
    await page.context().clearCookies();
    await page.goto("/app");
    await expect(page).toHaveURL(/login/);
  });

  test("user can log out and session is cleared", async ({ page }) => {
    const email = unique();
    await page.goto("/register");
    await page.getByLabel(/full name/i).fill("Logout Tester");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("SecurePass123!");
    await page.getByRole("button", { name: /create account|register|sign up/i }).click();
    await expect(page).toHaveURL(postAuthRoute);

    await page.getByRole("button", { name: /logout|sign out/i }).click();
    await page.goto("/app");
    await expect(page).toHaveURL(/login/);
  });
});
