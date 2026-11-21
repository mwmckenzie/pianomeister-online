import { test, expect } from '@playwright/test'

import {
  EMPTY_STORAGE,
  nudge,
  openSidebarSection,
  resetButton,
  segment,
  setting,
  shownValue,
  thumb,
  watchErrors,
} from './support'

const barOf = (barBeat: string | null) => Number.parseInt((barBeat ?? '').split(':')[0] ?? '', 10)

test('plays the Minuet and the HUD bar:beat advances, without console errors', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
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

test('Space plays and pauses; arrow keys step bars; Home goes back to the start', async ({
  page,
}) => {
  await page.goto('./#/')
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
  await page.keyboard.press('Home')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('1:1')
})

test('the timeline seeks by bar, by keyboard and by clicking', async ({ page }) => {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  const timeline = page.getByTestId('timeline')
  await timeline.focus()
  await timeline.press('ArrowRight')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('2:1')
  await expect(timeline).toHaveAttribute('aria-valuenow', '2')
  // Clicking the middle of the track lands on a bar start near the middle of the song.
  await timeline.click()
  await expect
    .poll(async () => barOf(await page.getByTestId('hud-bar-beat').textContent()))
    .toBeGreaterThan(25)
  await expect(page.getByTestId('hud-bar-beat')).toHaveText(/^\d+:1$/)
})

test('the playfield sidebar opens with P, applies changes live, and stays open', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  const stage = page.getByTestId('stage')
  const fullWidth = (await stage.boundingBox())?.width ?? 0
  await page.keyboard.press('KeyP')
  await expect(page.getByTestId('playfield-sidebar')).toBeVisible()
  // The highway gets narrower instead of being covered.
  await expect
    .poll(async () => (await stage.boundingBox())?.width ?? 0)
    .toBeLessThan(fullWidth - 300)

  await openSidebarSection(page, 'camera')
  await nudge(page, 'camera.tiltDeg', 'ArrowRight', 3)
  await expect(shownValue(page, 'camera.tiltDeg')).toHaveText('48°')
  await expect
    .poll(async () =>
      JSON.parse(
        (await page.evaluate(() => localStorage.getItem('pianomeister.settings'))) ?? '{}',
      ),
    )
    .toMatchObject({ version: 7, settings: { camera: { tiltDeg: 48 } } })

  await page.reload()
  await expect(page.getByTestId('playfield-sidebar')).toBeVisible()
  await expect(thumb(page, 'camera.tiltDeg')).toHaveAttribute('aria-valuenow', '48')
  await page.getByTestId('close-sidebar').click()
  await expect(page.getByTestId('playfield-sidebar')).toBeHidden()
  expect(errors).toEqual([])
})

test('sidebar sections: one open at a time, scrolled to the top, remembered', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await page.keyboard.press('KeyP')
  const sidebar = page.getByTestId('playfield-sidebar')
  await expect(sidebar).toBeVisible()
  // None open at first; the look picker sits above the sections.
  await expect(sidebar.locator('[data-state="open"][data-testid^="accordion-"]')).toHaveCount(0)
  await expect(page.getByTestId('look-picker')).toBeVisible()

  const camera = page.getByTestId('accordion-camera')
  const effects = page.getByTestId('accordion-effects')
  await camera.click()
  await expect(camera).toHaveAttribute('aria-expanded', 'true')
  await effects.click()
  await expect(camera).toHaveAttribute('aria-expanded', 'false')
  await expect(effects).toHaveAttribute('aria-expanded', 'true')
  // The opened header ends at the top of the scroll area.
  const scroll = sidebar.locator('.scroll')
  await expect
    .poll(async () => {
      const [h, s] = [await effects.boundingBox(), await scroll.boundingBox()]
      return Math.round(Math.abs((h?.y ?? 0) - (s?.y ?? 1e3)))
    })
    .toBeLessThanOrEqual(2)

  await page.reload()
  await expect(page.getByTestId('accordion-effects')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('accordion-camera')).toHaveAttribute('aria-expanded', 'false')
  await page.getByTestId('accordion-effects').click()
  await expect(sidebar.locator('[aria-expanded="true"][data-testid^="accordion-"]')).toHaveCount(0)

  // Keyboard: a focused header toggles with Enter and Space.
  await page.getByTestId('accordion-keyboard').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('accordion-keyboard')).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('accordion-keyboard')).toHaveAttribute('aria-expanded', 'false')
  expect(errors).toEqual([])
})

