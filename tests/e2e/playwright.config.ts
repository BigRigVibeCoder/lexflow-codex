import { defineConfig, devices } from '@playwright/test';

/**
 * LexFlow E2E Test Configuration
 *
 * Runs against lexflow-prod by default. Override with BASE_URL env var.
 * Per GOV-002 §14.4: screenshots on every step, trace on first retry.
 *
 * @see CODEX/05_PROJECT/SPR-009-ARCH_E2E_Testing.md
 */
export default defineConfig({
  testDir: './flows',
  fullyParallel: false,       // Serial — flows may share state
  forbidOnly: true,           // No .only in CI
  retries: 1,                 // Retry once on failure
  workers: 1,                 // Single worker — sequential execution
  timeout: 30_000,            // 30s per test

  /* Reporter: HTML forensic report + console list */
  reporter: [
    ['html', { outputFolder: './artifacts/reports', open: 'never' }],
    ['list'],
  ],

  use: {
    /* Target: lexflow-prod by default */
    baseURL: process.env.BASE_URL || 'http://34.26.122.46',

    /* GOV-002 §14.4: Screenshot & trace capture */
    screenshot: 'on',           // Capture at every step
    trace: 'on-first-retry',    // Full trace on failure retry
    video: 'on-first-retry',    // Video on failure retry

    /* Timeouts */
    actionTimeout: 10_000,      // 10s per action
    navigationTimeout: 30_000,  // 30s per navigation (Next.js SSR can be slow)
  },

  /* Output directories for artifacts */
  outputDir: './artifacts/test-results',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
