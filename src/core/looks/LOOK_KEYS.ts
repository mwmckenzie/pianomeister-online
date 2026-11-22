import type { SettingKey } from '../settings/SettingKey'
import { SETTING_KEYS } from '../settings/SETTING_KEYS'

/** Whole sections that are appearance. */
const SECTIONS = new Set(['colors', 'opacity', 'lines', 'noteStyle', 'effects', 'pedal', 'names'])

/** Appearance settings in sections that also hold geometry, practice or cost settings. */
const SINGLE: ReadonlySet<SettingKey> = new Set<SettingKey>([
  'highway.blackLaneShading',
  'highway.blackLaneShadingStrength',
  'highway.vignette',
  'notes.heads3d',
  'notes.headHeight',
  'notes.headRounded',
  'notes.contactShadow',
  'notes.shadowStrength',
  'notes.sustainCenterTransparency',
  'notes.sustainEdgeTransparency',
  'keys.maxApproachAlpha',
  'render.bloomStrength',
  'render.bloomRadius',
  'render.bloomThreshold',
])

/**
 * The settings a look holds (brief decision 121): how the scene looks — not the camera,
 * keyboard dimensions, look-ahead, black-lane lift, key fade timing or render cost.
 */
export const LOOK_KEYS: readonly SettingKey[] = SETTING_KEYS.filter(
  (key) => SECTIONS.has(key.split('.')[0] as string) || SINGLE.has(key),
)
