import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { seedBookmark, seedPractice, SONG_IDS, watchErrors } from './support'

/**
 * Brief decisions 90–92: list keys by role at the page level (↑/↓ the main list, Shift+↑/↓ the
 * side list, Enter the main action), Next / Previous tab, and loop nudges.
 */

async function openPlayer(page: Page): Promise<void> {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
}

/** Two songs with bookmarks: Minuet (Opening, Middle) and Canon (Canon start). */
async function seedTwoSongs(page: Page): Promise<void> {
  await seedPractice(page, {
    bookmarks: [
      seedBookmark('a', 'Opening', { startBar: 1, endBar: 4 }),
      seedBookmark('b', 'Middle', { startBar: 17, endBar: 32 }),
      { ...seedBookmark('c', 'Canon start', { startBar: 1, endBar: 2 }), songId: SONG_IDS.canon },
    ],
  })
}

const selectedSong = (page: Page) => page.locator('[data-testid="song-row"][aria-selected="true"]')

test('library: ↑/↓, Shift+↑/↓ and Enter work with no list focused; [ ] switch tabs', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await page.goto('./#/library')
  await expect(selectedSong(page)).toContainText('Canon in D')
  // Focus on the page itself, not a list.
  await page.getByTestId('storage-status').click()
  await page.keyboard.press('ArrowDown')
  await expect(selectedSong(page)).toContainText('Invention')
  await page.keyboard.press('ArrowUp')
  await expect(selectedSong(page)).toContainText('Canon in D')

  // The side list: All songs, the sources, then the tags. Each applies at once.
  const pressed = (id: string) =>
    expect(page.getByTestId(id)).toHaveAttribute('aria-pressed', 'true')
  await pressed('source-all')
  await page.keyboard.press('Shift+ArrowDown')
  await pressed('source-bundled')
  await expect(page.getByTestId('source-bundled')).toHaveAttribute('data-filter-cursor', 'true')
  await page.keyboard.press('Shift+ArrowDown')
  await pressed('source-uploaded')
  await expect(page.getByTestId('song-row')).toHaveCount(0)
  // A tag becomes the only tag; the source is kept.
  await page.keyboard.press('Shift+ArrowDown')
  await pressed('tag-filter-baroque')
  await pressed('source-uploaded')
  await expect(page.getByTestId('library-empty')).toHaveText(
    'No songs match these filters · Shift+↑ to All songs',
  )
  // Back to All songs: no source and no tag filter.
  await page.keyboard.press('Shift+ArrowUp')
  await page.keyboard.press('Shift+ArrowUp')
  await page.keyboard.press('Shift+ArrowUp')
  await pressed('source-all')
  await expect(page.getByTestId('tag-filter-baroque')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('song-row')).toHaveCount(3)

  // Typing in the search field triggers nothing: "]" is text there…
  await page.getByTestId('search').fill('')
  await page.getByTestId('search').press(']')
  await expect(page.getByTestId('search')).toHaveValue(']')
  await expect(page).toHaveURL(/#\/library/)
  // …but ↓ from the search field still moves the list.
  await page.getByTestId('search').fill('')
  await page.getByTestId('search').press('ArrowDown')
  await expect(selectedSong(page)).toContainText('Invention')

  // ] goes to Bookmarks, [ back (two tabs: either way is the other one).
  await page.getByTestId('storage-status').click()
  await page.keyboard.press(']')
  await expect(page.getByTestId('bookmark-manager')).toBeVisible()
  await page.keyboard.press('[')
  await expect(page).toHaveURL(/#\/library/)

  // Enter plays the selection.
  await page.getByTestId('storage-status').click()
  await page.keyboard.press('ArrowDown')
  await expect(selectedSong(page)).toContainText('Invention')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('hud-title')).toContainText('Invention')
  expect(errors).toEqual([])
})