test('a changed setting lights its reset icon, and reset restores the default', async ({
  page,
}) => {
  await page.goto('./#/')
  await openSidebarSection(page, 'camera')
  const reset = resetButton(page, 'camera.tiltDeg')
  await expect(reset).toHaveAttribute('data-changed', 'false')
  await expect(page.getByTestId('accordion-camera').locator('.dot')).toHaveCount(0)

  await nudge(page, 'camera.tiltDeg', 'ArrowLeft', 5)
  await expect(shownValue(page, 'camera.tiltDeg')).toHaveText('40°')
  await expect(reset).toHaveAttribute('data-changed', 'true')
  await expect(page.getByTestId('accordion-camera').locator('.dot')).toHaveCount(1)

  await reset.click()
  await expect(shownValue(page, 'camera.tiltDeg')).toHaveText('45°')
  await expect(reset).toHaveAttribute('data-changed', 'false')
})

test('section reset applies at once with Undo; a newer reset replaces the Undo', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await openSidebarSection(page, 'camera')
  await nudge(page, 'camera.tiltDeg', 'ArrowRight', 2)
  await nudge(page, 'camera.pan', 'ArrowRight', 4)
  await expect(shownValue(page, 'camera.pan')).toHaveText('2.0')

  await page.getByTestId('reset-section-camera').click()
  await expect(shownValue(page, 'camera.tiltDeg')).toHaveText('45°')
  await expect(shownValue(page, 'camera.pan')).toHaveText('0.0')
  await expect(page.getByTestId('toast-undo')).toBeVisible()
  await page.getByTestId('toast-undo').click()
  await expect(shownValue(page, 'camera.tiltDeg')).toHaveText('47°')
  await expect(shownValue(page, 'camera.pan')).toHaveText('2.0')
  await expect(page.getByTestId('toast-undo')).toBeHidden()

  // Reset camera, then keyboard: only the keyboard reset can be undone.
  await openSidebarSection(page, 'keyboard')
  await nudge(page, 'keyboard.gap', 'ArrowRight', 2)
  await openSidebarSection(page, 'camera')
  await page.getByTestId('reset-section-camera').click()
  await openSidebarSection(page, 'keyboard')
  await page.getByRole('button', { name: 'Reset keyboard to grand piano' }).click()
  await expect(page.getByTestId('toast-undo')).toHaveCount(1)
  await page.getByTestId('toast-undo').click()
  await expect(shownValue(page, 'keyboard.gap')).toHaveText('1.6 mm')
  await openSidebarSection(page, 'camera')
  await expect(shownValue(page, 'camera.tiltDeg')).toHaveText('45°')
  expect(errors).toEqual([])
})

test('visual-clarity and render settings apply, persist, and show the render readout', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await openSidebarSection(page, 'render')
  await expect(page.getByTestId('render-readout')).toContainText(/\d+ × \d+ px/)
  await segment(page, 'render.antialias', 'SMAA')
  await openSidebarSection(page, 'keyboard')
  await segment(page, 'keyboard.edgeProfile', 'Rounded')
  await nudge(page, 'keyboard.gap', 'ArrowRight', 12)
  await openSidebarSection(page, 'notes')
  await segment(page, 'notes.blackLiftMode', 'Manual')
  await nudge(page, 'notes.blackLift', 'Home')
  await setting(page, 'notes.heads3d').getByRole('checkbox').uncheck()

  await page.reload()
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await openSidebarSection(page, 'keyboard')
  await expect(
    page.getByTestId('setting-keyboard-edgeProfile-control').getByText('Rounded'),
  ).toHaveAttribute('data-state', 'on')
  await expect(thumb(page, 'keyboard.gap')).toHaveAttribute('aria-valuenow', '0.12')
  await openSidebarSection(page, 'notes')
  await expect(thumb(page, 'notes.blackLift')).toHaveAttribute('aria-valuenow', '0')
  await expect(setting(page, 'notes.heads3d').getByRole('checkbox')).not.toBeChecked()
  await openSidebarSection(page, 'render')
  await expect(
    page.getByTestId('setting-render-antialias-control').getByText('SMAA', { exact: true }),
  ).toHaveAttribute('data-state', 'on')

  // Every anti-aliasing mode renders without errors (FXAA and SMAA load on demand).
  for (const mode of ['Off', 'MSAA', 'FXAA', 'SMAA']) {
    await segment(page, 'render.antialias', mode)
    await expect(page.getByTestId('render-readout')).toContainText(/\d+ × \d+ px/)
  }
  await openSidebarSection(page, 'keyboard')
  await page.getByRole('button', { name: 'Reset keyboard to grand piano' }).click()
  await expect(shownValue(page, 'keyboard.gap')).toHaveText('1.4 mm')
  await expect(
    page.getByTestId('setting-keyboard-edgeProfile-control').getByText('Chamfer'),
  ).toHaveAttribute('data-state', 'on')
  expect(errors).toEqual([])
})

