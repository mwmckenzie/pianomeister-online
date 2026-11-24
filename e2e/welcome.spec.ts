import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import {
  earlierToday,
  middayDaysAgo,
  seedBookmark,
  seedPractice,
  segment,
  SONG_IDS,
  watchErrors,
} from './support'

/**
 * Milestone 7.7: the Welcome screen (m7-7 decisions 1–13). Opened at the site root (no hash) the
 * app starts on Welcome; `#/` is the player.
 */

const MIN = 60_000

async function openWelcome(page: Page): Promise<void> {
  await page.goto('./')
  await expect(page.getByTestId('welcome')).toBeVisible()
}

/** A bookmark on bars 17–32 last loaded, stopped at `bar`, with a little history. */
async function seedResume(page: Page, bar: number): Promise<void> {
  const now = Date.now()
  await seedPractice(page, {
    bookmarks: [seedBookmark('b', 'B section', { startBar: 17, endBar: 32 })],
    sessions: [{ id: 's1', profileId: 'default', startedAt: now - 2 * 86_400_000, endedAt: now }],
    playRecords: [
      {
        id: 'r1',
        profileId: 'default',
        sessionId: 's1',
        songId: SONG_IDS.minuet,
        bookmarkId: 'b',
        startedAt: now - 2 * 86_400_000,
        playedMs: 14 * MIN,
        plays: 9,
      },
    ],
    appState: [
      {
        key: 'lastOpened:default',
        value: JSON.stringify({ songId: SONG_IDS.minuet, bookmarkId: 'b', bar }),
      },
    ],
  })
}

test('@welcome @smoke the app starts on Welcome; with Start on = Player it opens the player', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openWelcome(page)
  // A profile still named "Me" is welcomed back, without a name.
  await expect(page.getByTestId('greeting')).toHaveText('Welcome back')
  // The scene behind is the player, its HUD hidden but its menu there, Home lit.
  await expect(page.getByTestId('menu-home')).toBeVisible()
  await expect(page.getByTestId('hud-title')).toBeHidden()

  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-appearance').click()
  await segment(page, 'appearance.startOn', 'Player')
  await page.keyboard.press('Escape')
  await page.goto('./')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await expect(page.getByTestId('welcome')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('@welcome Resume goes back to the stored bar of the last entry (inside its loop)', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await seedResume(page, 26)
  await page.goto('./')
  await expect(page.getByTestId('welcome')).toBeVisible()
  await expect(page.getByTestId('resume-title')).toHaveText('Minuet in G')
  await expect(page.getByTestId('resume-entry')).toContainText('B section')
  await expect(page.getByTestId('resume-details')).toHaveText(
    /^Last played .* · stopped at bar 26 · 9 plays · 14 min$/,
  )
  await expect(page.getByTestId('resume-marker')).toBeVisible()
  // Resume has the focus: Enter resumes.
  await expect(page.getByTestId('resume')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('welcome')).toHaveCount(0)
  await expect(page.getByTestId('hud-bookmark')).toHaveText('B section')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('26:1')
  await expect(page.getByTestId('transport-state')).not.toHaveText('playing')
  expect(errors).toEqual([])
})

test('@welcome a stored bar outside the loop resumes at the loop start', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await seedResume(page, 50)
  await page.goto('./')
  await page.getByTestId('resume').click()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('17:1')
  expect(errors).toEqual([])
})

test('@welcome going Home stores where playback stopped', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  for (let i = 0; i < 9; i++) await page.getByRole('button', { name: 'Next bar' }).click()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('10:1')
  await page.getByTestId('menu-home').click()
  await expect(page.getByTestId('welcome')).toBeVisible()
  // No plays yet: the card offers the loaded song to start with.
  await expect(page.getByTestId('resume')).toHaveText('Start with Minuet in G')
  await page.getByTestId('resume').click()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('10:1')
  expect(errors).toEqual([])
})

test('@welcome H goes Home and S to Stats from the player and the library', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await page.keyboard.press('h')
  await expect(page.getByTestId('welcome')).toBeVisible()
  await page.keyboard.press('s')
  await expect(page.getByTestId('stats-page')).toBeVisible()
  await page.getByTestId('home-link').click()
  await expect(page.getByTestId('welcome')).toBeVisible()
  await page.getByTestId('menu-library').click()
  await expect(page.getByTestId('song-row').first()).toBeVisible()
  await page.keyboard.press('h')
  await expect(page.getByTestId('welcome')).toBeVisible()
  await page.getByTestId('menu-stats').click()
  await expect(page.getByTestId('stats-page')).toBeVisible()
  expect(errors).toEqual([])
})

test('@welcome Choose another opens the picker; loading from it opens the player', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openWelcome(page)
  await page.getByTestId('choose-another').click()
  await expect(page.getByTestId('song-picker')).toBeVisible()
  await page.getByTestId('picker-song').filter({ hasText: 'Canon' }).click()
  await page.getByTestId('picker-load').click()
  await expect(page.getByTestId('welcome')).toHaveCount(0)
  await expect(page.getByTestId('hud-title')).toHaveText('Canon in D')
  expect(errors).toEqual([])
})

