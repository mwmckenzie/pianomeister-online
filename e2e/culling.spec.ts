import { fileURLToPath } from 'node:url'

import { type Page } from '@playwright/test'

import { BUILT_IN_LOOKS } from '../src/core/looks/BUILT_IN_LOOKS'
import { SETTINGS_VERSION } from '../src/core/settings/loadSettings'
import { QUALITY_PRESETS } from '../src/core/settings/QUALITY_PRESETS'
import { LONG_DEMO, openSong, type Settings } from './contactSheet'
import { expect, test } from './fixtures'
import { seedPractice, SONG_IDS, watchErrors } from './support'

/**
 * Milestone 11, Phase 1a: only the notes in view are drawn, and nobody can tell. The same frames
 * are drawn with the whole song and with the notes in view (docs/performance.md, "The fast loop").
 *
 * - `@exact`: software WebGL, not one pixel may differ.
 * - `@pixels`: the real GPU, whose redraws of one frame differ now and then by a level. The
 *   whole song drawn again gives that noise; culling must stay within it.
 * - `-full` (`@pixels-full`, `@exact-full`): once, before a pull request.
 */
const DENSE_SHORT = fileURLToPath(new URL('../test-fixtures/midi/dense-short.mid', import.meta.url))
/** Pixels over the measured noise that don't count. */
const NOISE_MARGIN = 24

type Step =
  | { readonly kind: 'at'; readonly bar: number; readonly seconds: number; readonly paused?: true }
  | { readonly kind: 'seconds'; readonly seconds: number; readonly paused?: true }
  /** Plays on at 60 fps for `frames`, from the last position. */
  | { readonly kind: 'play'; readonly frames: number }
  | { readonly kind: 'loop'; readonly bars: readonly [number, number] | null }

/** The worst frame of one run against another. */
interface Difference {
  readonly pixels: number
  readonly level: number
  readonly where: string
}

interface Result {
  readonly frames: number
  /** The whole song against itself: the same first frame drawn again. */
  readonly noise: Difference
  readonly culled: Difference
  /** With the window cut short at one edge: the comparison must notice. */
  readonly near: Difference | null
  readonly far: Difference | null
  /** Distinct frames: a blank or stuck canvas would compare equal. */
  readonly distinct: number
}

interface Api {
  start(seed?: number): void
  tickAt(bar: number, seconds: number): number
  tickAtSeconds(seconds: number): number
  step(tick: number, dt: number, playing?: boolean): void
  loop(range: { startBar: number; endBar: number } | null, preRollBeats?: number): void
  cull(on: boolean, broken?: 'near' | 'far' | null): void
  drawn(): { drawn: number[]; notes: number }
  info(): { triangles: number; drawCalls: number }
}

