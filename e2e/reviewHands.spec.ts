import { readFileSync } from 'node:fs'

import { type Page } from '@playwright/test'

import { extractNotes } from '../src/core/hands/extractNotes'
import { readMidiFile } from '../src/core/midi/readMidiFile'
import { writeMidiFile } from '../src/core/midi/writeMidiFile'
import { demoCombined, demoMidi } from '../src/core/testing/handDemos'
import { expect, test } from './fixtures'
import { choose, readStore, watchErrors } from './support'

const TWO_HANDS = Buffer.from(writeMidiFile(demoCombined()))
const row = (page: Page, title: string) => page.getByTestId('song-row').filter({ hasText: title })
const note = (page: Page) => page.getByTestId('hand-note')
/** The keys of a hand's first cage, as the player computed them (?stats=1). */
const firstCage = (page: Page, hand: 'right' | 'left') =>
  page.evaluate((h) => {
    const hook = window as unknown as {
      pianomeisterCageBars?: () => Record<string, { low: number; high: number }[]> | null
    }
    const cage = hook.pianomeisterCageBars?.()?.[h]?.[0]
    return cage === undefined ? null : [cage.low, cage.high]
  }, hand)
const flips = (page: Page) => page.getByTestId('review-flips')

async function upload(page: Page, name: string, buffer = TWO_HANDS): Promise<void> {
  await page.goto('./#/library')
  await page
    .getByTestId('upload-input')
    .setInputFiles([{ name: `${name}.mid`, mimeType: 'audio/midi', buffer }])
  await row(page, name).click()
  await expect(page.getByTestId('hands-badge')).toHaveText(/%$/)
}

async function openReview(page: Page): Promise<void> {
  await upload(page, 'Demo')
  await page.getByTestId('hands-review').click()
  await expect(page.getByTestId('review-counts')).toHaveText(/Right [1-9]\d* notes/)
  await expect(page.getByTestId('review-song')).toHaveText('Demo')
}

interface FlipRow {
  readonly settings?: { readonly flips: Record<string, string>; readonly algorithm: string }
}

test('@hands @smoke Review hands: a flip is saved, survives a reload and reaches the cages', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openReview(page)
  const right = async () =>
    Number(/Right (\d+)/.exec((await page.getByTestId('review-counts').textContent()) ?? '')?.[1])
  const before = await right()
  // The first note is the lowest bass note of bar 1; flipped right, bar 1's right cage reaches it.
  await note(page).focus()
  await expect(note(page)).toHaveAccessibleName('C2, bar 1 beat 1: left hand. Click to flip.')
  await page.keyboard.press('Enter')
  await expect(note(page)).toHaveAccessibleName(
    'C2, bar 1 beat 1: right hand, flipped by you. Click to flip.',
  )
  await expect(flips(page)).toContainText('1 note flipped')
  expect(await right()).toBe(before + 1)
  await expect(page.getByTestId('review-dirty')).toBeVisible()
  await page.getByTestId('review-save').click()
  await expect(page.getByTestId('review-dirty')).toBeHidden()

  await page.reload()
  await expect(flips(page)).toContainText('1 note flipped')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('hands-badge')).toHaveText('Edited')
  await expect(row(page, 'Demo')).toHaveAttribute('aria-selected', 'true')

  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-hands')).toContainText(`R ${before + 1} notes`)
  // Bar 1's right cage now reaches down to the flipped C2 (36).
  await page.goto('./#/?stats=1')
  await page.reload()
  await expect.poll(async () => (await firstCage(page, 'right'))?.[0]).toBe(36)
  expect((await firstCage(page, 'left'))?.[0]).toBe(48)
  expect(errors).toEqual([])
})

test('@hands the notes lane is one Tab stop: arrows, Home, End, Space', async ({ page }) => {
  await openReview(page)
  await note(page).focus()
  const name = () => note(page).getAttribute('aria-label')
  const first = await name()
  await page.keyboard.press('ArrowRight')
  expect(await name()).not.toBe(first)
  await page.keyboard.press('ArrowLeft')
  expect(await name()).toBe(first)
  await page.keyboard.press('End')
  await expect(note(page)).toHaveAccessibleName(/^E5, bar 9 beat 1/)
  // The view followed the note to the end of the song.
  await expect(note(page)).toBeInViewport()
  await page.keyboard.press('Home')
  expect(await name()).toBe(first)
  // Flipping back removes the flip.
  await page.keyboard.press('Space')
  await expect(flips(page)).toContainText('1 note flipped')
  await page.keyboard.press('Space')
  await expect(flips(page)).toContainText('No flips')
  await page.keyboard.press('Tab')
  expect(await note(page).evaluate((el) => el === document.activeElement)).toBe(false)
})

test('@hands a click flips the note under the pointer; a drag pans instead', async ({ page }) => {
  await openReview(page)
  const box = await note(page).boundingBox()
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2
  await page.mouse.click(x, y)
  await expect(flips(page)).toContainText('1 note flipped')
  await page.mouse.click(x, y)
  await expect(flips(page)).toContainText('No flips')
  await page.mouse.move(x + 200, y)
  await page.mouse.down()
  await page.mouse.move(x + 40, y, { steps: 4 })
  await page.mouse.up()
  await expect(flips(page)).toContainText('No flips')
  const scrolled = () => page.getByTestId('review-scroller').evaluate((el) => el.scrollLeft)
  await page.getByTestId('review-zoom-in').click()
  await page.getByTestId('review-zoom-in').click()
  await page.mouse.move(x + 300, y)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 4 })
  await page.mouse.up()
  await expect.poll(scrolled).toBeGreaterThan(20)
})

