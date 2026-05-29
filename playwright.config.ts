import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// Load .env / .env.local (all keys, not just VITE_*) so E2E_TEST_* reach
// process.env locally. Real env (CI secrets) wins over file values.
process.env = { ...loadEnv('development', process.cwd(), ''), ...process.env };

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