async function compare(
  page: Page,
  steps: readonly Step[],
  canFail: boolean,
  redraws = 20,
): Promise<Result> {
  return page.evaluate(
    async ({ steps, canFail, redraws }): Promise<Result> => {
      const api = (window as unknown as { pianomeisterCapture: Api }).pianomeisterCapture
      const stage = document.querySelector<HTMLCanvasElement>('[data-testid=stage]')
      const gl = stage?.getContext('webgl2')
      if (stage === null || gl === null || gl === undefined) throw new Error('no canvas')
      const { width, height } = stage
      // Read in the task that drew it.
      const grab = () => {
        const pixels = new Uint8Array(width * height * 4)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        return pixels
      }
      const none: Difference = { pixels: 0, level: 0, where: '' }
      const worse = (a: Difference, b: Difference): Difference => ({
        pixels: Math.max(a.pixels, b.pixels),
        level: Math.max(a.level, b.level),
        where: b.pixels > a.pixels ? b.where : a.where,
      })
      const difference = (a: Uint8Array, b: Uint8Array, where: string): Difference => {
        let pixels = 0
        let level = 0
        for (let p = 0; p < a.length; p += 4) {
          let d = 0
          for (let c = 0; c < 3; c++) {
            d = Math.max(d, Math.abs((a[p + c] as number) - (b[p + c] as number)))
          }
          if (d > 0) pixels++
          level = Math.max(level, d)
        }
        return { pixels, level, where }
      }
      let noise = none
      let culled = none
      let near = canFail ? none : null
      let far = canFail ? none : null
      let frames = 0
      const hashes = new Set<number>()
      // Every picture is a first frame: from a fresh start, one frame at the position before and
      // then this one, as a seek, a wrap or the next frame of playing shows it.
      let before = 0
      const shot = (name: string, tick: number, playing: boolean, from = before) => {
        const first = (cull: boolean, broken: 'near' | 'far' | null = null) => {
          api.cull(cull, broken)
          api.start(1)
          api.step(from, 1 / 60)
          api.step(tick, 1 / 60, playing)
          return grab()
        }
        // One to settle what the last picture left behind.
        first(false)
        const full = first(false)
        culled = worse(culled, difference(full, first(true), name))
        for (let i = 0; i < redraws; i++) noise = worse(noise, difference(full, first(false), name))
        if (near !== null) near = worse(near, difference(full, first(true, 'near'), name))
        if (far !== null) far = worse(far, difference(full, first(true, 'far'), name))
        hashes.add(full.reduce((h, x) => (Math.imul(h, 31) + x) | 0, 7))
        frames++
        before = tick
      }
      let where: (extra: number) => number = () => 0
      for (const [i, s] of steps.entries()) {
        const name = `${i} ${JSON.stringify(s)}`
        if (s.kind === 'loop') {
          const range = s.bars === null ? null : { startBar: s.bars[0], endBar: s.bars[1] }
          api.loop(range, 2)
          // The practice watcher applies it before the next task.
          await new Promise((resolve) => setTimeout(resolve, 0))
        } else if (s.kind === 'play') {
          for (let f = 1; f <= s.frames; f++) {
            shot(`${name} frame ${f}`, where(f / 60), true, where((f - 1) / 60))
          }
        } else {
          where =
            s.kind === 'at'
              ? (extra) => api.tickAt(s.bar, s.seconds + extra)
              : (extra) => api.tickAtSeconds(s.seconds + extra)
          shot(name, where(0), s.paused !== true)
        }
      }
      api.cull(true)
      return { frames, noise, culled, near, far, distinct: hashes.size }
    },
    { steps, canFail, redraws },
  )
}

/** A built-in look's values as stored settings, with everything that draws notes again on. */
function settingsOf(look: string, over: Settings = {}): Settings {
  const out: Settings = {}
  const values = BUILT_IN_LOOKS.find((l) => l.id === `builtin:${look}`)?.values ?? {}
  for (const [key, value] of Object.entries(values)) {
    const [section, field] = key.split('.') as [string, string]
    out[section] = { ...out[section], [field]: value }
  }
  out.render = { ...out.render, quality: 'medium', ...QUALITY_PRESETS.medium }
  out.handCages = { ...out.handCages, show: true }
  out.pedal = { ...out.pedal, show: true }
  out.names = { ...out.names, mode: 'both', showWithin: 1, fadeLength: 0.5, glow: 'subtle' }
  out.loop = { ...out.loop, after: 'repeat', dim: true }
  out.appearance = { homeOnNewSession: false, hideControls: false }
  for (const [section, fields] of Object.entries(over)) {
    out[section] = { ...out[section], ...fields }
  }
  return out
}

/** Opens a bundled song, so later loads open it again. */
async function openCanon(page: Page): Promise<void> {
  await page.goto('./#/library')
  await page.getByTestId('song-row').filter({ hasText: 'Canon in D' }).click()
  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-title')).toHaveText('Canon in D')
}

async function openWith(page: Page, settings: Settings, query = '', title = ''): Promise<void> {
  await page.evaluate(
    (value) => localStorage.setItem('pianomeister.settings', value),
    JSON.stringify({ version: SETTINGS_VERSION, settings }),
  )
  // A fresh page: a change of hash alone would leave the app running.
  await page.goto('about:blank')
  await page.goto(`./#/?capture=1${query}`)
  await page.waitForFunction(() => 'pianomeisterCapture' in window)
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('1:1')
  if (title !== '') await expect(page.getByTestId('hud-title')).toHaveText(title)
}

const LONGEST = { highway: { lookAheadBeats: 32 } }

function report(name: string, r: Result): void {
  const text = (d: Difference | null) => (d === null ? '-' : `${d.pixels} px, level ${d.level}`)
  console.log(
    `[culling] ${name}: ${r.frames} frames; noise ${text(r.noise)}; culled ${text(r.culled)}${
      r.culled.pixels > 0 ? ` (${r.culled.where})` : ''
    }; broken near ${text(r.near)}; broken far ${text(r.far)}`,
  )
}

