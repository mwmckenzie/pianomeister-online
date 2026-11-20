import { test, expect, type Locator, type Page } from '@playwright/test'

import {
  readStore,
  seedBookmark,
  seedPractice,
  setLoopBars,
  SONG_IDS,
  watchErrors,
} from './support'

/**
 * Milestone 8: the loop editor (`#/editor`, brief decisions 106–107). At "Whole song" the
 * Minuet's 64 bars share the roll's width (44 px inset on the left, 16 on the right).
 */

const AUTO_17_32 = 'Bars 17–32 · 100% · both hands · no pre-roll'
const AUTO_17_36 = 'Bars 17–36 · 100% · both hands · no pre-roll'

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Not on screen')
  return box
}

async function rollBox(page: Page) {
  const box = await page.getByTestId('loop-editor').getByTestId('roll').boundingBox()
  if (box === null) throw new Error('No roll')
  return box
}

/** A point at `at` (0–1) through bar `bar`, in the notes. */
async function barPoint(page: Page, bar: number, at = 0.5): Promise<{ x: number; y: number }> {
  const box = await rollBox(page)
  return { x: box.x + 44 + ((bar - 1 + at) * (box.width - 60)) / 64, y: box.y + 140 }
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 6 })
  await page.mouse.up()
}

async function openEditor(page: Page, query = ''): Promise<void> {
  await page.goto(`./#/editor${query}`)
  await expect(page.getByTestId('loop-editor')).toBeVisible()
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
}

test('E opens the loop editor and playback keeps running; Space, E and ‹ Player work there', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  await page.getByTestId('play-pause').click()
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  await page.keyboard.press('KeyE')
  await expect(page.getByTestId('loop-editor')).toBeVisible()
  await expect(page).toHaveURL(/#\/editor$/)
  // Still playing: the bar moves on under the editor.
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  const bar = Number(await page.getByTestId('hud-bar').textContent())
  await expect
    .poll(async () => Number(await page.getByTestId('hud-bar').textContent()))
    .toBeGreaterThan(bar)
  // Space is the player's play/pause here too.
  await page.keyboard.press('Space')
  await expect(page.getByTestId('transport-state')).toHaveText('paused')
  await page.keyboard.press('KeyE')
  await expect(page.getByTestId('loop-editor')).toHaveCount(0)
  await expect(page.getByTestId('hud-title')).toBeVisible()

  // From the strip's Open editor, and back with ‹ Player.
  await page.getByTestId('overview-toggle').click()
  await page.getByTestId('overview-open-editor').click()
  await expect(page.getByTestId('loop-editor')).toBeVisible()
  await page.getByTestId('editor-back').click()
  await expect(page.getByTestId('loop-editor')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('drag a bookmark’s end: saved on release, the automatic name follows, Undo restores it', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await seedPractice(page, {
    bookmarks: [seedBookmark('b', AUTO_17_32, { startBar: 17, endBar: 32 }, { autoName: true })],
  })
  await openEditor(page, '?bookmark=b')
  await expect(page.getByTestId('editor-name')).toHaveText(AUTO_17_32)
  const lane = page.getByTestId('loop-editor').getByTestId('lane-item')
  await expect(lane).toHaveAttribute('data-range', '17-32')

  const grip = await boxOf(page.getByTestId('lane-grip-end'))
  const to = await barPoint(page, 36, 0.97)
  await drag(page, { x: grip.x + 2, y: grip.y + 7 }, { x: to.x, y: grip.y + 7 })
  await expect(lane).toHaveAttribute('data-range', '17-36')
  await expect(page.getByTestId('editor-name')).toHaveText(AUTO_17_36)
  await expect(page.getByTestId('editor-to')).toHaveValue('36')
  const [saved] = await readStore<{ name: string; config: { loop: object } }>(page, 'bookmarks')
  expect(saved).toMatchObject({ name: AUTO_17_36, config: { loop: { startBar: 17, endBar: 36 } } })

  const toast = page
    .getByTestId('toast')
    .filter({ hasText: `Bars of “${AUTO_17_32}” changed to 17–36` })
  await expect(toast).toBeVisible()
  await toast.getByTestId('toast-undo').click()
  await expect(lane).toHaveAttribute('data-range', '17-32')
  await expect(page.getByTestId('editor-name')).toHaveText(AUTO_17_32)

  // Its body drags too, keeping the length.
  const body = await boxOf(lane)
  const four = ((await rollBox(page)).width - 60) / 16
  await drag(
    page,
    { x: body.x + body.width / 2, y: body.y + 12 },
    { x: body.x + body.width / 2 + four, y: body.y + 12 },
  )
  await expect(lane).toHaveAttribute('data-range', '21-36')
  expect(errors).toEqual([])
})

test('From/To edit the range; "Same settings as"; the loaded bookmark’s loop follows with one jump', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await seedPractice(page, {
    bookmarks: [
      seedBookmark('b', 'B section', { startBar: 17, endBar: 32 }),
      seedBookmark('c', 'Longer B', { startBar: 17, endBar: 36 }),
    ],
    appState: [
      {
        key: 'lastOpened:default',
        value: JSON.stringify({ songId: SONG_IDS.minuet, bookmarkId: 'b' }),
      },
    ],
  })
  await openEditor(page, '?bookmark=b')
  await expect(page.getByTestId('hud-bookmark')).toHaveText('B section')
  await expect(page.getByTestId('loop-value')).toHaveText('bars 17–32')
  await expect(page.getByTestId('hud-bar')).toHaveText('17')
  const bar20 = await barPoint(page, 20)
  await page.mouse.click(bar20.x, bar20.y)
  await expect(page.getByTestId('hud-bar')).toHaveText('20')

  await page.getByTestId('editor-to').fill('36')
  await page.getByTestId('editor-to').press('Enter')
  await expect(page.getByTestId('editor-same')).toHaveText('Same settings as “Longer B”')
  await expect(page.getByTestId('loop-value')).toHaveText('bars 17–36')
  await expect(page.getByTestId('hud-bar')).toHaveText('17')
  // The From field pushes the end along (the loop rules).
  await page.getByTestId('editor-from').fill('40')
  await page.getByTestId('editor-from').press('Enter')
  await expect(page.getByTestId('editor-to')).toHaveValue('40')
  await expect(page.getByTestId('loop-editor').getByTestId('lane-item').first()).toHaveAttribute(
    'data-range',
    '40-40',
  )
  expect(errors).toEqual([])
})

test('presets zoom, the minimap window drags to pan, and Play from shows where play really starts', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await setLoopBars(page, 17, 32)
  await page.keyboard.press('Escape')
  await page.getByTestId('stage').click()
  await page.keyboard.press('KeyE')
  await expect(page.getByTestId('loop-editor')).toBeVisible()
  const zoom = page.getByTestId('editor-zoom')
  await expect(zoom.locator('[data-value="whole"]')).toHaveAttribute('data-state', 'on')

  // Play from: the loop's start; a selection inside it; outside it, still the loop's start.
  const playFrom = page.getByTestId('editor-play-from')
  await expect(playFrom).toHaveText('Play from bar 17')
  await drag(page, await barPoint(page, 20), await barPoint(page, 24))
  await expect(playFrom).toHaveText('Play from bar 20')
  await expect(page.getByTestId('editor-name')).toHaveText('Selection')
  await expect(page.getByTestId('editor-summary')).toHaveText('Bars 20–24 · 5 bars')
  await drag(page, await barPoint(page, 41), await barPoint(page, 48))
  await expect(playFrom).toHaveText('Play from bar 17')

  await zoom.locator('[data-value="16"]').click()
  await expect(zoom.locator('[data-value="16"]')).toHaveAttribute('data-state', 'on')
  const windowBox = page.getByTestId('minimap-window')
  const before = await boxOf(windowBox)
  const map = await boxOf(page.getByTestId('minimap'))
  // A quarter of the song is in view.
  expect(before.width).toBeCloseTo((map.width - 60) / 4, -1)
  await drag(
    page,
    { x: before.x + before.width / 2, y: before.y + 20 },
    { x: before.x + before.width / 2 + 150, y: before.y + 20 },
  )
  const after = await windowBox.boundingBox()
  expect(after?.x ?? 0).toBeGreaterThan(before.x + 100)
  await expect(zoom.locator('[data-value="16"]')).toHaveAttribute('data-state', 'on')
  expect(errors).toEqual([])
})

