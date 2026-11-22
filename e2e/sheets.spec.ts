import { expect, test } from './fixtures'

import {
  type Cell,
  type Crop,
  frameWith,
  CLARITY_DEMO,
  FILLS_DEMO,
  LONG_DEMO,
  openSong,
  PEDAL_DEMO,
  type Settings,
  writeSheet,
} from './contactSheet'

/**
 * Milestone 9 round 3 contact sheets (npm run test:visual -- -g sheet): every note fill, the
 * transparency response, stripes on the pedal cage and on notes, and the note-name options —
 * each a grid of the same paused frame (Pedal demo, bar 2, ?animTime=3) at 1280×720.
 */
const OUT = 'test-results/visual/sheets'

const QUALITY = {
  off: { quality: 'off', bloomResolution: 'off', particleBudget: 512, shaderDetail: 'minimal' },
  medium: {
    quality: 'medium',
    bloomResolution: 'half',
    particleBudget: 2048,
    shaderDetail: 'medium',
  },
  high: { quality: 'high', bloomResolution: 'full', particleBudget: 4096, shaderDetail: 'high' },
} as const

const FILLS = [
  'solid',
  'gradient',
  'hotCore',
  'glass',
  'outline',
  'neon',
  'stripes',
  'smoke',
] as const

/** The notes' part of the frame (with the short look-ahead below), near and far. */
const NEAR: Crop = { x: 360, y: 40, width: 560, height: 540 }
/** A short look-ahead, so notes are long enough to judge a fill. */
const CLOSE = { lookAheadBeats: 3 }

test.use({ viewport: { width: 1280, height: 720 } })

function fillSettings(fill: string, extra: Settings = {}): Settings {
  return {
    highway: CLOSE,
    ...extra,
    noteStyle: { headFill: fill, sustainFill: fill, edgeGlow: false, ...extra.noteStyle },
  }
}

test('@visual sheet fills: every fill, 3D heads on/off, quality Off/Medium', async ({
  page,
  browser,
}) => {
  test.setTimeout(600_000)
  await openSong(page, PEDAL_DEMO, 'Pedal demo')
  const cells: Cell[] = []
  for (const fill of FILLS) {
    for (const heads3d of [true, false]) {
      for (const quality of ['off', 'medium'] as const) {
        const settings = fillSettings(fill, {
          notes: { heads3d },
          render: QUALITY[quality],
        })
        cells.push({
          label: `${fill} · 3D heads ${heads3d ? 'on' : 'off'} · ${quality}`,
          png: await frameWith(page, settings, 2, NEAR),
        })
      }
    }
  }
  await writeSheet(browser, `${OUT}/fills.png`, 'Fills — edge glow off', cells, 4, 360)
  expect(cells.length).toBeGreaterThan(0)
})

test('@visual sheet fills: transparency 0/25/50/75/90 %', async ({ page, browser }) => {
  test.setTimeout(600_000)
  await openSong(page, PEDAL_DEMO, 'Pedal demo')
  const cells: Cell[] = []
  for (const fill of FILLS) {
    for (const t of [0, 0.25, 0.5, 0.75, 0.9]) {
      const settings = fillSettings(fill, {
        notes: { heads3d: false, sustainCenterTransparency: t, sustainEdgeTransparency: t },
        render: QUALITY.medium,
      })
      cells.push({
        label: `${fill} · ${Math.round(t * 100)} %`,
        png: await frameWith(page, settings, 2, NEAR),
      })
    }
  }
  await writeSheet(
    browser,
    `${OUT}/fills-transparency.png`,
    'Transparency (centre = edges), 3D heads off, Medium',
    cells,
    5,
    300,
  )
  expect(cells.length).toBeGreaterThan(0)
})

