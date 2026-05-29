import type { Page } from '@playwright/test';

const EMAIL = process.env.E2E_TEST_EMAIL ?? 'test@example.com';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'testexample';

/** Signs in via the dev password form and waits for the app to land. */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/signin');
  await page.getByTestId('dev-email').fill(EMAIL);
  await page.getByTestId('dev-password').fill(PASSWORD);
  await page.getByTestId('dev-sign-in').click();
  await page.waitForURL(/\/(onboarding)?$/, { timeout: 15_000 });
}

/** Returns true when the test user has already completed onboarding. */
export function hasProfile(page: Page): boolean {
  return !page.url().includes('/onboarding');
}
