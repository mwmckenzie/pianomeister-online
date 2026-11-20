import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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
  { name: 'default', stored: null, sidebarOpen: false },
  // Milestone 6: the glass playfield sidebar open beside the (narrower) highway.
  { name: 'sidebar-open', stored: null, sidebarOpen: true },
  {
    name: 'highest',
    stored: {
      version: 3,
      settings: { render: { scaleAuto: false, scale: 2, maxPixelRatio: 4, antialias: 'smaa' } },
    },
    sidebarOpen: false,
  },
] as const

for (const variant of VARIANTS) {
  test(`@perf Canon for 20 s, ${variant.name} settings`, async ({ page }) => {
    await seed(page, variant.stored)
    await page.addInitScript((open) => {
      localStorage.setItem(
        'pianomeister.ui',
        JSON.stringify({ sidebarOpen: open, sidebarSections: ['camera', 'keyboard'] }),
      )
    }, variant.sidebarOpen)
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
  await page.goto('./#/')
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

/**
 * Milestone 7.7: the player paused vs Welcome over it (frozen scene). Over 10 s each: frames the
 * engine rendered and the main thread's busy time (CDP TaskDuration), per second.
 */
test('@perf Welcome open vs closed: frames and main-thread time over 10 s', async ({ page }) => {
  await openCanon(page)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const taskSeconds = async () => {
    const { metrics } = (await cdp.send('Performance.getMetrics')) as {
      metrics: { name: string; value: number }[]
    }
    return metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0
  }
  const rendered = () =>
    page.evaluate(
      () =>
        (
          window as { pianomeisterEngineStats?: () => { rendered: number } }
        ).pianomeisterEngineStats?.().rendered ?? 0,
    )
  const measure = async (state: string) => {
    await pause(page, 1000)
    const [frames0, task0] = [await rendered(), await taskSeconds()]
    await pause(page, 10_000)
    const [frames1, task1] = [await rendered(), await taskSeconds()]
    return {
      state,
      framesPerSecond: Number(((frames1 - frames0) / 10).toFixed(1)),
      mainThreadMsPerSecond: Number((((task1 - task0) * 1000) / 10).toFixed(1)),
    }
  }
  const closed = await measure('player, paused')
  await page.getByTestId('menu-home').click()
  await expect(page.getByTestId('welcome')).toBeVisible()
  const open = await measure('Welcome open')
  save('welcome-open-vs-closed', { closed, open })
  expect(open.framesPerSecond).toBeLessThan(closed.framesPerSecond)
})

/**
 * Milestone 8: the overview strip while playing the longest song we have (a generated 340-bar,
 * 9,520-note demo): the engine's frame time and the main thread's busy time with the strip
 * closed vs open (whole song, then zoomed to 8 bars and following), and the notes layer's
 * redraw time across zoom steps.
 */
test('@perf overview strip on a 340-bar song: closed vs open while playing, redraw on zoom', async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as { pianomeisterOverviewDraws?: number[] }).pianomeisterOverviewDraws = []
  })
  await page.goto('./#/library')
  await page
    .getByTestId('upload-input')
    .setInputFiles(fileURLToPath(new URL('../test-fixtures/midi/long-demo.mid', import.meta.url)))
  await expect(page.getByTestId('upload-summary')).toHaveText('1 added')
  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-bars')).toHaveText('340')
  await page.goto('./#/?stats=1')
  await page.reload()
  await expect(page.getByTestId('hud-bars')).toHaveText('340')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const taskSeconds = async () => {
    const { metrics } = (await cdp.send('Performance.getMetrics')) as {
      metrics: { name: string; value: number }[]
    }
    return metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0
  }
  const draws = () =>
    page.evaluate(() => [
      ...((window as { pianomeisterOverviewDraws?: number[] }).pianomeisterOverviewDraws ?? []),
    ])
  const clearDraws = () =>
    page.evaluate(() => {
      ;(window as { pianomeisterOverviewDraws?: number[] }).pianomeisterOverviewDraws?.splice(0)
    })
  const measure = async (state: string) => {
    await pause(page, 1000)
    const task0 = await taskSeconds()
    const samples: EngineStats[] = []
    for (let second = 0; second < 10; second++) {
      await pause(page, 1000)
      samples.push(
        await page.evaluate(
          () =>
            (
              window as { pianomeisterEngineStats?: () => EngineStats }
            ).pianomeisterEngineStats?.() ?? { averageFrameMs: 0, averageIntervalMs: 0, frames: 0 },
        ),
      )
    }
    const task1 = await taskSeconds()
    const mean = (pick: (s: EngineStats) => number) =>
      samples.reduce((sum, s) => sum + pick(s), 0) / samples.length
    return {
      state,
      averageFrameMs: Number(mean((s) => s.averageFrameMs).toFixed(3)),
      averageIntervalMs: Number(mean((s) => s.averageIntervalMs).toFixed(3)),
      mainThreadMsPerSecond: Number((((task1 - task0) * 1000) / 10).toFixed(1)),
    }
  }

  await page.getByTestId('play-pause').click()
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  const closed = await measure('strip closed')

  await page.getByTestId('overview-toggle').click()
  await expect(page.getByTestId('overview-strip')).toBeVisible()
  const openWhole = await measure('strip open, whole song')

  await clearDraws()
  // Zoom steps: Whole song → 4 bars and back, each a notes redraw.
  const zoomDraws: number[] = []
  for (const value of ['0.25', '0.5', '0.75', '1', '0.6', '0.3', '0']) {
    await clearDraws()
    await page.getByTestId('overview-zoom').fill(value)
    await expect.poll(async () => (await draws()).length).toBeGreaterThan(0)
    zoomDraws.push(...(await draws()))
  }
  await page.getByTestId('overview-zoom').fill('0.85')
  await clearDraws()
  const openZoomed = await measure('strip open, zoomed in, following')
  const followDraws = await draws()

  const stats = (xs: readonly number[]) => ({
    count: xs.length,
    meanMs: Number((xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(2)),
    maxMs: Number(Math.max(0, ...xs).toFixed(2)),
  })
  const result = {
    song: '340 bars, 9,520 notes',
    closed,
    openWhole,
    openZoomed,
    zoomRedraw: stats(zoomDraws),
    followRedrawsIn11s: stats(followDraws),
  }
  save('overview-long-demo', result)
  expect(result.zoomRedraw.maxMs).toBeLessThan(16)
})
