import { readFileSync } from 'node:fs'

import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { readStore, seedPractice, SONG_IDS, watchErrors } from './support'

/**
 * Milestone 9.5: playlists (the Playlists tab, listening mode, the Welcome "Listen" card).
 * Listening's seams and crossfades are checked in the contact sheets; here, the flows.
 */

const NOW = '2026-11-24T10:00:00.000Z'

function playlist(
  id: string,
  name: string,
  songIds: readonly string[],
  extra: Record<string, unknown> = {},
): object {
  return {
    id,
    profileId: 'default',
    name,
    lookId: null,
    entries: songIds.map((songId) => ({ songId, lookId: null })),
    shuffle: false,
    repeat: 'playlist',
    createdAt: NOW,
    updatedAt: NOW,
    lastPlayedAt: null,
    ...extra,
  }
}

async function openPlaylists(page: Page): Promise<void> {
  await page.goto('./#/playlists')
  await expect(page.getByTestId('playlists-page')).toBeVisible()
}

async function pick(page: Page, trigger: ReturnType<Page['getByTestId']>, option: string) {
  await trigger.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

const rowTitles = (page: Page) => page.getByTestId('playlist-row-title')

test('@playlists @smoke make a playlist, order it, give a song its own look, and play it', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlaylists(page)
  await expect(page.getByTestId('playlists-empty')).toContainText(
    'Make a playlist to listen to songs back to back',
  )
  await page.getByTestId('playlist-new').click()
  await expect(page.getByTestId('playlist-name')).toBeFocused()
  await page.getByTestId('playlist-name').fill('Evening')
  await page.getByTestId('playlist-name').press('Enter')
  await expect(page.getByTestId('playlist-item')).toContainText('Evening')
  await expect(page.getByTestId('playlist-empty')).toContainText('Add songs from the panel')

  const add = (title: string) =>
    page
      .getByTestId('playlist-add-song')
      .filter({ hasText: title })
      .getByTestId('playlist-add-button')
  await add('Minuet in G').click()
  await add('Canon in D').click()
  await add('Invention No. 1').click()
  await expect(rowTitles(page)).toHaveText([/Minuet in G/, /Canon in D/, /Invention No\. 1/])
  await expect(page.getByTestId('playlist-meta')).toContainText('3 songs')
  await expect(page.getByTestId('playlist-meta')).toContainText('crossfade 2 s')

  // ✓ adds a song again, with Undo.
  await add('Minuet in G').click()
  await expect(rowTitles(page)).toHaveCount(4)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(rowTitles(page)).toHaveCount(3)

  // Alt+↓ on a focused row moves it, and says so.
  await page.getByTestId('playlist-row').first().focus()
  await page.keyboard.press('Alt+ArrowDown')
  await expect(rowTitles(page)).toHaveText([/Canon in D/, /Minuet in G/, /Invention No\. 1/])
  await expect(page.getByTestId('playlist-announce')).toHaveText(
    'Moved Minuet in G to position 2 of 3',
  )

  // A per-song look; the rest show the playlist's.
  await pick(page, page.getByTestId('playlist-look'), 'Mist')
  const looks = page.getByTestId('playlist-row-look')
  await expect(looks.nth(0)).toContainText('Playlist look (Mist)')
  await pick(page, looks.nth(1), 'Blueprint')
  await expect(looks.nth(1)).toContainText('Blueprint')

  // Everything is saved at once.
  await page.reload()
  await expect(rowTitles(page)).toHaveText([/Canon in D/, /Minuet in G/, /Invention No\. 1/])
  await expect(page.getByTestId('playlist-row-look').nth(1)).toContainText('Blueprint')
  await expect(page.getByTestId('playlist-item')).toContainText('Look: Mist')

  await page.getByTestId('playlist-play').click()
  await expect(page.getByTestId('listening-hud')).toBeVisible()
  await expect(page.getByTestId('listening-title')).toHaveText('Canon in D')
  await expect(page.getByTestId('listening-where')).toContainText('Evening · song 1 of 3')
  await page.keyboard.press('n')
  await expect(page.getByTestId('listening-title')).toHaveText('Minuet in G')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('listening-hud')).toHaveCount(0)
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  expect(errors).toEqual([])
})

