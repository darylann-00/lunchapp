import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test.describe('Onboarding form', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    // Navigate directly — the form renders for both new and returning users.
    await page.goto('/onboarding');
  });

  test('renders step 1 with kid name and date of birth fields', async ({ page }) => {
    // Heading differs for new vs returning users.
    await expect(
      page.getByRole('heading', { name: /your kid/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Mia')).toBeVisible();
    await expect(page.getByText('Date of birth')).toBeVisible();
  });

  test('Continue button is disabled until a name is entered', async ({ page }) => {
    const continueBtn = page.getByRole('button', { name: /next/i });
    // Clear any pre-filled name.
    await page.getByPlaceholder('e.g. Mia').fill('');
    await expect(continueBtn).toBeDisabled();

    await page.getByPlaceholder('e.g. Mia').fill('Mia');
    await expect(continueBtn).toBeEnabled();
  });

  test('advances to step 2 (dietary restrictions)', async ({ page }) => {
    await page.getByPlaceholder('e.g. Mia').fill('Mia');
    await page.getByRole('button', { name: /next/i }).click();
    await expect(page.getByText(/dietary restrictions/i)).toBeVisible();
  });
});