test.describe('stored v1 settings', () => {
  test.use({ storageState: EMPTY_STORAGE })

  test('settings saved by milestone 4 (v1) are migrated, not discarded', async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('pianomeister.settings') !== null) return
      localStorage.setItem(
        'pianomeister.settings',
        JSON.stringify({
          version: 1,
          settings: { camera: { tiltDeg: 62, distanceOffset: 0, pan: 0 } },
        }),
      )
    })
    await page.goto('./#/')
    await openSidebarSection(page, 'camera')
    await expect(thumb(page, 'camera.tiltDeg')).toHaveAttribute('aria-valuenow', '62')
    await openSidebarSection(page, 'render')
    await expect(
      page.getByTestId('setting-render-antialias-control').getByText('MSAA', { exact: true }),
    ).toHaveAttribute('data-state', 'on')
    // The next change saves as the current version.
    await openSidebarSection(page, 'camera')
    await nudge(page, 'camera.tiltDeg', 'ArrowRight')
    await expect
      .poll(async () =>
        JSON.parse(
          (await page.evaluate(() => localStorage.getItem('pianomeister.settings'))) ?? '{}',
        ),
      )
      .toMatchObject({
        version: 7,
        settings: { camera: { tiltDeg: 63 }, appearance: { primary: '#8AB4FF' } },
      })
  })
})

test('keyboard limits: lowering the black keys clamps their press depth, and it persists', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await openSidebarSection(page, 'keyboard')
  const height = thumb(page, 'keyboard.blackHeight')
  const depth = thumb(page, 'keyboard.pressDepthBlack')
  await expect(depth).toHaveAttribute('aria-valuenow', '0.3')
  // The height can't exceed the key thickness (0.6): the slider's maximum.
  await expect(height).toHaveAttribute('aria-valuemax', '0.6')
  await nudge(page, 'keyboard.blackHeight', 'End')
  await expect(height).toHaveAttribute('aria-valuenow', '0.6')
  await nudge(page, 'keyboard.pressDepthBlack', 'End')
  await expect(depth).toHaveAttribute('aria-valuenow', '0.52')
  // Lower the black keys to 0.25: a pressed key must stay 0.08 above the white tops.
  // Page steps (0.1) then a few arrows: few key presses, so the CI preview stays well inside
  // the 30 s budget. Going via Home would clamp the depth to 0 on the way.
  await nudge(page, 'keyboard.blackHeight', 'PageDown', 3)
  await nudge(page, 'keyboard.blackHeight', 'ArrowLeft', 5)
  await expect(height).toHaveAttribute('aria-valuenow', '0.25')
  await expect(depth).toHaveAttribute('aria-valuenow', '0.17')
  await expect(depth).toHaveAttribute('aria-valuemax', '0.17')

  await page.reload()
  await openSidebarSection(page, 'keyboard')
  await expect(thumb(page, 'keyboard.blackHeight')).toHaveAttribute('aria-valuenow', '0.25')
  await expect(thumb(page, 'keyboard.pressDepthBlack')).toHaveAttribute('aria-valuenow', '0.17')
  expect(errors).toEqual([])
})

