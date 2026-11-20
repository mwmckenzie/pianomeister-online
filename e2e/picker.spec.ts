import { test, expect } from '@playwright/test'

import { fileURLToPath } from 'node:url'

import { sortingHistory } from './practiceSeeds'
import { seedPractice, watchErrors } from './support'

const METER_DEMO = fileURLToPath(new URL('../test-fixtures/midi/meter-demo.mid', import.meta.url))

test('the picker opens from the toolbar, shows details, and loads the chosen song', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  // A song picked while the ~230 samples download waits behind them (per-host request queue;
  // seconds on a busy dev server): this test is about the picker, so start once they're in.
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  await page.getByTestId('open-picker').click()
  const picker = page.getByTestId('song-picker')
  await expect(picker).toBeVisible()
  // The current song is highlighted, with its facts and the tempo as a range.
  await expect(page.getByTestId('picker-details')).toContainText('Minuet in G')
  await expect(page.getByTestId('picker-tempo')).toHaveText('126 bpm')
  await expect(page.getByTestId('picker-full-song')).toContainText('1–64')

  await page.getByTestId('picker-song').filter({ hasText: 'Canon in D' }).click()
  // The closing ritardando is under 5% of the song time, so it doesn't widen the range.
  await expect(page.getByTestId('picker-tempo')).toHaveText('100 bpm')
  await page.getByTestId('picker-load').click()
  await expect(picker).toBeHidden()
  await expect(page.getByTestId('hud-title')).toHaveText('Canon in D')
  await expect(page.getByTestId('hud-bars')).toHaveText('102')
  expect(errors).toEqual([])
})

test('O opens the picker; arrows move, Enter loads; typing in search triggers no shortcuts', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await page.getByTestId('stage').click()
  await page.keyboard.press('KeyO')
  const picker = page.getByTestId('song-picker')
  await expect(picker).toBeVisible()
  await expect(page.getByTestId('picker-search')).toBeFocused()
  await expect(page.getByTestId('picker-song')).toHaveCount(3)

  // "o" and "p" are shortcuts elsewhere (picker, playfield panel): here they're just text.
  await page.keyboard.type('op')
  await expect(page.getByTestId('picker-search')).toHaveValue('op')
  await expect(picker).toBeVisible()
  await expect(page.getByTestId('playfield-sidebar')).toBeHidden()
  await page.getByTestId('picker-search').fill('')

  // Sorted by title: Canon, Invention, Minuet. From Minuet, up once is the Invention.
  await page.keyboard.press('ArrowUp')
  await expect(page.getByTestId('picker-details')).toContainText('Invention')
  await page.keyboard.press('Enter')
  await expect(picker).toBeHidden()
  await expect(page.getByTestId('hud-title')).toContainText('Invention')
  expect(errors).toEqual([])
})

test('Esc closes the picker and returns focus; Library… opens the library', async ({ page }) => {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await page.getByTestId('open-picker').click()
  await expect(page.getByTestId('song-picker')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('song-picker')).toBeHidden()
  await expect(page.getByTestId('open-picker')).toBeFocused()

  await page.getByTestId('open-picker').click()
  await page.getByTestId('picker-search').fill('canon')
  await expect(page.getByTestId('picker-song')).toHaveCount(1)
  await page.getByTestId('open-library').click()
  await expect(page).toHaveURL(/#\/library$/)
  await expect(page.getByTestId('song-row').first()).toBeVisible()
  // The player's last frame is the library's backdrop.
  await expect(page.getByTestId('library-backdrop')).toHaveClass(/snapshot/)
})

test('the picker shows stored facts at once: hands, range, and meter changes with a popover', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/library')
  await page.getByTestId('upload-input').setInputFiles(METER_DEMO)
  await expect(page.getByTestId('upload-summary')).toHaveText('1 added')
  await page.getByTestId('song-row').filter({ hasText: 'Meter demo' }).click()
  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-title')).toHaveText('Meter demo')

  await page.getByTestId('open-picker').click()
  await expect(page.getByTestId('picker-notes')).toContainText('Right hand')
  await expect(page.getByTestId('picker-notes')).toContainText('notes')
  // The main meter plus a "+" that names the changes; no "N changes" text.
  await expect(page.getByTestId('picker-meter')).toHaveText('4/4+')
  const plus = page.getByTestId('meter-changes')
  await expect(plus).toHaveAccessibleName('4 meter changes')
  // Hover opens it after a short delay; leaving closes it.
  await plus.hover()
  await expect(page.getByTestId('meter-runs')).toBeVisible()
  await page.mouse.move(5, 5)
  await expect(page.getByTestId('meter-runs')).toBeHidden()
  // Click (or tap) opens it too.
  await plus.click()
  const runs = page.getByTestId('meter-runs').locator('li')
  await expect(runs).toHaveText([
    'bar 1 · 4/4',
    'bar 3 · 3/4',
    'bar 6 · 6/8',
    'bar 9 · 5/4',
    'bar 11 · 4/4',
  ])
  // Esc closes the meter popover only, not the picker.
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('meter-runs')).toBeHidden()
  await expect(page.getByTestId('song-picker')).toBeVisible()
  // Keyboard focus opens it; Esc closes it and the picker stays.
  await page.mouse.move(5, 5)
  await plus.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByTestId('meter-runs')).toBeHidden()
  await page.keyboard.press('Tab')
  await expect(plus).toBeFocused()
  await expect(plus).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByTestId('meter-runs')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('meter-runs')).toBeHidden()
  await expect(page.getByTestId('song-picker')).toBeVisible()
  // A bundled song shows its facts too, without being opened.
  await page.getByTestId('picker-song').filter({ hasText: 'Minuet' }).click()
  await expect(page.getByTestId('picker-notes')).toContainText('258 notes')
  await expect(page.getByTestId('picker-notes')).toContainText('G2–B5')
  expect(errors).toEqual([])
})

