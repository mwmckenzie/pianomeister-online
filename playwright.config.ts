import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

// The production preview by default (what CI and users get). On the dev server every lazy chunk
// queues behind the ~230 sample downloads on HTTP/1.1's six connections, so tests flake there;
// `npm run test:e2e:dev` (or PW_DEV=1) still runs against it for quick checks of unbuilt code.
const useDevServer =
  process.env.PW_DEV === '1' || process.env.npm_lifecycle_event === 'test:e2e:dev'
const port = useDevServer ? 5173 : 4173
// Trailing slash matters: tests use relative paths (`page.goto('./')`) so they stay under the Vite base.
const baseURL = `http://localhost:${port}/pianomeister-online/`

/**
 * Functional e2e tests run at render quality Off (no bloom, the smallest particle pool), so
 * parallel headless runs don't time out rendering bloom in software. This only seeds the
 * stored settings; the app's defaults are unchanged. visualPolish (which exercises quality),
 * the visual shots and the perf runs use their own settings. A test that seeds its own stored
 * settings (e.g. a migration) opts out with `test.use({ storageState: EMPTY_STORAGE })`.
 */
const QUALITY_OFF = {
  cookies: [],
  origins: [
    {
      origin: `http://localhost:${port}`,
      localStorage: [
        {
          name: 'pianomeister.settings',
          value: JSON.stringify({
            version: 6,
            settings: {
              render: {
                quality: 'off',
                bloomResolution: 'off',
                particleBudget: 512,
                shaderDetail: 'minimal',
              },
            },
          }),
        },
      ],
    },
  ],
}

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
  /*
   * Opt out of parallel tests on CI. Locally a quarter of the logical cores, not Playwright's
   * half: every test runs a headless browser rendering WebGL in software (well over a core),
   * and at half the machine saturates — the preview server then answers in ~300 ms per file,
   * on-demand chunks and songs queue behind ~230 sample downloads, and tests time out.
   */
  workers: process.env.CI ? 1 : '25%',
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
      testIgnore: /visualPolish\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: QUALITY_OFF,
      },
    },
    {
      // Milestone 9's controls, presets and looks: at the app's own default quality.
      name: 'polish',
      testMatch: /visualPolish\.spec\.ts/,
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
    command: useDevServer ? 'npm run dev' : 'npm run preview',
    // Wait on the app's real path; the server root isn't served under a Vite base.
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
