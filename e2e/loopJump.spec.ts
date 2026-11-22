import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { readStore, seedBookmark, seedPractice, SONG_IDS, watchErrors } from './support'

/**
 * Brief decision 8: every committed loop change moves the playhead to the new loop start —
 * while playing it plays on from there (pre-roll first), while paused it parks there. Each
 * trigger is checked both ways, starting from bar 1–2, far before the loop (bars 40–44).
 */

type State = 'playing' | 'paused'

const LOOP_40 = { startBar: 40, endBar: 44 }

const barNow = async (page: Page): Promise<number> =>
  Number.parseInt((await page.getByTestId('hud-bar-beat').textContent()) ?? '0', 10)

async function openPlayer(page: Page, seed?: { bookmark?: boolean; loaded?: boolean }) {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  if (seed?.bookmark === true) {
    await seedPractice(page, {
      bookmarks: [seedBookmark('b40', 'Bars 40 to 44', LOOP_40)],
      appState:
        seed.loaded === true
          ? [
              {
                key: 'lastOpened:default',
                value: JSON.stringify({ songId: SONG_IDS.minuet, bookmarkId: 'b40' }),
              },
            ]
          : [],
    })
    await expect(page.getByTestId('hud-bars')).toHaveText('64')
  }
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
}

/** A loop on (the playhead jumps to its start). */
async function setLoop(page: Page, from: number, to: number): Promise<void> {
  await page.getByTestId('open-loop').click()
  await page.getByTestId('loop-from').fill(String(from))
  await page.getByTestId('loop-from').press('Enter')
  await page.getByTestId('loop-to').fill(String(to))
  await page.getByTestId('loop-to').press('Enter')
  await page.getByTestId('loop-set').click()
  await expect(page.getByTestId('loop-value')).toHaveText(`bars ${from}–${to}`)
  await page.keyboard.press('Escape')
}

/** Loop bars 40–44 on. */
const loopFrom40 = (page: Page) => setLoop(page, 40, 44)

/**
 * The playhead to `bar` by a timeline click (with a loop on, decision 8: a bar inside it), then
 * playing, or played briefly and paused. Tests that need room between the playhead and the jump
 * target use a wide loop (bars 10–44) and start inside it.
 */
async function enter(page: Page, state: State, bar = 1): Promise<void> {
  const box = await page.getByTestId('timeline').boundingBox()
  if (box === null) throw new Error('No timeline')
  await page.mouse.click(box.x + ((bar - 0.5) / 64) * box.width, box.y + box.height / 2)
  await expect(page.getByTestId('hud-bar-beat')).toHaveText(`${bar}:1`)
  await page.getByTestId('play-pause').click()
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  if (state === 'paused') {
    await page.getByTestId('play-pause').click()
    await expect(page.getByTestId('transport-state')).toHaveText('paused')
  }
  expect(await barNow(page)).toBeLessThan(bar + 4)
}

/** Plays counted so far (decision 70: starts, wraps and loop jumps). */
async function plays(page: Page): Promise<number> {
  const records = await readStore<{ readonly plays: number }>(page, 'playRecords')
  return records.reduce((n, r) => n + r.plays, 0)
}

async function expectAt(page: Page, bar: number, state: State): Promise<void> {
  if (state === 'paused') {
    await expect(page.getByTestId('hud-bar-beat')).toHaveText(`${bar}:1`)
  } else {
    // At the target bar or just past it (the jump may still be on its way).
    const near = async () => {
      const now = await barNow(page)
      return now >= bar && now <= bar + 1
    }
    await expect.poll(near, { timeout: 5_000 }).toBe(true)
  }
  await expect(page.getByTestId('transport-state')).toHaveText(state)
}

