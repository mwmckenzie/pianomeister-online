import { expect, test } from '@playwright/test'

import {
  type Cell,
  type Crop,
  frameWith,
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
  for (const heads3d of [true, false]) {
    for (const fill of ['hotCore', 'glass', 'outline', 'neon']) {
      const settings = fillSettings(fill, { notes: { heads3d }, render: QUALITY.medium })
      cells.push({
        label: `${fill} · 3D heads ${heads3d ? 'on' : 'off'}`,
        png: await frameWith(page, settings, 2, NEAR),
      })
    }
  }
  await writeSheet(
    browser,
    `${OUT}/fills-compare.png`,
    'Hot core, Glass, Outline, Neon — Medium, default transparency',
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
