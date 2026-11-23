import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { QUALITY_PRESETS } from '../src/core/settings/QUALITY_PRESETS'
import { SETTINGS_VERSION } from '../src/core/settings/loadSettings'
import { type Cell, type Settings, writeSheet } from './contactSheet'
import { seedPractice, SONG_IDS } from './support'

/**
 * Milestone 9.5 contact sheets (npm run test:visual -- -g "listening sheet"): the playlist seam
 * and crossfade band, the listening HUD modes, and a look easing across a seam. Real playback
 * (a live clock), paused where a still frame is wanted, so frames vary a little run to run.
 */
const OUT = 'test-results/visual/m9-5'
const NOW = '2026-11-24T10:00:00.000Z'

interface Seam {
  play: (id: string, start?: number) => void
  seek: (seconds: number) => void
  state: () => { parts: { startSec: number; endSec: number }[] } | null
}

const seam = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { pianomeisterListening: Seam }).pianomeisterListening.state(),
  )

async function seek(page: Page, seconds: number): Promise<void> {
  await page.evaluate(
    (s) => (window as unknown as { pianomeisterListening: Seam }).pianomeisterListening.seek(s),
    seconds,
  )
}

/** Opens the player with `settings` stored and a two-song playlist (Minuet, then Canon). */
async function setUp(
  page: Page,
  settings: Settings,
  looks: { playlist: string | null; second: string | null } = { playlist: null, second: null },
): Promise<void> {
  await page.goto('./#/?stats=1')
  await expect(page.getByTestId('hud-title')).toBeVisible()
  await seedPractice(page, {
    playlists: [
      {
        id: 'sheet',
        profileId: 'default',
        name: 'Sheet',
        lookId: looks.playlist,
        entries: [
          { songId: SONG_IDS.minuet, lookId: null },
          { songId: SONG_IDS.canon, lookId: looks.second },
        ],
        shuffle: false,
        repeat: 'playlist',
        createdAt: NOW,
        updatedAt: NOW,
        lastPlayedAt: null,
      },
    ],
  })
  await page.evaluate(
    (value) => localStorage.setItem('pianomeister.settings', value),
    JSON.stringify({ version: SETTINGS_VERSION, settings }),
  )
  await page.reload()
  await expect(page.getByTestId('hud-title')).toBeVisible()
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
  await page.evaluate(() =>
    (window as unknown as { pianomeisterListening: Seam }).pianomeisterListening.play('sheet'),
  )
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
}

/** Brings the next song onto the timeline; returns where it starts (timeline seconds). */
async function appendNext(page: Page): Promise<number> {
  const end = (await seam(page))?.parts[0]?.endSec ?? 0
  await seek(page, end - 11)
  await expect.poll(async () => (await seam(page))?.parts.length).toBe(2)
  return (await seam(page))?.parts[1]?.startSec ?? 0
}

async function pausedAt(page: Page, seconds: number): Promise<Buffer> {
  if ((await page.getByTestId('transport-state').textContent()) === 'playing') {
    await page.keyboard.press('Space')
    await expect(page.getByTestId('transport-state')).toHaveText('paused')
  }
  await seek(page, seconds)
  // Two frames after the seek: the engine has drawn the new position.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  )
  return page.screenshot()
}

const quality = (q: 'off' | 'medium') => ({ quality: q, ...QUALITY_PRESETS[q] })

test('@visual listening sheet: seam and band by tilt, crossfade and quality', async ({
  page,
  browser,
}) => {
  test.setTimeout(900_000)
  for (const q of ['off', 'medium'] as const) {
    const cells: Cell[] = []
    for (const tilt of [25, 35, 85]) {
      for (const crossfade of [0, 2, 8]) {
        await setUp(page, {
          render: quality(q),
          camera: { tiltDeg: tilt },
          audio: { crossfade },
        })
        const start = await appendNext(page)
        // 1.5 s before the seam: the line, its label and the band ahead.
        cells.push({
          label: `tilt ${tilt}° · crossfade ${crossfade} s`,
          png: await pausedAt(page, start - 1.5),
        })
      }
    }
    await writeSheet(
      browser,
      `${OUT}/seam-${q}.png`,
      `Playlist seam and crossfade band · quality ${q} · 1.5 s before the seam`,
      cells,
      3,
      520,
    )
  }
})

test('@visual listening sheet: HUD modes', async ({ page, browser }) => {
  test.setTimeout(300_000)
  const cells: Cell[] = []
  for (const mode of ['show', 'minimal', 'hidden'] as const) {
    await setUp(page, { render: quality('medium'), appearance: { listeningHud: mode } })
    const start = await appendNext(page)
    cells.push({ label: `HUD ${mode}`, png: await pausedAt(page, start - 3) })
  }
  await writeSheet(browser, `${OUT}/hud-modes.png`, 'Listening HUD modes', cells, 3, 520)
})

test('@visual listening sheet: a look easing across the seam', async ({ page, browser }) => {
  test.setTimeout(300_000)
  await setUp(
    page,
    { render: quality('medium'), audio: { crossfade: 8 } },
    { playlist: 'builtin:classic', second: 'builtin:synthwave' },
  )
  const start = await appendNext(page)
  const cells: Cell[] = [{ label: 'before the seam', png: await pausedAt(page, start - 1) }]
  // The ease runs on the wall clock over the crossfade (8 s): play across the seam.
  await page.keyboard.press('Space')
  await expect(page.getByTestId('listening-title')).toContainText('Canon')
  await expect(page.getByTestId('transport-state')).toHaveText('playing')
  const crossed = Date.now()
  const at = async (ms: number) => {
    await expect.poll(() => Date.now() - crossed, { timeout: 20_000 }).toBeGreaterThan(ms)
    return page.screenshot()
  }
  cells.push({ label: 'mid-ease (~4 s)', png: await at(4000) })
  cells.push({ label: 'after (~9 s)', png: await at(9000) })
  await writeSheet(
    browser,
    `${OUT}/look-ease.png`,
    'Classic → Synthwave across a seam (crossfade 8 s)',
    cells,
    3,
    520,
  )
})
