import { fileURLToPath } from 'node:url'

import { test, expect, type Page } from '@playwright/test'

/**
 * Screenshots for a human to review (npm run test:visual): saved under test-results/visual/,
 * never committed. Each view is shot twice: plain, and with ?guides=1, which marks the 1x
 * (amber) and 1.5x (magenta) look-ahead depths.
 */
const VIEWS = [
  { name: 'tilt-30', tiltDeg: 30, distanceOffset: 0 },
  { name: 'tilt-45', tiltDeg: 45, distanceOffset: 0 },
  { name: 'tilt-70', tiltDeg: 70, distanceOffset: 0 },
  { name: 'tilt-45-closer', tiltDeg: 45, distanceOffset: -0.3 },
] as const

const PEDAL_DEMO = fileURLToPath(new URL('../test-fixtures/midi/pedal-demo.mid', import.meta.url))

async function seedSettings(page: Page, camera: { tiltDeg: number; distanceOffset: number }) {
  await page.addInitScript(
    (value) => {
      localStorage.setItem('pianomeister.settings', value)
    },
    JSON.stringify({ version: 1, settings: { camera: { ...camera, pan: 0 } } }),
  )
}

/** The pedal demo isn't a library song: upload it, then open it from its details panel. */
async function openPedalDemo(page: Page) {
  await page.goto('./#/library')
  await page.getByTestId('upload-input').setInputFiles(PEDAL_DEMO)
  await expect(page.getByTestId('upload-summary')).toHaveText('1 added')
  await page.getByTestId('song-row').filter({ hasText: 'Pedal demo' }).click()
  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-title')).toHaveText('Pedal demo')
}

async function showBar(page: Page, path: string, bar: number) {
  await page.goto(path)
  // A hash-only change (e.g. after opening a song) doesn't reload; ?guides is read on load.
  await page.reload()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('1:1')
  for (let i = 1; i < bar; i++) await page.getByRole('button', { name: 'Next bar' }).click()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText(`${bar}:1`)
  // Let a few frames render at the new position.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0
        const tick = () => (++frames >= 10 ? resolve() : requestAnimationFrame(tick))
        requestAnimationFrame(tick)
      }),
  )
}

for (const view of VIEWS) {
  for (const guides of [false, true]) {
    test(`@visual Minuet at bar 5, ${view.name}${guides ? ', guides' : ''}`, async ({ page }) => {
      await seedSettings(page, view)
      // A fresh browser profile opens the first bundled song, the Minuet.
      await showBar(page, guides ? './#/?guides=1' : './', 5)
      await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
      const shot = await page.screenshot({
        path: `test-results/visual/minuet-bar5-${view.name}${guides ? '-guides' : ''}.png`,
      })
      expect(shot.byteLength).toBeGreaterThan(0)
    })
  }
}

for (const guides of [false, true]) {
  test(`@visual pedal demo at bar 2${guides ? ', guides' : ''}`, async ({ page }) => {
    await seedSettings(page, { tiltDeg: 45, distanceOffset: 0 })
    await openPedalDemo(page)
    await showBar(page, guides ? './#/?guides=1' : './', 2)
    const shot = await page.screenshot({
      path: `test-results/visual/pedal-demo-bar2${guides ? '-guides' : ''}.png`,
    })
    expect(shot.byteLength).toBeGreaterThan(0)
  })
}

test('@visual library page with details panel', async ({ page }) => {
  await openPedalDemo(page)
  await page.goto('./#/library')
  await page.getByTestId('song-row').filter({ hasText: 'Pedal demo' }).click()
  await expect(page.getByRole('complementary', { name: 'Song details' })).toBeVisible()
  await expect(page.getByTestId('hand-ch0')).toBeVisible()
  const shot = await page.screenshot({ path: 'test-results/visual/library-details.png' })
  expect(shot.byteLength).toBeGreaterThan(0)
})

test('@visual library details as a sheet on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 })
  await page.goto('./#/library')
  await page.getByTestId('song-row').filter({ hasText: 'Canon in D' }).click()
  await expect(page.getByTestId('hand-ch0')).toBeVisible()
  const shot = await page.screenshot({ path: 'test-results/visual/library-details-narrow.png' })
  expect(shot.byteLength).toBeGreaterThan(0)
})
