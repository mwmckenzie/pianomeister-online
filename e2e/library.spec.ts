import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { test, expect, type Page } from '@playwright/test'
import { strFromU8, unzipSync } from 'fflate'

import { choose, watchErrors } from './support'

const PEDAL_DEMO = fileURLToPath(new URL('../test-fixtures/midi/pedal-demo.mid', import.meta.url))
const MINUET = fileURLToPath(new URL('../public/songs/minuet-in-g.mid', import.meta.url))

const row = (page: Page, title: string) => page.getByTestId('song-row').filter({ hasText: title })

async function uploadPedalDemo(page: Page) {
  await page.goto('./#/library')
  await page.getByTestId('upload-input').setInputFiles(PEDAL_DEMO)
  await expect(page.getByTestId('upload-summary')).toHaveText('1 added')
  await expect(row(page, 'Pedal demo')).toBeVisible()
}

test('uploads a MIDI file, and reports duplicates and rejected files', async ({ page }) => {
  const errors = watchErrors(page)
  await uploadPedalDemo(page)
  // The source shows in the filter counts and the details panel, not in the row.
  await expect(row(page, 'Pedal demo')).not.toContainText('uploaded')
  await expect(page.getByTestId('source-uploaded')).toContainText('1')
  await row(page, 'Pedal demo').click()
  await expect(page.getByTestId('details-source')).toHaveText('Uploaded · pedal-demo.mid')
  await expect(page.getByTestId('storage-status')).toContainText('Storage:')

  await page.getByTestId('upload-input').setInputFiles([
    // Playwright can't mix paths and buffers in one call.
    { name: 'pedal-demo.mid', mimeType: 'audio/midi', buffer: readFileSync(PEDAL_DEMO) },
    { name: 'minuet-in-g.mid', mimeType: 'audio/midi', buffer: readFileSync(MINUET) },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not music') },
    { name: 'bad.mid', mimeType: 'audio/midi', buffer: Buffer.from('MThd but not really') },
  ])
  await expect(page.getByTestId('upload-summary')).toHaveText(
    '0 added, 2 duplicate, 2 rejected — not a MIDI file (.mid or .midi); not a readable MIDI file',
  )
  await expect(page.getByTestId('song-row')).toHaveCount(4)
  expect(errors).toEqual([])
})

test('uploads files dropped anywhere on the page, with a drop overlay', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/library')
  await expect(page.getByTestId('song-row')).toHaveCount(3)
  const bytes = [...readFileSync(PEDAL_DEMO)]
  const dataTransfer = await page.evaluateHandle((data) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([new Uint8Array(data)], 'dropped.mid', { type: 'audio/midi' }))
    return transfer
  }, bytes)
  await page.locator('main').dispatchEvent('dragenter', { dataTransfer })
  await expect(page.getByTestId('drop-overlay')).toBeVisible()
  await page.locator('main').dispatchEvent('drop', { dataTransfer })
  await expect(page.getByTestId('drop-overlay')).toBeHidden()
  await expect(page.getByTestId('upload-summary')).toHaveText('1 added')
  await expect(row(page, 'Pedal demo')).toBeVisible()
  expect(errors).toEqual([])
})

test('edits title, composer and tags; they persist and are searchable', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/library')
  await row(page, 'Canon in D').click()
  await page.getByTestId('meta-title').fill('Canon (practice)')
  await page.getByTestId('meta-title').press('Tab')
  // Enter saves too; the field then shows the stored (trimmed) value.
  await page.getByTestId('meta-composer').fill('  Pachelbel, Johann  ')
  await page.getByTestId('meta-composer').press('Enter')
  await expect(page.getByTestId('meta-composer')).toHaveValue('Pachelbel, Johann')
  await page.getByTestId('tag-input').fill('wedding')
  await page.getByTestId('tag-input').press('Enter')
  // Tags aren't shown in the rows (m6); they appear as a filter.
  await expect(page.getByTestId('tag-filter-wedding')).toBeVisible()

  await page.reload()
  await expect(row(page, 'Canon (practice)')).toContainText('Pachelbel, Johann')
  await expect(page.getByTestId('tag-filter-wedding')).toBeVisible()

  await page.getByTestId('search').fill('pachelbel johann')
  await expect(page.getByTestId('song-row')).toHaveCount(1)
  await page.getByTestId('search').fill('')
  await page.getByTestId('tag-filter-wedding').click()
  await expect(page.getByTestId('song-row')).toHaveCount(1)
  await expect(page.getByTestId('song-row')).toContainText('Canon (practice)')

  await row(page, 'Canon (practice)').click()
  await page.getByTestId('meta-reset').click()
  await expect(row(page, 'Canon in D')).toBeVisible()
  expect(errors).toEqual([])
})

