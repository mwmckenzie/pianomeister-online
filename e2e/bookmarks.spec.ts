import { test, expect, type Page } from '@playwright/test'

import {
  nudge,
  readStore,
  saveAsBookmark,
  seedBookmark,
  seedPractice,
  segment,
  setLoopBars,
  setting,
  watchErrors,
} from './support'

interface StoredRecord {
  readonly bookmarkId: string | null
  readonly plays: number
  readonly playedMs: number
}

interface StoredBookmark {
  readonly id: string
  readonly name: string
  readonly autoName: boolean
  readonly config: { readonly tempoPercent: number; readonly handAudio: object; loop: object }
}

const B_SECTION = 'Bars 17–32 · 85% · both hands · no pre-roll'

async function openPlayer(page: Page): Promise<void> {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
}

async function setTempo(page: Page, steps: number): Promise<void> {
  await page.getByTestId('open-tempo').click()
  const slider = page.getByTestId('tempo-slider').getByRole('slider')
  await slider.focus()
  for (let i = 0; i < Math.abs(steps); i++)
    await slider.press(steps < 0 ? 'ArrowLeft' : 'ArrowRight')
  await page.keyboard.press('Escape')
}

/** Bars 17–32 at 85%, saved with B (auto-named). */
async function saveBSection(page: Page): Promise<void> {
  await setTempo(page, -3)
  await setLoopBars(page, 17, 32)
  await page.keyboard.press('Escape')
  await page.keyboard.press('b')
  await expect(page.getByTestId('hud-bookmark')).toHaveText(B_SECTION)
}

/** Two seeded Minuet bookmarks with custom names, then the manager. */
async function openManagerWithTwo(page: Page): Promise<void> {
  await openPlayer(page)
  await seedPractice(page, {
    bookmarks: [
      seedBookmark('opening', 'Opening', { startBar: 1, endBar: 4 }),
      seedBookmark('ending', 'Ending', { startBar: 61, endBar: 64 }),
    ],
  })
  await page.goto('./#/bookmarks')
  await expect(page.getByTestId('bookmark-row')).toHaveCount(2)
}

const row = (page: Page, name: string) => page.getByTestId('bookmark-row').filter({ hasText: name })