test('tempo and loop popovers: tempo %, a bar loop on the timeline, pre-roll, back to start', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')

  await page.getByTestId('open-tempo').click()
  const tempo = page.getByTestId('tempo-slider').getByRole('slider')
  await tempo.focus()
  await tempo.press('ArrowLeft')
  await tempo.press('ArrowLeft')
  await tempo.press('ArrowLeft')
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('85%')
  await expect(page.getByTestId('tempo-value')).toHaveText('85%')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('tempo-popover')).toBeHidden()

  await page.getByTestId('open-loop').click()
  await page.getByTestId('loop-from').fill('3')
  await page.getByTestId('loop-to').fill('6')
  await page.getByTestId('loop-set').click()
  await expect(page.getByTestId('timeline-loop')).toBeVisible()
  await expect(page.getByTestId('toggle-loop')).toHaveAttribute('aria-pressed', 'true')
  // A stopped transport parks at the loop start.
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('3:1')
  // Pre-roll is the same registry setting as in the Practice tab, with its reset icon.
  // Inverted: it counts back from the loop's first bar, so ArrowLeft adds beats.
  await nudge(page, 'practice.preRollBeats', 'ArrowLeft', 2)
  await expect(shownValue(page, 'practice.preRollBeats')).toHaveText('2 beats before bar 3')
  await expect(resetButton(page, 'practice.preRollBeats')).toHaveAttribute('data-changed', 'true')
  await page.keyboard.press('Escape')

  await page.getByTestId('toggle-loop').click()
  await expect(page.getByTestId('timeline-loop')).toBeHidden()
  await page.getByTestId('toggle-loop').click()
  await expect(page.getByTestId('timeline-loop')).toBeVisible()
  await page.getByTestId('open-loop').click()
  await page.getByTestId('loop-clear').click()
  await expect(page.getByTestId('timeline-loop')).toBeHidden()
  await page.getByTestId('to-start').click()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('1:1')
  expect(errors).toEqual([])
})

test('while playing, idle controls fade out and any activity brings them back', async ({
  page,
}) => {
  const errors = watchErrors(page)
  // A fake clock that runs in real time until the test jumps it past the idle delay, so the
  // test never depends on how long a slow (software-rendered) frame takes.
  await page.clock.install()
  await page.goto('./#/')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  await page.getByTestId('toggle-sidebar').click()
  await page.getByTestId('open-all-settings').click()
  await page.getByTestId('tab-appearance').click()
  // On by default, after 3 s; 2 s here.
  await nudge(page, 'appearance.hideControlsAfter', 'ArrowLeft', 2)
  await expect(shownValue(page, 'appearance.hideControlsAfter')).toHaveText('2 s')
  await expect(resetButton(page, 'appearance.hideControlsAfter')).toHaveAttribute(
    'data-changed',
    'true',
  )
  await page.keyboard.press('Escape')
  await page.getByTestId('toggle-sidebar').click()
  // Wait for the panel to be gone: the right column then moves right, and it must not slide
  // out from under the pointer later in the test.
  await expect(page.getByTestId('playfield-sidebar')).toHaveCount(0)

  const controls = page.getByTestId('player-controls')
  // Paused: never hidden.
  await page.mouse.move(640, 400)
  await page.clock.fastForward(2600)
  await expect(controls).not.toHaveClass(/hidden/)

  await page.getByTestId('play-pause').click()
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  // Over the controls: they stay.
  await page.clock.fastForward(2600)
  await expect(controls).not.toHaveClass(/hidden/)
  // Away from them and idle: they fade out; moving the pointer brings them back.
  await page.mouse.move(640, 400)
  await page.clock.fastForward(2600)
  await expect(controls).toHaveClass(/hidden/)
  await expect(page.getByTestId('app-menu')).toHaveClass(/hidden/)
  // The timeline and the information never hide.
  await expect(page.getByTestId('timeline')).toHaveCSS('opacity', '1')
  await expect(page.getByTestId('hud-bpm')).toBeVisible()
  await expect(page.getByTestId('hud-title')).toBeVisible()
  await page.mouse.move(660, 420)
  await expect(controls).not.toHaveClass(/hidden/)
  // A key press counts as activity too.
  await page.clock.fastForward(2600)
  await expect(controls).toHaveClass(/hidden/)
  await page.keyboard.press('Shift')
  await expect(controls).not.toHaveClass(/hidden/)

  // A popover open keeps them.
  await page.getByTestId('open-tempo').click()
  await page.clock.fastForward(2600)
  await expect(controls).not.toHaveClass(/hidden/)
  await page.keyboard.press('Escape')
  // Focus on a playfield panel control keeps them.
  await page.getByTestId('toggle-sidebar').click()
  await page.getByTestId('accordion-camera').focus()
  await page.mouse.move(640, 400)
  await page.clock.fastForward(2600)
  await expect(controls).not.toHaveClass(/hidden/)
  await page.getByTestId('play-pause').click()
  await expect(page.getByTestId('transport-state')).toHaveText('paused')
  expect(errors).toEqual([])
})

