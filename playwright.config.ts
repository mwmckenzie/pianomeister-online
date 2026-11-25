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
 * parallel headless runs don't time out rendering bloom in software, and without "Open Home when
 * a new session starts" (milestone 9.2), which seeded old sessions would set off. This only seeds the
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
                // CI runners have no GPU: WebGL renders in software on the cores the tests use.
                // Half the pixels and no anti-aliasing keep the frame cheap there.
                ...(process.env.CI
                  ? { scaleAuto: false, scale: 0.5, maxPixelRatio: 1, antialias: 'off' }
                  : {}),
              },
              // Tests seed sessions from hours or days ago; Home on a new session would open
              // over the page they test. homeOnNewSession.spec turns it back on.
              appearance: { homeOnNewSession: false },
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
  /*
   * Playwright empties its output folder before every run. Its own artifacts get a folder of
   * their own, so review output written beside it (test-results/visual: shots, range sheets,
   * their zip) survives the next run of any project.
   */
  outputDir: 'test-results/playwright',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() waits for a state. Every wait is on a state, never a fixed sleep, so
     * passing tests aren't slowed; 10 s (5 s until the e2e hardening) gives song and chunk loads
     * room when, under parallel load, they queue behind ~230 sample downloads per page.
     */
    timeout: 10_000,
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /*
   * One retry in CI: a test that passes on its retry is reported as flaky (the job summary lists
   * it) without failing the job. Locally none: re-run failures with --last-failed instead.
   */
  retries: process.env.CI ? 1 : 0,
  /*
   * CI: two workers per shard (4-core runners, the suite split across four shards). Locally a
   * quarter of the logical cores, not Playwright's
   * half: every test runs a headless browser rendering WebGL in software (well over a core),
   * and at half the machine saturates — the preview server then answers in ~300 ms per file,
   * on-demand chunks and songs queue behind ~230 sample downloads, and tests time out.
   */
  workers: process.env.CI ? 2 : '25%',
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // CI: a blob per shard, merged into one HTML report and a summary (.github/workflows/e2e.yml).
  reporter: process.env.CI ? [['blob'], ['github'], ['list']] : 'html',
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
      grepInvert: /@visual|@perf|@pixels|@exact|@full-/,
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
      // The perf fast loop's pixel comparison, on the real GPU (docs/performance.md): `npm run perf:fast`.
      name: 'pixels',
      grep: process.env.PERF_FULL ? /@pixels|@full-pixels/ : /@pixels/,
      timeout: 120_000,
      use: { ...devices['Desktop Chrome'], viewport: { width: 640, height: 360 } },
    },
    {
      // Its exact case: software WebGL draws the same frame the same way twice.
      name: 'exact',
      grep: process.env.PERF_FULL ? /@exact|@full-exact/ : /@exact/,
      timeout: 300_000,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 640, height: 360 },
        headless: true,
        launchOptions: {
          args: ['--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
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
