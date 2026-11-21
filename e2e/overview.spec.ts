import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { readStore, seedBookmark, seedPractice, setLoopBars, watchErrors } from './support'

/**
 * Milestone 8: the overview strip in the player (brief decisions 101–105). The Minuet has 64
 * bars of 3/4, all the same width, so at "Whole song" bar n sits at a fixed fraction.
 */

/** The strip's roll: 20 px insets, notes from 56 to 186 px down the canvas. */
async function barPoint(page: Page, bar: number, at = 0.5): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('overview-strip').getByTestId('roll').boundingBox()
  if (box === null) throw new Error('No roll')
  return { x: box.x + 20 + ((bar - 1 + at) * (box.width - 40)) / 64, y: box.y + 120 }
}

async function openPlayer(page: Page): Promise<void> {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
}

async function openStrip(page: Page): Promise<void> {
  await page.getByTestId('overview-toggle').click()
  await expect(page.getByTestId('overview-strip')).toBeVisible()
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()
}

test('V opens and closes the strip, the chevron too, and it stays open across a reload', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await expect(page.getByTestId('overview-strip')).toHaveCount(0)
  await page.getByTestId('stage').click()
  await page.keyboard.press('KeyV')
  await expect(page.getByTestId('overview-strip')).toBeVisible()
  await expect(page.getByTestId('overview-toggle')).toHaveAttribute('aria-expanded', 'true')
  // The columns stay where they are; the strip sits between them.
  const strip = await page.getByTestId('overview-strip').boundingBox()
  const left = await page.getByTestId('hud-counter').boundingBox()
  const right = await page.getByTestId('player-controls').boundingBox()
  expect(strip && left && strip.x).toBeGreaterThanOrEqual((left?.x ?? 0) + (left?.width ?? 0) + 20)
  expect((strip?.x ?? 0) + (strip?.width ?? 0)).toBeLessThanOrEqual((right?.x ?? 0) - 20)
  await expect(page.getByTestId('overview-zoom-label')).toHaveText('Whole song')

  await page.reload()
  await expect(page.getByTestId('overview-strip')).toBeVisible()
  await page.getByTestId('overview-close').click()
  await expect(page.getByTestId('overview-strip')).toHaveCount(0)
  await page.getByTestId('overview-toggle').click()
  await expect(page.getByTestId('overview-strip')).toBeVisible()
  await page.getByTestId('stage').click()
  await page.keyboard.press('KeyV')
  await expect(page.getByTestId('overview-strip')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a click seeks to the start of the bar; with a loop on, outside it lands on the loop start', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openStrip(page)
  const bar33 = await barPoint(page, 33)
  await page.mouse.click(bar33.x, bar33.y)
  await expect(page.getByTestId('hud-bar')).toHaveText('33')

  await setLoopBars(page, 17, 32)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('hud-bar')).toHaveText('17')
  const bar20 = await barPoint(page, 20)
  await page.mouse.click(bar20.x, bar20.y)
  await expect(page.getByTestId('hud-bar')).toHaveText('20')
  const bar40 = await barPoint(page, 40)
  await page.mouse.click(bar40.x, bar40.y)
  await expect(page.getByTestId('hud-bar')).toHaveText('17')
  expect(errors).toEqual([])
})

test('drag across the notes, then Loop these bars: the loop is set and the playhead jumps once', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openStrip(page)
  await drag(page, await barPoint(page, 41), await barPoint(page, 48))
  const actions = page.getByTestId('selection-actions')
  await expect(actions).toBeVisible()
  await expect(page.getByTestId('selection-range')).toHaveText('Bars 41–48')
  await expect(actions).toContainText('8 bars')
  // Nothing changes until an action is chosen.
  await expect(page.getByTestId('loop-value')).toBeHidden()
  await expect(page.getByTestId('hud-bar')).toHaveText('1')

  await page.getByTestId('selection-loop').click()
  await expect(page.getByTestId('loop-value')).toHaveText('bars 41–48')
  await expect(page.getByTestId('hud-bar')).toHaveText('41')
  await expect(actions).toHaveCount(0)

  // × clears a selection, and so does Esc with the roll focused.
  await drag(page, await barPoint(page, 5), await barPoint(page, 8))
  await page.getByTestId('selection-clear').click()
  await expect(actions).toHaveCount(0)
  await drag(page, await barPoint(page, 5), await barPoint(page, 8))
  await page.keyboard.press('Escape')
  await expect(actions).toHaveCount(0)
  await expect(page.getByTestId('loop-value')).toHaveText('bars 41–48')
  expect(errors).toEqual([])
})

