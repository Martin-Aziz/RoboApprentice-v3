import type { Page } from "@playwright/test";

export interface E2EUser {
  email: string;
  name: string;
  password: string;
}

export function buildUser(prefix: string): E2EUser {
  return {
    email: `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@forge-mind.dev`,
    name: "Coverage Explorer",
    password: "SecurePass123!",
  };
}

export async function registerViaUi(page: Page, user: E2EUser): Promise<void> {
  await page.goto("/register");
  await page.getByLabel(/full name/i).fill(user.name);
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: /create account|register|sign up/i }).click();
  await page.waitForURL(/\/app|\/dashboard|\/onboarding/, { timeout: 20_000 });
}

export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/app|\/dashboard|\/onboarding/, { timeout: 20_000 });
}
