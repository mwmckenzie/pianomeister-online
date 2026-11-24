import { SPLIT_ALGORITHMS } from '../hands/SPLIT_ALGORITHMS'
import type { NoteFill } from './NoteFill'
import type { PlayerSettings } from './PlayerSettings'
import type { SettingDefinition, SettingUnit } from './SettingDefinition'
import type { SettingHome, SettingsTabId, SidebarSectionId, WindowSectionId } from './SettingHome'
import type { SettingKey } from './SettingKey'
import type { SettingValue } from './SettingValue'
import { velocityScaleBounds } from './velocityScaleBounds'

/** Black key top above the white keys on a grand piano: 12 mm in white-key widths (23.5 mm). */
const GRAND_BLACK_HEIGHT = 12 / 23.5
const BLACK_LENGTH_RATIO = 0.63

const sidebar = (section: SidebarSectionId): SettingHome => ({ area: 'sidebar', section })
const tab = (id: SettingsTabId, section: WindowSectionId): SettingHome => ({
  area: 'window',
  tab: id,
  section,
})

function num(
  label: string,
  value: number,
  home: SettingHome,
  [min, max, step]: readonly [number, number, number],
  unit: SettingUnit = 'none',
  digits = 2,
) {
  return { kind: 'number', label, default: value, home, min, max, step, unit, digits } as const
}

const bool = (label: string, value: boolean, home: SettingHome) =>
  ({ kind: 'boolean', label, default: value, home }) as const

const color = (label: string, value: string, home: SettingHome) =>
  ({ kind: 'color', label, default: value, home }) as const

const percent = { unit: 'percent', digits: 0 } as const

const COLORS = 'Colors'
const NOTE_COLOURS = 'Note colours'

const LINE_COLORS = [
  { value: 'white', label: 'White' },
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'custom', label: 'Custom' },
] as const

const lineColor = <V extends 'white' | 'primary' | 'secondary' | 'custom'>(value: V) =>
  ({
    kind: 'choice',
    label: 'Colour',
    default: value as 'white' | 'primary' | 'secondary' | 'custom',
    home: sidebar('lines'),
    control: 'select',
    options: LINE_COLORS,
  }) as const

/** Emissive strength on the glow layer (0 = no bloom); a log slider with a 0 stop. */
const glow = (value: number, label = 'Glow', max = 3, home = sidebar('lines')) =>
  ({ ...num(label, value, home, [0, max, 0.05], 'times'), scale: 'log' }) as const

/** Log slider (milestone 9.1 §B): sizes, widths, strengths, counts, lifetimes. */
const log = { scale: 'log' } as const

const FILLS = [
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'hotCore', label: 'Hot core' },
  { value: 'outline', label: 'Outline' },
  { value: 'neon', label: 'Neon' },
  { value: 'stripes', label: 'Diagonal stripes' },
  { value: 'smoke', label: 'Smoke' },
  { value: 'crystal', label: 'Crystal' },
  { value: 'bubbles', label: 'Bubbles' },
  { value: 'liquid', label: 'Liquid' },
] as const

const fill = (label: string, home: SettingHome) =>
  ({
    kind: 'choice',
    label,
    default: 'solid' as NoteFill,
    home,
    control: 'select',
    options: FILLS,
  }) as const

const effects = sidebar('effects')

const STRIPE_COLORS = [
  { value: 'note', label: 'Note colour' },
  { value: 'darker', label: 'Darker note colour' },
  { value: 'custom', label: 'Custom' },
] as const

type Shown = (s: PlayerSettings) => boolean

/**
 * One use's stripe settings (Stripes fill, brief decision 112): opacities, width, balance,
 * angle and drift, separate per use, so fat pedal stripes never change the notes.
 */
function stripeShape(group: string, home: SettingHome, width: number, visible: Shown) {
  const row = { group, visible }
  return {
    aOpacity: { ...num('Stripe A opacity', 1, home, [0, 1, 0.05]), ...percent, ...row },
    bOpacity: { ...num('Stripe B opacity', 1, home, [0, 1, 0.05]), ...percent, ...row },
    width: { ...num('Stripe width', width, home, [0.05, 3, 0.05], 'mm'), ...log, ...row },
    balance: { ...num('Stripe balance', 0.5, home, [0.2, 0.8, 0.05]), ...percent, ...row },
    angle: { ...num('Angle', 45, home, [-75, 75, 5], 'deg', 0), ...row },
    drift: { ...bool('Drift along', false, home), ...row },
  }
}

/** Note stripes: A and B are the note colour, a darker one, or custom. */
function noteStripes(group: string, on: Shown) {
  const home = sidebar('noteStyle')
  const choice = (label: string, value: 'note' | 'darker') =>
    ({
      kind: 'choice',
      label,
      default: value as 'note' | 'darker' | 'custom',
      home,
      control: 'select',
      options: STRIPE_COLORS,
      group,
      visible: on,
    }) as const
  return {
    ...stripeShape(group, home, 0.35, on),
    a: choice('Stripe A colour', 'note'),
    b: choice('Stripe B colour', 'darker'),
    custom: (label: string, value: string, which: (s: PlayerSettings) => string) => ({
      ...color(label, value, home),
      group,
      visible: (s: PlayerSettings) => on(s) && which(s) === 'custom',
    }),
  }
}

const headStripes = noteStripes('Head stripes', (s) => s.noteStyle.headFill === 'stripes')
const sustainStripes = noteStripes('Sustain stripes', (s) => s.noteStyle.sustainFill === 'stripes')
const pedalStriped = (s: PlayerSettings) => s.pedal.show && s.pedal.fill === 'stripes'
const pedalStripes = stripeShape('Stripes', sidebar('cages'), 1, pedalStriped)

const handCagesOn = (s: PlayerSettings) => s.handCages.show
const handCageOn = (hand: 'right' | 'left') => (s: PlayerSettings) =>
  s.handCages.show && s.handCages[hand]
const handCageBorder = (hand: 'right' | 'left') => (s: PlayerSettings) =>
  handCageOn(hand)(s) && s.handCages.border
const handCageStriped = (hand: 'right' | 'left') => (s: PlayerSettings) =>
  handCageOn(hand)(s) && s.handCages[`${hand}Fill`] === 'stripes'
const rightCageStripes = stripeShape(
  'Right-hand stripes',
  sidebar('cages'),
  1,
  handCageStriped('right'),
)
const leftCageStripes = stripeShape(
  'Left-hand stripes',
  sidebar('cages'),
  1,
  handCageStriped('left'),
)
const HAND_CAGES = 'Hand cages'
const HAND_BORDER_COLORS = [
  { value: 'hand', label: 'Hand colour' },
  { value: 'custom', label: 'Custom' },
] as const

