import { test, expect } from '@playwright/test';
import { signIn, hasProfile } from './helpers';

test.describe('App shell navigation', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    if (!hasProfile(page)) test.skip();
  });

  test('shows all three tab buttons', async ({ page }) => {
    await expect(page.getByTestId('tab-lunch')).toBeVisible();
    await expect(page.getByTestId('tab-grocery')).toBeVisible();
    await expect(page.getByTestId('tab-profile')).toBeVisible();
  });

  test('switches to Grocery tab', async ({ page }) => {
    await page.getByTestId('tab-grocery').click();
    // Week nav arrows only appear on the Lunch tab — their absence confirms the switch.
    await expect(page.getByRole('button', { name: '‹' })).not.toBeVisible();
  });

  test('switches to Profile tab', async ({ page }) => {
    await page.getByTestId('tab-profile').click();
    // Profile tab always shows an Edit button in the default (non-editing) view.
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  });

  test('plan generation button is visible on Lunch tab', async ({ page }) => {
    // Button reads "Generate This Week" (empty state) or "Regenerate Week" (plan exists).
    await expect(
      page.getByRole('button', { name: /generate this week|regenerate week/i }),
    ).toBeVisible();
  });
});
