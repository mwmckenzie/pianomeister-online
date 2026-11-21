import { test, expect, type Page } from '@playwright/test'

import { choose, nudge, openSidebarSection, segment, setting, watchErrors } from './support'

type Settings = Record<string, Record<string, unknown>>

/** Seeds v6 settings (sections merged over the defaults) before the app loads. */
async function seed(page: Page, settings: Settings) {
  await page.addInitScript(
    (value) => localStorage.setItem('pianomeister.settings', value),
    JSON.stringify({ version: 6, settings }),
  )
}

async function openPlayer(page: Page, query = '') {
  await page.goto(`./#/${query}`)
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
}

/** Lets real time pass in the page (frames keep rendering meanwhile). */
const pause = (page: Page, ms: number) =>
  page.evaluate((delay) => new Promise<void>((resolve) => setTimeout(resolve, delay)), ms)

/** Waits for a few rendered frames. */
async function settle(page: Page, frames = 12) {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let n = 0
        const tick = () => (++n >= count ? resolve() : requestAnimationFrame(tick))
        requestAnimationFrame(tick)
      }),
    frames,
  )
}

/**
 * The canvas pixels, as a comparable string. The HUD drawn over the canvas (sample loading,
 * hints, toasts) is hidden for the shot, so only the scene is compared.
 */
async function frame(page: Page): Promise<string> {
  // Long enough for key presses and the held glow to reach their resting state.
  await settle(page, 30)
  const hide = await page.addStyleTag({
    content: '* { visibility: hidden !important; } canvas { visibility: visible !important; }',
  })
  const shot = (await page.locator('canvas').first().screenshot()).toString('base64')
  await hide.evaluate((el) => el.remove())
  return shot
}

/** Settings under which every milestone 9 row is shown (dependent rows included). */
const EVERYTHING_SHOWN: Settings = {
  lines: { borders: true, octaves: true },
  noteStyle: { headFill: 'gradient', sustainFill: 'stripes' },
  effects: {
    scalingSparks: true,
    flame: true,
    explosion: true,
    glitter: true,
    sustain: 'embers',
    keyCone: true,
    breathing: true,
  },
  pedal: { border: true },
  names: { mode: 'both' },
  render: { quality: 'high', bloomResolution: 'full', particleBudget: 4096, shaderDetail: 'high' },
}

/**
 * Works every control of a sidebar section once (m9 decision 17) and puts it back, so the rows
 * that depend on it stay shown: toggles flip twice, choices go through every option and back,
 * sliders go to both ends (no row depends on a number).
 */
async function workSection(page: Page, section: string) {
  await openSidebarSection(page, section)
  const rows = page
    .getByTestId(`section-${section}`)
    .locator('[data-testid^="setting-"].setting-row')
  const ids = await rows.evaluateAll((els) =>
    els
      .filter((el) => !el.hasAttribute('data-disabled'))
      .map((el) => ({
        id: el.getAttribute('data-testid') ?? '',
        kind: [...el.classList].find((c) => c.startsWith('kind-')) ?? '',
      })),
  )
  for (const { id, kind } of ids) {
    const control = page.getByTestId(`${id}-control`)
    if (kind === 'kind-boolean') {
      await control.click()
      await control.click()
    } else if (kind === 'kind-number') {
      const handle = control.getByRole('slider')
      await handle.focus()
      await handle.press('End')
      await handle.press('Home')
    } else if (kind === 'kind-choice') {
      const isSelect = await control.evaluate((el) => el.tagName === 'BUTTON')
      if (isSelect) {
        const original = (await control.textContent())?.trim() ?? ''
        await control.click()
        const labels = (await page.getByRole('option').allTextContents()).map((t) => t.trim())
        await page.keyboard.press('Escape')
        for (const label of [...labels, original]) await choose(page, control, label)
      } else {
        const segments = control.locator('[data-value]')
        const original = control.locator('[data-state="on"]')
        const originalValue = await original.getAttribute('data-value')
        const count = await segments.count()
        for (let i = 0; i < count; i++) await segments.nth(i).click()
        await control.locator(`[data-value="${originalValue}"]`).click()
      }
    }
  }
  expect(ids.length).toBeGreaterThan(0)
}

for (const section of ['lines', 'noteStyle', 'effects', 'cages', 'names', 'render']) {
  test(`every control in "${section}" applies without console errors`, async ({ page }) => {
    test.setTimeout(240_000)
    const errors = watchErrors(page)
    await seed(page, EVERYTHING_SHOWN)
    await openPlayer(page)
    await workSection(page, section)
    await settle(page)
    expect(errors).toEqual([])
  })
}