const namesShown = (s: PlayerSettings) => s.names.mode !== 'off'
const namesOnNotes = (s: PlayerSettings) => s.names.mode === 'notes' || s.names.mode === 'both'
const namesOnKeys = (s: PlayerSettings) => s.names.mode === 'keys' || s.names.mode === 'both'
/** The root cause first: with names off, "not on notes" is implied (brief decision 110). */
const NAMES_HINT = (s: PlayerSettings) =>
  s.names.mode === 'off' ? 'Needs note names on' : 'Needs note names on notes (Notes or Both)'
/** A note-label row: shown while names are on, enabled while they're on notes. */
const onNotes = {
  group: 'On notes',
  enabled: namesOnNotes,
  disabledHint: NAMES_HINT,
}
/** A row for names anywhere (notes or keys): greyed out while names are off. */
const namesOn = {
  enabled: namesShown,
  disabledHint: 'Needs note names on',
}

/** Fills that draw their own edge: the edge glow settings don't apply to them. */
const OWN_EDGE = new Set<NoteFill>(['outline', 'neon'])
const edgeApplies = (s: PlayerSettings) =>
  !OWN_EDGE.has(s.noteStyle.headFill) || !OWN_EDGE.has(s.noteStyle.sustainFill)
const EDGE_HINT = 'Outline and Neon draw their own edge'

type Span = readonly [number, number]

/**
 * Size, count, lifetime and spread of one onset effect, shown while it's on. Each effect has its
 * own useful span (milestone 9.1 §B: where it shows, where it whites out or hits the budget).
 */
function onsetKnobs(
  group: string,
  on: (s: PlayerSettings) => boolean,
  spans: {
    readonly size: Span
    readonly count: Span
    readonly lifetime: Span
    readonly spread: Span
  },
) {
  const visible = (s: PlayerSettings) => s.effects.enabled && on(s)
  const factor = (label: string, [min, max]: Span) => ({
    ...num(label, 1, effects, [min, max, 0.05], 'times'),
    ...log,
    group,
    visible,
  })
  // Spread is linear: 0 (a tight column) is an ordinary value, not "off".
  const [spreadMin, spreadMax] = spans.spread
  return {
    size: factor('Size', spans.size),
    count: factor('Count', spans.count),
    lifetime: factor('Lifetime', spans.lifetime),
    spread: {
      ...num('Spread', 1, effects, [spreadMin, spreadMax, 0.05], 'times'),
      group,
      visible,
    },
  }
}

const sparks = onsetKnobs('Sparks', (s) => s.effects.sparks, {
  size: [0.35, 2.5],
  count: [0.35, 3],
  lifetime: [0.35, 3],
  spread: [0, 3],
})
const scalingSparks = onsetKnobs('Scaling sparks', (s) => s.effects.scalingSparks, {
  size: [0.3, 1.5],
  count: [0.2, 2],
  lifetime: [0.2, 2],
  spread: [0, 3],
})
const flame = onsetKnobs('Flame burst', (s) => s.effects.flame, {
  size: [0.3, 1.75],
  count: [0.2, 2],
  lifetime: [0.2, 2],
  spread: [0, 2],
})
const explosion = onsetKnobs('Explosion', (s) => s.effects.explosion, {
  size: [0.4, 3],
  count: [0.3, 2.5],
  lifetime: [0.25, 3],
  spread: [0, 3],
})
const glitter = onsetKnobs('Glitter', (s) => s.effects.glitter, {
  size: [0.5, 3],
  count: [0.35, 2],
  lifetime: [0.4, 2.5],
  spread: [0, 3],
})
const sustainKnobs = onsetKnobs(
  'While a note sustains',
  (s) => s.effects.sustain !== 'none' && s.effects.sustain !== 'glow',
  { size: [0.35, 1.5], count: [0.35, 3], lifetime: [0.35, 2.5], spread: [0, 3] },
)

const onsetToggle = (label: string, value: boolean) => ({
  ...bool(label, value, effects),
  group: label,
  visible: (s: PlayerSettings) => s.effects.enabled,
})

const cages = sidebar('cages')
const render = sidebar('render')
const PRESET = 'Quality'
const BLOOM = 'Bloom'
const BLOOM_HINT = 'Needs bloom (quality Low or higher)'
const RESOLUTION = 'Resolution'

/**
 * Every setting, declared once (brief decisions 18–22, 39–63): label, default, limits, unit and
 * where it lives. The mapped type makes the compiler require exactly one entry per setting with
 * the right value type. Defaults, stored-value validation, reset groups and the settings UI are
 * all derived from this table.
 */
