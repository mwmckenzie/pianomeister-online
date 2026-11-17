import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

// Dev server locally for fast feedback; preview of the production build on CI.
const port = process.env.CI ? 4173 : 5173
// Trailing slash matters: tests use relative paths (`page.goto('./')`) so they stay under the Vite base.
const baseURL = `http://localhost:${port}/pianomeister-online/`

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Only on CI systems run the tests headless */
    headless: !!process.env.CI,
  },

  // Chromium only for now (the only browser installed locally). WebKit returns in milestone 3.
  projects: [
    {
      name: 'chromium',
      // Visual-review screenshots (for a human) and performance runs are separate projects.
      grepInvert: /@visual|@perf/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'visual',
      grep: /@visual/,
      // Headless (CI=1) renders WebGL in software; glass panels over the canvas make some
      // screenshots take longer than the default 30 s.
      timeout: 90_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 },
      },
    },
    {
      // Frame timings on a real GPU: run headed (locally) with `npm run test:perf`.
      name: 'perf',
      grep: /@perf/,
      timeout: 120_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 900 },
      },
    },
  ],

  webServer: {
    command: process.env.CI ? 'npm run preview' : 'npm run dev',
    // Wait on the app's real path; the server root isn't served under a Vite base.
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
