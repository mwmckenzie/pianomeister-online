import type { NoteFill } from './NoteFill'
import type { PlayerSettings } from './PlayerSettings'
import type { SettingDefinition, SettingUnit } from './SettingDefinition'
import type { SettingHome, SettingsTabId, SidebarSectionId, WindowSectionId } from './SettingHome'
import type { SettingKey } from './SettingKey'
import type { SettingValue } from './SettingValue'

/** Black key top above the white keys on a grand piano: 12 mm in white-key widths (23.5 mm). */
const GRAND_BLACK_HEIGHT = 12 / 23.5
const BLACK_LENGTH_RATIO = 0.63
/** Visible black key length: 63% of the 150 mm white key, in white-key widths. */
const BLACK_VISIBLE_LENGTH = (BLACK_LENGTH_RATIO * 150) / 23.5

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

/** Emissive strength on the glow layer (0 = no bloom). */
const glow = (value: number, label = 'Glow', max = 3, home = sidebar('lines')) =>
  num(label, value, home, [0, max, 0.05], 'times')

const FILLS = [
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'hotCore', label: 'Hot core' },
  { value: 'glass', label: 'Glass' },
  { value: 'outline', label: 'Outline' },
  { value: 'neon', label: 'Neon' },
  { value: 'stripes', label: 'Diagonal stripes' },
  { value: 'smoke', label: 'Smoke' },
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
    width: { ...num('Stripe width', width, home, [0.05, 3, 0.05], 'mm'), ...row },
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

/** Fills that draw their own edge: the edge glow settings don't apply to them. */
const OWN_EDGE = new Set<NoteFill>(['outline', 'neon'])
const edgeApplies = (s: PlayerSettings) =>
  !OWN_EDGE.has(s.noteStyle.headFill) || !OWN_EDGE.has(s.noteStyle.sustainFill)
const EDGE_HINT = 'Outline and Neon draw their own edge'

/** Size, count, lifetime and spread of one onset effect, shown while it's on. */
function onsetKnobs(group: string, on: (s: PlayerSettings) => boolean) {
  const visible = (s: PlayerSettings) => s.effects.enabled && on(s)
  const factor = (label: string, max = 3) => ({
    ...num(label, 1, effects, [0.2, max, 0.05], 'times'),
    group,
    visible,
  })
  return {
    size: factor('Size'),
    count: factor('Count'),
    lifetime: factor('Lifetime'),
    spread: { ...num('Spread', 1, effects, [0, 3, 0.05], 'times'), group, visible },
  }
}