test('@hands methods, parameters, compare and reset', async ({ page }) => {
  await openReview(page)
  const counts = page.getByTestId('review-counts')
  const detected = await counts.textContent()
  await choose(page, page.getByTestId('review-method'), 'Fixed split point')
  await page.getByTestId('review-advanced').click()
  await expect(page.getByTestId('review-value-split')).toHaveText('C4')
  const thumb = page.getByTestId('review-param-split').getByRole('slider')
  await thumb.press('End')
  await expect(page.getByTestId('review-value-split')).toHaveText('G9')
  await expect(counts).toHaveText(/Right 0 notes/)
  await page.getByTestId('review-reset-params').click()
  await expect(page.getByTestId('review-value-split')).toHaveText('C4')
  await thumb.press('End')
  await choose(page, page.getByTestId('review-compare'), 'Phrase look-ahead')
  await expect(page.getByTestId('review-compare-text')).toHaveText(
    /^Phrase look-ahead differs on [1-9]\d* notes \(dashed\)$/,
  )
  await note(page).focus()
  await page.keyboard.press('Enter')
  await expect(flips(page)).toContainText('1 note flipped')
  await page.getByTestId('review-clear').click()
  await expect(flips(page)).toContainText('No flips')

  await page.getByTestId('review-reset').click()
  await expect(page.getByTestId('review-method')).toHaveText('Phrase look-ahead (recommended)')
  await expect(page.getByTestId('review-compare')).toHaveText('Nothing')
  await expect(counts).toHaveText(detected ?? '')
  // Reset alone saves nothing.
  expect(await readStore(page, 'handAssignments')).toEqual([])
  // Saving what was detected makes it the player's, without changes to save before.
  await expect(page.getByTestId('review-dirty')).toBeHidden()
  await page.getByTestId('review-save').click()
  await expect.poll(async () => (await readStore<FlipRow>(page, 'handAssignments')).length).toBe(1)
})

test('@hands leaving with changes asks first', async ({ page }) => {
  await openReview(page)
  await choose(page, page.getByTestId('review-voice-1:3'), 'Left')
  await expect(page.getByTestId('review-dirty')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByTestId('review-keep').click()
  await expect(page.getByTestId('review-voice-1:3')).toHaveText('Left')
  // Esc in the question keeps editing too.
  await page.getByTestId('review-back').click()
  await expect(page.getByTestId('review-discard')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('review-discard')).toBeHidden()
  await expect(page.getByTestId('review-hands')).toBeVisible()
  await page.getByTestId('review-back').click()
  await page.getByTestId('review-discard').click()
  await expect(page.getByTestId('hands-badge')).toHaveText(/%$/)
  await expect(page.getByTestId('hand-voice-1:3')).toHaveText('Split')
  // Esc right after Save waits for the save instead of asking.
  await page.getByTestId('hands-review').click()
  await choose(page, page.getByTestId('review-voice-1:3'), 'Left')
  await page.getByTestId('review-save').click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('hands-badge')).toHaveText('Edited')
})

test('@hands export split downloads a file with the hands on their channels', async ({ page }) => {
  await upload(page, 'Demo')
  await page.getByTestId('hands-export').click()
  const downloading = page.waitForEvent('download')
  await page.getByTestId('export-split-confirm').click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('Demo (hands).mid')
  const after = extractNotes(readMidiFile(new Uint8Array(readFileSync(await download.path()))))
  const before = extractNotes(readMidiFile(new Uint8Array(TWO_HANDS)))
  expect(after).toHaveLength(before.length)
  expect([...new Set(after.map((n) => n.channel))].sort()).toEqual([0, 1])
  // The stored song is unchanged.
  await expect(page.getByTestId('hands-badge')).toHaveText(/%$/)
  await expect(page.getByTestId('hand-voice-1:3')).toBeVisible()
})

test('@hands @library the Export menu splits the selected song, with warnings', async ({
  page,
}) => {
  const line = (midi: number) =>
    Array.from({ length: 30 }, (_, i) => ({ midi: midi + (i % 5), start: i * 240, length: 200 }))
  const file = demoMidi.file([
    [demoMidi.name('Trio')],
    [demoMidi.name('Right'), ...demoMidi.notes(line(72), 4)],
    [demoMidi.name('Left'), ...demoMidi.notes(line(45), 5)],
    [demoMidi.name('Flute'), ...demoMidi.notes(line(60), 1)],
  ])
  await upload(page, 'Trio', Buffer.from(writeMidiFile(file)))
  await choose(page, page.getByTestId('hand-voice-3:1'), 'Hidden')
  await expect(page.getByTestId('hands-badge')).toHaveText('Edited')
  await page.getByTestId('export').click()
  await page.getByTestId('export-split').click()
  const warnings = page.getByTestId('export-warning')
  await expect(warnings).toHaveText(['Track 3 · ch 1 would mix with the left hand'])
  await choose(page, page.getByTestId('export-left'), '0')
  await expect(warnings).toHaveText(['Both hands would be on channel 0'])
  await choose(page, page.getByTestId('export-left'), '2')
  await expect(warnings).toHaveCount(0)
  await page.getByTestId('export-layout').getByText('Two tracks').click()
  const downloading = page.waitForEvent('download')
  await page.getByTestId('export-split-confirm').click()
  const path = await (await downloading).path()
  const out = extractNotes(readMidiFile(new Uint8Array(readFileSync(path))))
  const tracks = (channel: number) => [
    ...new Set(out.filter((n) => n.channel === channel).map((n) => n.track)),
  ]
  expect([tracks(0), tracks(2), tracks(1)]).toEqual([[4], [5], [3]])
})