test('@visual sheet fills: Hot core, Glass, Outline, Neon side by side', async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000)
  await openSong(page, PEDAL_DEMO, 'Pedal demo')
  const cells: Cell[] = []
  for (const quality of ['off', 'medium'] as const) {
    for (const heads3d of [true, false]) {
      for (const fill of ['hotCore', 'glass', 'outline', 'neon']) {
        const settings = fillSettings(fill, { notes: { heads3d }, render: QUALITY[quality] })
        cells.push({
          label: `${fill} · 3D heads ${heads3d ? 'on' : 'off'} · ${quality}`,
          png: await frameWith(page, settings, 2, NEAR),
        })
      }
    }
  }
  await writeSheet(
    browser,
    `${OUT}/fills-compare.png`,
    'Hot core, Glass, Outline, Neon — quality Off and Medium, default transparency',
    cells,
    4,
    480,
  )
  expect(cells.length).toBeGreaterThan(0)
})

test('@visual sheet stripes: pedal cage, 3 widths × 2 angles', async ({ page, browser }) => {
  test.setTimeout(300_000)
  await openSong(page, PEDAL_DEMO, 'Pedal demo')
  const cells: Cell[] = []
  for (const angle of [45, -30]) {
    for (const width of [0.35, 1, 2]) {
      const settings: Settings = {
        pedal: { fill: 'stripes', fillOpacity: 0.6, stripeWidth: width, stripeAngle: angle },
        render: QUALITY.medium,
      }
      cells.push({
        label: `pedal stripes · width ${width} · ${angle}°`,
        png: await frameWith(page, settings, 2),
      })
    }
  }
  // Notes never take the cage's tint, even at full cage opacity.
  cells.push({
    label: 'pedal stripes · opacity 100 %',
    png: await frameWith(
      page,
      { pedal: { fill: 'stripes', fillOpacity: 1 }, render: QUALITY.medium },
      2,
    ),
  })
  cells.push({
    label: 'pedal solid · opacity 100 %',
    png: await frameWith(
      page,
      { pedal: { fill: 'solid', fillOpacity: 1, fillColor: '#FAC400' }, render: QUALITY.medium },
      2,
    ),
  })
  await writeSheet(browser, `${OUT}/stripes-pedal.png`, 'Pedal cage stripes', cells, 3, 420)
  expect(cells.length).toBeGreaterThan(0)
})

/** Stripes on heads only or sustains only, with that use's stripe settings. */
function noteStripes(use: 'head' | 'sustain', extra: Record<string, unknown>): Settings {
  const striped = { headFill: 'solid', sustainFill: 'solid', [`${use}Fill`]: 'stripes' }
  return {
    notes: { heads3d: use === 'sustain' },
    highway: CLOSE,
    noteStyle: {
      ...striped,
      edgeGlow: false,
      ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [`${use}Stripe${k}`, v])),
    },
    render: QUALITY.medium,
  }
}

test('@visual sheet stripes: heads and sustains, widths and A/B opacity', async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000)
  await openSong(page, PEDAL_DEMO, 'Pedal demo')
  const cells: Cell[] = []
  for (const use of ['head', 'sustain'] as const) {
    for (const width of [0.15, 0.35, 0.8]) {
      cells.push({
        label: `${use} stripes · width ${width}`,
        png: await frameWith(page, noteStripes(use, { Width: width }), 2, NEAR),
      })
    }
  }
  for (const [a, b] of [
    [1, 1],
    [1, 0],
    [0.5, 0.5],
  ] as const) {
    cells.push({
      label: `sustain stripes · A ${a * 100} % / B ${b * 100} %`,
      png: await frameWith(page, noteStripes('sustain', { AOpacity: a, BOpacity: b }), 2, NEAR),
    })
  }
  await writeSheet(browser, `${OUT}/stripes-notes.png`, 'Note stripes', cells, 3, 420)
  expect(cells.length).toBeGreaterThan(0)
})

/** Where the labels are (the nearer part of the highway and the keys), at 1:1. */
const LABELS: Crop = { x: 300, y: 260, width: 680, height: 460 }

