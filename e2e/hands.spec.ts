import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { writeMidiFile } from '../src/core/midi/writeMidiFile'
import { demoCombined, demoMidi } from '../src/core/testing/handDemos'
import { choose, readStore, setting, SONG_IDS, watchErrors } from './support'

/** Both hands on one channel, wide apart: detected as two hands with confidence. */
const TWO_HANDS = Buffer.from(writeMidiFile(demoCombined()))
/** One line around middle C: it could be either hand's. */
const AMBIGUOUS = Buffer.from(
  writeMidiFile(
    demoMidi.file([
      demoMidi.notes(
        Array.from({ length: 40 }, (_, i) => ({
          midi: 58 + ((i * 3) % 7),
          start: i * 240,
          length: 200,
        })),
        0,
      ),
    ]),
  ),
)

async function upload(page: Page, name: string, buffer: Buffer): Promise<void> {
  await page.goto('./#/library')
  await page
    .getByTestId('upload-input')
    .setInputFiles([{ name: `${name}.mid`, mimeType: 'audio/midi', buffer }])
  await row(page, name).click()
}

const row = (page: Page, title: string) => page.getByTestId('song-row').filter({ hasText: title })
const badge = (page: Page) => page.getByTestId('hands-badge')

async function cageCounts(page: Page): Promise<{ right: number; left: number } | null> {
  return page.evaluate(() => {
    const hook = window as unknown as {
      pianomeisterCages?: () => { right: { count: number }; left: { count: number } } | null
    }
    const cages = hook.pianomeisterCages?.() ?? null
    return cages === null ? null : { right: cages.right.count, left: cages.left.count }
  })
}

test('@hands @smoke an upload with both hands on one channel is split, and its cages follow', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await upload(page, 'Demo', TWO_HANDS)
  await expect(badge(page)).toHaveText(/^(Detected|Check) · \d+ %$/)
  await expect(page.getByTestId('hand-voice-1:3')).toHaveText('Split')
  await expect(page.getByTestId('hands-split')).toContainText('Split with Phrase look-ahead')
  await expect(page.getByTestId('hands-counts')).toHaveText(/Right \d+ notes.*Left \d+ notes/)
  await expect(page.getByTestId('hands-reasons')).toBeHidden()
  await page.getByTestId('hands-why').click()
  await expect(page.getByTestId('hands-reasons')).toContainText('span more than one hand can reach')

  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-hands')).toHaveText(/^R [1-9]\d* notes · L [1-9]\d* notes$/)
  // The cage hook is there with ?stats=1 only; the player reopens the last song.
  await page.goto('./#/?stats=1')
  await page.reload()
  await expect(page.getByTestId('hud-title')).toHaveText('Demo')
  await expect.poll(async () => (await cageCounts(page))?.right ?? 0).toBeGreaterThan(0)
  const split = await cageCounts(page)
  expect(split?.left).toBeGreaterThan(0)

  // The player's role applies at once, and to the cages.
  await page.goto('./#/library')
  await row(page, 'Demo').click()
  await choose(page, page.getByTestId('hand-voice-1:3'), 'Left')
  await expect(badge(page)).toHaveText('Edited')
  await page.goto('./#/?stats=1')
  await expect(page.getByTestId('hud-hands')).toHaveText(/^R 0 notes · L \d+ notes$/)
  await expect.poll(async () => (await cageCounts(page))?.right).toBe(0)
  expect(errors).toEqual([])
})

test('@hands roles survive a reload, and Hidden everywhere says so', async ({ page }) => {
  await upload(page, 'Demo', TWO_HANDS)
  await expect(badge(page)).toHaveText(/%$/)
  await choose(page, page.getByTestId('hand-voice-1:3'), 'Hidden')
  await expect(page.getByTestId('hands-warning')).toHaveText('No hand is shown')
  await page.reload()
  await row(page, 'Demo').click()
  await expect(badge(page)).toHaveText('Edited')
  await expect(page.getByTestId('hand-voice-1:3')).toHaveText('Hidden')
})

test('@hands @library an unsure detection shows Check hands until the player decides', async ({
  page,
}) => {
  await upload(page, 'Ambiguous', AMBIGUOUS)
  await expect(badge(page)).toHaveText('Check · 30 %')
  await expect(row(page, 'Ambiguous').getByTestId('song-row-hint')).toHaveText('Check hands · 30 %')
  await choose(page, page.getByTestId('hand-voice-0:0'), 'Right')
  await expect(badge(page)).toHaveText('Edited')
  await expect(row(page, 'Ambiguous').getByTestId('song-row-hint')).toBeHidden()
})

test('@hands @settings without detection on upload the song keeps its channels until asked', async ({
  page,
}) => {
  await page.goto('./#/library')
  await page.getByTestId('song-row').first().waitFor()
  await page.goto('./#/')
  await page.getByTestId('hud-title').waitFor()
  await page.keyboard.press(',')
  await page.getByTestId('tab-library').click()
  await setting(page, 'hands.detectOnUpload').getByRole('checkbox').uncheck()
  await page.getByTestId('close-settings').click()
  await upload(page, 'Demo', TWO_HANDS)
  await expect(badge(page)).toHaveText('Not detected')
  await expect(page.getByTestId('hand-voice-1:3')).toHaveText('Right')
  await page.getByTestId('hands-detect').click()
  await expect(badge(page)).toHaveText(/%$/)
  await expect(page.getByTestId('hand-voice-1:3')).toHaveText('Split')
})

test('@hands songs from an older version are detected in the background; own hands stay', async ({
  page,
}) => {
  await page.goto('./#/library')
  await page.getByTestId('song-row').first().waitFor()
  await expect.poll(async () => (await readStore(page, 'handDetections')).length).toBe(3)
  // As a database from before this version: no detections, and the player's own channel map.
  await page.evaluate(
    (minuet) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('pianomeister')
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction(['handDetections', 'handAssignments', 'appState'], 'readwrite')
          tx.objectStore('handDetections').clear()
          tx.objectStore('appState').delete('handsPass')
          tx.objectStore('appState').delete('newAt')
          tx.objectStore('handAssignments').put({
            profileId: 'default',
            songId: minuet,
            hands: { right: [1], left: [0] },
          })
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    SONG_IDS.minuet,
  )
  await page.reload()
  await expect(page.getByTestId('toast')).toContainText('Hands detected for 2 songs · 0 to check')
  await row(page, 'Minuet in G').click()
  await expect(badge(page)).toHaveText('Edited')
  await expect(page.getByTestId('hand-voice-0:0')).toHaveText('Left')
  await expect(page.getByTestId('hand-voice-1:1')).toHaveText('Right')
  await row(page, 'Canon in D').click()
  await expect(badge(page)).toHaveText('Detected · 90 %')
})