test('Open in editor from the bookmark manager loads its song first and selects it', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await seedPractice(page, {
    bookmarks: [
      {
        ...seedBookmark('k', 'Canon opening', { startBar: 1, endBar: 8 }),
        songId: SONG_IDS.canon,
      },
    ],
  })
  await page.goto('./#/bookmarks')
  await page.getByTestId('bookmark-row').filter({ hasText: 'Canon opening' }).click()
  await page.getByTestId('bookmark-open-editor').click()
  await expect(page.getByTestId('loop-editor')).toBeVisible()
  await expect(page).toHaveURL(/#\/editor\?bookmark=k$/)
  await expect(page.getByTestId('loop-editor').getByRole('heading', { level: 1 })).toContainText(
    'Canon in D',
  )
  await expect(page.getByTestId('editor-name')).toHaveText('Canon opening')
  await page.getByTestId('editor-back').click()
  // Its song is loaded, as Full song: nothing of the bookmark applied.
  await expect(page.getByTestId('hud-title')).toHaveText('Canon in D')
  await expect(page.getByTestId('hud-full-song')).toBeVisible()

  // Load in player loads the bookmark and goes back.
  await page.keyboard.press('KeyE')
  await page.getByTestId('loop-editor').getByTestId('lane-item').getByRole('button').click()
  await page.getByTestId('editor-load').click()
  await expect(page.getByTestId('loop-editor')).toHaveCount(0)
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Canon opening')
  expect(errors).toEqual([])
})

test('the hand toggles are remembered; the editor lanes are one Tab stop, Enter selects', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await seedPractice(page, {
    bookmarks: [
      seedBookmark('a', 'Opening', { startBar: 1, endBar: 8 }),
      seedBookmark('b', 'B section', { startBar: 17, endBar: 32 }),
    ],
  })
  await openEditor(page)
  await page.getByTestId('editor-left').uncheck()
  await page.reload()
  await expect(page.getByTestId('loop-editor')).toBeVisible()
  await expect(page.getByTestId('editor-left')).not.toBeChecked()
  await expect(page.getByTestId('editor-right')).toBeChecked()

  const button = (name: string) =>
    page
      .getByTestId('loop-editor')
      .getByTestId('lane-item')
      .filter({ hasText: name })
      .getByRole('button')
  await button('Opening').focus()
  await page.keyboard.press('ArrowRight')
  await expect(button('B section')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('editor-name')).toHaveText('B section')
  expect(errors).toEqual([])
})
