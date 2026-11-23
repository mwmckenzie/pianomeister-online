import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import {
  saveAsBookmark,
  seedBookmark,
  seedPractice,
  setLoopBars,
  SONG_IDS,
  watchErrors,
} from './support'

const B_SECTION = 'Bars 17–32 · 100% · both hands · no pre-roll'

const profileRow = (page: Page, name: string) =>
  page
    .getByTestId('profile-row')
    .filter({ has: page.getByTestId('profile-name').getByText(name, { exact: true }) })

async function openProfilesTab(page: Page): Promise<void> {
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('tab-profiles').click()
}

test('@settings a second profile has its own bookmarks and stats; switch from the tab or the menu', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  // Me practised the Minuet an hour ago.
  const hourAgo = Date.now() - 3_600_000
  await seedPractice(page, {
    sessions: [{ id: 's1', profileId: 'default', startedAt: hourAgo, endedAt: hourAgo + 600_000 }],
    playRecords: [
      {
        id: 'r1',
        profileId: 'default',
        sessionId: 's1',
        songId: SONG_IDS.minuet,
        bookmarkId: `full:${SONG_IDS.minuet}`,
        startedAt: hourAgo,
        playedMs: 600_000,
        plays: 2,
      },
    ],
  })
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  // One profile: nothing about profiles in the player.
  await expect(page.getByTestId('menu-profile')).toBeHidden()
  await setLoopBars(page, 17, 32)
  const saved = await saveAsBookmark(page)
  expect(saved).toBe(B_SECTION)
  await page.keyboard.press('Escape')

  await openProfilesTab(page)
  await expect(page.getByTestId('profile-row')).toHaveCount(1)
  await expect(profileRow(page, 'Me').getByTestId('profile-active')).toBeVisible()
  await expect(profileRow(page, 'Me').getByTestId('profile-facts')).toHaveText(
    '10 min practiced · last practiced today',
  )
  await expect(profileRow(page, 'Me').getByTestId('profile-delete')).toBeDisabled()
  await expect(page.getByTestId('summary-sessions')).toHaveText('1')
  await expect(page.getByTestId('summary-most')).toHaveText('Minuet in G')

  // Create Anna and switch to her from the tab.
  await page.getByTestId('profile-new').click()
  await page.getByTestId('profile-new-name').fill('Anna')
  await page.getByTestId('profile-create').click()
  await expect(page.getByTestId('profile-row')).toHaveCount(2)
  await profileRow(page, 'Anna').getByTestId('profile-switch').click()
  await expect(page.getByTestId('toast').filter({ hasText: 'Switched to Anna' })).toBeVisible()
  await expect(page.getByTestId('summary-sessions')).toHaveText('0')
  await page.keyboard.press('Escape')

  // Anna's player: no bookmark, no stats.
  await expect(page.getByTestId('hud-bookmark')).toBeHidden()
  await expect(page.getByTestId('menu-profile')).toBeVisible()
  await page.getByTestId('open-picker').click()
  await expect(page.getByTestId('picker-bookmark')).toHaveCount(0)
  const minuet = page.getByTestId('picker-song').filter({ hasText: 'Minuet in G' })
  await expect(minuet.getByTestId('picker-song-plays')).toHaveText('—')
  await page.keyboard.press('Escape')

  // Back to Me from the menu: her last bookmark and stats are back.
  await page.getByTestId('menu-profile').click()
  await page.getByTestId('switch-profile-Me').click()
  await expect(page.getByTestId('toast').filter({ hasText: 'Switched to Me' })).toBeVisible()
  await expect(page.getByTestId('hud-bookmark')).toHaveText(B_SECTION)
  await page.getByTestId('open-picker').click()
  await expect(minuet.getByTestId('picker-song-plays')).toHaveText('2')
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('@settings a profile can be renamed, recoloured and deleted with a confirm; Me stays active', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await seedPractice(page, {
    profiles: [{ id: 'anna', name: 'Anna', color: '#FFB38A', createdAt: 10 }],
    bookmarks: [seedBookmark('b-me', B_SECTION, { startBar: 17, endBar: 32 }, { autoName: true })],
    appState: [
      {
        key: 'lastOpened:default',
        value: JSON.stringify({ songId: SONG_IDS.minuet, bookmarkId: 'b-me' }),
      },
    ],
  })
  await expect(page.getByTestId('hud-bookmark')).toHaveText(B_SECTION)
  await expect(page.getByTestId('menu-profile')).toBeVisible()

  // Rename and recolour Anna, then delete her.
  await openProfilesTab(page)
  await profileRow(page, 'Anna').getByTestId('profile-rename').click()
  await page.getByTestId('profile-rename-input').fill('Ann')
  await page.getByTestId('profile-rename-input').press('Enter')
  await profileRow(page, 'Ann').getByTestId('profile-color-Ember').click()
  await expect(profileRow(page, 'Ann').getByTestId('profile-color-Ember')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await profileRow(page, 'Ann').getByTestId('profile-delete').click()
  await expect(page.getByTestId('profile-delete-text')).toHaveText(
    "This deletes Ann's 0 bookmarks and its practice stats, and its hand channel choices. This can't be undone.",
  )
  await page.getByTestId('profile-delete-confirm').click()
  await expect(page.getByTestId('profile-row')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('menu-profile')).toBeHidden()

  // Persisted: after a reload Me is active with her bookmark.
  await page.reload()
  await expect(page.getByTestId('hud-bookmark')).toHaveText(B_SECTION)
  expect(errors).toEqual([])
})