const sparks = onsetKnobs('Sparks', (s) => s.effects.sparks)
const scalingSparks = onsetKnobs('Scaling sparks', (s) => s.effects.scalingSparks)
const flame = onsetKnobs('Flame burst', (s) => s.effects.flame)
const explosion = onsetKnobs('Explosion', (s) => s.effects.explosion)
const glitter = onsetKnobs('Glitter', (s) => s.effects.glitter)
const sustainKnobs = onsetKnobs(
  'While a note sustains',
  (s) => s.effects.sustain !== 'none' && s.effects.sustain !== 'glow',
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
    'camera.tiltDeg': num('Tilt', 45, sidebar('camera'), [20, 85, 1], 'deg', 0),
    'camera.distanceOffset': num('Distance', 0, sidebar('camera'), [-0.6, 1, 0.05]),
    'camera.pan': num('Pan', 0, sidebar('camera'), [-26, 26, 0.5], 'none', 1),

    // Keyboard (decisions 44–46). Upper limits of blackHeight and the press depths also depend
    // on other settings: see settingMax / constrainKeyboard.
    'keyboard.thickness': num('Key thickness', 0.6, sidebar('keyboard'), [0.2, 1.2, 0.01], 'mm'),
    'keyboard.gap': num('Gap between keys', 0.06, sidebar('keyboard'), [0, 0.2, 0.005], 'mm'),
    'keyboard.blackLengthRatio': {
      ...num('Black key length', BLACK_LENGTH_RATIO, sidebar('keyboard'), [0.5, 0.8, 0.01]),
      ...percent,
    },
    'keyboard.blackHeight': num(
      'Black key height',
      GRAND_BLACK_HEIGHT,
      sidebar('keyboard'),
      [0, 1.2, 0.01],
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
      visible: (s) => s.keyboard.edgeProfile !== 'none',
    },
    'keyboard.animate': bool('Animate keys', true, sidebar('keyboard')),
    'keyboard.pressDepthWhite': {
      ...num('White key depth', 0.22, sidebar('keyboard'), [0, 1.2, 0.01], 'mm'),
      visible: (s) => s.keyboard.animate,
    },
    'keyboard.pressDepthBlack': {
      ...num('Black key depth', 0.3, sidebar('keyboard'), [0, 1.12, 0.01], 'mm'),
      visible: (s) => s.keyboard.animate,
    },
    'keyboard.pivotOffsetWhite': {
      ...num('White key pivot behind the key', 0, sidebar('keyboard'), [0, 16, 0.1], 'mm'),
      visible: (s) => s.keyboard.animate,
    },
    'keyboard.pivotOffsetBlack': {
      // Twice the visible length behind the key: black keys drop nearly level, slightly tilted.
      ...num(
        'Black key pivot behind the key',
        2 * BLACK_VISIBLE_LENGTH,
        sidebar('keyboard'),
        [0, 16, 0.1],
        'mm',
      ),
      visible: (s) => s.keyboard.animate,
    },

    // Highway (decisions 18, 22, 42)
    'highway.lookAheadBeats': num('Look-ahead', 8, sidebar('highway'), [2, 32, 1], 'beats', 0),
    'highway.blackLaneShading': bool('Darker black-key lanes', true, sidebar('highway')),
    'highway.blackLaneShadingStrength': {
      ...num('Lane shading', 0.22, sidebar('highway'), [0, 1, 0.01]),
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
      ...num('Lane line opacity', 0.35, sidebar('highway'), [0, 1, 0.01]),
      ...percent,
      group: COLORS,
    },
    'colors.bar': { ...color('Bar lines', '#5C6F99', sidebar('highway')), group: COLORS },
    'opacity.bar': {
      ...num('Bar line opacity', 0.6, sidebar('highway'), [0, 1, 0.01]),
      ...percent,
      group: COLORS,
    },
    'colors.beat': { ...color('Beat lines', '#5C6F99', sidebar('highway')), group: COLORS },
    'opacity.beat': {
      ...num('Beat line opacity', 0.12, sidebar('highway'), [0, 1, 0.01]),
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
      ...num('Width', 0.08, sidebar('lines'), [0.02, 0.4, 0.01], 'mm'),
      group: 'Now line',
    },
    'lines.nowGlow': { ...glow(0.6), group: 'Now line' },
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
      group: 'Borders',
      visible: (s) => s.lines.borders,
    },
    'lines.bordersGlow': { ...glow(0.3), group: 'Borders', visible: (s) => s.lines.borders },
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
      group: 'Octaves',
      visible: (s) => s.lines.octaves,
    },
    'lines.octavesGlow': { ...glow(0.5), group: 'Octaves', visible: (s) => s.lines.octaves },
    'lines.barGlow': { ...glow(0, 'Bar line glow', 1), group: 'Bar & beat lines' },
    'lines.beatGlow': { ...glow(0, 'Beat line glow', 1), group: 'Bar & beat lines' },

    // Notes (decisions 19, 39–41) and the key colour fade-in
    'notes.heads3d': bool('3D note heads', true, sidebar('notes')),
    'notes.headHeight': {
      ...num('Head height', 0.35, sidebar('notes'), [0.05, 0.8, 0.05], 'mm'),
      visible: (s) => s.notes.heads3d,
    },
    'notes.headRounded': {
      ...bool('Rounded head edges', true, sidebar('notes')),
      visible: (s) => s.notes.heads3d,
    },
    'notes.blackLiftMode': {
      kind: 'choice',
      label: 'Black-lane notes',
      default: 'keys',
      home: sidebar('notes'),
      options: [
        { value: 'keys', label: 'At key height' },
        { value: 'manual', label: 'Manual' },
      ],
    },
    'notes.blackLift': {
      ...num('Lift', GRAND_BLACK_HEIGHT, sidebar('notes'), [0, 0.8, 0.01], 'mm'),
      visible: (s) => s.notes.blackLiftMode === 'manual',
    },
    'notes.contactShadow': bool('Shadow under black-lane notes', true, sidebar('notes')),
    'notes.shadowStrength': {
      ...num('Shadow strength', 0.45, sidebar('notes'), [0, 1, 0.01]),
      ...percent,
      visible: (s) => s.notes.contactShadow,
    },
    'notes.sustainCenterTransparency': {
      ...num('Sustain transparency, centre', 0.25, sidebar('notes'), [0, 1, 0.05]),
      ...percent,
    },
    'notes.sustainEdgeTransparency': {
      ...num('Sustain transparency, edges', 0.75, sidebar('notes'), [0, 1, 0.05]),
      ...percent,
    },
    'keys.fadeBeats': num('Key fade-in', 1, sidebar('notes'), [0, 4, 0.25], 'beats'),
    'keys.maxApproachAlpha': {
      ...num('Key colour before the note', 0.7, sidebar('notes'), [0, 1, 0.05]),
      ...percent,
    },

    // Note style (decisions 112–113)
    'noteStyle.headFill': { ...fill('Head fill', sidebar('noteStyle')), group: 'Fill' },
    'noteStyle.sustainFill': { ...fill('Sustain fill', sidebar('noteStyle')), group: 'Fill' },
    'noteStyle.gradientEnd': {
      ...num('Gradient end brightness', 0.35, sidebar('noteStyle'), [0, 1, 0.05]),
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
    'noteStyle.headStripeWidth': headStripes.width,
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
    'noteStyle.sustainStripeWidth': sustainStripes.width,
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
      ...num('Edge width', 0.04, sidebar('noteStyle'), [0.01, 0.2, 0.005], 'mm'),
      group: 'Edges',
      visible: (s) => s.noteStyle.edgeGlow,
      enabled: edgeApplies,
      disabledHint: EDGE_HINT,
    },
    'noteStyle.edgeIntensity': {
      ...glow(0.5, 'Edge intensity', 3, sidebar('noteStyle')),
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
      visible: (s) => s.names.mode !== 'off',
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
      visible: (s) => s.names.mode !== 'off',
      options: [
        { value: 'sharps', label: 'Sharps ♯' },
        { value: 'flats', label: 'Flats ♭' },
      ],
    },

    // Pedal & cages (decisions 115–116); the defaults are the pre-milestone-9 pedal band.
    'pedal.show': bool('Pedal sections', true, cages),
    'pedal.fill': { ...fill('Fill', cages), visible: (s) => s.pedal.show },
    'pedal.fillColor': { ...color('Fill colour', '#4A5468', cages), visible: (s) => s.pedal.show },
    'pedal.fillOpacity': {
      ...num('Fill opacity', 0.22, cages, [0, 1, 0.01]),
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
      ...num('Border width', 0.06, cages, [0.01, 0.4, 0.01], 'mm'),
      visible: (s) => s.pedal.show && s.pedal.border,
    },
    'pedal.borderGlow': {
      ...glow(0.3, 'Border glow', 3, cages),
      visible: (s) => s.pedal.show && s.pedal.border,
    },
    'pedal.cornerRadius': {
      ...num('Corner rounding', 0, cages, [0, 2, 0.05], 'mm'),
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
    'pedal.stripeWidth': pedalStripes.width,
    'pedal.stripeBalance': pedalStripes.balance,
    'pedal.stripeAngle': pedalStripes.angle,
    'pedal.stripeDrift': pedalStripes.drift,

    // Effects (decisions 47, 113, 117, 118)
    'effects.enabled': bool('Now-line effects', true, effects),
    'effects.velocityScaling': {
      ...bool('Size follows velocity', true, effects),
      visible: (s) => s.effects.enabled,
    },
    'effects.minScale': {
      ...num('Size at softest', 0.6, effects, [0.2, 3, 0.05], 'times'),
      visible: (s) => s.effects.enabled && s.effects.velocityScaling,
    },
    'effects.maxScale': {
      ...num('Size at loudest', 1.7, effects, [0.2, 3, 0.05], 'times'),
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
      ...glow(0.5, 'Pulse amount', 2, effects),
      group: 'Notes',
      visible: (s) => s.effects.pulse,
    },
    'effects.pulseDecayMs': {
      ...num('Pulse decay', 200, effects, [40, 1000, 10], 'ms', 0),
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
      ...num('Spill reach', 1.5, effects, [0.5, 4, 0.25], 'none', 2),
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
      ...num('Cone strength', 0.4, effects, [0, 1, 0.05]),
      ...percent,
      group: 'Keys',
      visible: (s) => s.effects.keyCone,
    },
    'effects.keyConeSpread': {
      ...num('Cone spread', 1, effects, [0.25, 3, 0.05], 'times'),
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
      group: BLOOM,
      enabled: (s) => s.render.bloomResolution !== 'off',
      disabledHint: BLOOM_HINT,
    },
    'render.bloomRadius': {
      ...num('Bloom radius', 0.4, render, [0, 1, 0.05]),
      ...percent,
      group: BLOOM,
      enabled: (s) => s.render.bloomResolution !== 'off',
      disabledHint: BLOOM_HINT,
    },
    'render.bloomThreshold': {
      ...num('Bloom threshold', 0.1, render, [0, 1, 0.01]),
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
  }
