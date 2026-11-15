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

async function seedSettings(page: Page, camera: { tiltDeg: number; distanceOffset: number }) {
  await page.addInitScript(
    (value) => {
      localStorage.setItem('pianomeister.settings', value)
    },
    JSON.stringify({ version: 1, settings: { camera: { ...camera, pan: 0 } } }),
  )
}

async function showBar(page: Page, path: string, fileName: string, bar: number) {
  await page.goto(path)
  await page.getByTestId('song-picker').selectOption(fileName)
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
      await showBar(page, guides ? './#/?guides=1' : './', 'minuet-in-g.mid', 5)
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
    await showBar(page, guides ? './#/?guides=1' : './', 'pedal-demo.mid', 2)
    const shot = await page.screenshot({
      path: `test-results/visual/pedal-demo-bar2${guides ? '-guides' : ''}.png`,
    })
    expect(shot.byteLength).toBeGreaterThan(0)
  })
}
