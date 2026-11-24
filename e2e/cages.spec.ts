import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { choose, openSidebarSection, setting, watchErrors } from './support'

/**
 * Milestone 10: hand cages. Each hand's keys per bar on the highway, from the song's hand
 * assignment; the toggles apply at render time.
 */

interface CageInfo {
  right: { count: number; visible: boolean }
  left: { count: number; visible: boolean }
  order: { pedal: number; cages: number; notes: number }
}

const cages = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { pianomeisterCages: () => CageInfo | null }).pianomeisterCages(),
  )

async function openPlayer(page: Page): Promise<void> {
  await page.goto('./#/?stats=1')
  await expect(page.getByTestId('hud-title')).toHaveText('Minuet in G')
  await expect.poll(async () => (await cages(page))?.right.count ?? 0).toBeGreaterThan(0)
}

const toggle = (page: Page, key: string) => setting(page, key).getByRole('checkbox')

test('@cages @smoke both hands have cages, drawn over the pedal cage and behind the notes', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await openPlayer(page)
  const info = await cages(page)
  expect(info?.right.visible).toBe(true)
  expect(info?.left.visible).toBe(true)
  expect(info?.left.count).toBeGreaterThan(0)
  expect(info?.order.cages).toBeGreaterThan(info?.order.pedal ?? Infinity)
  expect(info?.order.cages).toBeLessThan(info?.order.notes ?? -Infinity)
  expect(errors).toEqual([])
})

test('@cages the global and per-hand toggles apply at once, without rebuilding', async ({
  page,
}) => {
  await openPlayer(page)
  const before = await cages(page)
  await openSidebarSection(page, 'cages')
  await toggle(page, 'handCages.left').uncheck()
  await expect.poll(async () => (await cages(page))?.left.visible).toBe(false)
  expect((await cages(page))?.right.visible).toBe(true)
  await toggle(page, 'handCages.show').uncheck()
  await expect.poll(async () => (await cages(page))?.right.visible).toBe(false)
  // The per-hand toggles hide with the global one.
  await expect(toggle(page, 'handCages.left')).toBeHidden()
  await toggle(page, 'handCages.show').check()
  await toggle(page, 'handCages.left').check()
  await expect.poll(async () => (await cages(page))?.left.visible).toBe(true)
  // Nothing was recomputed: the same cages.
  const after = await cages(page)
  expect([after?.right.count, after?.left.count]).toEqual([before?.right.count, before?.left.count])
  // The toggles are stored.
  await toggle(page, 'handCages.right').uncheck()
  await page.reload()
  await expect.poll(async () => (await cages(page))?.right.visible).toBe(false)
  expect((await cages(page))?.left.visible).toBe(true)
})

test('@cages @library a change of hand assignment in the Library updates the cages', async ({
  page,
}) => {
  await openPlayer(page)
  const both = await cages(page)
  // The Minuet's left hand is channel 1: Hidden leaves only the right hand's cages.
  await page.goto('./#/library')
  await page.getByTestId('song-row').filter({ hasText: 'Minuet in G' }).click()
  await choose(page, page.getByTestId('hand-ch1'), 'Hidden')
  await openPlayer(page)
  expect((await cages(page))?.left.count).toBe(0)
  expect((await cages(page))?.left.visible).toBe(false)
  expect((await cages(page))?.right.count).toBe(both?.right.count)
  await page.goto('./#/library')
  await page.getByTestId('song-row').filter({ hasText: 'Minuet in G' }).click()
  await choose(page, page.getByTestId('hand-ch1'), 'Left')
  await openPlayer(page)
  expect((await cages(page))?.left.count).toBe(both?.left.count)
})