test('B saves what is playing in one click, auto-named; the HUD names it on its own line', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  // Full song: dimmed, on the line under the composer.
  await expect(page.getByTestId('hud-composer')).toHaveText('Christian Petzold (attrib. J.S. Bach)')
  await expect(page.getByTestId('hud-full-song')).toHaveText('Full song')
  await expect(page.getByTestId('save-bookmark-icon')).toHaveAttribute(
    'aria-label',
    'Save as bookmark (B)',
  )

  await saveBSection(page)
  await expect(page.getByTestId('toast').filter({ hasText: `Saved “${B_SECTION}”` })).toBeVisible()
  // The bookmark line is in the secondary colour (Glacier #7EE0C3), Full song wasn't.
  await expect(page.getByTestId('hud-entry')).toHaveCSS('color', 'rgb(126, 224, 195)')
  await expect(page.getByTestId('hud-composer')).toHaveText('Christian Petzold (attrib. J.S. Bach)')
  await expect(page.getByTestId('hud-full-song')).toBeHidden()
  await expect(page.getByTestId('hud-entry')).toHaveAttribute('data-kind', 'bookmark')
  await expect(page.getByTestId('hud-entry-icon')).toBeVisible()
  const [saved] = await readStore<StoredBookmark>(page, 'bookmarks')
  expect(saved).toMatchObject({ name: B_SECTION, autoName: true })

  // Load Full song: the whole song at 100%, no loop.
  await page.getByTestId('open-picker').click()
  const bookmarkRow = page.getByTestId('picker-bookmark')
  await expect(bookmarkRow).toHaveCount(1)
  await expect(bookmarkRow).toContainText(B_SECTION)
  await page.getByTestId('picker-full-song').click()
  await expect(page.getByTestId('picker-load')).toHaveText('Load full song')
  await page.getByTestId('picker-load').click()
  await expect(page.getByTestId('hud-full-song')).toBeVisible()
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('100%')
  await expect(page.getByTestId('loop-value')).toBeHidden()

  // Load the bookmark: its loop and tempo apply. Its name is its summary, so no summary line.
  await page.getByTestId('open-picker').click()
  await page.getByTestId('picker-bookmark').click()
  await expect(page.getByTestId('picker-entry-name')).toHaveText(B_SECTION)
  await expect(page.getByTestId('picker-entry-summary')).toBeHidden()
  await page.getByTestId('picker-load').click()
  await expect(page.getByTestId('hud-bookmark')).toHaveText(B_SECTION)
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('85%')
  await expect(page.getByTestId('loop-value')).toHaveText('bars 17–32')

  // The manager lists it under its song, without a summary line while auto-named.
  await page.getByTestId('menu-library').click()
  await page.getByTestId('tab-bookmarks').click()
  await expect(page.getByTestId('bookmark-group')).toHaveText(/Minuet in G · 64 bars/i)
  await expect(page.getByTestId('bookmark-row-name')).toHaveText(B_SECTION)
  await expect(page.getByTestId('bookmark-row-summary')).toBeHidden()
  await expect(page.getByTestId('bookmark-name-reset')).toHaveAttribute('data-changed', 'false')

  // A typed name is custom: the summary shows under it, and the reset brings the auto name back.
  await page.getByTestId('bookmark-name').fill('B section')
  await expect(page.getByTestId('bookmark-row-name')).toHaveText('B section')
  await expect(page.getByTestId('bookmark-row-summary')).toHaveText('Bars 17–32 · 85%')
  await page.getByTestId('bookmark-tempo').getByRole('slider').press('ArrowRight')
  await expect(page.getByTestId('bookmark-row-name')).toHaveText('B section')
  await page.getByTestId('bookmark-name-reset').click()
  await expect(page.getByTestId('bookmark-name')).toHaveValue(
    'Bars 17–32 · 90% · both hands · no pre-roll',
  )
  await expect(page.getByTestId('bookmark-row-summary')).toBeHidden()
  // An auto name follows the settings.
  await page.getByTestId('bookmark-left').getByText('Solo', { exact: true }).click()
  await expect(page.getByTestId('bookmark-row-name')).toHaveText(
    'Bars 17–32 · 90% · left only · no pre-roll',
  )

  // The library row's subtitle is its bookmark count.
  await page.getByTestId('tab-library').click()
  await expect(page.getByTestId('song-row').filter({ hasText: 'Minuet in G' })).toContainText(
    '1 bookmark',
  )
  expect(errors).toEqual([])
})

test('the save toast: Rename opens the manager on the name, Undo removes the bookmark', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await setLoopBars(page, 5, 8)
  // The loop popover's button is the same one-click save.
  await expect(page.getByTestId('save-bookmark')).toHaveText('Save as bookmark')
  const name = await saveAsBookmark(page)
  expect(name).toBe('Bars 5–8 · 100% · both hands · no pre-roll')
  // (Esc would close the toast along with the popover.)
  await page.getByTestId('toast-rename').click()
  await expect(page.getByTestId('bookmark-manager')).toBeVisible()
  await expect(page.getByTestId('bookmark-name')).toBeFocused()
  await expect(page.getByTestId('bookmark-name')).toHaveValue(name)
  await page.keyboard.type('Bridge')
  await expect(page.getByTestId('bookmark-row-name')).toHaveText('Bridge')

  // Undo: the new bookmark goes, and the player is back to what it had: Bridge loaded, with the
  // temporary loop change, so the line shows that setup.
  await page.getByTestId('back-to-player').click()
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Bridge')
  await setLoopBars(page, 9, 12)
  await page.keyboard.press('Escape')
  await page.getByTestId('save-bookmark-icon').click()
  await expect(page.getByTestId('hud-bookmark')).toHaveText(
    'Bars 9–12 · 100% · both hands · no pre-roll',
  )
  await page.getByTestId('toast-undo').click()
  await expect(page.getByTestId('hud-custom')).toHaveText(
    'Bars 9–12 · 100% · both hands · no pre-roll',
  )
  await expect(page.getByTestId('loop-value')).toHaveText('bars 9–12')
  await page.getByTestId('open-loop').click()
  await expect(page.getByTestId('back-to-name')).toHaveText('Bridge')
  await expect.poll(async () => (await readStore(page, 'bookmarks')).length).toBe(1)
  expect(errors).toEqual([])
})

