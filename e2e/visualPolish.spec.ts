import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { SETTINGS_VERSION } from '../src/core/settings/loadSettings'

import { CLARITY_DEMO, LONG_DEMO, openSong } from './contactSheet'
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

/**
 * A frame once the scene has settled (samples loaded, layout and fonts done): two consecutive
 * frames the same. Under parallel load the first frames can still change.
 */
async function stableFrame(page: Page): Promise<string> {
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
  let previous = await frame(page)
  for (let i = 0; i < 10; i++) {
    const next = await frame(page)
    if (next === previous) return next
    previous = next
  }
  return previous
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

/**
 * How many pixels differ by more than 4/255 in any channel between two frames. Animation
 * (flicker, smoke, a pulse) changes whole notes — thousands of pixels; settling keys and
 * bloom rounding touch a few.
 */
async function changedPixels(page: Page, a: string, b: string): Promise<number> {
  return page.evaluate(
    async ([first, second]) => {
      const pixels = async (png: string) => {
        const image = new Image()
        image.src = `data:image/png;base64,${png}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d') as CanvasRenderingContext2D
        context.drawImage(image, 0, 0)
        return context.getImageData(0, 0, image.width, image.height).data
      }
      const [x, y] = [await pixels(first), await pixels(second)]
      let changed = 0
      for (let i = 0; i < x.length; i += 4) {
        const d = Math.max(
          Math.abs((x[i] ?? 0) - (y[i] ?? 0)),
          Math.abs((x[i + 1] ?? 0) - (y[i + 1] ?? 0)),
          Math.abs((x[i + 2] ?? 0) - (y[i + 2] ?? 0)),
        )
        if (d > 4) changed++
      }
      return changed
    },
    [a, b] as const,
  )
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
  await choose(page, page.getByTestId('setting-noteStyle-sustainFill-control'), 'Diagonal stripes')
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
  // …and say why.
  await expect(page.getByTestId('section-render-hint')).toHaveText(
    'Needs bloom (quality Low or higher)',
  )
  await expect(page.getByTestId('setting-render-bloomStrength-hint')).toBeHidden()
  await openSidebarSection(page, 'effects')
  await expect(page.getByTestId('setting-effects-keyCone-hint')).toHaveText(
    'Needs shader detail Medium or High',
  )
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
  const off = await stableFrame(page)
  await segment(page, 'names.mode', 'Both')
  const on = await frame(page)
  expect(on).not.toEqual(off)
  await segment(page, 'names.mode', 'Off')
  expect(await stableFrame(page)).toEqual(off)
  // Note-label rows stay in view, greyed out; the shared reason is said once, at the top.
  await expect(setting(page, 'names.offset')).toHaveAttribute('data-disabled', 'true')
  const sectionHints = page.getByTestId('section-names-hint')
  // Only the root cause: names off implies "not on notes" (and "not on keys").
  await expect(sectionHints).toHaveText(['Needs note names on'])
  await expect(page.getByTestId('setting-names-offset-hint')).toBeHidden()
  expect(errors).toEqual([])
})

const ANIMATED = { noteStyle: { headFill: 'hotCore', sustainFill: 'smoke' } }

test('animated fills hold still while stopped, even with full motion', async ({ page }) => {
  // Looping animation runs only while playing (brief decision 119), so the frame settles.
  const errors = watchErrors(page)
  await seed(page, { ...ANIMATED, appearance: { motion: 'full' } })
  await openPlayer(page)
  // Keys and pulses from loading settle first (wall-clock fades).
  await pause(page, 1500)
  const a = await stableFrame(page)
  await pause(page, 400)
  expect(await changedPixels(page, a, await frame(page))).toBeLessThan(50)
  expect(errors).toEqual([])
})

test('reduced motion stops animated fills', async ({ page }) => {
  const errors = watchErrors(page)
  await seed(page, { ...ANIMATED, appearance: { motion: 'reduced' } })
  await openPlayer(page)
  // Keys and pulses from loading settle first (wall-clock fades).
  await pause(page, 1500)
  const a = await stableFrame(page)
  await pause(page, 400)
  expect(await changedPixels(page, a, await frame(page))).toBeLessThan(50)
  expect(errors).toEqual([])
})

test('Copy look puts the current look on the clipboard as .pmlook.json', async ({
  page,
  context,
}) => {
  const errors = watchErrors(page)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openPlayer(page)
  await page.getByTestId('toggle-sidebar').click()
  await page.getByTestId('look-select').click()
  await page.getByRole('option', { name: 'Classic', exact: true }).click()
  await page.getByTestId('look-copy').click()
  await expect(page.getByTestId('toast').filter({ hasText: 'Copied look "Classic"' })).toBeVisible()
  const file = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))
  expect(file).toMatchObject({ format: 'pianomeister-look', version: 8 })
  expect(file.looks).toHaveLength(1)
  expect(file.looks[0]).toMatchObject({ id: 'builtin:classic', name: 'Classic' })
  expect(file.looks[0].settings.lines.nowStyle).toBe('thin')
  // Device cost never travels with a look.
  expect(file.looks[0].settings.render).not.toHaveProperty('quality')
  expect(file.looks[0].settings.render).not.toHaveProperty('particleBudget')
  expect(errors).toEqual([])
})

/** Everything that animates on, at full motion. */
const LIVELY = {
  noteStyle: { headFill: 'hotCore', sustainFill: 'smoke' },
  effects: { sustain: 'embers', breathing: true, pulse: true },
  appearance: { motion: 'full' },
}

test('a paused frame settles, then holds still', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = watchErrors(page)
  await seed(page, LIVELY)
  await openPlayer(page)
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await pause(page, 2000)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  // Pulses, flashes and particles in flight finish (well under 3 s), then nothing moves.
  await pause(page, 3000)
  const still = await frame(page)
  await pause(page, 500)
  expect(await changedPixels(page, still, await frame(page))).toBeLessThan(50)
  expect(errors).toEqual([])
})

test('seeking while paused starts no pulse', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = watchErrors(page)
  await seed(page, LIVELY)
  await openPlayer(page)
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
  for (let bar = 0; bar < 2; bar++) {
    await page.getByRole('button', { name: 'Next bar' }).click()
    // Straight after the seek, a pulse would still be bright; a second later it's gone.
    const now = await frame(page)
    await pause(page, 1000)
    expect(await changedPixels(page, now, await frame(page))).toBeLessThan(50)
  }
  expect(errors).toEqual([])
})

interface LabelSnapshot {
  readonly id: string
  readonly state: 'new' | 'hidden' | 'shown'
  readonly shown: number
  readonly slot: number
}

/** The overlap pass's labels on each animation frame, for `ms`. */
function sampleLabels(page: Page, ms: number): Promise<LabelSnapshot[][]> {
  return page.evaluate(
    (duration) =>
      new Promise<LabelSnapshot[][]>((resolve) => {
        const read = (window as unknown as { pianomeisterLabels: () => LabelSnapshot[] })
          .pianomeisterLabels
        const frames: LabelSnapshot[][] = []
        const end = performance.now() + duration
        const tick = () => {
          frames.push(read())
          if (performance.now() < end) requestAnimationFrame(tick)
          else resolve(frames)
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )
}

/**
 * Changes between consecutive frames that would read as a blink or a jump: a shown label hiding,
 * a label fading out (other than its distance and handover fades, which aren't in `shown`), or a
 * stack slot changing.
 */
function labelFlips(frames: readonly LabelSnapshot[][]): string[] {
  const flips: string[] = []
  for (let f = 1; f < frames.length; f++) {
    const before = new Map((frames[f - 1] ?? []).map((l) => [l.id, l]))
    for (const label of frames[f] ?? []) {
      const prev = before.get(label.id)
      if (prev === undefined) continue
      if (prev.state === 'shown' && label.state !== 'shown') flips.push(`${label.id} hid @${f}`)
      if (label.shown < prev.shown) flips.push(`${label.id} faded out @${f}`)
      if (label.slot !== prev.slot) flips.push(`${label.id} moved slot @${f}`)
    }
  }
  return flips
}

/** Opens a song with note names on notes and the test hook. */
async function openWithLabels(page: Page, file = LONG_DEMO, title = 'Long demo') {
  await openSong(page, file, title)
  await page.evaluate(
    (value) => localStorage.setItem('pianomeister.settings', value),
    JSON.stringify({ version: SETTINGS_VERSION, settings: { names: { mode: 'notes' } } }),
  )
  await page.goto('./#/?stats=1')
  await page.reload()
  await expect(page.getByTestId('hud-title')).toHaveText(title)
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
}

for (const song of [
  // Ten-note chords: labels wait for room, then show for good.
  { title: 'Long demo', file: LONG_DEMO, check: (l: LabelSnapshot) => l.state === 'hidden' },
  // Chords in neighbouring lanes: stacked labels.
  { title: 'Clarity demo', file: CLARITY_DEMO, check: (l: LabelSnapshot) => l.slot > 0 },
] as const) {
  test(`note labels never blink or jump while playing (${song.title})`, async ({ page }) => {
    test.setTimeout(120_000)
    const errors = watchErrors(page)
    await openWithLabels(page, song.file, song.title)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    const frames = await sampleLabels(page, 5000)
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    expect(labelFlips(frames)).toEqual([])
    const all = frames.flat()
    expect(all.length).toBeGreaterThan(0)
    // The passage really exercises the rule (hidden labels, or stacked ones).
    expect(all.some(song.check)).toBe(true)
    expect(errors).toEqual([])
  })
}

test('a seek places note labels at once (no fades)', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = watchErrors(page)
  await openWithLabels(page)
  for (let bar = 0; bar < 3; bar++) {
    await page.getByRole('button', { name: 'Next bar' }).click()
    const [first] = await sampleLabels(page, 0)
    expect(first?.length ?? 0).toBeGreaterThan(0)
    // Paused, nothing moves: every label is fully in or out straight away.
    expect((first ?? []).filter((l) => l.shown !== 0 && l.shown !== 1)).toEqual([])
  }
  expect(errors).toEqual([])
})
