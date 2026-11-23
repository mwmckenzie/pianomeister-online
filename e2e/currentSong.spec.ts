import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { seedBookmark, seedPractice, SONG_IDS, watchErrors } from './support'

/**
 * Milestone 9.2 E: Change song and the Library open on the current song (and the loaded
 * bookmark), selected and in view whatever the sort; a filter hiding it in the Library says so.
 */

async function openPlayer(page: Page): Promise<void> {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
}

const pickerSong = (page: Page, title: string) =>
  page.getByTestId('picker-song').filter({ hasText: title })

test('@library @smoke Change song opens on the current song and its bookmark, whatever the sort', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await seedPractice(page, {
    bookmarks: [
      { ...seedBookmark('opening', 'Opening', { startBar: 1, endBar: 4 }), songId: SONG_IDS.canon },
      { ...seedBookmark('ending', 'Ending', { startBar: 20, endBar: 24 }), songId: SONG_IDS.canon },
    ],
  })
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  // Load Canon's "Ending" bookmark.
  await page.keyboard.press('o')
  await pickerSong(page, 'Canon').click()
  await page.getByTestId('picker-bookmark').filter({ hasText: 'Ending' }).click()
  await page.getByTestId('picker-load').click()
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Ending')

  const picker = page.getByTestId('song-picker')
  await expect(picker).toBeHidden()
  for (const sort of ['title', 'composer', 'bookmarks', 'plays', 'time', 'last']) {
    await page.keyboard.press('o')
    await expect(picker).toBeVisible()
    await page.getByTestId(`picker-sort-${sort}`).click()
    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
    await page.keyboard.press('o')
    await expect(picker).toBeVisible()
    const current = pickerSong(page, 'Canon')
    await expect(current, sort).toHaveAttribute('aria-selected', 'true')
    await expect(current, sort).toBeInViewport()
    const ending = page.getByTestId('picker-bookmark').filter({ hasText: 'Ending' })
    await expect(ending, sort).toHaveAttribute('aria-selected', 'true')
    await expect(ending, sort).toBeInViewport()
    // Focus stays in the search field: typing searches.
    await expect(page.getByTestId('picker-search')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
  }
  expect(errors).toEqual([])
})

test('@library the Library opens on the current song, whatever the sort; a hiding filter says so', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  for (const sort of ['title', 'composer', 'duration', 'plays', 'last', 'dateAdded']) {
    await page.goto('./#/library')
    await page.getByTestId(`sort-${sort}`).click()
    await page.goto('./#/')
    await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
    await page.goto('./#/library')
    const current = page.getByTestId('song-row').filter({ hasText: 'Minuet in G' })
    await expect(current, sort).toHaveAttribute('aria-selected', 'true')
    await expect(current, sort).toBeInViewport()
    await expect(page.getByRole('listbox', { name: 'Songs' }), sort).toBeFocused()
  }

  // A search that hides it: the line, and Show clears it and reveals the song.
  await page.getByTestId('search').fill('canon')
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await page.goto('./#/library')
  await expect(page.getByTestId('current-hidden')).toHaveText(
    /Current song is hidden by the filter ·\s*Show/,
  )
  await page.getByTestId('current-show').click()
  await expect(page.getByTestId('current-hidden')).toHaveCount(0)
  await expect(page.getByTestId('search')).toHaveValue('')
  const current = page.getByTestId('song-row').filter({ hasText: 'Minuet in G' })
  await expect(current).toHaveAttribute('aria-selected', 'true')
  await expect(current).toBeInViewport()
  expect(errors).toEqual([])
})