test('saving the same settings again creates nothing: it loads the existing bookmark', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await saveBSection(page)
  // Back to Full song, then the same loop and tempo again.
  await page.getByTestId('open-picker').click()
  await page.getByTestId('picker-full-song').click()
  await page.getByTestId('picker-load').click()
  await expect(page.getByTestId('hud-full-song')).toBeVisible()
  await setTempo(page, -3)
  await setLoopBars(page, 17, 32)
  await page.keyboard.press('Escape')

  await page.keyboard.press('b')
  const toast = page
    .getByTestId('toast')
    .filter({ hasText: `Already saved as “${B_SECTION}” · no new bookmark created` })
  await expect(toast).toBeVisible()
  await expect(page.getByTestId('hud-bookmark')).toHaveText(B_SECTION)
  expect(await readStore(page, 'bookmarks')).toHaveLength(1)

  await toast.getByTestId('toast-show').click()
  await expect(page.getByTestId('bookmark-manager')).toBeVisible()
  await expect(page.getByTestId('bookmark-row')).toHaveCount(1)
  await expect(page.getByTestId('bookmark-name')).toHaveValue(B_SECTION)
  expect(errors).toEqual([])
})

test('player changes to a loaded bookmark: the line shows the setup, Back to, and no writes', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await saveBSection(page)
  const settingsBefore = await page.evaluate(() => localStorage.getItem('pianomeister.settings'))

  // A tempo change: the line shows the setup itself, plain, with no icon, and a hint.
  await setTempo(page, -2)
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('75%')
  const custom = page.getByTestId('hud-custom')
  await expect(custom).toHaveText('Bars 17–32 · 75% · both hands · no pre-roll')
  await expect(page.getByTestId('hud-entry-icon')).toBeHidden()
  await expect(page.getByTestId('hud-entry')).toHaveAttribute(
    'title',
    'Bars 17–32 · 75% · both hands · no pre-roll\nDoesn’t match a bookmark · press B to save it',
  )
  // No notes any more; the tempo reset still goes to the bookmark's 85%.
  await page.getByTestId('open-tempo').click()
  await expect(page.getByTestId('tempo-reset')).toHaveText('Reset to 85%')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('temporary-note')).toHaveCount(0)
  await expect(page.getByTestId('hud-modified')).toHaveCount(0)

  // Changed back: the bookmark again, with its icon.
  await setTempo(page, 2)
  await expect(page.getByTestId('hud-bookmark')).toHaveText(B_SECTION)
  await expect(page.getByTestId('hud-entry-icon')).toBeVisible()

  // A hand mode in the Audio tab is temporary too (still resets to the bookmark's value).
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-audio').click()
  await segment(page, 'audio.leftAudio', 'Mute')
  await expect(setting(page, 'audio.leftAudio')).toHaveAttribute('data-changed', 'true')
  await expect(page.getByTestId('settings-window').getByTestId('temporary-note')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(custom).toHaveText('Bars 17–32 · 85% · left muted · no pre-roll')

  // Neither the settings nor the bookmark were written.
  expect(await page.evaluate(() => localStorage.getItem('pianomeister.settings'))).toBe(
    settingsBefore,
  )
  const [saved] = await readStore<StoredBookmark>(page, 'bookmarks')
  expect(saved?.config.tempoPercent).toBe(85)
  expect(saved?.config.handAudio).toEqual({ right: 'on', left: 'on' })

  // "Back to <name>" drops them all, and is gone once the setup matches.
  await page.getByTestId('open-loop').click()
  await expect(page.getByTestId('back-to-name')).toHaveText(B_SECTION)
  await page.getByTestId('back-to-loaded').click()
  await expect(page.getByTestId('hud-bookmark')).toHaveText(B_SECTION)
  await expect(page.getByTestId('back-to-loaded')).toBeHidden()
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('a play is a start: the first Play and each loop wrap count, for the matching bookmark', async ({
  page,
}) => {
  // Loading the samples (up to 30 s on a busy machine) plus a few real loop wraps.
  test.setTimeout(60_000)
  const errors = watchErrors(page)
  await openPlayer(page)
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  await setTempo(page, 20)
  await setLoopBars(page, 1, 1)
  await saveAsBookmark(page)
  await page.keyboard.press('Escape')

  await page.getByTestId('play-pause').click()
  const plays = async () =>
    (await readStore<StoredRecord>(page, 'playRecords')).reduce((n, r) => n + r.plays, 0)
  // The start, then three wraps (one play each).
  await expect.poll(plays, { timeout: 20_000 }).toBeGreaterThanOrEqual(4)
  await page.getByTestId('play-pause').click()
  await expect(page.getByTestId('transport-state')).toHaveText('paused')

  const records = await readStore<StoredRecord>(page, 'playRecords')
  const total = records.reduce((n, r) => n + r.plays, 0)
  expect(total).toBeGreaterThanOrEqual(4)
  const [bookmark] = await readStore<StoredBookmark>(page, 'bookmarks')
  expect(records.every((r) => r.bookmarkId === bookmark?.id)).toBe(true)

  await page.getByTestId('open-picker').click()
  const minuet = page.getByTestId('picker-song').filter({ hasText: 'Minuet in G' })
  await expect(minuet.getByTestId('picker-song-plays')).toHaveText(String(total))
  await expect(minuet.getByTestId('picker-song-time')).not.toHaveText('—')
  await expect(minuet.getByTestId('picker-song-lastcell')).toHaveText('Today')
  await expect(page.getByTestId('picker-song-played')).toHaveText(`${total}×`)
  // Full song is selected by default: none of this practice is its.
  await expect(page.getByTestId('picker-entry-name')).toHaveText('Full song')
  await expect(page.getByTestId('picker-entry-played')).toHaveText('—')
  await expect(page.getByTestId('picker-entry-share')).toHaveText('0%')
  await page.getByTestId('picker-bookmark').click()
  await expect(page.getByTestId('picker-entry-played')).toHaveText(`${total}×`)
  await expect(page.getByTestId('picker-entry-share')).toHaveText('100%')
  await expect(page.getByTestId('picker-other-setups')).toBeHidden()
  expect(errors).toEqual([])
})

test('the manager edits a bookmark (range, hands) that then loads that way; delete can be undone', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await page.keyboard.press('b')
  await expect(page.getByTestId('hud-bookmark')).toHaveText(
    'Bars 1–64 · 100% · both hands · no pre-roll',
  )
  await page.getByTestId('menu-library').click()
  await page.getByTestId('tab-bookmarks').click()

  await page.getByTestId('bookmark-name').fill('Left hand alone')
  await page.getByTestId('bookmark-from').fill('5')
  await page.getByTestId('bookmark-from').press('Enter')
  await page.getByTestId('bookmark-to').fill('8')
  await page.getByTestId('bookmark-to').press('Enter')
  await page.getByTestId('bookmark-right').getByText('Mute', { exact: true }).click()
  await expect(page.getByTestId('bookmark-row-summary')).toHaveText('Bars 5–8 · 100% · right muted')
  await expect(page.getByTestId('bookmark-right-reset')).toHaveAttribute('data-changed', 'true')
  await expect(page.getByTestId('bookmark-row-name')).toHaveText('Left hand alone')

  // Saved: once the last write has landed, a reload shows the edits.
  await expect
    .poll(async () => (await readStore<StoredBookmark>(page, 'bookmarks'))[0]?.config.handAudio)
    .toEqual({ right: 'muted', left: 'on' })
  await page.reload()
  await page.getByTestId('bookmark-row').click()
  await expect(page.getByTestId('bookmark-name')).toHaveValue('Left hand alone')
  await expect(page.getByTestId('bookmark-range')).toHaveText('5–8')

  await page.getByTestId('bookmark-load').click()
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Left hand alone')
  await expect(page.getByTestId('loop-value')).toHaveText('bars 5–8')
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-audio').click()
  await expect(
    page.getByTestId('setting-audio-rightAudio-control').getByText('Mute', { exact: true }),
  ).toHaveAttribute('data-state', 'on')
  await page.keyboard.press('Escape')

  // Delete shows an Undo toast instead of a confirm.
  await page.getByTestId('menu-library').click()
  await page.getByTestId('tab-bookmarks').click()
  await page.getByTestId('bookmark-row').click()
  await page.getByTestId('bookmark-delete').click()
  await expect(page.getByTestId('bookmark-row')).toHaveCount(0)
  await page.getByTestId('toast-undo').click()
  await expect(page.getByTestId('bookmark-row')).toHaveCount(1)
  await expect(page.getByTestId('bookmark-row')).toContainText('Left hand alone')
  expect(errors).toEqual([])
})

