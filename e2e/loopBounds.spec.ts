import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { setLoopBars, watchErrors } from './support'

/**
 * Brief decision 8: while the loop is on, nothing seeks outside it — a timeline click or drag
 * before or after the loop, the timeline's keys and ←/→ all land on (or wrap to) the loop start.
 * The Minuet has 64 bars; the loop is bars 20–35.
 */

const barNow = async (page: Page): Promise<number> =>
  Number.parseInt((await page.getByTestId('hud-bar-beat').textContent()) ?? '0', 10)

async function openWithLoop(page: Page): Promise<void> {
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bars')).toHaveText('64')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 30_000 })
  await setLoopBars(page, 20, 35)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('loop-value')).toHaveText('bars 20–35')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('20:1')
}

/** The x of the middle of `bar` on the timeline (bars are equal length in the Minuet). */
async function xOfBar(page: Page, bar: number): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('timeline').boundingBox()
  if (box === null) throw new Error('No timeline')
  return { x: box.x + ((bar - 0.5) / 64) * box.width, y: box.y + box.height / 2 }
}

async function clickBar(page: Page, bar: number): Promise<void> {
  const { x, y } = await xOfBar(page, bar)
  await page.mouse.click(x, y)
}

test('a timeline click before or after the loop lands on its start (paused)', async ({ page }) => {
  const errors = watchErrors(page)
  await openWithLoop(page)
  // Outside is dimmed on both sides.
  await expect(page.getByTestId('timeline-outside')).toHaveCount(2)
  await clickBar(page, 12)
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('20:1')
  await clickBar(page, 50)
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('20:1')
  // Inside the loop: as asked.
  await clickBar(page, 28)
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('28:1')
  await expect(page.getByTestId('transport-state')).not.toHaveText('playing')
  expect(errors).toEqual([])
})

test('a drag released outside the loop lands on its start (playing)', async ({ page }) => {
  const errors = watchErrors(page)
  await openWithLoop(page)
  await page.getByTestId('play-pause').click()
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  const from = await xOfBar(page, 25)
  const to = await xOfBar(page, 12)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 5 })
  await page.mouse.up()
  // Plays on from the loop start (bar 20, or just past it).
  await expect.poll(() => barNow(page)).toBeGreaterThanOrEqual(20)
  expect(await barNow(page)).toBeLessThanOrEqual(21)
  // After the loop, by click while playing: the same.
  await clickBar(page, 50)
  await expect.poll(() => barNow(page)).toBeLessThanOrEqual(21)
  expect(await barNow(page)).toBeGreaterThanOrEqual(20)
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  expect(errors).toEqual([])
})

test('→ on the loop’s last bar wraps to its start; ← on its first bar stays', async ({ page }) => {
  const errors = watchErrors(page)
  await openWithLoop(page)
  await clickBar(page, 35)
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('35:1')
  await page.getByTestId('stage').click()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('20:1')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('20:1')
  // The focused timeline's keys too: End is past the loop.
  await page.getByTestId('timeline').focus()
  await page.getByTestId('timeline').press('End')
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('20:1')
  expect(errors).toEqual([])
})

test('with the loop off, seeking goes anywhere again', async ({ page }) => {
  const errors = watchErrors(page)
  await openWithLoop(page)
  await page.getByTestId('toggle-loop').click()
  await expect(page.getByTestId('loop-value')).toBeHidden()
  await expect(page.getByTestId('timeline-outside')).toHaveCount(0)
  await clickBar(page, 12)
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('12:1')
  await clickBar(page, 50)
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('50:1')
  expect(errors).toEqual([])
})
