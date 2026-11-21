import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import {
  readStore,
  seedBookmark,
  seedPractice,
  setLoopBars,
  SONG_IDS,
  watchErrors,
} from './support'

/**
 * Milestone 7.6 (brief decisions 60, 68–72): the now-playing line follows the setup live, a play
 * is a start, and plays and time go to what the setup matches — the song always gets them all.
 */

interface StoredRecord {
  readonly bookmarkId: string | null
  readonly plays: number
  readonly playedMs: number
  readonly startedAt: number
}

const MIN = 60_000

async function openPlayer(page: Page): Promise<void> {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
}

const barNow = async (page: Page): Promise<number> =>
  Number.parseInt((await page.getByTestId('hud-bar-beat').textContent()) ?? '0', 10)

const plays = async (page: Page): Promise<number> =>
  (await readStore<StoredRecord>(page, 'playRecords')).reduce((n, r) => n + r.plays, 0)

test('Full song shows the bookmark icon; a tempo key makes it a custom setup; Back to Full song', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  const entry = page.getByTestId('hud-entry')
  await expect(page.getByTestId('hud-full-song')).toHaveText('Full song')
  await expect(page.getByTestId('hud-entry-icon')).toBeVisible()
  await expect(entry).toHaveAttribute('data-kind', 'fullSong')
  // Secondary colour (Glacier), like any bookmark.
  await expect(entry).toHaveCSS('color', 'rgb(126, 224, 195)')

  // The tempo key just changes the setup: the line follows, plain and dim, no icon.
  await page.keyboard.press('-')
  await expect(page.getByTestId('hud-custom')).toHaveText(
    'Full song · 95% · both hands · no pre-roll',
  )
  await expect(page.getByTestId('hud-entry-icon')).toBeHidden()
  await expect(entry).not.toHaveCSS('color', 'rgb(126, 224, 195)')

  await page.getByTestId('open-loop').click()
  await expect(page.getByTestId('back-to-name')).toHaveText('Full song')
  await page.getByTestId('back-to-loaded').click()
  await expect(page.getByTestId('hud-full-song')).toBeVisible()
  await expect(page.getByTestId('hud-tempo-percent')).toHaveText('100%')
  await expect(page.getByTestId('back-to-loaded')).toBeHidden()
  expect(errors).toEqual([])
})

test('changing settings to equal another bookmark adopts it, and it gets the plays', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const errors = watchErrors(page)
  await openPlayer(page)
  await seedPractice(page, {
    bookmarks: [
      seedBookmark('a', 'Opening', { startBar: 1, endBar: 4 }),
      seedBookmark('b', 'Middle', { startBar: 17, endBar: 32 }),
    ],
    appState: [
      {
        key: 'lastOpened:default',
        value: JSON.stringify({ songId: SONG_IDS.minuet, bookmarkId: 'a' }),
      },
    ],
  })
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Opening')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })

  // Bars 17–32, everything else as before: that's Middle. No reload, no toast.
  await setLoopBars(page, 17, 32)
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Middle')
  await expect(page.getByTestId('toast')).toHaveCount(0)
  // Opening is still the one loaded: Back to returns there.
  await expect(page.getByTestId('back-to-name')).toHaveText('Opening')
  await page.keyboard.press('Escape')

  await page.getByTestId('play-pause').click()
  await expect.poll(() => plays(page)).toBe(1)
  await page.getByTestId('play-pause').click()
  await expect(page.getByTestId('transport-state')).toHaveText('paused')
  const records = await readStore<StoredRecord>(page, 'playRecords')
  expect(records.map((r) => [r.bookmarkId, r.plays])).toEqual([['b', 1]])
  expect(errors).toEqual([])
})

test('pausing and resuming is one play', async ({ page }) => {
  test.setTimeout(60_000)
  const errors = watchErrors(page)
  await openPlayer(page)
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  const playPause = page.getByTestId('play-pause')
  await playPause.click()
  await expect.poll(() => barNow(page)).toBeGreaterThanOrEqual(2)
  await playPause.click()
  await expect(page.getByTestId('transport-state')).toHaveText('paused')
  // A seek while paused, then resume: still the same play.
  await page.getByRole('button', { name: 'Next bar' }).click()
  await playPause.click()
  await expect.poll(() => barNow(page)).toBeGreaterThanOrEqual(4)
  await playPause.click()
  await expect(page.getByTestId('transport-state')).toHaveText('paused')

  // (Stored by random id: put them in playing order.)
  const records = (await readStore<StoredRecord>(page, 'playRecords')).sort(
    (a, b) => a.startedAt - b.startedAt,
  )
  expect(records).toHaveLength(2)
  expect(records.map((r) => r.plays)).toEqual([1, 0])
  expect(records.every((r) => r.bookmarkId === `full:${SONG_IDS.minuet}`)).toBe(true)
  expect(errors).toEqual([])
})

test("deleting a bookmark keeps the song's plays and time; the picker shows other setups", async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  const now = Date.now()
  const record = (id: string, bookmarkId: string | null, minutes: number, count: number) => ({
    id,
    profileId: 'default',
    sessionId: 's1',
    songId: SONG_IDS.minuet,
    bookmarkId,
    startedAt: now - 30 * MIN,
    playedMs: minutes * MIN,
    plays: count,
  })
  await seedPractice(page, {
    bookmarks: [seedBookmark('a', 'Opening', { startBar: 1, endBar: 4 })],
    sessions: [{ id: 's1', profileId: 'default', startedAt: now - 30 * MIN, endedAt: now }],
    playRecords: [record('r1', 'a', 10, 3), record('r2', null, 18, 12)],
  })

  const picker = async () => {
    await page.getByTestId('open-picker').click()
    await page.getByTestId('picker-song').filter({ hasText: 'Minuet in G' }).click()
  }
  await picker()
  await expect(page.getByTestId('picker-song-played')).toHaveText('15×')
  await expect(page.getByTestId('picker-song-practice')).toHaveText('28 min')
  await expect(page.getByTestId('picker-other-setups')).toHaveText(
    'Other setups: 12 plays · 18 min',
  )
  await page.getByTestId('picker-bookmark').click()
  await expect(page.getByTestId('picker-entry-played')).toHaveText('3×')
  // Its share is of all the song's time, other setups included: 10 of 28 minutes.
  await expect(page.getByTestId('picker-entry-share')).toHaveText('36%')
  await page.keyboard.press('Escape')

  // Delete the bookmark: the song's numbers don't change.
  await page.goto('./#/bookmarks')
  await page.getByTestId('bookmark-row').filter({ hasText: 'Opening' }).click()
  await page.getByTestId('bookmark-delete').click()
  await expect(page.getByTestId('bookmark-row')).toHaveCount(0)
  await page.getByTestId('tab-library').click()
  const minuet = page.getByTestId('song-row').filter({ hasText: 'Minuet in G' })
  await expect(minuet.getByTestId('row-plays')).toHaveText('15')
  await page.getByTestId('back-to-player').click()
  await picker()
  await expect(page.getByTestId('picker-song-played')).toHaveText('15×')
  await expect(page.getByTestId('picker-song-practice')).toHaveText('28 min')
  expect(await readStore(page, 'playRecords')).toHaveLength(2)
  expect(errors).toEqual([])
})