for (const state of ['playing', 'paused'] as const) {
  test.describe(`loop changes move the playhead (${state})`, () => {
    test(`turning the loop on jumps to its start (${state})`, async ({ page }) => {
      const errors = watchErrors(page)
      await openPlayer(page)
      // With the loop off, the fields only choose what the loop button turns on.
      await page.getByTestId('open-loop').click()
      await page.getByTestId('loop-from').fill('40')
      await page.getByTestId('loop-from').press('Enter')
      await page.getByTestId('loop-to').fill('44')
      await page.getByTestId('loop-to').press('Enter')
      await page.keyboard.press('Escape')
      await enter(page, state)
      await page.getByTestId('toggle-loop').click()
      await expectAt(page, 40, state)
      expect(errors).toEqual([])
    })

    test(`releasing the range slider jumps, dragging doesn't (${state})`, async ({ page }) => {
      const errors = watchErrors(page)
      await openPlayer(page)
      await setLoop(page, 10, 44)
      await enter(page, state, 30)
      await page.getByTestId('open-loop').click()
      const end = page.getByTestId('loop-slider').getByRole('slider').last()
      const box = (await end.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }
      const track = (await page.getByTestId('loop-slider').boundingBox()) ?? box
      const y = box.y + box.height / 2
      await page.mouse.move(box.x + box.width / 2, y)
      await page.mouse.down()
      await page.mouse.move(track.x + track.width - 4, y, { steps: 6 })
      // Mid-drag: the range follows the thumb, the loop and the playhead don't move yet.
      await expect(page.getByTestId('loop-range')).not.toHaveText('10–44')
      await expect(page.getByTestId('loop-value')).toHaveText('bars 10–44')
      expect(await barNow(page)).toBeGreaterThanOrEqual(30)
      await page.mouse.up()
      await expect(page.getByTestId('loop-value')).not.toHaveText('bars 10–44')
      await expectAt(page, 10, state)
      expect(errors).toEqual([])
    })

    test(`committing From or To jumps to the new start (${state})`, async ({ page }) => {
      const errors = watchErrors(page)
      await openPlayer(page)
      await setLoop(page, 10, 44)
      await enter(page, state, 30)
      // To: the loop's start stays bar 10, and the playhead goes back there from bar 30.
      await page.getByTestId('open-loop').click()
      await page.getByTestId('loop-to').fill('60')
      await page.getByTestId('loop-to').press('Enter')
      await expectAt(page, 10, state)
      // From: to the new start, bar 42.
      await page.getByTestId('loop-from').fill('42')
      await page.getByTestId('loop-from').press('Enter')
      await expectAt(page, 42, state)
      expect(errors).toEqual([])
    })

    test(`Back to the bookmark jumps to the bookmark's start (${state})`, async ({ page }) => {
      const errors = watchErrors(page)
      await openPlayer(page, { bookmark: true, loaded: true })
      await expect(page.getByTestId('hud-bookmark')).toHaveText('Bars 40 to 44')
      // A temporary loop change, then back to bar 1.
      await page.getByTestId('open-loop').click()
      await page.getByTestId('loop-from').fill('42')
      await page.getByTestId('loop-from').press('Enter')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('hud-custom')).toBeVisible()
      await enter(page, state, 42)
      await page.getByTestId('open-loop').click()
      await page.getByTestId('back-to-loaded').click()
      await expect(page.getByTestId('loop-value')).toHaveText('bars 40–44')
      await expectAt(page, 40, state)
      expect(errors).toEqual([])
    })

    test(`loading a bookmark jumps to its start (${state})`, async ({ page }) => {
      const errors = watchErrors(page)
      await openPlayer(page, { bookmark: true })
      await expect(page.getByTestId('hud-full-song')).toBeVisible()
      await enter(page, state)
      await page.getByTestId('open-picker').click()
      await page.getByTestId('picker-bookmark').click()
      await page.getByTestId('picker-load').click()
      await expect(page.getByTestId('hud-bookmark')).toHaveText('Bars 40 to 44')
      await expectAt(page, 40, state)
      expect(errors).toEqual([])
    })
  })
}

