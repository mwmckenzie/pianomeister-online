import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { SETTINGS_VERSION } from '../src/core/settings/loadSettings'
import { seedBookmark, seedPractice, SONG_IDS, watchErrors } from './support'

/**
 * Milestone 9.2 D: Open Home when a new session starts. A new session is the stats' rule: more
 * than "New session after" (30 min by default) since the last playback ended. The shared test
 * storage turns the setting off; these tests turn it on.
 */

const MIN = 60_000

test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:4173',
        localStorage: [
          {
            name: 'pianomeister.settings',
            value: JSON.stringify({
              version: SETTINGS_VERSION,
              settings: { render: { quality: 'off' }, appearance: { homeOnNewSession: true } },
            }),
          },
        ],
      },
    ],
  },
})

/** A session whose last playback ended `minutesAgo` minutes before `now`. */
function lastPlayback(now: number, minutesAgo: number) {
  const endedAt = now - minutesAgo * MIN
  return {
    sessions: [{ id: 's1', profileId: 'default', startedAt: endedAt - 5 * MIN, endedAt }],
    playRecords: [
      {
        id: 'r1',
        profileId: 'default',
        sessionId: 's1',
        songId: SONG_IDS.minuet,
        bookmarkId: null,
        startedAt: endedAt - 5 * MIN,
        playedMs: 5 * MIN,
        plays: 1,
      },
    ],
  }
}

async function openPlayer(page: Page): Promise<void> {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
}

test('@welcome @smoke a new session opens Home on load, once; not on a reload or refocus in the same session', async ({
  page,
}) => {
  const errors = watchErrors(page)
  // Never played: the player stays (Start on decides a first run).
  await openPlayer(page)
  await expect(page.getByTestId('welcome')).toHaveCount(0)

  await seedPractice(page, lastPlayback(Date.now(), 31))
  await expect(page.getByTestId('welcome')).toBeVisible()

  // Handled for this session: back on the player, a reload and a refocus leave it there.
  await openPlayer(page)
  await page.reload()
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByTestId('welcome')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('@welcome within the gap a reload continues the session: Home does not open', async ({
  page,
}) => {
  await openPlayer(page)
  await seedPractice(page, lastPlayback(Date.now(), 20))
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await expect(page.getByTestId('welcome')).toHaveCount(0)
})

test('@welcome the setting turns it off', async ({ page }) => {
  await openPlayer(page)
  await page.evaluate(
    (value) => localStorage.setItem('pianomeister.settings', value),
    JSON.stringify({
      version: SETTINGS_VERSION,
      settings: { render: { quality: 'off' }, appearance: { homeOnNewSession: false } },
    }),
  )
  await seedPractice(page, lastPlayback(Date.now(), 90))
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await expect(page.getByTestId('welcome')).toHaveCount(0)
})

test('@welcome when the gap passes while the app is open and idle, Home opens by itself', async ({
  page,
}) => {
  await page.clock.install()
  await openPlayer(page)
  await seedPractice(page, lastPlayback(await page.evaluate(() => Date.now()), 29))
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await expect(page.getByTestId('welcome')).toHaveCount(0)
  await page.clock.fastForward('02:00')
  await expect(page.getByTestId('welcome')).toBeVisible()
})

test('@welcome a bookmark draft is never interrupted; it waits for the next new session', async ({
  page,
}) => {
  await page.clock.install()
  await openPlayer(page)
  const now = await page.evaluate(() => Date.now())
  await seedPractice(page, {
    ...lastPlayback(now, 29),
    bookmarks: [seedBookmark('opening', 'Opening', { startBar: 1, endBar: 4 })],
  })
  await page.goto('./#/bookmarks')
  await page.getByTestId('bookmark-row').filter({ hasText: 'Opening' }).click()
  await page.getByTestId('bookmark-duplicate').click()
  await expect(page.locator('[data-testid="bookmark-row"][data-draft="true"]')).toBeVisible()
  await page.clock.fastForward('02:00')
  await expect(page.locator('[data-testid="bookmark-row"][data-draft="true"]')).toBeVisible()
  await expect(page.getByTestId('welcome')).toHaveCount(0)
})