test('bookmark manager: ↑/↓ bookmarks, Shift+↑/↓ the song filter, Enter loads; sliders keep their arrows', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await seedTwoSongs(page)
  await page.goto('./#/bookmarks')
  const name = page.getByTestId('bookmark-name')
  // Library order: Minuet (Opening, Middle), then Canon.
  await expect(name).toHaveValue('Opening')
  await page.getByTestId('bookmark-group').first().click()
  await page.keyboard.press('ArrowDown')
  await expect(name).toHaveValue('Middle')
  await page.keyboard.press('ArrowDown')
  await expect(name).toHaveValue('Canon start')
  await page.keyboard.press('ArrowUp')
  await expect(name).toHaveValue('Middle')

  // A focused slider keeps ↑/↓: the tempo moves, the selection doesn't.
  const tempo = page.getByTestId('bookmark-tempo').getByRole('slider')
  const before = await tempo.getAttribute('aria-valuenow')
  await tempo.focus()
  await tempo.press('ArrowDown')
  await expect(tempo).not.toHaveAttribute('aria-valuenow', before ?? '')
  await expect(name).toHaveValue('Middle')

  // The song filter: All bookmarks, then each song; it applies at once.
  await page.getByTestId('bookmark-group').first().click()
  await page.keyboard.press('Shift+ArrowDown')
  await expect(page.getByTestId('filter-song').first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('bookmark-group')).toHaveCount(1)
  await page.keyboard.press('Shift+ArrowUp')
  await expect(page.getByTestId('filter-all')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('bookmark-group')).toHaveCount(2)

  // Typing in search triggers nothing.
  await page.getByTestId('bookmark-search').press('[')
  await expect(page.getByTestId('bookmark-search')).toHaveValue('[')
  await expect(page.getByTestId('bookmark-manager')).toBeVisible()
  await page.getByTestId('bookmark-search').fill('')

  // Picking Minuet selected its first bookmark; Enter loads the selection in the player.
  await expect(name).toHaveValue('Opening')
  await page.getByTestId('bookmark-group').first().click()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Opening')
  expect(errors).toEqual([])
})