test('@playlists listening records no practice and leaves the stored look as it was', async ({
  page,
}) => {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toBeVisible()
  await seedPractice(page, {
    playlists: [
      playlist('pl', 'Blue', [SONG_IDS.minuet, SONG_IDS.canon], { lookId: 'builtin:blueprint' }),
    ],
  })
  const stored = () => page.evaluate(() => localStorage.getItem('pianomeister.settings'))
  const before = await stored()
  await openPlaylists(page)
  await page.getByTestId('playlist-play').click()
  await expect(page.getByTestId('listening-hud')).toBeVisible()
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  // Let it play a while (a real play would be recorded after a few seconds).
  await expect
    .poll(() =>
      page.evaluate(() => {
        const t = document.querySelector('[data-testid="listening-time"]')?.textContent ?? ''
        const m = /(\d+):(\d\d)/.exec(t)
        return m === null ? 0 : Number(m[1]) * 60 + Number(m[2])
      }),
    )
    .toBeGreaterThanOrEqual(4)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('listening-hud')).toHaveCount(0)
  expect(await stored()).toBe(before)
  expect(await readStore(page, 'playRecords')).toEqual([])
  expect(await readStore(page, 'sessions')).toEqual([])
  const [saved] = await readStore<{ lastPlayedAt: number | null }>(page, 'playlists')
  expect(saved?.lastPlayedAt).not.toBeNull()
})

test('@playlists export then import brings the playlist back', async ({ page }) => {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toBeVisible()
  await seedPractice(page, {
    playlists: [playlist('pl', 'Round trip', [SONG_IDS.canon, SONG_IDS.minuet])],
  })
  await openPlaylists(page)
  const download = page.waitForEvent('download')
  await page.getByTestId('playlist-export').click()
  const file = await download
  expect(file.suggestedFilename()).toBe('Round trip.pmplaylist.json')
  const text = readFileSync((await file.path()) ?? '', 'utf8')

  await page.getByTestId('playlist-more').click()
  await page.getByTestId('playlist-delete').click()
  await expect(page.getByTestId('playlists-empty')).toBeVisible()

  await page.getByTestId('playlist-import-file').setInputFiles({
    name: 'Round trip.pmplaylist.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  })
  await expect(page.getByTestId('playlist-item')).toHaveCount(1)
  await expect(page.getByTestId('playlist-item')).toContainText('Round trip')
  await expect(rowTitles(page)).toHaveText([/Canon in D/, /Minuet in G/])

  // The same file again adds nothing (the same playlist).
  await page.getByTestId('playlist-import-file').setInputFiles({
    name: 'again.pmplaylist.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  })
  await expect(page.getByTestId('toast').getByText('Those playlists are here already')).toBeVisible()
  await expect(page.getByTestId('playlist-item')).toHaveCount(1)
})

test('@playlists @welcome the Listen card: hidden with none, recent first, Play listens', async ({
  page,
}) => {
  await page.goto('./')
  await expect(page.getByTestId('welcome')).toBeVisible()
  await expect(page.getByTestId('calendar-card')).toBeVisible()
  await expect(page.getByTestId('listen-card')).toHaveCount(0)
  await seedPractice(page, {
    playlists: [
      playlist('a', 'Never played', [SONG_IDS.minuet]),
      playlist('b', 'Played', [SONG_IDS.canon, SONG_IDS.minuet], { lastPlayedAt: 1000 }),
    ],
  })
  await page.goto('./')
  const items = page.getByTestId('listen-item')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText('Played')
  await expect(items.nth(0)).toContainText('2 songs')
  await items.nth(0).getByTestId('listen-play').click()
  await expect(page.getByTestId('listening-hud')).toBeVisible()
  await expect(page.getByTestId('listening-title')).toHaveText('Canon in D')
})

test('@playlists @library Add to playlist… from the Library makes a new playlist', async ({
  page,
}) => {
  await page.goto('./#/library')
  await page.getByTestId('song-row').filter({ hasText: 'Canon in D' }).click()
  await page.getByTestId('add-to-playlist').click()
  await page.getByTestId('add-to-playlist-new').click()
  await expect(page.getByTestId('playlists-page')).toBeVisible()
  await expect(page.getByTestId('playlist-name')).toBeFocused()
  await expect(page.getByTestId('playlist-name')).toHaveValue('New playlist')
  await expect(rowTitles(page)).toHaveText([/Canon in D/])

  // Then the menu lists it.
  await page.getByTestId('tab-library').click()
  await page.getByTestId('song-row').filter({ hasText: 'Minuet in G' }).click()
  await page.getByTestId('add-to-playlist').click()
  await page.getByTestId('add-to-playlist-item').filter({ hasText: 'New playlist' }).click()
  await expect(page.getByTestId('toast').getByText('Added to “New playlist”')).toBeVisible()
  await page.getByTestId('tab-playlists').click()
  await expect(rowTitles(page)).toHaveText([/Canon in D/, /Minuet in G/])
})