test('the manager lists only real bookmarks: no Full song, no New bookmark', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/bookmarks')
  await expect(page.getByTestId('bookmarks-empty')).toHaveText(
    'No bookmarks yet. In the player, set up the loop, tempo and hands you want and press or B.',
  )
  await expect(
    page.getByTestId('bookmarks-empty').getByRole('img', { name: 'Save as bookmark' }),
  ).toBeVisible()
  await expect(page.getByTestId('new-bookmark')).toHaveCount(0)
  await expect(page.getByTestId('bookmark-panel')).toBeHidden()

  await openManagerWithTwo(page)
  await expect(page.getByTestId('bookmark-row-full')).toHaveCount(0)
  await expect(page.getByText('Full song')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Duplicate makes a draft; leaving it unchanged asks, and Discard drops it', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openManagerWithTwo(page)
  await row(page, 'Opening').click()
  await page.getByTestId('bookmark-duplicate').click()

  // A draft, selected and focused, only in memory.
  await expect(page.getByTestId('bookmark-row')).toHaveCount(3)
  const draft = page.locator('[data-testid="bookmark-row"][data-draft="true"]')
  await expect(draft).toContainText('Unsaved duplicate')
  await expect(draft).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('bookmark-duplicate-note')).toHaveText(
    'Duplicate of “Opening” · change something to keep it',
  )
  await expect(page.getByTestId('bookmark-name')).toBeFocused()
  await expect(page.getByTestId('bookmark-name')).toHaveValue(
    'Bars 1–4 · 100% · both hands · no pre-roll',
  )
  await expect(page.getByTestId('bookmark-duplicate')).toBeDisabled()
  expect(await readStore(page, 'bookmarks')).toHaveLength(2)

  // Selecting another bookmark asks; Discard drops the draft and goes on.
  await row(page, 'Ending').click()
  const dialog = page.getByTestId('discard-duplicate')
  await expect(dialog.getByRole('heading')).toHaveText('Discard this duplicate?')
  await expect(page.getByTestId('discard-duplicate-text')).toHaveText(
    'It has the same settings as “Opening”, so it won’t be kept unless you change something.',
  )
  await expect(page.getByTestId('discard-duplicate-keep')).toBeFocused()
  await page.getByTestId('discard-duplicate-confirm').click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('bookmark-row')).toHaveCount(2)
  await expect(page.getByTestId('bookmark-name')).toHaveValue('Ending')

  // Load in player from a draft: discarding it loads the bookmark it copies.
  await row(page, 'Opening').click()
  await page.getByTestId('bookmark-duplicate').click()
  await page.getByTestId('bookmark-load').click()
  await page.getByTestId('discard-duplicate-confirm').click()
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Opening')
  expect(await readStore(page, 'bookmarks')).toHaveLength(2)
  expect(errors).toEqual([])
})

