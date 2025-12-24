import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for VMP E2E Tests
 *
 * Tests Days 5-8 functionality with real browser authentication
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:9000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }, // 393x851 viewport
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] }, // 390x844 viewport
    },
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] }, // 1024x1366 viewport
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:9000/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
