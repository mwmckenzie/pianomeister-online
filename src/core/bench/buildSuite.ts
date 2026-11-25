import { BUILT_IN_LOOKS } from '../looks/BUILT_IN_LOOKS'
import type { NoteFill } from '../settings/NoteFill'
import type { QualityPreset } from '../settings/QualityPreset'
import { QUALITY_PRESETS } from '../settings/QUALITY_PRESETS'
import type { BenchCell, BenchSegment, BenchSuite } from './BenchCell'
import { cellSec } from './SEGMENTS'

const QUALITIES = Object.keys(QUALITY_PRESETS) as QualityPreset[]
const STUDY = 'builtin:study'
/** Study and Classic, and a guess at the two costliest until a full run on a weak GPU says. */
const STANDARD_LOOKS = [STUDY, 'builtin:classic', 'builtin:inferno', 'builtin:crystal']
const OTHER_SEGMENTS: readonly BenchSegment[] = [
  'light',
  'loop',
  'crossfade',
  'pauseResume',
  'idle',
]

const FILLS: readonly NoteFill[] = [
  'solid',
  'gradient',
  'hotCore',
  'outline',
  'neon',
  'stripes',
  'smoke',
  'crystal',
  'bubbles',
  'liquid',
]

/** Everything on, so each feature can be taken away in turn. */
const EVERYTHING: BenchCell['overrides'] = {
  'names.mode': 'both',
  'handCages.show': true,
  'pedal.show': true,
  'highway.vignette': 0.3,
  'effects.enabled': true,
}

const WITHOUT: Readonly<Record<string, BenchCell['overrides']>> = {
  'no bloom': { 'render.bloomResolution': 'off' },
  'no anti-aliasing': { 'render.antialias': 'off' },
  'no cages': { 'handCages.show': false, 'pedal.show': false },
  'no note names': { 'names.mode': 'off' },
  'no vignette': { 'highway.vignette': 0 },
  'no effects': { 'effects.enabled': false },
  'pixel ratio 1': { 'render.scaleAuto': false, 'render.scale': 1 },
}

const cell = (
  look: string,
  quality: QualityPreset,
  segment: BenchSegment,
  round = 1,
  probe: string | null = null,
  overrides: BenchCell['overrides'] = {},
): BenchCell => ({ look, quality, segment, probe, overrides, round })

function standard(): BenchCell[] {
  const cells: BenchCell[] = []
  // Levels interleaved and in two rounds: heat and clock drift hit them all alike.
  for (const round of [1, 2]) {
    for (const look of STANDARD_LOOKS) {
      for (const segment of ['normal', 'dense'] as const) {
        for (const quality of QUALITIES) cells.push(cell(look, quality, segment, round))
      }
    }
  }
  for (const segment of OTHER_SEGMENTS) {
    for (const quality of QUALITIES) cells.push(cell(STUDY, quality, segment))
  }
  return cells
}

function probes(): BenchCell[] {
  const all = (name: string, overrides: BenchCell['overrides']) =>
    cell(STUDY, 'medium', 'dense', 1, name, { ...EVERYTHING, ...overrides })
  return [
    all('everything', {}),
    ...Object.entries(WITHOUT).map(([name, overrides]) => all(name, overrides)),
    ...FILLS.map((fill) =>
      cell(STUDY, 'medium', 'dense', 1, `fill ${fill}`, {
        'noteStyle.headFill': fill,
        'noteStyle.sustainFill': fill,
      }),
    ),
  ]
}

/** The cells of a suite, in running order. `quality` is the smoke suite's only one. */
export function buildSuite(suite: BenchSuite, quality: QualityPreset): readonly BenchCell[] {
  if (suite === 'smoke') {
    return (['normal', 'dense', 'idle'] as const).map((s) => cell(STUDY, quality, s))
  }
  if (suite === 'standard') return standard()
  const looks = BUILT_IN_LOOKS.flatMap((look) => QUALITIES.map((q) => cell(look.id, q, 'dense')))
  return [...looks, ...probes(), ...standard()]
}

/** About how long a suite takes, in seconds (slow devices take as long: cells are timed). */
export const suiteSec = (cells: readonly BenchCell[]): number =>
  cells.reduce((sum, c) => sum + cellSec(c.segment), 0)