export const SETTINGS_REGISTRY: { readonly [K in SettingKey]: SettingDefinition<SettingValue<K>> } =
  {
    // Camera (decision 21)
    'camera.tiltDeg': num('Tilt', 35, sidebar('camera'), [25, 85, 1], 'deg', 0),
    'camera.distanceOffset': num('Distance', 0, sidebar('camera'), [-0.6, 1, 0.05]),
    'camera.pan': num('Pan', 0, sidebar('camera'), [-26, 26, 0.5], 'none', 1),

    // Keyboard (decisions 44–46). Upper limits of blackHeight and the press depths also depend
    // on other settings: see settingMax / constrainKeyboard.
    'keyboard.thickness': num('Key thickness', 0.6, sidebar('keyboard'), [0.2, 1.2, 0.05], 'mm'),
    'keyboard.gap': num('Gap between keys', 0.06, sidebar('keyboard'), [0, 0.2, 0.01], 'mm'),
    'keyboard.blackLengthRatio': {
      ...num('Black key length', BLACK_LENGTH_RATIO, sidebar('keyboard'), [0.5, 0.8, 0.01]),
      ...percent,
    },
    'keyboard.blackHeight': num(
      'Black key height',
      GRAND_BLACK_HEIGHT,
      sidebar('keyboard'),
      [0, 1.2, 0.05],
      'mm',
    ),
    'keyboard.edgeProfile': {
      kind: 'choice',
      label: 'Key edges',
      default: 'chamfer',
      home: sidebar('keyboard'),
      options: [
        { value: 'none', label: 'None' },
        { value: 'chamfer', label: 'Chamfer' },
        { value: 'rounded', label: 'Rounded' },
      ],
    },
    'keyboard.edgeSize': {
      ...num('Edge size', 0.04, sidebar('keyboard'), [0.005, 0.12, 0.005], 'mm'),
      ...log,
      visible: (s) => s.keyboard.edgeProfile !== 'none',
    },
    'keyboard.animate': bool('Animate keys', true, sidebar('keyboard')),
    'keyboard.pressDepthWhite': {
      ...num('White key depth', 0.22, sidebar('keyboard'), [0, 1.2, 0.05], 'mm'),
      visible: (s) => s.keyboard.animate,
    },
    'keyboard.pressDepthBlack': {
      ...num('Black key depth', 0.3, sidebar('keyboard'), [0, 1.12, 0.05], 'mm'),
      visible: (s) => s.keyboard.animate,
    },
    'keyboard.pivotOffsetWhite': {
      ...num('White key pivot behind the key', 0, sidebar('keyboard'), [0, 8, 0.5], 'mm'),
      visible: (s) => s.keyboard.animate,
    },
    'keyboard.pivotOffsetBlack': {
      // About twice the visible length behind the key (8.04, snapped to the 0.5 step): black
      // keys drop nearly level, slightly tilted.
      ...num('Black key pivot behind the key', 8, sidebar('keyboard'), [0, 8, 0.5], 'mm'),
      visible: (s) => s.keyboard.animate,
    },

    // Highway (decisions 18, 22, 42)
    'highway.lookAheadBeats': {
      ...num('Look-ahead', 10, sidebar('highway'), [2, 32, 1], 'beats', 0),
      ...log,
    },
    'highway.blackLaneShading': bool('Darker black-key lanes', true, sidebar('highway')),
    'highway.blackLaneShadingStrength': {
      ...num('Lane shading', 0.22, sidebar('highway'), [0, 1, 0.05]),
      ...percent,
      visible: (s) => s.highway.blackLaneShading,
    },
    'highway.vignette': {
      ...num('Vignette', 0.2, sidebar('highway'), [0, 1, 0.05]),
      ...percent,
    },
    // Very dark (decision 22, milestone 9): provisional until the tuning session.
    'colors.background': { ...color('Background', '#03050B', sidebar('highway')), group: COLORS },
    'colors.highway': { ...color('Highway', '#070B16', sidebar('highway')), group: COLORS },
    'colors.lane': { ...color('Lane lines', '#3A4A6E', sidebar('highway')), group: COLORS },
    'opacity.lane': {
      ...num('Lane line opacity', 0.35, sidebar('highway'), [0, 1, 0.05]),
      ...percent,
      group: COLORS,
    },
    'colors.bar': { ...color('Bar lines', '#5C6F99', sidebar('highway')), group: COLORS },
    'opacity.bar': {
      ...num('Bar line opacity', 0.6, sidebar('highway'), [0, 1, 0.05]),
      ...percent,
      group: COLORS,
    },
    'colors.beat': { ...color('Beat lines', '#5C6F99', sidebar('highway')), group: COLORS },
    'opacity.beat': {
      ...num('Beat line opacity', 0.12, sidebar('highway'), [0, 0.6, 0.05]),
      ...percent,
      group: COLORS,
    },

    // Lines & glow (decision 111)
    'lines.nowStyle': {
      kind: 'choice',
      label: 'Now line',
      default: 'glowing',
      home: sidebar('lines'),
      group: 'Now line',
      options: [
        { value: 'thin', label: 'Thin' },
        { value: 'glowing', label: 'Glowing' },
        { value: 'neon', label: 'Neon' },
      ],
    },
    'lines.nowColor': {
      kind: 'choice',
      label: 'Colour',
      default: 'custom',
      home: sidebar('lines'),
      group: 'Now line',
      control: 'select',
      options: [...LINE_COLORS, { value: 'pitch', label: 'Pitch (keys underneath)' }],
    },
    'lines.nowCustom': {
      ...color('Custom colour', '#BFD2FF', sidebar('lines')),
      group: 'Now line',
      visible: (s) => s.lines.nowColor === 'custom',
    },
    'lines.nowWidth': {
      ...num('Width', 0.08, sidebar('lines'), [0.02, 0.3, 0.01], 'mm'),
      ...log,
      group: 'Now line',
    },
    'lines.nowGlow': { ...glow(0.6), group: 'Now line' },
    // Loop visibility (milestone 9.2).
    'loop.dim': bool('Dim outside the loop', true, sidebar('loop')),
    'loop.dimStrength': {
      ...num('Dim strength', 0.6, sidebar('loop'), [0, 0.95, 0.05]),
      ...percent,
      visible: (s) => s.loop.dim,
    },
    'loop.after': {
      kind: 'choice',
      label: 'After the loop end',
      default: 'repeat',
      home: sidebar('loop'),
      options: [
        { value: 'repeat', label: 'Next repeat' },
        { value: 'continue', label: 'Song continues' },
      ],
    },
    'loop.lines': {
      ...bool('Loop boundary lines', true, sidebar('loop')),
      group: 'Boundary lines',
    },
    'loop.linesColor': {
      ...lineColor('secondary'),
      home: sidebar('loop'),
      group: 'Boundary lines',
      visible: (s) => s.loop.lines,
    },
    'loop.linesCustom': {
      ...color('Custom colour', '#7EE0C3', sidebar('loop')),
      group: 'Boundary lines',
      visible: (s) => s.loop.lines && s.loop.linesColor === 'custom',
    },
    'loop.linesWidth': {
      ...num('Width', 0.14, sidebar('loop'), [0.02, 0.3, 0.01], 'mm'),
      ...log,
      group: 'Boundary lines',
      visible: (s) => s.loop.lines,
    },
    'loop.linesGlow': {
      ...glow(1, 'Glow', 3, sidebar('loop')),
      group: 'Boundary lines',
      visible: (s) => s.loop.lines,
    },
    'lines.borders': { ...bool('Highway borders', true, sidebar('lines')), group: 'Borders' },
    'lines.bordersColor': {
      ...lineColor('custom'),
      group: 'Borders',
      visible: (s) => s.lines.borders,
    },
    'lines.bordersCustom': {
      ...color('Custom colour', '#5C6F99', sidebar('lines')),
      group: 'Borders',
      visible: (s) => s.lines.borders && s.lines.bordersColor === 'custom',
    },
    'lines.bordersWidth': {
      ...num('Width', 0.05, sidebar('lines'), [0.01, 0.3, 0.01], 'mm'),
      ...log,
      group: 'Borders',
      visible: (s) => s.lines.borders,
    },
    'lines.bordersGlow': { ...glow(0.3), group: 'Borders', visible: (s) => s.lines.borders },
    // The playlist seam (milestone 9.5): where the next song starts, with its title.
    'lines.seam': { ...bool('Seam line', true, sidebar('lines')), group: 'Playlist seam' },
    'lines.seamColor': {
      ...lineColor('secondary'),
      group: 'Playlist seam',
      visible: (s) => s.lines.seam,
    },
    'lines.seamCustom': {
      ...color('Custom colour', '#7EE0C3', sidebar('lines')),
      group: 'Playlist seam',
      visible: (s) => s.lines.seam && s.lines.seamColor === 'custom',
    },
    'lines.octaves': { ...bool('Octave lines (B/C)', false, sidebar('lines')), group: 'Octaves' },
    'lines.octavesEF': {
      ...bool('Also on E/F', false, sidebar('lines')),
      group: 'Octaves',
      visible: (s) => s.lines.octaves,
    },
    'lines.octavesColor': {
      ...lineColor('secondary'),
      group: 'Octaves',
      visible: (s) => s.lines.octaves,
    },
    'lines.octavesCustom': {
      ...color('Custom colour', '#7EE0C3', sidebar('lines')),
      group: 'Octaves',
      visible: (s) => s.lines.octaves && s.lines.octavesColor === 'custom',
    },
    'lines.octavesWidth': {
      ...num('Width', 0.05, sidebar('lines'), [0.01, 0.3, 0.01], 'mm'),
      ...log,
      group: 'Octaves',
      visible: (s) => s.lines.octaves,
    },
    'lines.octavesGlow': { ...glow(0.5), group: 'Octaves', visible: (s) => s.lines.octaves },
    'lines.barGlow': { ...glow(0, 'Bar line glow'), group: 'Bar & beat lines' },
    'lines.beatGlow': { ...glow(0, 'Beat line glow', 2), group: 'Bar & beat lines' },

    // Notes (decisions 19, 39–41) and the key colour fade-in
    // Note colours (milestone 9.1 §C round 2): the palette the whole scene's note colour follows.
    'notes.palette': {
      kind: 'colourSet',
      label: 'Note colours',
      default: 'default',
      home: sidebar('notes'),
      group: NOTE_COLOURS,
    },
    'notes.paletteSaved': {
      kind: 'savedColours',
      label: 'Saved note colours',
      default: null,
      home: sidebar('notes'),
      group: NOTE_COLOURS,
      visible: () => false,
    },
    'notes.paletteMono': {
      ...color('Colour', '#8AB4FF', sidebar('notes')),
      group: NOTE_COLOURS,
      visible: (s) => s.notes.palette === 'mono',
    },
    'notes.paletteWhite': {
      ...color('White-key notes', '#7EE0C3', sidebar('notes')),
      group: NOTE_COLOURS,
      visible: (s) => s.notes.palette === 'twoTone',
    },
    'notes.paletteBlack': {
      ...color('Black-key notes', '#C3A6FF', sidebar('notes')),
      group: NOTE_COLOURS,
      visible: (s) => s.notes.palette === 'twoTone',
    },
    'notes.heads3d': bool('3D note heads', true, sidebar('notes')),
    'notes.whiteHeadHeight': {
      ...num('White note height', 0.35, sidebar('notes'), [0.1, 0.8, 0.05], 'mm'),
      visible: (s) => s.notes.heads3d,
    },
    'notes.blackHeadHeight': {
      ...num('Black note height', 0.6, sidebar('notes'), [0.1, 0.8, 0.05], 'mm'),
      visible: (s) => s.notes.heads3d,
    },
    'notes.headRounded': {
      ...bool('Rounded head edges', true, sidebar('notes')),
      visible: (s) => s.notes.heads3d,
    },
    'notes.blackSideShading': {
      ...num('Black side shading', 0.7, sidebar('notes'), [0, 1, 0.05]),
      ...percent,
      visible: (s) => s.notes.heads3d,
    },
    'notes.blackRidge': {
      ...bool('Raised black sustains', false, sidebar('notes')),
      visible: (s) => s.notes.heads3d,
    },
    'notes.blackRidgeHeight': {
      ...num('Ridge height', 0.08, sidebar('notes'), [0.02, 0.35, 0.01], 'mm'),
      visible: (s) => s.notes.heads3d && s.notes.blackRidge,
    },
    'notes.blackOutline': bool('Black note outline', true, sidebar('notes')),
    'notes.blackOutlineStrength': {
      ...num('Outline strength', 0.8, sidebar('notes'), [0, 1, 0.05]),
      ...percent,
      visible: (s) => s.notes.blackOutline,
    },
    'notes.sustainCenterTransparency': {
      ...num('Sustain transparency, centre', 0.25, sidebar('notes'), [0, 0.85, 0.05]),
      ...percent,
    },
    'notes.sustainEdgeTransparency': {
      ...num('Sustain transparency, edges', 0.75, sidebar('notes'), [0, 1, 0.05]),
      ...percent,
    },
    'keys.fadeBeats': num('Key fade-in', 1, sidebar('notes'), [0, 4, 0.25], 'beats'),
    'keys.maxApproachAlpha': {
      ...num('Key colour before the note', 0.7, sidebar('notes'), [0.1, 1, 0.05]),
      ...percent,
    },

    // Note style (decisions 112–113)
    'noteStyle.headFill': { ...fill('Head fill', sidebar('noteStyle')), group: 'Fill' },
    'noteStyle.sustainFill': { ...fill('Sustain fill', sidebar('noteStyle')), group: 'Fill' },
    'noteStyle.gradientEnd': {
      ...num('Gradient end brightness', 0.35, sidebar('noteStyle'), [0, 0.8, 0.05]),
      ...percent,
      group: 'Fill',
      visible: (s) => s.noteStyle.headFill === 'gradient' || s.noteStyle.sustainFill === 'gradient',
    },
    'noteStyle.neonFlicker': {
      ...bool('Neon flicker', false, sidebar('noteStyle')),
      group: 'Fill',
      visible: (s) => s.noteStyle.headFill === 'neon' || s.noteStyle.sustainFill === 'neon',
    },
    'noteStyle.headStripeA': headStripes.a,
    'noteStyle.headStripeACustom': headStripes.custom(
      'Stripe A custom colour',
      '#FAC400',
      (s) => s.noteStyle.headStripeA,
    ),
    'noteStyle.headStripeB': headStripes.b,
    'noteStyle.headStripeBCustom': headStripes.custom(
      'Stripe B custom colour',
      '#141414',
      (s) => s.noteStyle.headStripeB,
    ),
    'noteStyle.headStripeAOpacity': headStripes.aOpacity,
    'noteStyle.headStripeBOpacity': headStripes.bOpacity,
    'noteStyle.headStripeWidth': { ...headStripes.width, max: 1 },
    'noteStyle.headStripeBalance': headStripes.balance,
    'noteStyle.headStripeAngle': headStripes.angle,
    'noteStyle.headStripeDrift': headStripes.drift,
    'noteStyle.sustainStripeA': sustainStripes.a,
    'noteStyle.sustainStripeACustom': sustainStripes.custom(
      'Stripe A custom colour',
      '#FAC400',
      (s) => s.noteStyle.sustainStripeA,
    ),
    'noteStyle.sustainStripeB': sustainStripes.b,
    'noteStyle.sustainStripeBCustom': sustainStripes.custom(
      'Stripe B custom colour',
      '#141414',
      (s) => s.noteStyle.sustainStripeB,
    ),
    'noteStyle.sustainStripeAOpacity': sustainStripes.aOpacity,
    'noteStyle.sustainStripeBOpacity': sustainStripes.bOpacity,
    'noteStyle.sustainStripeWidth': { ...sustainStripes.width, min: 0.1, max: 1.5 },
    'noteStyle.sustainStripeBalance': sustainStripes.balance,
    'noteStyle.sustainStripeAngle': sustainStripes.angle,
    'noteStyle.sustainStripeDrift': sustainStripes.drift,
    'noteStyle.edgeGlow': {
      ...bool('Edge glow', true, sidebar('noteStyle')),
      group: 'Edges',
      enabled: edgeApplies,
      disabledHint: EDGE_HINT,
    },
    'noteStyle.edgeWidth': {
      ...num('Edge width', 0.04, sidebar('noteStyle'), [0.02, 0.2, 0.005], 'mm'),
      ...log,
      group: 'Edges',
      visible: (s) => s.noteStyle.edgeGlow,
      enabled: edgeApplies,
      disabledHint: EDGE_HINT,
    },
    'noteStyle.edgeIntensity': {
      // Edge glow has its own switch, so 0 isn't needed as "off": a plain log from 0.1.
      ...glow(0.5, 'Edge intensity', 3, sidebar('noteStyle')),
      min: 0.1,
      group: 'Edges',
      visible: (s) => s.noteStyle.edgeGlow,
      enabled: edgeApplies,
      disabledHint: EDGE_HINT,
    },

    // Note names (decision 114)
    'names.mode': {
      kind: 'choice',
      label: 'Note names',
      default: 'off',
      home: sidebar('names'),
      options: [
        { value: 'off', label: 'Off' },
        { value: 'notes', label: 'Notes' },
        { value: 'keys', label: 'Keys' },
        { value: 'both', label: 'Both' },
      ],
    },
    'names.octave': {
      kind: 'choice',
      label: 'Octave number',
      default: 'c',
      home: sidebar('names'),
      ...namesOn,
      options: [
        { value: 'c', label: 'On C only' },
        { value: 'all', label: 'On all notes' },
      ],
    },
    'names.accidentals': {
      kind: 'choice',
      label: 'Black keys',
      default: 'sharps',
      home: sidebar('names'),
      ...namesOn,
      options: [
        { value: 'sharps', label: 'Sharps ♯' },
        { value: 'flats', label: 'Flats ♭' },
      ],
    },
    'names.style': {
      kind: 'choice',
      label: 'Label style',
      default: 'facing',
      home: sidebar('names'),
      ...onNotes,
      options: [
        { value: 'facing', label: 'Facing camera' },
        { value: 'flat', label: 'Flat on note' },
      ],
    },
    'names.textSize': {
      ...num('Text size', 12, sidebar('names'), [10, 18, 1], 'px', 0),
      ...onNotes,
    },
    'names.textColor': {
      kind: 'choice',
      label: 'Text colour',
      default: 'auto',
      home: sidebar('names'),
      control: 'select',
      ...onNotes,
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'note', label: 'Note colour' },
        { value: 'white', label: 'White' },
        { value: 'dark', label: 'Dark' },
      ],
    },
    'names.shadow': {
      ...num('Text shadow', 0.6, sidebar('names'), [0, 1, 0.1]),
      ...percent,
      ...namesOn,
      // Also behind the key-top names; listed with the note labels' look.
      group: 'On notes',
    },
    'names.showWithin': {
      ...num('Show within', 0.6, sidebar('names'), [0.1, 1, 0.05]),
      ...percent,
      ...onNotes,
    },
    'names.fadeLength': {
      ...num('Fade length', 0.15, sidebar('names'), [0, 0.3, 0.02]),
      ...percent,
      ...onNotes,
    },
    'names.anchor': {
      kind: 'choice',
      label: 'Anchor',
      default: 'ahead',
      home: sidebar('names'),
      control: 'select',
      ...onNotes,
      options: [
        { value: 'ahead', label: 'Ahead of head' },
        { value: 'on', label: 'On head' },
        { value: 'behind', label: 'Behind head' },
      ],
    },
    'names.offset': {
      ...num('Offset along note', 0, sidebar('names'), [-1, 1, 0.05], 'none', 2),
      ...onNotes,
    },
    'names.height': {
      ...num('Height above note', 6, sidebar('names'), [0, 18, 1], 'px', 0),
      group: 'On notes',
      enabled: (s) => namesOnNotes(s) && s.names.style === 'facing',
      disabledHint: (s) => (namesOnNotes(s) ? 'Needs labels facing the camera' : NAMES_HINT(s)),
    },
    'names.avoidOverlaps': {
      ...bool('Avoid overlaps', true, sidebar('names')),
      ...onNotes,
    },
    'names.repeats': {
      kind: 'choice',
      label: 'Label repeated notes',
      default: 'bar',
      home: sidebar('names'),
      control: 'select',
      ...onNotes,
      options: [
        { value: 'bar', label: 'Once per bar' },
        { value: 'first', label: 'First of a run' },
        { value: 'all', label: 'All' },
      ],
    },
    'names.glow': {
      kind: 'choice',
      label: 'Label glow',
      default: 'off',
      home: sidebar('names'),
      ...onNotes,
      options: [
        { value: 'off', label: 'Off' },
        { value: 'subtle', label: 'Subtle' },
      ],
    },
    'names.keySize': {
      ...num('Key label size', 11, sidebar('names'), [9, 16, 1], 'px', 0),
      group: 'On keys',
      enabled: namesOnKeys,
      disabledHint: (s) =>
        s.names.mode === 'off' ? 'Needs note names on' : 'Needs note names on keys (Keys or Both)',
    },

    // Pedal & cages (decisions 115–116); the defaults are the pre-milestone-9 pedal band.
    'pedal.show': bool('Pedal sections', true, cages),
    'pedal.fill': { ...fill('Fill', cages), visible: (s) => s.pedal.show },
    'pedal.fillColor': { ...color('Fill colour', '#4A5468', cages), visible: (s) => s.pedal.show },
    'pedal.fillOpacity': {
      ...num('Fill opacity', 0.22, cages, [0, 0.8, 0.05]),
      ...percent,
      visible: (s) => s.pedal.show,
    },
    'pedal.border': { ...bool('Border', false, cages), visible: (s) => s.pedal.show },
    'pedal.borderColor': {
      ...lineColor('custom'),
      home: cages,
      label: 'Border colour',
      visible: (s) => s.pedal.show && s.pedal.border,
    },
    'pedal.borderCustom': {
      ...color('Custom border colour', '#7A86A0', cages),
      visible: (s) => s.pedal.show && s.pedal.border && s.pedal.borderColor === 'custom',
    },
    'pedal.borderWidth': {
      ...num('Border width', 0.06, cages, [0.02, 0.4, 0.01], 'mm'),
      ...log,
      visible: (s) => s.pedal.show && s.pedal.border,
    },
    'pedal.borderGlow': {
      ...glow(0.3, 'Border glow', 3, cages),
      visible: (s) => s.pedal.show && s.pedal.border,
    },
    'pedal.cornerRadius': {
      ...num('Corner rounding', 0, cages, [0, 2, 0.05], 'mm'),
      ...log,
      visible: (s) => s.pedal.show && s.pedal.border,
    },
    'pedal.stripeA': {
      ...color('Stripe A colour', '#FAC400', cages),
      group: 'Stripes',
      visible: pedalStriped,
    },
    'pedal.stripeB': {
      ...color('Stripe B colour', '#141414', cages),
      group: 'Stripes',
      visible: pedalStriped,
    },
    'pedal.stripeAOpacity': pedalStripes.aOpacity,
    'pedal.stripeBOpacity': pedalStripes.bOpacity,
    'pedal.stripeWidth': { ...pedalStripes.width, min: 0.4 },
    'pedal.stripeBalance': pedalStripes.balance,
    'pedal.stripeAngle': pedalStripes.angle,
    'pedal.stripeDrift': pedalStripes.drift,

    // Hand cages (milestone 10): each hand's keys per bar; Classic keeps them off.
    'handCages.show': { ...bool('Hand cages', true, cages), group: HAND_CAGES },
    'handCages.right': {
      ...bool('Right hand', true, cages),
      group: HAND_CAGES,
      visible: handCagesOn,
    },
    'handCages.left': {
      ...bool('Left hand', true, cages),
      group: HAND_CAGES,
      visible: handCagesOn,
    },
    'handCages.rightColor': {
      ...lineColor('primary'),
      home: cages,
      label: 'Right colour',
      group: HAND_CAGES,
      visible: handCageOn('right'),
    },
    'handCages.rightCustom': {
      ...color('Right custom colour', '#8AB4FF', cages),
      group: HAND_CAGES,
      visible: (s) => handCageOn('right')(s) && s.handCages.rightColor === 'custom',
    },
    'handCages.rightFill': {
      ...fill('Right fill', cages),
      group: HAND_CAGES,
      visible: handCageOn('right'),
    },
    'handCages.leftColor': {
      ...lineColor('secondary'),
      home: cages,
      label: 'Left colour',
      group: HAND_CAGES,
      visible: handCageOn('left'),
    },
    'handCages.leftCustom': {
      ...color('Left custom colour', '#7EE0C3', cages),
      group: HAND_CAGES,
      visible: (s) => handCageOn('left')(s) && s.handCages.leftColor === 'custom',
    },
    'handCages.leftFill': {
      ...fill('Left fill', cages),
      group: HAND_CAGES,
      visible: handCageOn('left'),
    },
    'handCages.fillOpacity': {
      ...num('Fill opacity', 0.12, cages, [0, 0.5, 0.01]),
      ...percent,
      group: HAND_CAGES,
      visible: handCagesOn,
    },
    'handCages.border': { ...bool('Border', true, cages), group: HAND_CAGES, visible: handCagesOn },
    'handCages.rightBorderColor': {
      kind: 'choice',
      label: 'Right border colour',
      default: 'hand' as 'hand' | 'custom',
      home: cages,
      control: 'select',
      options: HAND_BORDER_COLORS,
      group: HAND_CAGES,
      visible: handCageBorder('right'),
    },
    'handCages.rightBorderCustom': {
      ...color('Right custom border colour', '#FFFFFF', cages),
      group: HAND_CAGES,
      visible: (s) => handCageBorder('right')(s) && s.handCages.rightBorderColor === 'custom',
    },
    'handCages.leftBorderColor': {
      kind: 'choice',
      label: 'Left border colour',
      default: 'hand' as 'hand' | 'custom',
      home: cages,
      control: 'select',
      options: HAND_BORDER_COLORS,
      group: HAND_CAGES,
      visible: handCageBorder('left'),
    },
    'handCages.leftBorderCustom': {
      ...color('Left custom border colour', '#FFFFFF', cages),
      group: HAND_CAGES,
      visible: (s) => handCageBorder('left')(s) && s.handCages.leftBorderColor === 'custom',
    },
    'handCages.borderWidth': {
      ...num('Border width', 0.04, cages, [0.02, 0.4, 0.01], 'mm'),
      ...log,
      group: HAND_CAGES,
      visible: (s) => handCagesOn(s) && s.handCages.border,
    },
    'handCages.borderGlow': {
      ...glow(0.15, 'Border glow', 3, cages),
      group: HAND_CAGES,
      visible: (s) => handCagesOn(s) && s.handCages.border,
    },
    'handCages.cornerRadius': {
      ...num('Corner rounding', 0, cages, [0, 2, 0.05], 'mm'),
      ...log,
      group: HAND_CAGES,
      visible: handCagesOn,
    },
    'handCages.carried': {
      ...num('Carried bars', 0.5, cages, [0, 1, 0.05]),
      ...percent,
      group: HAND_CAGES,
      visible: handCagesOn,
    },
    'handCages.rightStripeA': {
      ...color('Stripe A colour', '#FAC400', cages),
      group: 'Right-hand stripes',
      visible: handCageStriped('right'),
    },
    'handCages.rightStripeB': {
      ...color('Stripe B colour', '#141414', cages),
      group: 'Right-hand stripes',
      visible: handCageStriped('right'),
    },
    'handCages.rightStripeAOpacity': rightCageStripes.aOpacity,
    'handCages.rightStripeBOpacity': rightCageStripes.bOpacity,
    'handCages.rightStripeWidth': { ...rightCageStripes.width, min: 0.4 },
    'handCages.rightStripeBalance': rightCageStripes.balance,
    'handCages.rightStripeAngle': rightCageStripes.angle,
    'handCages.rightStripeDrift': rightCageStripes.drift,
    'handCages.leftStripeA': {
      ...color('Stripe A colour', '#FAC400', cages),
      group: 'Left-hand stripes',
      visible: handCageStriped('left'),
    },
    'handCages.leftStripeB': {
      ...color('Stripe B colour', '#141414', cages),
      group: 'Left-hand stripes',
      visible: handCageStriped('left'),
    },
    'handCages.leftStripeAOpacity': leftCageStripes.aOpacity,
    'handCages.leftStripeBOpacity': leftCageStripes.bOpacity,
    'handCages.leftStripeWidth': { ...leftCageStripes.width, min: 0.4 },
    'handCages.leftStripeBalance': leftCageStripes.balance,
    'handCages.leftStripeAngle': leftCageStripes.angle,
    'handCages.leftStripeDrift': leftCageStripes.drift,

    // Effects (decisions 47, 113, 117, 118)
    'effects.enabled': bool('Now-line effects', true, effects),
    'effects.velocityScaling': {
      ...bool('Size follows velocity', true, effects),
      visible: (s) => s.effects.enabled,
    },
    'effects.minScale': {
      ...num('Size at softest', 0.6, effects, [0.2, 2, 0.05], 'times'),
      ...log,
      visible: (s) => s.effects.enabled && s.effects.velocityScaling,
      limitHint: (s) =>
        velocityScaleBounds(s.effects).limited ? 'Limited by Size at loudest' : null,
    },
    'effects.maxScale': {
      ...num('Size at loudest', 1.7, effects, [0.5, 3, 0.05], 'times'),
      ...log,
      visible: (s) => s.effects.enabled && s.effects.velocityScaling,
    },
    'effects.sparks': onsetToggle('Sparks', true),
    'effects.sparksSize': sparks.size,
    'effects.sparksCount': sparks.count,
    'effects.sparksLifetime': sparks.lifetime,
    'effects.sparksSpread': sparks.spread,
    'effects.scalingSparks': onsetToggle('Scaling sparks', false),
    'effects.scalingSparksSize': scalingSparks.size,
    'effects.scalingSparksCount': scalingSparks.count,
    'effects.scalingSparksLifetime': scalingSparks.lifetime,
    'effects.scalingSparksSpread': scalingSparks.spread,
    'effects.flame': onsetToggle('Flame burst', false),
    'effects.flameSize': flame.size,
    'effects.flameCount': flame.count,
    'effects.flameLifetime': flame.lifetime,
    'effects.flameSpread': flame.spread,
    'effects.explosion': onsetToggle('Explosion', false),
    'effects.explosionSize': explosion.size,
    'effects.explosionCount': explosion.count,
    'effects.explosionLifetime': explosion.lifetime,
    'effects.explosionSpread': explosion.spread,
    'effects.glitter': onsetToggle('Glitter', false),
    'effects.glitterSize': glitter.size,
    'effects.glitterCount': glitter.count,
    'effects.glitterLifetime': glitter.lifetime,
    'effects.glitterSpread': glitter.spread,
    'effects.sustain': {
      kind: 'choice',
      label: 'While a note sustains',
      default: 'glow',
      home: effects,
      group: 'While a note sustains',
      control: 'select',
      visible: (s) => s.effects.enabled,
      options: [
        { value: 'none', label: 'Nothing' },
        { value: 'glow', label: 'Glow' },
        { value: 'embers', label: 'Embers' },
        { value: 'flames', label: 'Small flames' },
        { value: 'smoke', label: 'Smoke wisps' },
      ],
    },
    'effects.sustainSize': sustainKnobs.size,
    'effects.sustainCount': sustainKnobs.count,
    'effects.sustainLifetime': sustainKnobs.lifetime,
    'effects.sustainSpread': sustainKnobs.spread,
    'effects.pulse': { ...bool('Note-on pulse', true, effects), group: 'Notes' },
    'effects.pulseAmount': {
      // Pulse has its own switch: from 0.15 (below, it looks like no pulse) to 1.5 (white keys).
      ...glow(0.5, 'Pulse amount', 1.5, effects),
      min: 0.15,
      group: 'Notes',
      visible: (s) => s.effects.pulse,
    },
    'effects.pulseDecayMs': {
      ...num('Pulse decay', 200, effects, [100, 1000, 10], 'ms', 0),
      ...log,
      group: 'Notes',
      visible: (s) => s.effects.pulse,
    },
    'effects.soundingGlow': {
      ...bool('Sounding notes glow brighter', true, effects),
      group: 'Notes',
    },
    'effects.soundingGlowAmount': {
      ...num('Sounding glow', 0.3, effects, [0, 1, 0.05]),
      ...percent,
      group: 'Notes',
      visible: (s) => s.effects.soundingGlow,
    },
    'effects.breathing': {
      ...bool('Breathing pulse', false, effects),
      group: 'Notes',
      visible: (s) => s.effects.soundingGlow,
    },
    'effects.keySpill': {
      ...bool('Light spills onto neighbours', true, effects),
      group: 'Keys',
      // Shader detail Minimal samples no neighbours (brief decision 110).
      enabled: (s) => s.render.shaderDetail !== 'minimal',
      disabledHint: 'Needs shader detail Low or higher',
    },
    'effects.keySpillStrength': {
      ...num('Spill strength', 0.25, effects, [0, 1, 0.05]),
      ...percent,
      group: 'Keys',
      visible: (s) => s.effects.keySpill,
    },
    'effects.keySpillSpread': {
      ...num('Spill reach', 1.5, effects, [0.75, 4, 0.25], 'none', 2),
      ...log,
      group: 'Keys',
      visible: (s) => s.effects.keySpill,
    },
    'effects.keyCone': {
      ...bool('Light cone down the key', false, effects),
      group: 'Keys',
      // Cones need shader detail Medium or High (brief decision 110).
      enabled: (s) => s.render.shaderDetail === 'medium' || s.render.shaderDetail === 'high',
      disabledHint: 'Needs shader detail Medium or High',
    },
    'effects.keyConeStrength': {
      ...num('Cone strength', 0.4, effects, [0, 1, 0.1]),
      ...percent,
      group: 'Keys',
      visible: (s) => s.effects.keyCone,
    },
    'effects.keyConeSpread': {
      ...num('Cone spread', 1, effects, [0.25, 3, 0.05], 'times'),
      ...log,
      group: 'Keys',
      visible: (s) => s.effects.keyCone,
    },

    // Render quality (decision 48)
    'render.quality': {
      kind: 'choice',
      label: 'Quality preset',
      default: 'medium',
      tabletDefault: 'low',
      home: render,
      group: PRESET,
      options: [
        { value: 'off', label: 'Off' },
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
      ],
    },
    'render.bloomResolution': {
      kind: 'choice',
      label: 'Bloom resolution',
      default: 'half',
      tabletDefault: 'quarter',
      home: render,
      group: PRESET,
      options: [
        { value: 'off', label: 'Off' },
        { value: 'quarter', label: '¼' },
        { value: 'half', label: '½' },
        { value: 'full', label: 'Full' },
      ],
    },
    'render.particleBudget': {
      ...num('Particle budget', 2048, render, [256, 4096, 256], 'none', 0),
      tabletDefault: 1024,
      group: PRESET,
    },
    'render.shaderDetail': {
      kind: 'choice',
      label: 'Shader detail',
      default: 'medium',
      tabletDefault: 'low',
      home: render,
      group: PRESET,
      options: [
        { value: 'minimal', label: 'Minimal' },
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
      ],
    },
    'render.bloomStrength': {
      ...num('Bloom strength', 0.8, render, [0, 3, 0.05], 'times'),
      ...log,
      group: BLOOM,
      enabled: (s) => s.render.bloomResolution !== 'off',
      disabledHint: BLOOM_HINT,
    },
    'render.bloomRadius': {
      ...num('Bloom radius', 0.4, render, [0, 1, 0.1]),
      ...percent,
      group: BLOOM,
      enabled: (s) => s.render.bloomResolution !== 'off',
      disabledHint: BLOOM_HINT,
    },
    'render.bloomThreshold': {
      ...num('Bloom threshold', 0.1, render, [0, 0.4, 0.02]),
      ...percent,
      group: BLOOM,
      enabled: (s) => s.render.bloomResolution !== 'off',
      disabledHint: BLOOM_HINT,
    },
    'render.scaleAuto': {
      ...bool('Match the display (auto)', true, render),
      group: RESOLUTION,
    },
    'render.scale': {
      ...num('Render scale', 1, render, [0.5, 2, 0.05], 'times'),
      group: RESOLUTION,
      visible: (s) => !s.render.scaleAuto,
    },
    'render.maxPixelRatio': {
      ...num('Max pixel ratio', 2, render, [1, 4, 0.25], 'times'),
      group: RESOLUTION,
    },
    'render.antialias': {
      kind: 'choice',
      label: 'Anti-aliasing',
      default: 'msaa',
      home: render,
      group: RESOLUTION,
      options: [
        { value: 'off', label: 'Off' },
        { value: 'msaa', label: 'MSAA' },
        { value: 'fxaa', label: 'FXAA' },
        { value: 'smaa', label: 'SMAA' },
      ],
    },

    // Audio (decisions 14–16, 61)
    'audio.master': { ...num('Master', 0.8, tab('audio', 'volume'), [0, 1, 0.01]), ...percent },
    'audio.crossfade': num(
      'Crossfade between songs',
      2,
      tab('audio', 'playback'),
      [0, 8, 0.5],
      'seconds',
      1,
    ),
    'audio.crossfadeCurve': {
      kind: 'choice',
      label: 'Crossfade curve',
      default: 'sequential',
      home: tab('audio', 'playback'),
      control: 'select',
      options: [
        { value: 'sequential', label: 'Sequential' },
        { value: 'sCurve', label: 'S-curve' },
        { value: 'equalPower', label: 'Equal power' },
      ],
      enabled: (s) => s.audio.crossfade > 0,
      disabledHint: 'Needs a crossfade',
    },
    'audio.rightVolume': {
      ...num('Right hand', 1, tab('audio', 'volume'), [0, 1, 0.01]),
      ...percent,
    },
    'audio.leftVolume': {
      ...num('Left hand', 1, tab('audio', 'volume'), [0, 1, 0.01]),
      ...percent,
    },
    'audio.rightAudio': {
      kind: 'choice',
      label: 'Right hand sound',
      default: 'on',
      home: tab('audio', 'volume'),
      options: [
        { value: 'on', label: 'On' },
        { value: 'muted', label: 'Mute' },
        { value: 'solo', label: 'Solo' },
      ],
    },
    'audio.leftAudio': {
      kind: 'choice',
      label: 'Left hand sound',
      default: 'on',
      home: tab('audio', 'volume'),
      options: [
        { value: 'on', label: 'On' },
        { value: 'muted', label: 'Mute' },
        { value: 'solo', label: 'Solo' },
      ],
    },
    'audio.quietLevel': {
      ...num('Quiet pre-roll level', 0.25, tab('audio', 'preRollMetronome'), [0, 1, 0.01]),
      ...percent,
    },
    'audio.metronomeVolume': {
      ...num('Metronome volume', 0.6, tab('audio', 'preRollMetronome'), [0, 1, 0.01]),
      ...percent,
    },
    'audio.metronomeMode': {
      kind: 'choice',
      label: 'Metronome',
      default: 'off',
      home: tab('audio', 'preRollMetronome'),
      options: [
        { value: 'off', label: 'Off' },
        { value: 'preRoll', label: 'Pre-roll only' },
        { value: 'always', label: 'Always' },
      ],
    },
    'audio.output': {
      kind: 'choice',
      label: 'Output',
      default: 'piano',
      home: tab('audio', 'soundSource'),
      control: 'select',
      options: [{ value: 'piano', label: 'Built-in grand piano' }],
    },

    // Hand detection (milestone 10.5)
    'hands.detectOnUpload': bool('Detect hands on upload', true, tab('library', 'handDetection')),
    'hands.hintBelow': num(
      'Show "Check hands" below',
      70,
      tab('library', 'handDetection'),
      [50, 90, 5],
      'wholePercent',
      0,
    ),
    'hands.defaultAlgorithm': {
      kind: 'choice',
      label: 'Default split method',
      default: 'beam',
      home: tab('library', 'handDetection'),
      options: SPLIT_ALGORITHMS.map(({ id, name }) => ({
        value: id as PlayerSettings['hands']['defaultAlgorithm'],
        label: name,
      })),
      control: 'select',
    },

    // Practice (decisions 2, 10, 61)
    'practice.tempoStep': num(
      'Tempo step',
      5,
      tab('practice', 'tempo'),
      [1, 10, 1],
      'wholePercent',
      0,
    ),
    'practice.preRollBeats': num('Pre-roll', 0, tab('practice', 'preRoll'), [0, 16, 1], 'beats', 0),
    'practice.preRollMode': {
      kind: 'choice',
      label: 'Pre-roll sound',
      default: 'muted',
      home: tab('practice', 'preRoll'),
      options: [
        { value: 'muted', label: 'Muted' },
        { value: 'quiet', label: 'Quiet' },
      ],
    },

    // Appearance (decisions 52–54)
    'appearance.primary': color('Primary', '#8AB4FF', tab('appearance', 'menuColors')),
    'appearance.secondary': color('Secondary', '#7EE0C3', tab('appearance', 'menuColors')),
    'appearance.panelOpacity': {
      ...num('Panel opacity', 0.58, tab('appearance', 'glass'), [0.3, 0.95, 0.01]),
      ...percent,
    },
    'appearance.blur': num('Background blur', 26, tab('appearance', 'glass'), [0, 40, 1], 'px', 0),
    'appearance.motion': {
      kind: 'choice',
      label: 'Menu animations',
      default: 'system',
      home: tab('appearance', 'motion'),
      options: [
        { value: 'system', label: 'Follow system' },
        { value: 'full', label: 'Full' },
        { value: 'reduced', label: 'Reduced' },
      ],
    },
    'appearance.hideControls': bool(
      'Hide controls when idle',
      true,
      tab('appearance', 'playerControls'),
    ),
    'appearance.hideControlsAfter': {
      ...num('After', 3, tab('appearance', 'playerControls'), [0.5, 10, 0.5], 'seconds', 1),
      enabled: (settings) => settings.appearance.hideControls,
      disabledHint: 'Needs “Hide controls when idle”',
    },
    'appearance.startOn': {
      kind: 'choice',
      label: 'Start on',
      default: 'welcome',
      home: tab('appearance', 'start'),
      options: [
        { value: 'welcome', label: 'Welcome' },
        { value: 'player', label: 'Player' },
      ],
    },
    'appearance.listeningHud': {
      kind: 'choice',
      label: 'Listening HUD',
      default: 'show',
      home: tab('appearance', 'listening'),
      options: [
        { value: 'show', label: 'Show' },
        { value: 'minimal', label: 'Minimal' },
        { value: 'hidden', label: 'Hidden' },
      ],
    },
    'appearance.homeOnNewSession': bool(
      'Open Home when a new session starts',
      true,
      tab('appearance', 'start'),
    ),
    'appearance.sessionGap': {
      kind: 'choice',
      label: 'New session after',
      default: '30',
      home: tab('appearance', 'start'),
      options: [
        { value: '10', label: '10 min' },
        { value: '20', label: '20 min' },
        { value: '30', label: '30 min' },
        { value: '60', label: '60 min' },
      ],
    },
  }
