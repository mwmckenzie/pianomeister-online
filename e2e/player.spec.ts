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
