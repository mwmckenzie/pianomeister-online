import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { readStore, seedPractice, SONG_IDS, watchErrors } from './support'

/** A bookmark row for Minuet in G, written straight into the database. */
function bookmark(id: string, name: string, profileId = 'default') {
  return {
    id,
    profileId,
    songId: SONG_IDS.minuet,
    name,
    config: {
      loop: { startBar: 1, endBar: 4 },
      tempoPercent: 100,
      handAudio: { right: 'on', left: 'on' },
      preRollBeats: 0,
      preRollMode: 'muted',
    },
    createdAt: 1,
    updatedAt: 1,
  }
}

async function exportBackup(page: Page): Promise<string> {
  const downloading = page.waitForEvent('download')
  await page.getByTestId('export').click()
  return (await downloading).path()
}

async function importBackup(page: Page, path: string): Promise<void> {
  await page.getByTestId('import-input').setInputFiles(path)
}

async function bookmarkNames(page: Page, profileId = 'default'): Promise<string[]> {
  const rows = await readStore<{ profileId: string; name: string }>(page, 'bookmarks')
  return rows
    .filter((b) => b.profileId === profileId)
    .map((b) => b.name)
    .sort()
}

/**
 * The backup holds Me with bookmark "A"; this device's Me then has "B" and "C" instead. Returns
 * the backup's path, with the library page open.
 */
async function divergedMe(page: Page): Promise<string> {
  await page.goto('./#/library')
  await expect(page.getByTestId('song-row').first()).toBeVisible()
  await seedPractice(page, { bookmarks: [bookmark('a', 'A')] })
  const path = await exportBackup(page)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('pianomeister')
        open.onsuccess = () => {
          const tx = open.result.transaction('bookmarks', 'readwrite')
          tx.objectStore('bookmarks').clear()
          tx.oncomplete = () => {
            open.result.close()
            resolve()
          }
        }
      }),
  )
  await seedPractice(page, { bookmarks: [bookmark('b', 'B'), bookmark('c', 'C')] })
  await expect(page.getByTestId('song-row').first()).toBeVisible()
  return path
}

const MERGE =
  'Adds the backup\'s bookmarks and practice history to your existing profile. Nothing on this device is changed or removed. Afterwards "Me" has 3 bookmarks.'
const ADD_NEW =
  'Keeps your profile as it is and adds the backup as a separate profile named "Me (imported)". You can rename it later.'
const REPLACE =
  "Deletes this device's \"Me\" bookmarks (2) and practice history (none), then uses the backup's version instead. This can't be undone."

async function expectDialogWording(page: Page): Promise<void> {
  const dialog = page.getByTestId('profile-collision')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading')).toHaveText('A profile named "Me" already exists')
  await expect(page.getByTestId('collision-intro')).toHaveText(
    'The backup contains a profile that matches one on this device. Choose what to do with it.',
  )
  await expect(page.getByTestId('collision-local')).toHaveText(
    'On this device: Me · 2 bookmarks · no practice time · not practiced yet',
  )
  await expect(page.getByTestId('collision-incoming')).toHaveText(
    'In the backup: Me · 1 bookmark · no practice time · not practiced yet',
  )
  await expect(page.getByTestId('collision-merge')).toContainText('Merge into "Me"')
  await expect(page.getByTestId('collision-merge-result')).toHaveText(MERGE)
  await expect(page.getByTestId('collision-addNew')).toContainText('Add as a new profile')
  await expect(page.getByTestId('collision-addNew-result')).toHaveText(ADD_NEW)
  await expect(page.getByTestId('collision-replace')).toContainText('Replace "Me"')
  await expect(page.getByTestId('collision-replace-result')).toHaveText(REPLACE)
  // Same name: Merge is chosen, the button just imports.
  await expect(page.getByTestId('collision-merge')).toHaveClass(/selected/)
  await expect(page.getByTestId('collision-confirm')).toHaveText('Import')
  await expect(page.getByTestId('collision-warning')).toBeHidden()
}

const toast = (page: Page, text: string) => page.getByTestId('toast').filter({ hasText: text })

test('import, Merge: adds the backup bookmarks to Me, as the dialog says', async ({ page }) => {
  const errors = watchErrors(page)
  const path = await divergedMe(page)
  await importBackup(page, path)
  await expectDialogWording(page)
  await page.getByTestId('collision-confirm').click()
  await expect(toast(page, 'Imported: merged into Me (+1 bookmark).')).toBeVisible()
  expect(await bookmarkNames(page)).toEqual(['A', 'B', 'C'])
  expect(errors).toEqual([])
})

