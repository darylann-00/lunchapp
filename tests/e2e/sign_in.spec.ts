import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'test@example.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'testexample';

test('signs in via dev password form and reaches the app', async ({ page }) => {
  await page.goto('/signin');

  await page.getByTestId('dev-email').fill(TEST_EMAIL);
  await page.getByTestId('dev-password').fill(TEST_PASSWORD);
  await page.getByTestId('dev-sign-in').click();

  // First sign-in lands on /onboarding (no profile row yet) or / (returning user).
  await expect(page).toHaveURL(/\/(onboarding)?$/, { timeout: 15_000 });
});
