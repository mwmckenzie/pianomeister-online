import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { nudge, openSidebarSection, SONG_IDS, seedPractice, watchErrors } from './support'

/** Milestone 11, Phase 1a: nothing is drawn while nothing moves. */

interface Seams {
  readonly pianomeisterEngineStats: () => {
    readonly rendered: number
    readonly frames: number
    readonly averageIntervalMs: number
  }
  readonly pianomeisterRenderInfo: () => { readonly programs: number }
  readonly pianomeisterRedraw: () => void
  readonly pianomeisterParticles: () => {
    readonly particles: { readonly live: number }
    readonly smoke: { readonly live: number }
  }
  readonly frameRequests: () => number
}

const seam = <T>(page: Page, read: (w: Seams) => T): Promise<T> =>
  page.evaluate(`(${read.toString()})(window)`)

const rendered = (page: Page) => seam(page, (w) => w.pianomeisterEngineStats().rendered)
const programs = (page: Page) => seam(page, (w) => w.pianomeisterRenderInfo().programs)

const lapse = (page: Page, ms: number) =>
  page.evaluate((delay) => new Promise<void>((resolve) => setTimeout(resolve, delay)), ms)

/** Waits until no frame is drawn for half a second; the count then. */
async function rest(page: Page): Promise<number> {
  let last = -1
  await expect
    .poll(
      async () => {
        const before = last
        last = await rendered(page)
        return last === before
      },
      { intervals: [500], timeout: 20_000 },
    )
    .toBe(true)
  return last
}

async function open(page: Page, look: 'default' | 'particles' = 'default'): Promise<void> {
  await page.addInitScript((particles) => {
    const raf = window.requestAnimationFrame.bind(window)
    let requests = 0
    window.requestAnimationFrame = (run) => {
      requests++
      return raf(run)
    }
    Object.assign(window, { frameRequests: () => requests })
    if (!particles) return
    const effects = { sparks: true, explosion: true, sustain: 'smoke', pulse: true }
    localStorage.setItem(
      'pianomeister.settings',
      JSON.stringify({
        version: 6,
        settings: { effects, appearance: { homeOnNewSession: false } },
      }),
    )
  }, look === 'particles')
  await page.goto('./#/?stats=1')
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
}

async function playFor(page: Page, frames: number): Promise<void> {
  const from = await rendered(page)
  await page.getByTestId('play-pause').click()
  await expect.poll(() => rendered(page)).toBeGreaterThan(from + frames)
}

test('@player @smoke at rest nothing is drawn, and the HUD asks for no frames', async ({
  page,
}) => {
  const errors = watchErrors(page)
  await open(page)
  const stopped = await rest(page)
  const asked = await seam(page, (w) => w.frameRequests())
  await lapse(page, 1000)
  expect(await rendered(page)).toBe(stopped)
  expect(await seam(page, (w) => w.frameRequests())).toBe(asked)

  await playFor(page, 20)
  await page.getByTestId('play-pause').click()
  const paused = await rest(page)
  await lapse(page, 1000)
  expect(await rendered(page)).toBe(paused)
  expect(errors).toEqual([])
})

test('@player paused, a seek, a setting, a resize and a redraw each draw, then rest', async ({
  page,
}) => {
  await open(page)
  const changes: readonly (readonly [string, () => Promise<unknown>])[] = [
    ['seek', () => page.keyboard.press('ArrowRight')],
    ['resize', () => page.setViewportSize({ width: 1100, height: 700 })],
    ['tab shown', () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))],
    ['redraw', () => seam(page, (w) => w.pianomeisterRedraw())],
    ['reduced motion', () => page.emulateMedia({ reducedMotion: 'reduce' })],
  ]
  for (const [name, change] of changes) {
    const before = await rest(page)
    await change()
    await expect.poll(() => rendered(page), name).toBeGreaterThan(before)
    expect((await rest(page)) - before, name).toBeLessThan(120)
  }
  const bar = await page.getByTestId('hud-bar').textContent()
  await page.keyboard.press('ArrowRight')
  // The HUD, at rest, follows the seek.
  await expect(page.getByTestId('hud-bar')).not.toHaveText(bar ?? '')
  await openSidebarSection(page, 'camera')
  const before = await rest(page)
  await nudge(page, 'camera.tiltDeg', 'ArrowRight')
  await expect.poll(() => rendered(page)).toBeGreaterThan(before)
})