const NAMES_CASES: readonly { readonly label: string; readonly names: Record<string, unknown> }[] =
  [
    { label: 'defaults (facing camera, once per bar)', names: {} },
    { label: 'flat on note', names: { style: 'flat' } },
    { label: 'colour: note', names: { textColor: 'note' } },
    { label: 'colour: white', names: { textColor: 'white' } },
    { label: 'colour: dark', names: { textColor: 'dark' } },
    { label: 'anchor: on head', names: { anchor: 'on' } },
    { label: 'anchor: behind head', names: { anchor: 'behind' } },
    { label: 'avoid overlaps off', names: { avoidOverlaps: false } },
    { label: 'show within 100 %', names: { showWithin: 1 } },
    { label: 'text 18 px, glow subtle', names: { textSize: 18, glow: 'subtle' } },
    { label: 'Both (handover at the keys)', names: { mode: 'both' } },
    { label: 'Both, key labels 16 px', names: { mode: 'both', keySize: 16 } },
    { label: 'once per bar, show within 60 %', names: { showWithin: 0.6 } },
    { label: 'repeated notes: first of a run', names: { repeats: 'first' } },
    { label: 'repeated notes: all', names: { repeats: 'all' } },
  ]

for (const song of [
  { title: 'Pedal demo', file: PEDAL_DEMO, name: 'names-pedal' },
  { title: 'Long demo', file: LONG_DEMO, name: 'names-dense' },
  { title: 'Clarity demo', file: CLARITY_DEMO, name: 'names-stacked' },
] as const) {
  test(`@visual sheet names: ${song.title}`, async ({ page, browser }) => {
    test.setTimeout(300_000)
    await openSong(page, song.file, song.title)
    const cells: Cell[] = []
    for (const c of NAMES_CASES) {
      const settings: Settings = {
        names: { mode: 'notes', ...c.names },
        render: QUALITY.medium,
      }
      cells.push({ label: c.label, png: await frameWith(page, settings, 2, LABELS) })
    }
    await writeSheet(
      browser,
      `${OUT}/${song.name}.png`,
      `Note names — ${song.title}, bar 2, Medium`,
      cells,
      3,
      680,
    )
    expect(cells).toHaveLength(NAMES_CASES.length)
  })
}

/** Round-6 fill candidates: animated ones get three frames half a second apart. */
const CANDIDATES = [
  { fill: 'smokeRound1', label: 'Smoke (round 1)', times: [3, 3.5, 4] },
  { fill: 'smoke', label: 'Smoke (fixed)', times: [3, 3.5, 4] },
  { fill: 'crystal', label: 'Crystal', times: [3] },
  { fill: 'bubbles', label: 'Bubbles', times: [3, 3.5, 4] },
  { fill: 'liquid', label: 'Liquid', times: [3, 3.5, 4] },
] as const

/** Yellow, red, green and purple lanes of the fills demo, near and far. */
const LANES: Crop = { x: 300, y: 120, width: 700, height: 520 }

for (const c of CANDIDATES) {
  test(`@visual sheet fills: candidate ${c.label}`, async ({ page, browser }) => {
    test.setTimeout(600_000)
    await openSong(page, FILLS_DEMO, 'Fills demo')
    const cells: Cell[] = []
    for (const quality of ['off', 'high'] as const) {
      for (const heads3d of [true, false]) {
        for (const t of c.times) {
          const settings: Settings = {
            highway: { lookAheadBeats: 5 },
            notes: { heads3d },
            render: QUALITY[quality],
            noteStyle: { headFill: c.fill, sustainFill: c.fill, edgeGlow: false },
          }
          cells.push({
            label: `${quality} · 3D heads ${heads3d ? 'on' : 'off'} · t ${t} s`,
            png: await frameWith(page, settings, 2, LANES, t),
          })
        }
      }
    }
    await writeSheet(
      browser,
      `${OUT}/candidate-${c.fill}.png`,
      `${c.label} — Fills demo (yellow D, red C, green G, purple A), bar 2, quality Off / High`,
      cells,
      Math.max(2, c.times.length),
      560,
    )
    expect(cells.length).toBeGreaterThan(0)
  })
}