test('a draft is saved as soon as an edit makes it different', async ({ page }) => {
  const errors = watchErrors(page)
  await openManagerWithTwo(page)
  await row(page, 'Opening').click()
  await page.getByTestId('bookmark-duplicate').click()
  await page.getByTestId('bookmark-tempo').getByRole('slider').press('ArrowRight')

  await expect(page.getByTestId('bookmark-duplicate-note')).toBeHidden()
  await expect(page.getByTestId('bookmark-name')).toHaveValue(
    'Bars 1–4 · 105% · both hands · no pre-roll',
  )
  await expect.poll(async () => (await readStore(page, 'bookmarks')).length).toBe(3)
  // Kept: leaving doesn't ask.
  await row(page, 'Ending').click()
  await expect(page.getByTestId('discard-duplicate')).toBeHidden()
  await expect(page.getByTestId('bookmark-row')).toHaveCount(3)
  await expect(page.locator('[data-draft="true"]')).toHaveCount(0)

  // An edit that makes a bookmark the same as another says so (and is still saved).
  await page.getByTestId('bookmark-from').fill('1')
  await page.getByTestId('bookmark-from').press('Enter')
  await page.getByTestId('bookmark-to').fill('4')
  await page.getByTestId('bookmark-to').press('Enter')
  await expect(page.getByTestId('bookmark-same-note')).toHaveText('Same settings as “Opening”')
  await expect
    .poll(async () => {
      const stored = await readStore<StoredBookmark>(page, 'bookmarks')
      return stored.find((b) => b.id === 'ending')?.config.loop
    })
    .toEqual({ startBar: 1, endBar: 4 })
  expect(errors).toEqual([])
})

