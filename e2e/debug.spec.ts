import { test, expect } from '@playwright/test'

test('debug page loads the Minuet and plays it', async ({ page }) => {
  await page.goto('./#/debug')
  await page.getByTestId('fixture-select').selectOption('minuet-in-g.mid')
  await expect(page.getByTestId('bar-count')).toHaveText('64')

  await page.getByRole('button', { name: 'Play', exact: true }).click()

  // Wait for about a second of playback on the audio clock rather than sleeping.
  await expect
    .poll(async () => Number.parseFloat((await page.getByTestId('song-time').textContent()) ?? ''))
    .toBeGreaterThanOrEqual(1)
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  const barBeat = (await page.getByTestId('bar-beat').textContent()) ?? ''
  expect(Number.parseInt(barBeat.split(':')[0] ?? '', 10)).toBeGreaterThanOrEqual(1)
})