test('@welcome highlights rotate every 8 s and pause while hovered; a suggestion loads', async ({
  page,
}) => {
  const errors = watchErrors(page)
  // Mid-month: the seeded plays (1 and 2 days ago) are "this month" on any real date.
  await page.clock.install({ time: new Date('2026-11-18T12:00:00') })
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  const now = await page.evaluate(() => Date.now())
  const loop = { startBar: 17, endBar: 32 }
  const record = (id: string, daysAgo: number, tempo: number, minutes: number) => ({
    id,
    profileId: 'default',
    sessionId: id,
    songId: SONG_IDS.minuet,
    bookmarkId: 'b',
    startedAt: now - daysAgo * 86_400_000,
    playedMs: minutes * MIN,
    plays: 3,
    tempoPercent: tempo,
    loop,
  })
  await seedPractice(page, {
    bookmarks: [seedBookmark('b', 'B section', loop)],
    playRecords: [record('r1', 2, 70, 20), record('r2', 1, 85, 30)],
  })
  await page.goto('./')
  const title = page.getByTestId('highlight-title')
  await expect(title).toHaveText('B section went from 70% to 85% this month')
  // Two or more highlights, and nothing holding the rotation (hover, focus), before time moves.
  await expect.poll(() => page.getByTestId('highlight-dot').count()).toBeGreaterThanOrEqual(2)
  await page.mouse.move(0, 0)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.clock.runFor(8100)
  await expect(title).not.toHaveText('B section went from 70% to 85% this month')
  const second = await title.textContent()
  // Hovered: it stays.
  await page.getByTestId('highlight').hover()
  await page.clock.runFor(16_500)
  await expect(title).toHaveText(second ?? '')
  // A dot selects one.
  await page.getByTestId('highlight-dot').first().click()
  await expect(title).toHaveText('B section went from 70% to 85% this month')

  // "Maybe next": Canon in D was never played.
  const chip = page.getByTestId('suggestion').filter({ hasText: 'Canon in D' })
  await expect(chip).toContainText('never played')
  await chip.click()
  await expect(page.getByTestId('hud-title')).toHaveText('Canon in D')
  expect(errors).toEqual([])
})

test('@welcome This week and the 12-week calendar show the practice, and the streak', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  const now = Date.now()
  await seedPractice(page, {
    playRecords: [0, 1, 2].map((daysAgo) => ({
      id: `r${daysAgo}`,
      profileId: 'default',
      sessionId: `s${daysAgo}`,
      songId: SONG_IDS.minuet,
      bookmarkId: `full:${SONG_IDS.minuet}`,
      startedAt: daysAgo === 0 ? earlierToday(now) : middayDaysAgo(daysAgo, now),
      playedMs: 20 * MIN,
      plays: 1,
    })),
  })
  await page.goto('./')
  await expect(page.getByTestId('streak')).toHaveText('3 days in a row')
  await expect(page.getByTestId('calendar-card').getByTestId('heatmap-day')).not.toHaveCount(0)
  await expect(
    page.getByTestId('calendar-card').locator('[data-testid="heatmap-day"][data-level="2"]'),
  ).toHaveCount(3)
  await expect(page.getByTestId('week-chart').getByTestId('chart-bar')).toHaveCount(7)
  expect(errors).toEqual([])
})

/** Lets real time pass in the page: the point is that nothing renders meanwhile. */
const lapse = (page: Page, ms: number) =>
  page.evaluate((delay) => new Promise<void>((resolve) => setTimeout(resolve, delay)), ms)

/** Frames the engine has rendered since mount (needs ?stats=1). */
const rendered = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as { pianomeisterEngineStats?: () => { rendered: number } }
      ).pianomeisterEngineStats?.().rendered ?? -1,
  )

test('@welcome the scene behind Welcome is frozen: one frame per change, the loop again on Resume', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/welcome?stats=1')
  await expect(page.getByTestId('welcome')).toBeVisible()
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
  await lapse(page, 300)
  const still = await rendered(page)
  expect(still).toBeGreaterThan(0)
  await lapse(page, 1000)
  expect(await rendered(page)).toBe(still)

  // A resize renders the new size once.
  await page.setViewportSize({ width: 1200, height: 800 })
  await expect.poll(() => rendered(page)).toBeGreaterThan(still)
  await lapse(page, 300)
  const resized = await rendered(page)
  await lapse(page, 1000)
  expect(await rendered(page)).toBe(resized)

  // Resume: the loop runs again.
  await page.getByTestId('resume').click()
  await expect(page.getByTestId('welcome')).toHaveCount(0)
  await expect.poll(() => rendered(page)).toBeGreaterThan(resized + 5)
  expect(errors).toEqual([])
})