test('loop range: slider and fields stay in sync and never allow an invalid range', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await page.getByTestId('open-loop').click()
  const from = page.getByTestId('loop-from')
  const to = page.getByTestId('loop-to')
  const shown = page.getByTestId('loop-range')
  const start = page.getByTestId('loop-slider').getByRole('slider').first()
  const end = page.getByTestId('loop-slider').getByRole('slider').last()
  await expect(shown).toHaveText('1–4')

  // A start typed past the end pulls the end along (Enter commits).
  await from.fill('10')
  await from.press('Enter')
  await expect(shown).toHaveText('bar 10')
  await expect(to).toHaveValue('10')
  await expect(end).toHaveAttribute('aria-valuenow', '10')

  // The end thumb moves the "To" field.
  await end.focus()
  await end.press('ArrowRight')
  await end.press('ArrowRight')
  await expect(to).toHaveValue('12')
  await expect(shown).toHaveText('10–12')

  // The start thumb can't pass the end: both end up together.
  await start.focus()
  await start.press('End')
  await expect(shown).toHaveText('bar 64')
  await expect(from).toHaveValue('64')

  // An end typed before the start pulls the start back; out-of-range values are clamped.
  await to.fill('5')
  await to.blur()
  await expect(shown).toHaveText('bar 5')
  await expect(from).toHaveValue('5')
  // With the thumbs together, the focused one moves and pushes the other.
  await end.focus()
  await end.press('ArrowLeft')
  await expect(shown).toHaveText('bar 4')
  await expect(end).toBeFocused()
  await to.fill('99')
  await to.press('Enter')
  await expect(shown).toHaveText('4–64')

  // Without a loop, pre-roll leads into wherever play starts.
  await nudge(page, 'practice.preRollBeats', 'ArrowLeft', 4)
  await expect(shownValue(page, 'practice.preRollBeats')).toHaveText(
    '4 beats before the play position',
  )

  // Set the loop: pre-roll now reads back from its first bar, and range changes apply at once.
  await page.getByTestId('loop-set').click()
  await expect(page.getByTestId('toggle-loop')).toHaveAttribute('aria-pressed', 'true')
  await expect(shownValue(page, 'practice.preRollBeats')).toHaveText('4 beats before bar 4')
  await from.fill('7')
  await from.press('Enter')
  await expect(page.getByTestId('toggle-loop')).toHaveAttribute('aria-label', /7–64/)

  // Tab from "From" to "To" and type: the new "To" replaces the old one (not appended).
  await from.fill('20')
  await page.keyboard.press('Tab')
  await expect(to).toBeFocused()
  await page.keyboard.type('30')
  await page.keyboard.press('Enter')
  await expect(shown).toHaveText('20–30')
  expect(errors).toEqual([])
})

test('the HUD: bar:beat with upward beat dots, tempo and time, values beside the toggles', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  // The Minuet is in 3/4: three dots, beat 1 lit and at the bottom of the stack.
  const dots = page.getByTestId('beat-dots').locator('.dot')
  await expect(dots).toHaveCount(3)
  await expect(page.locator('[data-beat="1"]')).toHaveClass(/current/)
  const beat1 = await page.locator('[data-beat="1"]').boundingBox()
  const beat3 = await page.locator('[data-beat="3"]').boundingBox()
  expect(beat1 !== null && beat3 !== null && beat1.y > beat3.y).toBe(true)
  await expect(page.getByTestId('hud-bpm')).toHaveText('126')
  await expect(page.getByTestId('hud-tempo')).toHaveText('100% of 126 bpm')
  await expect(page.getByTestId('hud-position')).toHaveText('0:00')

  // Off: no value text beside the loop and tempo icons.
  await expect(page.getByTestId('loop-value')).toHaveCount(0)
  await expect(page.getByTestId('tempo-value')).toHaveCount(0)
  await page.getByTestId('open-tempo').click()
  const tempo = page.getByTestId('tempo-slider').getByRole('slider')
  await tempo.focus()
  await tempo.press('ArrowLeft')
  await expect(page.getByTestId('tempo-value')).toHaveText('95%')
  await expect(page.getByTestId('hud-tempo-percent')).toHaveClass(/accent/)
  await page.keyboard.press('Escape')
  await page.getByTestId('toggle-loop').click()
  await expect(page.getByTestId('loop-value')).toHaveText('bars 1–4')
  await expect(page.getByTestId('timeline-loop-start')).toHaveText('1')
  await expect(page.getByTestId('timeline-loop-end')).toHaveText('4')
  // The bpm text is information only.
  await expect(page.getByTestId('hud-bpm')).not.toHaveAttribute('role', /.+/)
  expect(errors).toEqual([])
})

