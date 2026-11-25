import { readFileSync } from 'node:fs'

import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { SETTINGS_VERSION } from '../src/core/settings/loadSettings'
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

test('@playlists a name being typed survives a library refresh', async ({ page }) => {
  // Hand detection's background pass refreshes the library: hold it until the name is typed.
  await page.addInitScript(() => {
    const held: IdleRequestCallback[] = []
    window.requestIdleCallback = (run) => held.push(run)
    Object.assign(window, {
      runIdle: () => {
        for (const run of held.splice(0)) run({ didTimeout: false, timeRemaining: () => 50 })
      },
    })
  })
  await openPlaylists(page)
  await page.getByTestId('playlist-new').click()
  await expect(page.getByTestId('playlist-name')).toBeFocused()
  await page.getByTestId('playlist-name').fill('Evening')
  await expect
    .poll(async () => {
      await page.evaluate(() => (window as unknown as { runIdle: () => void }).runIdle())
      return (await readStore(page, 'handDetections')).length
    })
    .toBe(3)
  await expect(page.getByTestId('playlist-name')).toHaveValue('Evening')
  await page.getByTestId('playlist-name').press('Enter')
  await expect(page.getByTestId('playlist-item')).toContainText('Evening')
})

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
  await expect(
    page.getByTestId('toast').getByText('Those playlists are here already'),
  ).toBeVisible()
  await expect(page.getByTestId('playlist-item')).toHaveCount(1)
})

/** "m:ss" / "m:ss" of the listening HUD, in seconds: elapsed and length. */
async function listeningTime(page: Page): Promise<[number, number]> {
  const text = (await page.getByTestId('listening-time').textContent()) ?? ''
  const [at = 0, length = 0] = [...text.matchAll(/(\d+):(\d\d)/g)].map(
    (m) => Number(m[1]) * 60 + Number(m[2]),
  )
  return [at, length]
}

test('@playlists listening seeks: the timeline and Shift+arrows, and the next song still starts', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/?stats=1')
  await expect(page.getByTestId('hud-title')).toBeVisible()
  await seedPractice(page, {
    playlists: [playlist('pl', 'Two', [SONG_IDS.minuet, SONG_IDS.canon])],
  })
  // Play / pause waits for the samples.
  await expect(page.getByTestId('sample-status')).toHaveText('loaded')
  await openPlaylists(page)
  await page.getByTestId('playlist-play').click()
  await expect(page.getByTestId('transport-state')).toHaveText('playing')

  // Shift+→ and Shift+←: 5 s on and back, paused so the song doesn't move meanwhile.
  await page.keyboard.press('Space')
  await expect(page.getByTestId('transport-state')).toHaveText('paused')
  const [from] = await listeningTime(page)
  await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(async () => (await listeningTime(page))[0]).toBe(from + 5)
  await page.keyboard.press('Shift+ArrowLeft')
  await expect.poll(async () => (await listeningTime(page))[0]).toBe(from)

  // Minimal keeps the timeline, Hidden doesn't.
  const timeline = page.getByTestId('timeline')
  await page.keyboard.press('d')
  await expect(page.getByTestId('listening-hud')).toHaveAttribute('data-mode', 'minimal')
  await expect(timeline).toBeVisible()
  await page.keyboard.press('d')
  await expect(page.getByTestId('listening-hud')).toHaveAttribute('data-mode', 'hidden')
  await expect(timeline).toHaveCount(0)
  await page.keyboard.press('d')

  // A click about 3 s before the end (crossfade 2 s; it lands on the bar's start).
  const box = await timeline.boundingBox()
  const [, length] = await listeningTime(page)
  const width = box?.width ?? 0
  await timeline.click({ position: { x: (width * (length - 3)) / length, y: 14 } })
  await expect.poll(async () => (await listeningTime(page))[0]).toBeGreaterThanOrEqual(length - 6)
  await expect(page.getByTestId('listening-title')).toHaveText('Minuet in G')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('listening-announce')).toContainText('Canon in D')
  await expect(page.getByTestId('listening-title')).toHaveText('Canon in D')
  await expect(page.getByTestId('transport-state')).toHaveText('playing')

  // Focus is on the timeline after the click: → is still "next song", not a bar step.
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('listening-title')).toHaveText('Minuet in G')
  expect(await readStore(page, 'playRecords')).toEqual([])
  expect(await readStore(page, 'sessions')).toEqual([])
  expect(errors).toEqual([])
})

