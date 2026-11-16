import { test, expect, type Page } from '@playwright/test'

/** Collects console errors and page errors for the whole test. */
function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

const barOf = (barBeat: string | null) => Number.parseInt((barBeat ?? '').split(':')[0] ?? '', 10)

test('plays the Minuet and the HUD bar:beat advances, without console errors', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('1:1')

  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  // About 2 s of playback: at 126 BPM in 3/4 a bar is ~1.43 s, so we pass into bar 2.
  await expect
    .poll(async () => barOf(await page.getByTestId('hud-bar-beat').textContent()), {
      timeout: 10_000,
    })
    .toBeGreaterThanOrEqual(2)
  expect(errors).toEqual([])
})

test('Space plays and pauses; arrow keys step bars', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  await page.getByTestId('stage').click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('3:1')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('2:1')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('transport-state')).toHaveText('paused')
})

test('settings persist across a reload', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./')
  await page.getByTestId('open-settings').click()
  const tilt = page.getByTestId('setting-tilt')
  await expect(tilt).toHaveValue('45')
  await tilt.fill('60')
  await expect(page.getByRole('complementary', { name: 'Settings' })).toContainText('60°')

  await page.reload()
  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('setting-tilt')).toHaveValue('60')

  await page.getByRole('button', { name: 'Reset to defaults' }).click()
  await expect(page.getByTestId('setting-tilt')).toHaveValue('45')
  expect(errors).toEqual([])
})

test('visual-clarity and render settings apply, persist, and show the render readout', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('render-readout')).toContainText(/\d+ × \d+ px/)

  await page.getByTestId('setting-edge-profile').selectOption('rounded')
  await page.getByTestId('setting-antialias').selectOption('smaa')
  await page.getByTestId('setting-lift-mode').selectOption('manual')
  await page.getByTestId('setting-lift').fill('0.3')
  await page.getByTestId('setting-gap').fill('0.12')
  await page.getByTestId('setting-heads3d').uncheck()
  await expect(page.getByTestId('render-readout')).toContainText(/\d+ × \d+ px/)

  await page.reload()
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('setting-edge-profile')).toHaveValue('rounded')
  await expect(page.getByTestId('setting-antialias')).toHaveValue('smaa')
  await expect(page.getByTestId('setting-lift-mode')).toHaveValue('manual')
  await expect(page.getByTestId('setting-lift')).toHaveValue('0.3')
  await expect(page.getByTestId('setting-gap')).toHaveValue('0.12')
  await expect(page.getByTestId('setting-heads3d')).not.toBeChecked()

  // Every anti-aliasing mode renders without errors.
  for (const mode of ['off', 'msaa', 'fxaa', 'smaa']) {
    await page.getByTestId('setting-antialias').selectOption(mode)
    await expect(page.getByTestId('render-readout')).toContainText(/\d+ × \d+ px/)
  }
  await page.getByRole('button', { name: 'Reset to grand piano' }).click()
  await expect(page.getByTestId('setting-gap')).toHaveValue('0.06')
  await expect(page.getByTestId('setting-edge-profile')).toHaveValue('chamfer')
  expect(errors).toEqual([])
})

test('settings saved by milestone 4 (v1) are migrated, not discarded', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('pianomeister.settings') !== null) return
    localStorage.setItem(
      'pianomeister.settings',
      JSON.stringify({ version: 1, settings: { camera: { tiltDeg: 62, distanceOffset: 0, pan: 0 } } }),
    )
  })
  await page.goto('./')
  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('setting-tilt')).toHaveValue('62')
  await expect(page.getByTestId('setting-edge-profile')).toHaveValue('chamfer')
  await expect(page.getByTestId('setting-antialias')).toHaveValue('msaa')
  const stored = await page.evaluate(() => localStorage.getItem('pianomeister.settings'))
  // Opening settings doesn't rewrite storage by itself; the next change saves as v2.
  await page.getByTestId('setting-tilt').fill('63')
  await expect
    .poll(async () =>
      JSON.parse((await page.evaluate(() => localStorage.getItem('pianomeister.settings'))) ?? '{}'),
    )
    .toMatchObject({ version: 2, settings: { camera: { tiltDeg: 63 } } })
  expect(stored).not.toBeNull()
})

test('keyboard limits: lowering the black keys clamps their press depth, and it persists', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./')
  await page.getByTestId('open-settings').click()
  const height = page.getByTestId('setting-black-height')
  const depth = page.getByTestId('setting-press-black')
  await expect(depth).toHaveValue('0.3')
  // The height can't exceed the key thickness (0.6): the slider's maximum.
  await expect(height).toHaveAttribute('max', '0.6')
  await height.fill('0.6')
  await depth.fill('0.52')
  await expect(depth).toHaveValue('0.52')
  // Lower the black keys: a pressed key must stay 0.08 above the white tops.
  await height.fill('0.25')
  await expect(depth).toHaveValue('0.17')
  await expect(depth).toHaveAttribute('max', '0.17')

  await page.reload()
  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('setting-black-height')).toHaveValue('0.25')
  await expect(page.getByTestId('setting-press-black')).toHaveValue('0.17')
  expect(errors).toEqual([])
})