test('the bar:beat colon never moves as the numbers change', async ({ page }) => {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  const timeline = page.getByTestId('timeline')
  const colonX = async (bar: number) => {
    await expect(page.getByTestId('hud-bar')).toHaveText(String(bar))
    return (await page.getByTestId('hud-bar-beat-sep').boundingBox())?.x
  }
  // The Minuet's 64 bars are all the same length, so clicking a bar's middle on the timeline
  // seeks to that bar.
  const box = await timeline.boundingBox()
  expect(box).not.toBeNull()
  const { x, y, width, height } = box as NonNullable<typeof box>
  const seek = async (bar: number) => {
    await page.mouse.click(x + (width * (bar - 0.5)) / 64, y + height / 2)
    return colonX(bar)
  }
  const at1 = await seek(1)
  const at9 = await seek(9)
  const at10 = await seek(10)
  const at57 = await seek(57)
  expect(at1).toBeDefined()
  expect([at9, at10, at57]).toEqual([at1, at1, at1])
})

test('the app menu: icons name themselves on hover, L opens the library, comma the settings', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  const library = page.getByTestId('menu-library')
  await expect(library.locator('.name')).toHaveCSS('opacity', '0')
  await library.hover()
  await expect(library.locator('.name')).toHaveCSS('opacity', '1')
  await expect(library.locator('.name')).toHaveText('LibraryL')

  // The playfield icon is lit while the panel is open.
  await page.getByTestId('stage').click()
  await page.keyboard.press('KeyP')
  await expect(page.getByTestId('toggle-sidebar')).toHaveClass(/active/)
  await page.keyboard.press('KeyP')
  await expect(page.getByTestId('toggle-sidebar')).not.toHaveClass(/active/)

  await page.keyboard.press('Comma')
  await expect(page.getByTestId('settings-window')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('settings-window')).toBeHidden()
  await page.getByTestId('stage').click()
  await page.keyboard.press('KeyL')
  await expect(page).toHaveURL(/#\/library$/)
  expect(errors).toEqual([])
})

test('during a count-in the HUD shows the target bar dimmed and the dots count the pre-roll', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  await page.getByTestId('open-loop').click()
  await page.getByTestId('loop-from').fill('3')
  await page.getByTestId('loop-from').press('Enter')
  await page.getByTestId('loop-set').click()
  // 8 beats of pre-roll: about 3.8 s at 126 bpm.
  await nudge(page, 'practice.preRollBeats', 'ArrowLeft', 8)
  await page.keyboard.press('Escape')
  await page.getByTestId('play-pause').click()
  const counter = page.getByTestId('hud-counter')
  await expect(counter).toHaveAttribute('data-pre-roll', 'true')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('3:1')
  // Two columns of four dots for the eight count-in beats.
  await expect(page.getByTestId('beat-dots').locator('.dot')).toHaveCount(8)
  await expect(counter).toHaveAttribute('data-pre-roll', 'false', { timeout: 10_000 })
  await expect(page.getByTestId('beat-dots').locator('.dot')).toHaveCount(3)
  await page.getByTestId('play-pause').click()
  expect(errors).toEqual([])
})