test('hand channels and a meter override carry over to the player', async ({ page }) => {
  const errors = watchErrors(page)
  await uploadPedalDemo(page)
  await row(page, 'Pedal demo').click()
  await choose(page, page.getByTestId('hand-ch1'), 'Hidden')
  await page.getByTestId('edit-meter').click()
  await page.getByTestId('override-numerator').fill('3')
  await expect(page.getByTestId('override-preview')).toContainText('11 bars')
  await page.getByRole('button', { name: 'Save meter' }).click()
  await expect(page.getByTestId('meter-line')).toContainText('3/4 override')
  await expect(row(page, 'Pedal demo')).toContainText('11')

  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-title')).toHaveText('Pedal demo')
  await expect(page.getByTestId('hud-hands')).toHaveText('R ch0 · L –')
  await expect(page.getByTestId('hud-bars')).toHaveText('11')
  await page.getByRole('button', { name: 'Next bar' }).click()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('2:1')
  // 84 BPM, 3/4: bar 2 starts after 3 beats ≈ 2.1 s.
  await expect(page.getByTestId('hud-position')).toHaveText('0:02')
  expect(errors).toEqual([])
})

/** Simulates storage failing (e.g. quota exceeded) for every write until the page reloads. */
async function failStorageWrites(page: Page) {
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('Simulated storage failure', 'QuotaExceededError')
    }
  })
}

const HAND_LABEL: Record<string, string> = { right: 'Right', left: 'Left', hidden: 'Hidden' }

async function expectHands(page: Page, ch0: string, ch1: string) {
  await expect(page.getByTestId('hand-ch0')).toHaveText(HAND_LABEL[ch0] ?? ch0)
  await expect(page.getByTestId('hand-ch1')).toHaveText(HAND_LABEL[ch1] ?? ch1)
}

async function reopenDetails(page: Page, title: string) {
  await page.reload()
  await row(page, title).click()
  await expect(page.getByTestId('hand-ch0')).toBeVisible()
}

test('swap hands, per-channel changes and restore default persist', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/library')
  await row(page, 'Canon in D').click()
  await expectHands(page, 'right', 'left')

  await page.getByRole('button', { name: 'Swap hands' }).click()
  await expectHands(page, 'left', 'right')
  await reopenDetails(page, 'Canon in D')
  await expectHands(page, 'left', 'right')

  await choose(page, page.getByTestId('hand-ch1'), 'Hidden')
  await expectHands(page, 'left', 'hidden')
  await reopenDetails(page, 'Canon in D')
  await expectHands(page, 'left', 'hidden')

  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-hands')).toHaveText('R – · L ch0')
  await page.getByTestId('open-picker').click()
  await page.getByTestId('open-library').click()
  await row(page, 'Canon in D').click()

  await page.getByRole('button', { name: 'Restore default' }).click()
  await expectHands(page, 'right', 'left')
  await reopenDetails(page, 'Canon in D')
  await expectHands(page, 'right', 'left')
  await expect(page.getByRole('button', { name: 'Restore default' })).toBeDisabled()

  await expect(page.getByTestId('details-error')).toBeHidden()
  expect(errors).toEqual([])
})

test('a failed save is shown, logged, and undone in the panel', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/library')
  await row(page, 'Canon in D').click()
  await expectHands(page, 'right', 'left')
  await failStorageWrites(page)
  await page.getByRole('button', { name: 'Swap hands' }).click()
  await expect(page.getByTestId('details-error')).toContainText("Couldn't save the hand channels")
  await expectHands(page, 'right', 'left')
  // A per-channel change that fails snaps back to the stored hand.
  await page.getByTestId('hand-ch1').click()
  await page.getByRole('option', { name: 'Hidden', exact: true }).click()
  await expectHands(page, 'right', 'left')
  expect(errors.filter((e) => e.includes("Couldn't save the hand channels"))).toHaveLength(2)
  await page.getByRole('button', { name: 'Dismiss error' }).first().click()
  await expect(page.getByTestId('details-error')).toBeHidden()
})