test('Save as bookmark from a selection saves it without loading it; the same again saves nothing', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openStrip(page)
  await drag(page, await barPoint(page, 41), await barPoint(page, 48))
  await page.getByTestId('selection-save').click()
  const name = 'Bars 41–48 · 100% · both hands · no pre-roll'
  const toast = page.getByTestId('toast').filter({ hasText: `Saved “${name}”` })
  await expect(toast).toBeVisible()
  await expect(toast.getByTestId('toast-load')).toBeVisible()
  await expect(toast.getByTestId('toast-rename')).toBeVisible()
  await expect(toast.getByTestId('toast-undo')).toBeVisible()
  // Not loaded: still Full song, no loop, no jump.
  await expect(page.getByTestId('hud-full-song')).toHaveText('Full song')
  await expect(page.getByTestId('loop-value')).toBeHidden()
  await expect(page.getByTestId('hud-bar')).toHaveText('1')
  const lane = page.getByTestId('overview-strip').getByTestId('lane-item')
  await expect(lane).toHaveCount(1)
  await expect(lane).toHaveAttribute('data-range', '41-48')
  const [saved] = await readStore<{ config: { loop: object } }>(page, 'bookmarks')
  expect(saved?.config.loop).toEqual({ startBar: 41, endBar: 48 })

  // The same bars again: nothing new.
  await drag(page, await barPoint(page, 41), await barPoint(page, 48))
  await page.getByTestId('selection-save').click()
  await expect(
    page
      .getByTestId('toast')
      .filter({ hasText: `Already saved as “${name}” · no new bookmark created` }),
  ).toBeVisible()
  expect(await readStore(page, 'bookmarks')).toHaveLength(1)

  // The toast's Load loads it.
  await toast.getByTestId('toast-load').click()
  await expect(page.getByTestId('hud-bookmark')).toHaveText(name)
  await expect(page.getByTestId('loop-value')).toHaveText('bars 41–48')
  expect(errors).toEqual([])
})

test('dragging a loop handle changes the loop on release, with one jump to its start', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await setLoopBars(page, 17, 32)
  await page.keyboard.press('Escape')
  await openStrip(page)
  const bar33 = await barPoint(page, 33)
  await page.mouse.click(bar33.x, bar33.y)
  await expect(page.getByTestId('hud-bar')).toHaveText('17')
  await page.mouse.click((await barPoint(page, 20)).x, bar33.y)
  await expect(page.getByTestId('hud-bar')).toHaveText('20')

  // The end handle sits on bar 32's end: drag it to bar 36's end.
  const from = await barPoint(page, 32, 1)
  const to = await barPoint(page, 36, 0.97)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 6 })
  // Shown at once, applied only on release.
  await expect(page.getByTestId('loop-value')).toHaveText('bars 17–32')
  await page.mouse.up()
  await expect(page.getByTestId('loop-value')).toHaveText('bars 17–36')
  await expect(page.getByTestId('hud-bar')).toHaveText('17')
  expect(errors).toEqual([])
})

test('a click on a bookmark in the lane loads it; the one playing is lit', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await seedPractice(page, {
    bookmarks: [
      seedBookmark('b', 'B section', { startBar: 17, endBar: 32 }),
      seedBookmark('end', 'Ending', { startBar: 53, endBar: 64 }),
    ],
  })
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await openStrip(page)
  const lanes = page.getByTestId('overview-strip').getByTestId('lane-item')
  await expect(lanes).toHaveCount(2)
  await expect(lanes.filter({ hasText: 'B section' }).getByRole('button')).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await lanes.filter({ hasText: 'B section' }).getByRole('button').click()
  await expect(page.getByTestId('hud-bookmark')).toHaveText('B section')
  await expect(page.getByTestId('loop-value')).toHaveText('bars 17–32')
  await expect(page.getByTestId('hud-bar')).toHaveText('17')
  await expect(lanes.filter({ hasText: 'B section' }).getByRole('button')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(errors).toEqual([])
})

test('keys on the focused overview: a bar cursor, Shift extends, Enter loops, B saves', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openStrip(page)
  const roll = page.getByTestId('overview-strip').getByTestId('roll')
  await roll.focus()
  await page.keyboard.press('ArrowRight')
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight')
  await expect(roll.getByTestId('roll-live')).toHaveText('Selected bars 1–4 · 4 bars')
  // The arrows stayed in the overview: the playhead didn't move.
  await expect(page.getByTestId('hud-bar')).toHaveText('1')
  await page.keyboard.press('KeyB')
  await expect(
    page
      .getByTestId('toast')
      .filter({ hasText: 'Saved “Bars 1–4 · 100% · both hands · no pre-roll”' }),
  ).toBeVisible()
  await expect(page.getByTestId('hud-full-song')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('loop-value')).toHaveText('bars 1–4')
  expect(errors).toEqual([])
})