/** A playlist file whose playlist uses a saved look the file carries. */
function fileWithLook(playlistId: string, name: string, lookId: string, lookName: string): string {
  return JSON.stringify({
    format: 'pianomeister-playlist',
    version: 1,
    playlists: [
      {
        id: playlistId,
        name,
        lookId,
        entries: [{ songId: SONG_IDS.minuet, lookId: null }],
        shuffle: false,
        repeat: 'playlist',
        createdAt: NOW,
      },
    ],
    looks: {
      format: 'pianomeister-look',
      version: SETTINGS_VERSION,
      looks: [
        {
          id: lookId,
          name: lookName,
          createdAt: NOW,
          settings: { colors: { background: '#200010' } },
        },
      ],
    },
  })
}

test('@playlists @looks import asks "Import its looks too": on adds the look, off leaves it out', async ({
  page,
}) => {
  await openPlaylists(page)
  const importFile = (name: string, text: string) =>
    page.getByTestId('playlist-import-file').setInputFiles({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    })

  // On (the default): the look joins My looks and the playlist uses it.
  await importFile('with.pmplaylist.json', fileWithLook('p1', 'With look', 'look-1', 'Dusk'))
  await expect(page.getByTestId('playlist-import-dialog')).toBeVisible()
  await expect(page.getByTestId('playlist-import-looks')).toBeChecked()
  await page.getByTestId('playlist-import-confirm').click()
  await expect(page.getByTestId('playlist-item')).toContainText('Look: Dusk')
  expect((await readStore<{ name: string }>(page, 'looks')).map((l) => l.name)).toEqual(['Dusk'])

  // Off: no look is added; the playlist falls back to the current look.
  await importFile('without.pmplaylist.json', fileWithLook('p2', 'Without look', 'look-2', 'Dawn'))
  await page.getByTestId('playlist-import-looks').uncheck()
  await page.getByTestId('playlist-import-confirm').click()
  await expect(page.getByTestId('playlist-import-dialog')).toBeHidden()
  await expect(page.getByTestId('playlist-item').filter({ hasText: 'Without look' })).toContainText(
    'Look: Current look',
  )
  expect((await readStore<{ name: string }>(page, 'looks')).map((l) => l.name)).toEqual(['Dusk'])
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

/**
 * Milestone 11, Phase 0: a hidden tab gets no animation frames, so listening
 * prepares the next song from the scheduler's ticks instead (Phase 1a).
 */
test('@playlists a playlist goes on to the next song in a hidden tab', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window)
    let hidden = false
    const held: FrameRequestCallback[] = []
    window.requestAnimationFrame = (run) => (hidden ? -held.push(run) : raf(run))
    Object.assign(window, {
      hidePage: () => {
        hidden = true
        Object.defineProperty(document, 'hidden', { value: true, configurable: true })
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
      },
    })
  })
  await page.goto('./#/?stats=1')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
  await seedPractice(page, {
    playlists: [playlist('p', 'Hidden', [SONG_IDS.invention, SONG_IDS.minuet])],
  })
  await page.reload()
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
  // Browsers start audio after a gesture.
  await page.getByTestId('stage').click({ position: { x: 640, y: 500 } })
  await page.evaluate(() =>
    (
      window as unknown as { pianomeisterListening: { play: (id: string) => void } }
    ).pianomeisterListening.play('p'),
  )
  const read = () =>
    page.evaluate(() => {
      const l = (
        window as unknown as {
          pianomeisterListening: {
            position: () => number
            state: () => { current: number; parts: { songId: string; endSec: number }[] } | null
            seek: (s: number) => void
          }
        }
      ).pianomeisterListening
      const state = l.state()
      return {
        at: l.position(),
        end: state?.parts[0]?.endSec ?? 0,
        song: state?.parts[state.current]?.songId,
        songs: state?.parts.length,
      }
    })
  await expect.poll(async () => (await read()).at).toBeGreaterThan(0.3)
  const { end } = await read()
  // Before the next song is prepared (10 s and the crossfade before the end), hide the tab.
  await page.evaluate((to) => {
    const w = window as unknown as {
      pianomeisterListening: { seek: (s: number) => void }
      hidePage: () => void
    }
    w.pianomeisterListening.seek(to)
    w.hidePage()
  }, end - 13.5)
  await expect.poll(async () => (await read()).at).toBeGreaterThan(end - 12)
  // The first song's end: the next one is alone on the timeline (from 0) and plays on.
  await expect
    .poll(async () => ((await read()).songs === 1 ? (await read()).song : ''), { timeout: 25_000 })
    .toBe(SONG_IDS.minuet)
  const { at } = await read()
  await expect.poll(async () => (await read()).at).toBeGreaterThan(at + 1)
})
