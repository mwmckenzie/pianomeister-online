import { mkdirSync, writeFileSync } from 'node:fs'

import { test, expect, type Page } from '@playwright/test'

/**
 * Performance and render diagnostics (npm run test:perf, headed locally so a real GPU is used).
 * Results are printed and written to test-results/perf/; they are inputs for the review report.
 */
const OUT = 'test-results/perf'

interface EngineStats {
  readonly averageFrameMs: number
  readonly averageIntervalMs: number
  readonly frames: number
}

function save(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true })
  writeFileSync(`${OUT}/${name}.json`, `${JSON.stringify(data, null, 2)}\n`)
  console.log(name, JSON.stringify(data))
}

/** Lets real time pass in the page (frames keep rendering meanwhile). */
const pause = (page: Page, ms: number) =>
  page.evaluate((delay) => new Promise<void>((resolve) => setTimeout(resolve, delay)), ms)

async function seed(page: Page, stored: unknown | null) {
  if (stored === null) return
  await page.addInitScript((value) => {
    localStorage.setItem('pianomeister.settings', value)
  }, JSON.stringify(stored))
}

async function openCanon(page: Page) {
  await page.goto('./#/library')
  await page.getByTestId('song-row').filter({ hasText: 'Canon in D' }).click()
  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-title')).toHaveText('Canon in D')
  // ?stats=1 is read when the player mounts.
  await page.goto('./#/?stats=1')
  await page.reload()
  await expect(page.getByTestId('hud-title')).toHaveText('Canon in D')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
}

/** Canvas buffer vs CSS size, context attributes and MSAA samples. */
async function canvasInfo(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    const gl = canvas.getContext('webgl2')
    return {
      devicePixelRatio: window.devicePixelRatio,
      css: [canvas.clientWidth, canvas.clientHeight],
      buffer: [canvas.width, canvas.height],
      expected: [
        Math.round(canvas.clientWidth * window.devicePixelRatio),
        Math.round(canvas.clientHeight * window.devicePixelRatio),
      ],
      contextAntialias: gl?.getContextAttributes()?.antialias ?? null,
      samples: gl === null ? null : (gl.getParameter(gl.SAMPLES) as number),
      renderInfo:
        (window as { pianomeisterRenderInfo?: () => unknown }).pianomeisterRenderInfo?.() ?? null,
    }
  })
}

const VARIANTS = [
  { name: 'default', stored: null },
  {
    name: 'highest',
    stored: {
      version: 2,
      settings: { render: { scaleAuto: false, scale: 2, maxPixelRatio: 4, antialias: 'smaa' } },
    },
  },
] as const

for (const variant of VARIANTS) {
  test(`@perf Canon for 20 s, ${variant.name} settings`, async ({ page }) => {
    await seed(page, variant.stored)
    await openCanon(page)
    await page.getByRole('button', { name: 'Next bar' }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByTestId('transport-state')).toHaveText('playing')
    // Let the stats window (last 120 frames) fill with steady playback, then sample it.
    const samples: EngineStats[] = []
    for (let second = 0; second < 20; second++) {
      await pause(page, 1000)
      samples.push(
        await page.evaluate(
          () =>
            (
              window as { pianomeisterEngineStats?: () => EngineStats }
            ).pianomeisterEngineStats?.() ?? null,
        ),
      )
    }
    const valid = samples.filter((s) => s !== null && s.frames > 0)
    const mean = (pick: (s: EngineStats) => number) =>
      valid.reduce((sum, s) => sum + pick(s), 0) / Math.max(1, valid.length)
    const result = {
      variant: variant.name,
      averageFrameMs: Number(mean((s) => s.averageFrameMs).toFixed(3)),
      averageIntervalMs: Number(mean((s) => s.averageIntervalMs).toFixed(3)),
      canvas: await canvasInfo(page),
    }
    save(`canon-${variant.name}`, result)
    expect(valid.length).toBeGreaterThan(10)
  })
}

test('@perf render diagnostics: buffer size, MSAA, and a device-pixel-ratio change', async ({
  page,
}) => {
  await page.goto('./')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  const initial = await canvasInfo(page)
  // Simulate moving the window to a monitor with another scale factor: only the DPR changes.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1.5,
    mobile: false,
  })
  await pause(page, 500)
  const afterDprChange = await canvasInfo(page)
  save('render-diagnostics', { initial, afterDprChange })
  expect(initial.buffer[0]).toBeGreaterThan(0)
})