test('Keep editing stays on the draft; leaving the page asks too', async ({ page }) => {
  const errors = watchErrors(page)
  await openManagerWithTwo(page)
  await row(page, 'Ending').click()
  await page.getByTestId('bookmark-duplicate').click()

  // The Library tab: asks, and Keep editing stays here with the draft.
  await page.getByTestId('tab-library').click()
  await expect(page.getByTestId('discard-duplicate-text')).toHaveText(
    'It has the same settings as “Ending”, so it won’t be kept unless you change something.',
  )
  await page.getByTestId('discard-duplicate-keep').click()
  await expect(page.getByTestId('bookmark-manager')).toBeVisible()
  await expect(page.locator('[data-draft="true"]')).toHaveAttribute('aria-pressed', 'true')

  // A song filter asks too; Esc keeps editing.
  await page.getByTestId('filter-song').click()
  await expect(page.getByTestId('discard-duplicate')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-draft="true"]')).toHaveCount(1)

  // Back to the player: Discard goes on.
  await page.getByTestId('back-to-player').click()
  await page.getByTestId('discard-duplicate-confirm').click()
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  // A reload drops a draft without asking.
  await page.goto('./#/bookmarks')
  await row(page, 'Ending').click()
  await page.getByTestId('bookmark-duplicate').click()
  await page.reload()
  await expect(page.getByTestId('bookmark-row')).toHaveCount(2)
  expect(await readStore(page, 'bookmarks')).toHaveLength(2)
  expect(errors).toEqual([])
})

test('the metronome is part of a bookmark: temporary in the player, a row in the manager', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await saveBSection(page)
  // M with a bookmark loaded: a temporary change (the line shows the setup); the setting stays off.
  await page.keyboard.press('m')
  await expect(page.getByTestId('toggle-metronome')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('hud-custom')).toHaveText(
    'Bars 17–32 · 85% · both hands · no pre-roll · metronome',
  )
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-audio').click()
  await expect(setting(page, 'audio.metronomeMode')).toHaveAttribute('data-changed', 'true')
  await page.keyboard.press('Escape')
  const stored = JSON.parse(
    (await page.evaluate(() => localStorage.getItem('pianomeister.settings'))) ?? '{}',
  ) as { settings?: { audio?: { metronomeMode?: string } } }
  expect(stored.settings?.audio?.metronomeMode ?? 'off').toBe('off')
  await page.getByTestId('open-loop').click()
  await page.getByTestId('back-to-loaded').click()
  await expect(page.getByTestId('toggle-metronome')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('hud-bookmark')).toHaveText(B_SECTION)
  await page.keyboard.press('Escape')

  // In the manager: a Metronome row; the auto name follows it, and it counts as a setting.
  await page.getByTestId('menu-library').click()
  await page.getByTestId('tab-bookmarks').click()
  await page.getByTestId('bookmark-metronome').getByText('Pre-roll', { exact: true }).click()
  await expect(page.getByTestId('bookmark-name')).toHaveValue(
    'Bars 17–32 · 85% · both hands · no pre-roll · metronome in pre-roll',
  )
  await expect(page.getByTestId('bookmark-metronome-reset')).toHaveAttribute('data-changed', 'true')
  await page.getByTestId('bookmark-load').click()
  await expect(page.getByTestId('metronome-value')).toHaveText('pre-roll')
  await expect(page.getByTestId('hud-bookmark')).toHaveText(
    'Bars 17–32 · 85% · both hands · no pre-roll · metronome in pre-roll',
  )
  expect(errors).toEqual([])
})

test('the Practice tab stays global with a bookmark loaded, and says so', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-practice').click()
  await expect(page.getByTestId('defaults-note')).toBeHidden()
  await page.keyboard.press('Escape')
  await saveBSection(page)
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-practice').click()
  await expect(page.getByTestId('defaults-note')).toHaveText(
    `The defaults for Full song. ${B_SECTION} has its own pre-roll · edit it in the Bookmark manager`,
  )
  // Changing it edits the setting, not the bookmark: the bookmark still plays as saved.
  await nudge(page, 'practice.preRollBeats', 'ArrowRight')
  await expect(page.getByTestId('hud-bookmark')).toHaveText(B_SECTION)
  await page.getByTestId('defaults-note-link').click()
  await expect(page.getByTestId('bookmark-name')).toHaveValue(B_SECTION)
  expect(errors).toEqual([])
})