/** Culled frames are within the noise, and cutting the window short is far outside it. */
function check(name: string, result: Result, exact: boolean): void {
  report(name, result)
  const { noise, culled } = result
  expect(result.distinct).toBeGreaterThan(result.frames / 2)
  const limit = exact
    ? { pixels: 0, level: 0 }
    : { pixels: noise.pixels + NOISE_MARGIN, level: Math.max(noise.level, 1) }
  if (exact) expect(noise, 'the same frames drawn twice').toMatchObject({ pixels: 0, level: 0 })
  expect(culled.pixels, culled.where).toBeLessThanOrEqual(limit.pixels)
  expect(culled.level, culled.where).toBeLessThanOrEqual(limit.level)
  for (const broken of [result.near, result.far]) {
    if (broken === null) continue
    expect(broken.pixels).toBeGreaterThan(Math.max(50, limit.pixels * 5))
    expect(broken.level).toBeGreaterThan(Math.max(20, limit.level * 5))
  }
}

/** The far fade moving, paused, just after a seek, a loop's wrap and repeats, both ends. */
const JOURNEY = (b: { far: number; loop: readonly [number, number]; last: number }): Step[] => [
  { kind: 'at', bar: 4, seconds: 0.2 },
  { kind: 'play', frames: 3 },
  { kind: 'at', bar: 4, seconds: 0.4, paused: true },
  { kind: 'at', bar: b.far, seconds: 0.31 },
  { kind: 'play', frames: 2 },
  { kind: 'loop', bars: b.loop },
  { kind: 'at', bar: b.loop[0], seconds: 0.1 },
  { kind: 'at', bar: b.loop[1] + 1, seconds: -0.02 },
  { kind: 'at', bar: b.loop[0], seconds: 0 },
  { kind: 'play', frames: 2 },
  { kind: 'loop', bars: null },
  { kind: 'at', bar: 1, seconds: -0.5 },
  { kind: 'at', bar: b.last, seconds: 0.5 },
]
const CANON = JOURNEY({ far: 40, loop: [20, 21], last: 100 })
const DENSE = JOURNEY({ far: 9, loop: [10, 10], last: 26 })

async function acrossSeam(page: Page, settings: Settings): Promise<Step[]> {
  await page.goto('./')
  await openWith(page, settings, '&stats=1')
  await seedPractice(page, {
    playlists: [
      {
        id: 'p',
        profileId: 'default',
        name: 'Two',
        lookId: null,
        entries: [SONG_IDS.invention, SONG_IDS.minuet].map((songId) => ({ songId, lookId: null })),
        shuffle: false,
        repeat: 'playlist',
        createdAt: 1,
        updatedAt: 1,
        lastPlayedAt: null,
      },
    ],
  })
  await page.reload()
  await page.waitForFunction(() => 'pianomeisterListening' in window)
  await expect(page.getByTestId('sample-status')).toHaveText('loaded', { timeout: 60_000 })
  await page.getByTestId('stage').click({ position: { x: 320, y: 300 } })
  const seam = await page.evaluate(async () => {
    interface Listening {
      play(id: string): void
      seek(seconds: number): void
      state(): { parts: { startSec: number; endSec: number }[] } | null
    }
    const l = (window as unknown as { pianomeisterListening: Listening }).pianomeisterListening
    const until = async (ready: () => boolean) => {
      for (let i = 0; i < 200 && !ready(); i++) await new Promise((r) => setTimeout(r, 50))
      if (!ready()) throw new Error('the next song never came')
    }
    l.play('p')
    await until(() => (l.state()?.parts.length ?? 0) > 0)
    l.seek((l.state()?.parts[0]?.endSec ?? 0) - 9)
    await until(() => (l.state()?.parts.length ?? 0) > 1)
    return l.state()?.parts[1]?.startSec ?? 0
  })
  expect(seam).toBeGreaterThan(5)
  await page.keyboard.press('Space')
  await expect(page.getByTestId('transport-state')).toHaveText('paused')
  return [
    { kind: 'seconds', seconds: seam - 4 },
    { kind: 'seconds', seconds: seam - 0.05 },
    { kind: 'play', frames: 5 },
    { kind: 'seconds', seconds: seam + 0.8, paused: true },
    { kind: 'seconds', seconds: seam + 1.5 },
  ]
}

// ── The fast loop ────────────────────────────────────────────────────────────────────────────

test('@exact culling: Canon on software WebGL', async ({ page }) => {
  const errors = watchErrors(page)
  await openCanon(page)
  await openWith(page, settingsOf('study', LONGEST), '', 'Canon in D')
  const steps: Step[] = [
    { kind: 'at', bar: 20, seconds: 0.2 },
    { kind: 'at', bar: 40, seconds: 0.31, paused: true },
  ]
  check('Canon, software', await compare(page, steps, true, 2), true)
  expect(errors).toEqual([])
})

