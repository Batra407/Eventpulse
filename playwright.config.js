// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,          // 60 s per test
  retries: 1,               // one retry on flakiness
  workers: 1,               // single worker — sequential, cleaner video
  fullyParallel: false,

  use: {
    baseURL: 'http://localhost:5000',
    headless: false,         // visible browser for demo recording
    slowMo: 200,             // 200 ms between actions → smooth demo
    viewport: { width: 1280, height: 720 },

    // ── Video recording ─────────────────────────────────────────────────────
    video: 'on',             // record every test
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',

    // Generous timeout for form submissions hitting local server
    actionTimeout:    15_000,
    navigationTimeout: 20_000,
  },

  outputDir: 'test-results',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Reporter (console summary + HTML report in test-results/html)
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
});