test('picker: ↑/↓ the songs and Shift+↑/↓ the Load list from anywhere; Enter loads', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await seedTwoSongs(page)
  await page.getByTestId('open-picker').click()
  const search = page.getByTestId('picker-search')
  await expect(search).toBeFocused()
  const song = page.locator('[data-testid="picker-song"][aria-selected="true"]')
  // A–Z: Canon, Invention, Minuet; Minuet (the one with bookmarks) selected.
  await page.getByTestId('picker-sort-title').click()
  await page.getByTestId('picker-song').filter({ hasText: 'Minuet' }).click()
  await expect(song).toContainText('Minuet')
  await search.focus()
  // From the search field: Shift+↓ moves the Load list (it doesn't select text).
  await search.press('Shift+ArrowDown')
  await expect(page.getByTestId('picker-entry-name')).toHaveText('Opening')
  // Focus on the dialog body: ↓ moves the songs (Full song selected again for the new song).
  await page.getByRole('banner').getByRole('heading', { name: 'What to practice' }).click()
  await page.keyboard.press('ArrowUp')
  await expect(song).toContainText('Invention')
  await page.keyboard.press('ArrowDown')
  await expect(song).toContainText('Minuet')
  await expect(page.getByTestId('picker-entry-name')).toHaveText('Full song')
  // Even with the Load list focused, ↓ is the songs' and Shift+↓ the Load list's.
  await page.keyboard.press(']')
  await expect(page.getByRole('listbox', { name: 'What to load' })).toBeFocused()
  await page.keyboard.press('Shift+ArrowDown')
  await page.keyboard.press('Shift+ArrowDown')
  await expect(page.getByTestId('picker-entry-name')).toHaveText('Middle')
  await page.keyboard.press('[')
  await expect(page.getByRole('listbox', { name: 'Songs' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Middle')
  expect(errors).toEqual([])
})

test('settings: ] and [ step through the tabs and wrap', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await page.getByTestId('menu-settings').click()
  const selected = (id: string) =>
    expect(page.getByTestId(`tab-${id}`)).toHaveAttribute('aria-selected', 'true')
  await selected('practice')
  await page.keyboard.press(']')
  await selected('audio')
  await page.keyboard.press('[')
  await selected('practice')
  // Wraps: before the first is the last.
  await page.keyboard.press('[')
  await selected('about')
  await page.keyboard.press(']')
  await selected('practice')
  expect(errors).toEqual([])
})

/** Loop bars 40–44 on, the playhead parked at its start. */
async function loop40Parked(page: Page): Promise<void> {
  await page.getByTestId('open-loop').click()
  await page.getByTestId('loop-from').fill('40')
  await page.getByTestId('loop-from').press('Enter')
  await page.getByTestId('loop-to').fill('44')
  await page.getByTestId('loop-to').press('Enter')
  await page.getByTestId('loop-set').click()
  await expect(page.getByTestId('loop-value')).toHaveText('bars 40–44')
  await page.keyboard.press('Escape')
  const timeline = page.getByTestId('timeline')
  await timeline.focus()
  // Home lands on the loop start while the loop is on (decision 8).
  await timeline.press('Home')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('40:1')
}

test('four quick loop nudges show at once and apply as one jump', async ({ page }) => {
  const errors = watchErrors(page)
  // The 400 ms settle passes only when the test says so.
  await page.clock.install()
  await openPlayer(page)
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  await loop40Parked(page)
  await page.getByTestId('open-loop').click()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  const steps = ['loop-from-up', 'loop-to-up', 'loop-from-up', 'loop-to-up']
  for (const id of steps) {
    await page.getByTestId(id).click()
    // Each nudge restarts the wait, so 4 × 300 ms never applies.
    await page.clock.runFor(300)
  }
  // Shown at once: the HUD label and the fields…
  await expect(page.getByTestId('loop-value')).toHaveText('bars 42–46')
  await expect(page.getByTestId('loop-from')).toHaveValue('42')
  await expect(page.getByTestId('loop-to')).toHaveValue('46')
  // …but no jump yet.
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('40:1')
  await page.clock.runFor(150)
  await page.clock.runFor(50)
  // One jump, to the final start.
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('42:1')
  expect(errors).toEqual([])
})

test('a loop nudge key with the loop off turns it on from the last range', async ({ page }) => {
  const errors = watchErrors(page)
  // The 400 ms settle passes only when the test says so.
  await page.clock.install()
  await openPlayer(page)
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  // Give "Loop end +1 bar" a key.
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-shortcuts').click()
  const row = page.getByTestId('shortcut-loopEndLater')
  await expect(row.getByTestId('shortcut-none')).toBeVisible()
  await row.getByTestId('shortcut-add').click()
  await page.keyboard.press('j')
  await expect(row.getByTestId('shortcut-key')).toHaveText(['J'])
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('settings-window')).toBeHidden()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))

  const toggle = page.getByTestId('toggle-loop')
  const applied = page.getByTestId('timeline-loop')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('j')
  // Shown at once (from the last range, bars 1–4)…
  await expect(page.getByTestId('loop-value')).toHaveText('bars 1–5')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  // …and applied once nudging pauses: the timeline shows the loop then.
  await expect(applied).toBeHidden()
  await page.clock.runFor(450)
  await expect(page.getByTestId('timeline-loop-end')).toHaveText('5')

  // Off, then on again: the nudged range is the one the loop button turns on.
  await toggle.click()
  await expect(page.getByTestId('loop-value')).toBeHidden()
  await toggle.click()
  await expect(page.getByTestId('loop-value')).toHaveText('bars 1–5')

  // The button while a nudge is still waiting: it reads on, so a click turns the loop off, and
  // the waiting nudge doesn't apply later; its range is the one the button turns on next.
  await toggle.click()
  await expect(applied).toBeHidden()
  await page.keyboard.press('j')
  await expect(page.getByTestId('loop-value')).toHaveText('bars 1–6')
  await toggle.click()
  await expect(page.getByTestId('loop-value')).toBeHidden()
  await page.clock.runFor(450)
  await expect(page.getByTestId('loop-value')).toBeHidden()
  await expect(applied).toBeHidden()
  await toggle.click()
  await expect(page.getByTestId('loop-value')).toHaveText('bars 1–6')
  await expect(page.getByTestId('timeline-loop-end')).toHaveText('6')
  expect(errors).toEqual([])
})
