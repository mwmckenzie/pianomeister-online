import { readFileSync } from 'node:fs'

import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { watchErrors } from './support'

/**
 * Milestone 11, Phase 0: the benchmark (`#/bench`) and the perf overlay. Structure and isolation
 * only: timings are never checked.
 */
const stored = (page: Page) => page.evaluate(() => localStorage.getItem('pianomeister.settings'))

async function openBench(page: Page): Promise<void> {
  await page.goto('./#/')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Next bar' }).click()
  await page.getByRole('button', { name: 'Next bar' }).click()
  await page.goto('./#/bench?suite=smoke&quality=off&label=Test%20PC')
  await expect(page.getByTestId('bench-start')).toBeEnabled()
}

const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((on) => {
    Object.defineProperty(document, 'hidden', { value: on, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)

test('@bench a run gives a file, notices a hidden tab and leaves everything as it was', async ({
  page,
}) => {
  test.setTimeout(150_000)
  const errors = watchErrors(page)
  await openBench(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-bar')).toHaveText('3')
  const title = await page.getByTestId('hud-title').textContent()
  await page.goto('./#/bench?suite=smoke&quality=off&label=Test%20PC')
  const before = await stored(page)

  await page.getByTestId('bench-start').click()
  await expect(page.getByTestId('bench-running')).toContainText('study | off | normal')
  await setHidden(page, true)
  expect(await stored(page)).toBe(before)
  await setHidden(page, false)
  await expect(page.getByTestId('bench-result')).toBeVisible({ timeout: 100_000 })
  await expect(page.getByTestId('bench-flags')).toContainText('disturbed')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('bench-download').click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^bench-test-pc-\d{4}-\d\d-\d\d-\d{4}\.json$/)
  const path = await download.path()
  const run = JSON.parse(readFileSync(path, 'utf8')) as {
    schema: string
    cells: {
      cell: { segment: string }
      renderer: { drawCalls: number }
      frames: { frames: number }
    }[]
    device: { gpu: string | null }
  }
  expect(run.schema).toBe('pianomeister-bench')
  expect(run.cells.map((c) => c.cell.segment)).toEqual(['normal', 'dense', 'idle'])
  for (const cell of run.cells) expect(cell.renderer.drawCalls).toBeGreaterThan(5)

  // Against itself: every cell shared, nothing changed.
  await page.getByTestId('bench-file').setInputFiles(path)
  await expect(page.getByTestId('bench-comparison')).toContainText('3 cells in common, 0 changes')

  expect(await stored(page)).toBe(before)
  await page.getByTestId('bench-close').click()
  await expect(page.getByTestId('hud-title')).toHaveText(title ?? '')
  await expect(page.getByTestId('hud-bar')).toHaveText('3')
  await expect(page.getByTestId('transport-state')).toHaveText('stopped')
  expect(errors).toEqual([])
})

test('@bench Cancel, a reload and leaving the page put the player back', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = watchErrors(page)
  await openBench(page)
  const before = await stored(page)
  const start = async () => {
    await page.getByTestId('bench-start').click()
    await expect(page.getByTestId('bench-running')).toBeVisible()
  }
  await start()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('bench-page')).toBeVisible()
  expect(await stored(page)).toBe(before)

  await start()
  await page.reload()
  await expect(page.getByTestId('bench-start')).toBeEnabled({ timeout: 60_000 })
  expect(await stored(page)).toBe(before)

  // To another page in the middle of a run.
  await start()
  await page.goto('./#/library')
  await expect(page.getByTestId('song-row').first()).toBeVisible()
  expect(await stored(page)).toBe(before)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await expect(page.getByTestId('transport-state')).toHaveText('stopped')
  expect(errors).toEqual([])
})

test('@bench the perf overlay opens with its key and the page from About', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await expect(page.getByTestId('perf-overlay')).toHaveCount(0)
  await page.keyboard.press('Control+Alt+KeyP')
  await expect(page.getByTestId('perf-overlay')).toBeVisible()
  await page.keyboard.press('Control+Alt+KeyP')
  await expect(page.getByTestId('perf-overlay')).toHaveCount(0)
  await page.keyboard.press(',')
  await page.getByRole('tab', { name: 'About' }).click()
  await page.getByTestId('about-bench').click()
  await expect(page.getByTestId('bench-page')).toBeVisible()
  await expect(page.getByTestId('settings-window')).toBeHidden()
  expect(errors).toEqual([])
})