test('loop range: a pointer drag into the other thumb pushes it along', async ({ page }) => {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await page.getByTestId('open-loop').click()
  const shown = page.getByTestId('loop-range')
  await expect(shown).toHaveText('1–4')
  const slider = page.getByTestId('loop-slider')
  const startBox = await slider.getByRole('slider').first().boundingBox()
  const trackBox = await slider.boundingBox()
  expect(startBox).not.toBeNull()
  expect(trackBox).not.toBeNull()
  const start = startBox as NonNullable<typeof startBox>
  const track = trackBox as NonNullable<typeof trackBox>
  const y = start.y + start.height / 2
  // Grab the start thumb and drag it to the far right: the end is pushed to the last bar.
  await page.mouse.move(start.x + start.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(track.x + track.width + 20, y, { steps: 8 })
  await expect(shown).toHaveText('bar 64')
  // Still the start thumb: dragging back leaves the end where it was pushed.
  await page.mouse.move(track.x + track.width / 2, y, { steps: 8 })
  await page.mouse.up()
  await expect(shown).toHaveText(/^\d+–64$/)
  await expect(slider.getByRole('slider').first()).toBeFocused()
})

test.describe('stored v3 settings', () => {
  test.use({ storageState: EMPTY_STORAGE })

  test('settings saved with the v3 idle choices migrate to the switch and seconds', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('pianomeister.settings') !== null) return
      localStorage.setItem(
        'pianomeister.settings',
        JSON.stringify({ version: 3, settings: { appearance: { hideControls: 'off' } } }),
      )
    })
    await page.goto('./#/')
    await page.getByTestId('menu-settings').click()
    await page.getByTestId('tab-appearance').click()
    const toggle = setting(page, 'appearance.hideControls').getByRole('checkbox')
    await expect(toggle).not.toBeChecked()
    // Off: the delay is shown but can't be changed.
    await expect(setting(page, 'appearance.hideControlsAfter')).toHaveAttribute(
      'data-disabled',
      'true',
    )
    await expect(thumb(page, 'appearance.hideControlsAfter')).toHaveAttribute('data-disabled', '')
    // A greyed-out control says what it needs.
    await expect(page.getByTestId('setting-appearance-hideControlsAfter-hint')).toHaveText(
      'Needs “Hide controls when idle”',
    )
    await toggle.click()
    await expect(setting(page, 'appearance.hideControlsAfter')).not.toHaveAttribute(
      'data-disabled',
      'true',
    )
    await nudge(page, 'appearance.hideControlsAfter', 'ArrowRight')
    await expect(shownValue(page, 'appearance.hideControlsAfter')).toHaveText('3.5 s')
    await resetButton(page, 'appearance.hideControlsAfter').click()
    await expect(shownValue(page, 'appearance.hideControlsAfter')).toHaveText('3 s')
  })
})

test('the tempo step (Practice tab) sets how far the tempo slider moves', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-practice').click()
  await expect(shownValue(page, 'practice.tempoStep')).toHaveText('5%')
  await nudge(page, 'practice.tempoStep', 'ArrowLeft', 3)
  await expect(shownValue(page, 'practice.tempoStep')).toHaveText('2%')
  await expect(resetButton(page, 'practice.tempoStep')).toHaveAttribute('data-changed', 'true')
  await page.keyboard.press('Escape')

  await page.getByTestId('open-tempo').click()
  const slider = page.getByTestId('tempo-slider').getByRole('slider')
  await slider.focus()
  await slider.press('ArrowRight')
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('102%')
  await slider.press('ArrowLeft')
  await slider.press('ArrowLeft')
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('98%')
  expect(errors).toEqual([])
})

test('M toggles the metronome (Full song: the Audio setting), back to its last mode', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  const toggle = page.getByTestId('toggle-metronome')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(toggle).toHaveAttribute('aria-label', 'Metronome (M)')
  await page.keyboard.press('m')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-audio').click()
  const mode = page.getByTestId('setting-audio-metronomeMode-control')
  await expect(mode.getByText('Always', { exact: true })).toHaveAttribute('data-state', 'on')
  await mode.getByText('Pre-roll only', { exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('metronome-value')).toHaveText('pre-roll')
  // Off, then back to the last mode that wasn't off.
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('metronome-value')).toBeHidden()
  await page.keyboard.press('m')
  await expect(page.getByTestId('metronome-value')).toHaveText('pre-roll')
  expect(errors).toEqual([])
})