for (const look of ['study', 'classic']) {
  test(`@pixels culling: Canon, ${look}`, async ({ page }) => {
    const errors = watchErrors(page)
    await openCanon(page)
    await openWith(page, settingsOf(look, LONGEST), '', 'Canon in D')
    check(`Canon ${look}`, await compare(page, CANON, look === 'study'), false)
    expect(errors).toEqual([])
  })

  test(`@pixels culling: dense chords, ${look}`, async ({ page }) => {
    const errors = watchErrors(page)
    await openSong(page, DENSE_SHORT, 'Dense short')
    await openWith(page, settingsOf(look, LONGEST), '', 'Dense short')
    check(`dense ${look}`, await compare(page, DENSE, look === 'study'), false)
    expect(errors).toEqual([])
  })

  test(`@pixels culling: a crossfade, ${look}`, async ({ page }) => {
    const errors = watchErrors(page)
    const steps = await acrossSeam(page, settingsOf(look, LONGEST))
    check(`crossfade ${look}`, await compare(page, steps, false), false)
    expect(errors).toEqual([])
  })
}

test('@pixels culling: triangles, instances and draw calls at fixed positions', async ({
  page,
}) => {
  const errors = watchErrors(page)
  const count = async (song: string, title: string, bars: readonly number[]) => {
    for (const quality of ['off', 'medium'] as const) {
      const render = { quality, ...QUALITY_PRESETS[quality] }
      await openWith(page, settingsOf('study', { render, names: { mode: 'both' } }), '', title)
      const rows = await page.evaluate((bars) => {
        const api = (window as unknown as { pianomeisterCapture: Api }).pianomeisterCapture
        api.start(1)
        return bars.map((bar) =>
          [false, true].map((cull) => {
            api.cull(cull)
            api.step(api.tickAt(bar, 0.2), 1 / 60)
            const { triangles, drawCalls } = api.info()
            const instances = api.drawn().drawn.reduce((a, b) => a + b, 0)
            return { triangles, instances, drawCalls }
          }),
        )
      }, bars)
      for (const [i, [full, culled]] of rows.entries()) {
        if (full === undefined || culled === undefined) throw new Error('no counts')
        console.log(
          `[counters] ${song} ${quality} bar ${bars[i]}: triangles ${full.triangles} → ${culled.triangles}, instances ${full.instances} → ${culled.instances}, draw calls ${full.drawCalls} → ${culled.drawCalls}`,
        )
        // A layer with nothing in view isn't drawn.
        expect(culled.drawCalls).toBeLessThanOrEqual(full.drawCalls)
        expect(culled.triangles).toBeLessThan(full.triangles / 2)
      }
    }
  }
  await openCanon(page)
  await count('Canon', 'Canon in D', [1, 20, 60, 100])
  await openSong(page, LONG_DEMO, 'Long demo')
  await count('long-demo', 'Long demo', [4, 24, 100, 300])
  expect(errors).toEqual([])
})

// ── Full validation: once, before a pull request ─────────────────────────────────────────────

const VIEWS: Record<string, Settings> = {
  'as it is': {},
  'flattest tilt': { ...LONGEST, camera: { tiltDeg: 25 } },
  'steepest tilt, offset labels': {
    ...LONGEST,
    camera: { tiltDeg: 85 },
    names: { offset: 2, anchor: 'behind', avoidOverlaps: false },
  },
  'square heads, ridges, outline, Off': {
    notes: { headRounded: false, blackRidge: true, blackOutline: true },
    render: { quality: 'off', ...QUALITY_PRESETS.off },
  },
}
for (const look of ['study', 'classic']) {
  for (const [name, view] of Object.entries(VIEWS)) {
    test(`@full-pixels culling: Canon, ${look}, ${name}`, async ({ page }) => {
      test.setTimeout(600_000)
      await openCanon(page)
      await openWith(page, settingsOf(look, view), '', 'Canon in D')
      check(`${look} ${name}`, await compare(page, CANON, false), false)
    })
    test(`@full-exact culling: Canon, ${look}, ${name}`, async ({ page }) => {
      // Software WebGL at the longest look-ahead takes seconds per frame, and each of the 15 frames is redrawn 20 times: about 18 minutes a case.
      test.setTimeout(3_600_000)
      await openCanon(page)
      await openWith(page, settingsOf(look, view), '', 'Canon in D')
      check(`${look} ${name}, software`, await compare(page, CANON, false), true)
    })
  }
}