test('a failed title or composer save shows the error and restores the field', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/library')
  await row(page, 'Canon in D').click()
  await expect(page.getByTestId('meta-title')).toHaveValue('Canon in D')
  await failStorageWrites(page)

  await page.getByTestId('meta-title').fill('Renamed')
  await page.getByTestId('meta-title').press('Tab')
  await expect(page.getByTestId('details-error')).toContainText("Couldn't save the song details")
  await expect(page.getByTestId('meta-title')).toHaveValue('Canon in D')

  await page.getByTestId('meta-composer').fill('Someone else')
  await page.getByTestId('meta-composer').press('Enter')
  await expect(page.getByTestId('meta-composer')).toHaveValue('Johann Pachelbel')
  await expect(row(page, 'Canon in D')).toContainText('Johann Pachelbel')
  expect(errors.filter((e) => e.includes("Couldn't save the song details"))).toHaveLength(2)

  await page.reload()
  await row(page, 'Canon in D').click()
  await expect(page.getByTestId('meta-title')).toHaveValue('Canon in D')
  await expect(page.getByTestId('meta-composer')).toHaveValue('Johann Pachelbel')
})

test('the player reopens the last opened song after a reload', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await page.getByTestId('open-picker').click()
  await page.getByTestId('open-library').click()
  await row(page, 'Canon in D').click()
  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-title')).toHaveText('Canon in D')
  await page.reload()
  await expect(page.getByTestId('hud-title')).toHaveText('Canon in D')
  expect(errors).toEqual([])
})

test('exports, deletes and re-imports an upload with its metadata', async ({ page }) => {
  const errors = watchErrors(page)
  await uploadPedalDemo(page)
  await row(page, 'Pedal demo').click()
  await page.getByTestId('meta-title').fill('Pedal study')
  await page.getByTestId('meta-title').press('Tab')
  await expect(row(page, 'Pedal study')).toBeVisible()

  const downloading = page.waitForEvent('download')
  await page.getByTestId('export').click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^pianomeister-library-.*\.zip$/)
  const zip = unzipSync(new Uint8Array(readFileSync(await download.path())))
  expect(Object.keys(zip).sort()).toEqual(['library.json', 'uploads/pedal-demo.mid'])
  const doc = JSON.parse(strFromU8(zip['library.json'] ?? new Uint8Array())) as {
    meta: Record<string, { title?: string }>
  }
  expect(Object.values(doc.meta)).toEqual([{ title: 'Pedal study' }])

  await row(page, 'Pedal study').click()
  await page.getByTestId('delete-upload').click()
  await page.getByTestId('confirm-delete').click()
  await expect(page.getByTestId('song-row')).toHaveCount(3)

  await page.getByTestId('import-input').setInputFiles(await download.path())
  await expect(page.getByTestId('import-summary')).toContainText('Imported: 1 added')
  await expect(row(page, 'Pedal study')).toBeVisible()
  expect(errors).toEqual([])
})

test('the details panel always shows a song; headers sort, including by date added', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await page.goto('./#/library')
  // Opened directly, there's no player frame: the static backdrop.
  await expect(page.getByTestId('library-backdrop')).not.toHaveClass(/snapshot/)
  // The first row is selected and its details are shown.
  await expect(page.getByTestId('song-row').first()).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('song-details')).toBeVisible()
  await expect(page.getByTestId('meta-title')).toHaveValue('Canon in D')

  // ↓ moves the selection.
  await page.getByTestId('song-row').first().click()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('meta-title')).toHaveValue(/^Invention No. 1/)

  await page.getByTestId('upload-input').setInputFiles(PEDAL_DEMO)
  await expect(page.getByTestId('upload-summary')).toHaveText('1 added')
  await expect(row(page, 'Pedal demo')).toContainText('Today')
  await page.getByTestId('sort-dateAdded').click()
  await expect(page.locator('[aria-sort="descending"]')).toContainText('Added')
  await expect(page.getByTestId('song-row').first()).toContainText('Pedal demo')
  await page.getByTestId('sort-bars').click()
  await expect(page.locator('[aria-sort="ascending"]')).toContainText('Bars')

  // Filtering out the selected song moves the selection to a visible one.
  await page.getByTestId('source-bundled').click()
  await expect(page.getByTestId('song-details')).toBeVisible()
  await expect(row(page, 'Pedal demo')).toBeHidden()
  await expect(page.locator('[data-testid="song-row"][aria-selected="true"]')).toHaveCount(1)
  expect(errors).toEqual([])
})