test('zoom: the slider down to 4 bars, Ctrl+wheel around the pointer, the wheel pans', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await openStrip(page)
  const label = page.getByTestId('overview-zoom-label')
  await page.getByTestId('overview-zoom').fill('1')
  await expect(label).toHaveText('4 bars')
  await page.getByTestId('overview-zoom').fill('0')
  await expect(label).toHaveText('Whole song')

  const point = await barPoint(page, 32)
  await page.mouse.move(point.x, point.y)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -400)
  await page.keyboard.up('Control')
  await expect(label).not.toHaveText('Whole song')
  const zoomed = await label.textContent()
  // A plain wheel pans: the zoom stays, a click now lands on another bar than at "Whole song".
  await page.mouse.wheel(0, 300)
  await expect(label).toHaveText(zoomed ?? '')
  expect(errors).toEqual([])
})

test.describe('1024×768 with the playfield panel open', () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test('without room between the columns the strip hides; the chevron opens the editor instead', async ({
    page,
  }) => {
    const errors = watchErrors(page)
    await openPlayer(page)
    await openStrip(page)
    const chevron = page.getByTestId('overview-toggle')
    await page.getByTestId('toggle-sidebar').click()
    await expect(page.getByTestId('overview-strip')).toHaveCount(0)
    await expect(chevron).toHaveAttribute('data-room', 'no')
    await expect(chevron).toHaveAttribute(
      'title',
      'Not enough room for the overview here · open the loop editor (E)',
    )
    await chevron.click()
    await expect(page.getByTestId('loop-editor')).toBeVisible()
    await page.getByTestId('editor-back').click()
    // V too.
    await page.getByTestId('stage').click()
    await page.keyboard.press('KeyV')
    await expect(page.getByTestId('loop-editor')).toBeVisible()
    await page.getByTestId('editor-back').click()
    // Room again: it's back by itself.
    await page.getByTestId('toggle-sidebar').click()
    await expect(page.getByTestId('overview-strip')).toBeVisible()
    await expect(chevron).toHaveAttribute('title', 'Close overview (V)')
    expect(errors).toEqual([])
  })
})

test('the bookmark lane is one Tab stop: arrows move between bookmarks, Enter loads', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await seedPractice(page, {
    bookmarks: [
      seedBookmark('a', 'Opening', { startBar: 1, endBar: 8 }),
      seedBookmark('p', 'Phrase', { startBar: 5, endBar: 12 }),
      seedBookmark('b', 'B section', { startBar: 17, endBar: 32 }),
    ],
  })
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await openStrip(page)
  const strip = page.getByTestId('overview-strip')
  const button = (name: string) =>
    strip.getByTestId('lane-item').filter({ hasText: name }).getByRole('button')
  await expect(strip.getByTestId('lane-item')).toHaveCount(3)
  // One Tab stop: the first bookmark.
  await expect(strip.locator('[data-testid="lane-item"] button[tabindex="0"]')).toHaveCount(1)
  await expect(button('Opening')).toHaveAttribute('tabindex', '0')
  await button('Opening').focus()
  await page.keyboard.press('ArrowRight')
  await expect(button('B section')).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(button('Opening')).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(button('Phrase')).toBeFocused()
  await expect(button('Phrase')).toHaveAttribute('tabindex', '0')
  await expect(button('Opening')).toHaveAttribute('tabindex', '-1')
  // The arrows stayed in the lane: the playhead didn't move.
  await expect(page.getByTestId('hud-bar')).toHaveText('1')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Phrase')
  expect(errors).toEqual([])
})

test('the Loop editor menu item opens the editor, from Welcome too', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  const item = page.getByTestId('menu-loop-editor')
  await expect(item).toContainText('Loop editor')
  await expect(item).toContainText('E')
  await item.click()
  await expect(page.getByTestId('loop-editor')).toBeVisible()
  await page.getByTestId('editor-back').click()
  await page.goto('./#/welcome')
  await expect(page.getByTestId('welcome')).toBeVisible()
  await item.click()
  await expect(page.getByTestId('loop-editor')).toBeVisible()
  expect(errors).toEqual([])
})
