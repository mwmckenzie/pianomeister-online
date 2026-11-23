import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { nudge, segment, shownValue, watchErrors } from './support'

/** Opens the window from the playfield panel ("All settings…"), opening the panel if needed. */
async function openWindow(page: Page, tab: string) {
  const sidebar = page.getByTestId('playfield-sidebar')
  if (!(await sidebar.isVisible())) await page.getByTestId('toggle-sidebar').click()
  await page.getByTestId('open-all-settings').click()
  await expect(page.getByTestId('settings-window')).toBeVisible()
  await page.getByTestId(`tab-${tab}`).click()
}

async function openSettings(page: Page, tab: string) {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await openWindow(page, tab)
}

const cssVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)

test('@settings @smoke Esc closes the settings window, focus is trapped and returns to the opener', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openSettings(page, 'audio')
  const dialog = page.getByTestId('settings-window')
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  }
  // One Esc closes the window, even with focus on a control whose tooltip is showing.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('open-all-settings')).toBeFocused()
  expect(errors).toEqual([])
})

test('@settings tab reset applies at once, counts changes, and can be undone', async ({ page }) => {
  const errors = watchErrors(page)
  await openSettings(page, 'audio')
  await expect(page.getByTestId('changed-count')).toHaveText('0 settings changed from default')
  // Home then six page steps (10% each): few key presses, so the test stays well inside 30 s
  // when the preview renders WebGL in software.
  await nudge(page, 'audio.leftVolume', 'Home')
  await nudge(page, 'audio.leftVolume', 'PageUp', 6)
  await expect(shownValue(page, 'audio.leftVolume')).toHaveText('60%')
  await segment(page, 'audio.metronomeMode', 'Pre-roll only')
  await expect(page.getByTestId('changed-count')).toHaveText('2 settings changed from default')
  await expect(page.getByTestId('tab-audio').locator('.dot')).toHaveCount(1)

  await page.getByTestId('reset-tab-audio').click()
  await expect(page.getByTestId('changed-count')).toHaveText('0 settings changed from default')
  await expect(shownValue(page, 'audio.leftVolume')).toHaveText('100%')
  await page.getByTestId('toast-undo').click()
  await expect(shownValue(page, 'audio.leftVolume')).toHaveText('60%')
  await expect(page.getByTestId('changed-count')).toHaveText('2 settings changed from default')

  // Section reset in the window works the same way.
  await page.getByTestId('reset-section-volume').click()
  await expect(page.getByTestId('changed-count')).toHaveText('1 setting changed from default')
  expect(errors).toEqual([])
})

test('@settings a theme preset and a custom primary colour persist across a reload', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openSettings(page, 'appearance')
  await page.getByTestId('preset-ember').click()
  await expect.poll(() => cssVar(page, '--primary')).toBe('#FFB38A')
  await expect.poll(() => cssVar(page, '--secondary')).toBe('#FFD98A')
  await expect(page.getByTestId('preset-ember')).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  await expect.poll(() => cssVar(page, '--primary')).toBe('#FFB38A')

  await openWindow(page, 'appearance')
  const hex = page.getByRole('textbox', { name: 'Primary hex value' })
  await hex.fill('#1a3d8f')
  await hex.press('Enter')
  await expect.poll(() => cssVar(page, '--primary')).toBe('#1A3D8F')
  // Dark primary → light text on primary buttons (decision 52).
  await expect.poll(() => cssVar(page, '--on-primary')).toBe('#FFFFFF')
  await expect(page.getByTestId('preset-ember')).toHaveAttribute('aria-pressed', 'false')

  await page.reload()
  await expect.poll(() => cssVar(page, '--primary')).toBe('#1A3D8F')
  expect(errors).toEqual([])
})

test('@settings reduced motion turns menu transitions into fades', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openSettings(page, 'appearance')
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-motion', 'reduced')
  const animation = () =>
    page.getByTestId('settings-window').evaluate((el) => getComputedStyle(el).animationName)
  expect(await animation()).toBe('pm-fade-in')
  expect(await cssVar(page, '--move')).toBe('0')

  // "Full" overrides the system preference; "Reduced" forces fades.
  await segment(page, 'appearance.motion', 'Full')
  await expect(html).toHaveAttribute('data-motion', 'full')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await segment(page, 'appearance.motion', 'Reduced')
  await expect(html).toHaveAttribute('data-motion', 'reduced')
  await segment(page, 'appearance.motion', 'Follow system')
  await expect(html).toHaveAttribute('data-motion', 'full')

  // Reopened with full motion, the window rises in.
  await page.keyboard.press('Escape')
  await page.getByTestId('open-all-settings').click()
  expect(await animation()).toBe('pm-rise-in')
})

test('@settings glass blur 0 keeps panels opaque enough to read', async ({ page }) => {
  await openSettings(page, 'appearance')
  await nudge(page, 'appearance.blur', 'Home')
  await expect(page.locator('html')).toHaveAttribute('data-glass-blur', '0')
  const background = await page
    .getByTestId('settings-window')
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  const alpha = Number(/[\d.]+\)$/.exec(background)?.[0].replace(')', '') ?? '1')
  expect(alpha).toBeGreaterThanOrEqual(0.9)
})