test('a loop jump while playing is a start, counted at once', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await setLoop(page, 10, 44)
  await enter(page, 'playing', 30)
  // The Play in enter() was the first start.
  await expect.poll(() => plays(page)).toBe(1)
  await page.getByTestId('open-loop').click()
  await page.getByTestId('loop-from').fill('42')
  await page.getByTestId('loop-from').press('Enter')
  await expectAt(page, 42, 'playing')
  await expect.poll(() => plays(page)).toBe(2)
  expect(errors).toEqual([])
})

test('a loop jump while paused arms a start: the next Play counts', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await setLoop(page, 10, 44)
  await enter(page, 'paused', 30)
  await expect.poll(() => plays(page)).toBe(1)
  await page.getByTestId('open-loop').click()
  await page.getByTestId('loop-from').fill('42')
  await page.getByTestId('loop-from').press('Enter')
  await expectAt(page, 42, 'paused')
  // Parked at the new start: armed, not counted yet.
  expect(await plays(page)).toBe(1)
  await page.keyboard.press('Escape')
  await page.getByTestId('play-pause').click()
  await expect.poll(() => plays(page)).toBe(2)
  expect(errors).toEqual([])
})

test('turning the loop off leaves the playhead where it is', async ({ page }) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  await loopFrom40(page)
  await page.getByRole('button', { name: 'Next bar' }).click()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('41:1')
  await page.getByTestId('toggle-loop').click()
  await expect(page.getByTestId('loop-value')).toBeHidden()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('41:1')
  expect(errors).toEqual([])
})

test('the Stop button rewinds like Home: to the loop start, else the song start', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  const stop = page.getByTestId('stop')
  await expect(stop).toHaveAccessibleName('Stop')
  // It comes first in the transport, before Previous bar.
  const labels = await page
    .getByRole('toolbar', { name: 'Transport' })
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')))
  expect(labels.slice(0, 2)).toEqual(['Stop', 'Previous bar'])

  await page.getByTestId('play-pause').click()
  await expect.poll(() => barNow(page)).toBeGreaterThanOrEqual(2)
  await stop.click()
  await expect(page.getByTestId('transport-state')).toHaveText('stopped')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('1:1')

  await loopFrom40(page)
  await page.getByRole('button', { name: 'Next bar' }).click()
  await page.getByTestId('play-pause').click()
  await stop.click()
  await expect(page.getByTestId('transport-state')).toHaveText('stopped')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('40:1')
  expect(errors).toEqual([])
})

test('arrow keys on the range slider apply the loop once they settle, or on focus loss', async ({
  page,
}) => {
  const errors = watchErrors(page)
  // The page's clock is ours: the 400 ms settle only passes when the test says so, so a slow
  // machine can't let it pass between the key presses and the "not applied yet" checks.
  await page.clock.install()
  await openPlayer(page)
  await loopFrom40(page)
  await enter(page, 'paused', 40)
  await page.getByTestId('open-loop').click()
  const start = page.getByTestId('loop-slider').getByRole('slider').first()
  await start.focus()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  // Three quick steps: the thumbs move, the loop and playhead wait…
  await start.press('ArrowRight')
  await start.press('ArrowRight')
  await start.press('ArrowRight')
  await expect(page.getByTestId('loop-range')).toHaveText('43–44')
  await expect(page.getByTestId('loop-value')).toHaveText('bars 40–44')
  expect(await barNow(page)).toBe(40)
  // Still waiting just before the 400 ms are up…
  await page.clock.runFor(350)
  await expect(page.getByTestId('loop-value')).toHaveText('bars 40–44')
  // …then apply once, with one jump to the new start.
  await page.clock.runFor(100)
  await expect(page.getByTestId('loop-value')).toHaveText('bars 43–44')
  await page.clock.runFor(50)
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('43:1')

  // A step followed by focus leaving the thumb applies at once.
  await start.press('ArrowLeft')
  await expect(page.getByTestId('loop-value')).toHaveText('bars 43–44')
  await page.getByTestId('loop-from').focus()
  // No clock time passes: the blur alone applies it.
  await expect(page.getByTestId('loop-value')).toHaveText('bars 42–44')
  await page.clock.runFor(50)
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('42:1')
  expect(errors).toEqual([])
})