test('@player what rest leaves on screen is what a later frame would show', async ({ page }) => {
  await open(page, 'particles')
  await playFor(page, 90)
  await page.getByTestId('play-pause').click()
  await rest(page)
  const live = await seam(page, (w) => {
    const { particles, smoke } = w.pianomeisterParticles()
    return particles.live + smoke.live
  })
  expect(live).toBe(0)
  const at = { clip: { x: 300, y: 200, width: 600, height: 500 } }
  const settled = await page.screenshot(at)
  await lapse(page, 1500)
  for (let i = 0; i < 3; i++) {
    await seam(page, (w) => w.pianomeisterRedraw())
    await rest(page)
  }
  const later = await page.screenshot(at)
  expect(later.equals(settled)).toBe(true)
})

test('@player playing on after a rest draws at once, compiles nothing and skips no time', async ({
  page,
}) => {
  await open(page)
  await playFor(page, 20)
  await page.getByTestId('play-pause').click()
  const still = await rest(page)
  const compiled = await programs(page)
  /** The time steps of the last frames, added up. */
  const steps = () =>
    seam(page, (w) => {
      const { frames, averageIntervalMs } = w.pianomeisterEngineStats()
      return frames * averageIntervalMs
    })
  const stepped = await steps()
  const bar = await page.getByTestId('hud-bar').textContent()
  await lapse(page, 4000)
  const longest = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const button = document.querySelector<HTMLElement>('[data-testid="play-pause"]')
        button?.click()
        let last = performance.now()
        let most = 0
        let n = 0
        const step = () => {
          const now = performance.now()
          most = Math.max(most, now - last)
          last = now
          if (++n < 20) requestAnimationFrame(step)
          else resolve(most)
        }
        requestAnimationFrame(step)
      }),
  )
  expect(longest).toBeLessThan(250)
  expect(await rendered(page)).toBeGreaterThan(still + 5)
  expect(await programs(page)).toBe(compiled)
  // The engine's clock didn't take the rest for one long step.
  expect((await steps()) - stepped).toBeLessThan(3000)
  // The four seconds at rest weren't played.
  await expect(page.getByTestId('hud-bar')).toHaveText(bar)
})

test('@playlists listening, paused, rests; its HUD follows a seek', async ({ page }) => {
  await open(page)
  await seedPractice(page, {
    playlists: [
      {
        id: 'p',
        profileId: 'default',
        name: 'Idle',
        lookId: null,
        entries: [SONG_IDS.invention, SONG_IDS.minuet].map((songId) => ({ songId, lookId: null })),
        shuffle: false,
        repeat: 'off',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        lastPlayedAt: null,
      },
    ],
  })
  await page.reload()
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
  await page.getByTestId('stage').click({ position: { x: 640, y: 500 } })
  const from = await rendered(page)
  await page.evaluate(() =>
    (
      window as unknown as { pianomeisterListening: { play: (id: string) => void } }
    ).pianomeisterListening.play('p'),
  )
  await expect.poll(() => rendered(page)).toBeGreaterThan(from + 60)
  await page.keyboard.press('Space')
  const still = await rest(page)
  const asked = await seam(page, (w) => w.frameRequests())
  await lapse(page, 1000)
  expect(await rendered(page)).toBe(still)
  expect(await seam(page, (w) => w.frameRequests())).toBe(asked)
  await page.evaluate(() =>
    (
      window as unknown as { pianomeisterListening: { seek: (s: number) => void } }
    ).pianomeisterListening.seek(12),
  )
  await expect.poll(() => rendered(page)).toBeGreaterThan(still)
})
