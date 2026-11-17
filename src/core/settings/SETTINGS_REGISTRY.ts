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
    'colors.background': color('Background', '#05070F', sidebar('highway')),
    'colors.highway': color('Highway', '#0A0F1E', sidebar('highway')),
    'colors.lane': color('Lane lines', '#3A4A6E', sidebar('highway')),
    'opacity.lane': {
      ...num('Lane line opacity', 0.35, sidebar('highway'), [0, 1, 0.01]),
      ...percent,
    },
    'colors.bar': color('Bar lines', '#5C6F99', sidebar('highway')),
    'opacity.bar': {
      ...num('Bar line opacity', 0.6, sidebar('highway'), [0, 1, 0.01]),
      ...percent,
    },
    'colors.beat': color('Beat lines', '#5C6F99', sidebar('highway')),
    'opacity.beat': {
      ...num('Beat line opacity', 0.12, sidebar('highway'), [0, 1, 0.01]),
      ...percent,
    },
    'colors.pedal': color('Pedal band', '#4A5468', sidebar('highway')),
    'opacity.pedal': {
      ...num('Pedal band opacity', 0.22, sidebar('highway'), [0, 1, 0.01]),
      ...percent,
    },

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

    // Effects (decision 47)
    'effects.enabled': bool('Now-line sparks and glow', true, sidebar('effects')),
    'effects.velocityScaling': {
      ...bool('Size follows velocity', true, sidebar('effects')),
      visible: (s) => s.effects.enabled,
    },
    'effects.minScale': {
      ...num('Size at softest', 0.6, sidebar('effects'), [0.2, 3, 0.05], 'times'),
      visible: (s) => s.effects.enabled && s.effects.velocityScaling,
    },
    'effects.maxScale': {
      ...num('Size at loudest', 1.7, sidebar('effects'), [0.2, 3, 0.05], 'times'),
      visible: (s) => s.effects.enabled && s.effects.velocityScaling,
    },

    // Render quality (decision 48)
    'render.scaleAuto': bool('Match the display (auto)', true, sidebar('render')),
    'render.scale': {
      ...num('Render scale', 1, sidebar('render'), [0.5, 2, 0.05], 'times'),
      visible: (s) => !s.render.scaleAuto,
    },
    'render.maxPixelRatio': num('Max pixel ratio', 2, sidebar('render'), [1, 4, 0.25], 'times'),
    'render.antialias': {
      kind: 'choice',
      label: 'Anti-aliasing',
      default: 'msaa',
      home: sidebar('render'),
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
    'appearance.hideControls': {
      kind: 'choice',
      label: 'Hide controls when idle',
      default: '3',
      home: tab('appearance', 'playerControls'),
      options: [
        { value: 'off', label: 'Off' },
        { value: '2', label: '2 s' },
        { value: '3', label: '3 s' },
        { value: '5', label: '5 s' },
        { value: '10', label: '10 s' },
      ],
    },
  }