test('new playfield controls change what the highway shows', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  const before = await frame(page)
  await openSidebarSection(page, 'lines')
  await segment(page, 'lines.nowStyle', 'Neon')
  const neon = await frame(page)
  expect(neon).not.toEqual(before)
  await openSidebarSection(page, 'noteStyle')
  await choose(page, page.getByTestId('setting-noteStyle-sustainFill-control'), 'Stripes')
  const stripes = await frame(page)
  expect(stripes).not.toEqual(neon)
  await openSidebarSection(page, 'highway')
  await nudge(page, 'highway.vignette', 'End')
  expect(await frame(page)).not.toEqual(stripes)
  expect(errors).toEqual([])
})

test('quality presets set their cost settings; a tweak shows "modified"', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openSidebarSection(page, 'render')
  const budget = page.getByTestId('setting-render-particleBudget-value')
  await expect(budget).toHaveText('2048')
  await segment(page, 'render.quality', 'High')
  await expect(budget).toHaveText('4096')
  await expect(page.getByTestId('render-readout')).toContainText('bloom')
  await segment(page, 'render.quality', 'Off')
  await expect(budget).toHaveText('512')
  await expect(page.getByTestId('render-readout')).not.toContainText('bloom')
  await expect(page.getByTestId('quality-status')).toBeHidden()
  await nudge(page, 'render.particleBudget', 'ArrowRight')
  await expect(page.getByTestId('quality-status')).toHaveText('Off · modified')
  await segment(page, 'render.quality', 'Low')
  await expect(page.getByTestId('quality-status')).toBeHidden()
  // Bloom settings are greyed out while bloom is off.
  await segment(page, 'render.quality', 'Off')
  await expect(setting(page, 'render.bloomStrength')).toHaveAttribute('data-disabled', 'true')
  expect(errors).toEqual([])
})

test('looks: apply with Undo, modified, save as new, persist, delete with Undo', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await page.getByTestId('toggle-sidebar').click()
  const select = page.getByTestId('look-select')
  await expect(select).toContainText('Defaults')

  await select.click()
  await page.getByRole('option', { name: 'Classic', exact: true }).click()
  await expect(select).toContainText('Classic')
  await expect(page.getByTestId('look-status')).toBeHidden()
  await page.getByTestId('toast-undo').click()
  await expect(select).toContainText('Defaults')

  await select.click()
  await page.getByRole('option', { name: 'Classic', exact: true }).click()
  await openSidebarSection(page, 'lines')
  await segment(page, 'lines.nowStyle', 'Neon')
  await expect(page.getByTestId('look-status')).toHaveText('Classic · modified')
  // Built-in looks can't be overwritten: only "Save as new…".
  await expect(page.getByTestId('look-save')).toBeHidden()
  await page.getByTestId('look-save-new').click()
  await page.getByTestId('look-name').fill('Neon night')
  await page.getByTestId('look-name-save').click()
  await expect(select).toContainText('Neon night')
  await expect(page.getByTestId('look-status')).toBeHidden()

  await page.reload()
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  // The panel's open state is kept across reloads (brief decision 63).
  await expect(page.getByTestId('playfield-sidebar')).toBeVisible()
  await expect(page.getByTestId('look-select')).toContainText('Neon night')

  await page.getByTestId('look-delete').click()
  await expect(page.getByTestId('look-select')).toContainText('Custom')
  await page.getByTestId('toast-undo').click()
  await expect(page.getByTestId('look-select')).toContainText('Neon night')
  expect(errors).toEqual([])
})

test('note names on and off', async ({ page }) => {
  const errors = watchErrors(page)
  // Reduced motion keeps the scene still (the held glow pulses otherwise), so frames compare.
  await seed(page, { highway: { lookAheadBeats: 4 }, appearance: { motion: 'reduced' } })
  await openPlayer(page)
  await openSidebarSection(page, 'names')
  const off = await frame(page)
  await segment(page, 'names.mode', 'Both')
  const on = await frame(page)
  expect(on).not.toEqual(off)
  await segment(page, 'names.mode', 'Off')
  expect(await frame(page)).toEqual(off)
  expect(errors).toEqual([])
})

const ANIMATED = { noteStyle: { headFill: 'hotCore', sustainFill: 'smoke' } }

test('animated fills move with full motion', async ({ page }) => {
  const errors = watchErrors(page)
  await seed(page, { ...ANIMATED, appearance: { motion: 'full' } })
  await openPlayer(page)
  const a = await frame(page)
  await pause(page, 400)
  expect(await frame(page)).not.toEqual(a)
  expect(errors).toEqual([])
})

test('reduced motion stops animated fills', async ({ page }) => {
  const errors = watchErrors(page)
  await seed(page, { ...ANIMATED, appearance: { motion: 'reduced' } })
  await openPlayer(page)
  const a = await frame(page)
  await pause(page, 400)
  expect(await frame(page)).toEqual(a)
  expect(errors).toEqual([])
})