test('uploads stored with old-shape facts are brought up to date in the background', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/library')
  await page.getByTestId('upload-input').setInputFiles(METER_DEMO)
  await expect(page.getByTestId('upload-summary')).toHaveText('1 added')
  // Rewrite the stored upload as an older version stored it: no facts version, channel stats
  // or meter summary (what a database upgraded before those fields existed still holds).
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('pianomeister')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const store = db.transaction('uploads', 'readwrite').objectStore('uploads')
          const cursor = store.openCursor()
          cursor.onsuccess = () => {
            const row = cursor.result
            if (row === null) {
              db.close()
              resolve()
              return
            }
            const { factsVersion, channels, meter, ...oldFacts } = row.value.facts
            void [factsVersion, channels, meter]
            row.update({ ...row.value, facts: oldFacts })
            row.continue()
          }
        }
      }),
  )
  await page.goto('./#/')
  await page.reload()
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await page.getByTestId('open-picker').click()
  await page.getByTestId('picker-song').filter({ hasText: 'Meter demo' }).click()
  // Recomputed on load: hand counts, range and meter changes appear without opening the song.
  await expect(page.getByTestId('picker-notes')).toContainText('Right hand')
  await expect(page.getByTestId('picker-notes')).toContainText(/\d+ notes/)
  await expect(page.getByTestId('picker-meter')).toHaveText('4/4+')
  expect(errors).toEqual([])
})

test('the picker sorts songs by last practiced by default, and by plays, time and bookmarks', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await seedPractice(page, sortingHistory(Date.now()))
  await page.getByTestId('open-picker').click()
  const titles = page.getByTestId('picker-song').locator('.title')
  await expect(titles).toHaveText([/^Invention/, /^Canon/, /^Minuet/])
  await page.getByTestId('picker-sort-plays').click()
  await expect(titles).toHaveText([/^Canon/, /^Invention/, /^Minuet/])
  await page.getByTestId('picker-sort-time').click()
  await expect(titles).toHaveText([/^Canon/, /^Invention/, /^Minuet/])
  await page.getByTestId('picker-sort-bookmarks').click()
  await expect(titles.first()).toHaveText(/^Invention/)
  await page.getByTestId('picker-sort-title').click()
  await expect(titles).toHaveText([/^Canon/, /^Invention/, /^Minuet/])

  // The Load list: Full song pinned, then the song's bookmarks; its headers sort them.
  await page.getByTestId('picker-song').filter({ hasText: 'Invention' }).click()
  await expect(page.getByTestId('picker-full-song')).toBeVisible()
  await expect(page.getByTestId('picker-bookmark')).toHaveCount(2)
  await expect(page.getByTestId('picker-entry-name')).toHaveText('Full song')
  await expect(page.getByTestId('picker-entry-share')).toHaveText('100%')
  // Shift+↓ moves the Load list (the side list, decision 90).
  await page.keyboard.press('Shift+ArrowDown')
  await expect(page.getByTestId('picker-entry-name')).toHaveText('Opening')
  await expect(page.getByTestId('picker-load')).toHaveText('Load bookmark')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('hud-bookmark')).toHaveText('Opening')
  expect(errors).toEqual([])
})