test('import, Add as a new profile: "Me (imported)" with the backup bookmarks; Me unchanged', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const path = await divergedMe(page)
  await importBackup(page, path)
  await expectDialogWording(page)
  await page.getByTestId('collision-addNew').click()
  await expect(page.getByTestId('collision-confirm')).toHaveText('Import')
  await page.getByTestId('collision-confirm').click()
  await expect(toast(page, 'Imported: added 1 new profile.')).toBeVisible()
  expect(await bookmarkNames(page)).toEqual(['B', 'C'])
  const profiles = await readStore<{ id: string; name: string }>(page, 'profiles')
  const imported = profiles.find((p) => p.name === 'Me (imported)')
  expect(imported).toBeDefined()
  expect(await bookmarkNames(page, imported?.id)).toEqual(['A'])
  expect(errors).toEqual([])
})

test('import, Replace: warns, offers an export first, then Me has only the backup bookmarks', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const path = await divergedMe(page)
  await importBackup(page, path)
  await expectDialogWording(page)
  await page.getByTestId('collision-replace').click()
  await expect(page.getByTestId('collision-warning')).toBeVisible()
  await expect(page.getByTestId('collision-export')).toHaveText('Export current data first')
  await expect(page.getByTestId('collision-confirm')).toHaveText('Replace and import')
  // "Export current data first" downloads a backup without leaving the dialog.
  const downloading = page.waitForEvent('download')
  await page.getByTestId('collision-export').click()
  expect((await downloading).suggestedFilename()).toMatch(/^pianomeister-library-.*\.zip$/)
  await expect(page.getByTestId('profile-collision')).toBeVisible()
  await page.getByTestId('collision-confirm').click()
  await expect(toast(page, 'Imported: replaced Me.')).toBeVisible()
  expect(await bookmarkNames(page)).toEqual(['A'])
  expect(errors).toEqual([])
})

test('Cancel import writes nothing; several collisions are asked one by one', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/library')
  await expect(page.getByTestId('song-row').first()).toBeVisible()
  await seedPractice(page, {
    profiles: [{ id: 'anna', name: 'Anna', color: '#FFB38A', createdAt: 5 }],
    bookmarks: [bookmark('a', 'A'), bookmark('x', 'X', 'anna')],
  })
  const path = await exportBackup(page)
  await seedPractice(page, { bookmarks: [bookmark('b', 'B')] })

  await importBackup(page, path)
  await expect(page.getByTestId('collision-step')).toHaveText('1 of 2')
  await page.getByTestId('collision-cancel').click()
  await expect(page.getByTestId('profile-collision')).toBeHidden()
  await expect(page.getByTestId('import-summary')).toBeHidden()
  expect(await bookmarkNames(page)).toEqual(['A', 'B'])
  expect(await readStore(page, 'profiles')).toHaveLength(2)

  // One step per collision, in the backup's order (Anna, then Me).
  await importBackup(page, path)
  await expect(page.getByTestId('collision-step')).toHaveText('1 of 2')
  await expect(page.getByTestId('collision-local')).toContainText('On this device: Anna')
  await page.getByTestId('collision-confirm').click()
  await expect(page.getByTestId('collision-step')).toHaveText('2 of 2')
  await expect(page.getByTestId('collision-local')).toContainText('On this device: Me')
  await page.getByTestId('collision-confirm').click()
  await expect(
    toast(page, 'Imported: merged into Anna (+0 bookmarks), merged into Me (+0 bookmarks).'),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('export, clear storage, import: bookmarks and stats come back; importing again adds no duplicates', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/library')
  await expect(page.getByTestId('song-row').first()).toBeVisible()
  const now = Date.now()
  await seedPractice(page, {
    bookmarks: [bookmark('a', 'A')],
    sessions: [{ id: 's1', profileId: 'default', startedAt: now - 60_000, endedAt: now }],
    playRecords: [
      {
        id: 'r1',
        profileId: 'default',
        sessionId: 's1',
        songId: SONG_IDS.minuet,
        bookmarkId: 'a',
        startedAt: now - 60_000,
        playedMs: 60_000,
        plays: 3,
      },
    ],
  })
  const path = await exportBackup(page)

  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('pianomeister')
        request.onsuccess = () => resolve()
        request.onblocked = () => resolve()
      }),
  )
  await page.reload()
  await expect(page.getByTestId('song-row').first()).toBeVisible()
  expect(await bookmarkNames(page)).toEqual([])

  for (let round = 0; round < 2; round++) {
    await importBackup(page, path)
    await page.getByTestId('collision-confirm').click()
    await expect(page.getByTestId('import-summary')).toBeVisible()
  }
  expect(await bookmarkNames(page)).toEqual(['A'])
  expect(await readStore(page, 'playRecords')).toHaveLength(1)
  await expect(
    page.getByTestId('song-row').filter({ hasText: 'Minuet in G' }).getByTestId('row-plays'),
  ).toHaveText('3')
  expect(errors).toEqual([])
})
