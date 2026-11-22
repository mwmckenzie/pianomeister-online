import type { SettingKey } from '../settings/SettingKey'
import { defaultValue } from '../settings/settingValues'
import type { Look } from './Look'
import { LOOK_KEYS } from './LOOK_KEYS'

/**
 * The pre-milestone-9 look, frozen: every setting that existed before keeps its milestone 8
 * default here even if the tuning session changes the default, and every new effect is off.
 * Settings not listed (knobs of effects that are off) follow their defaults.
 */
const CLASSIC: Readonly<Partial<Record<SettingKey, unknown>>> = {
  'highway.blackLaneShading': true,
  'highway.blackLaneShadingStrength': 0.22,
  'highway.vignette': 0,
  'colors.background': '#05070F',
  'colors.highway': '#0A0F1E',
  'colors.lane': '#3A4A6E',
  'colors.bar': '#5C6F99',
  'colors.beat': '#5C6F99',
  'opacity.lane': 0.35,
  'opacity.bar': 0.6,
  'opacity.beat': 0.12,
  'notes.heads3d': true,
  'notes.headHeight': 0.35,
  'notes.headRounded': true,
  'notes.contactShadow': true,
  'notes.shadowStrength': 0.45,
  'notes.sustainCenterTransparency': 0.25,
  'notes.sustainEdgeTransparency': 0.75,
  'keys.maxApproachAlpha': 0.7,
  'lines.nowStyle': 'thin',
  'lines.nowColor': 'custom',
  'lines.nowCustom': '#BFD2FF',
  'lines.nowWidth': 0.08,
  'lines.nowGlow': 0,
  'lines.borders': false,
  'lines.octaves': false,
  'lines.octavesEF': false,
  'lines.barGlow': 0,
  'lines.beatGlow': 0,
  'noteStyle.headFill': 'solid',
  'noteStyle.sustainFill': 'solid',
  'noteStyle.edgeGlow': false,
  'names.mode': 'off',
  'pedal.show': true,
  'pedal.fill': 'solid',
  'pedal.fillColor': '#4A5468',
  'pedal.fillOpacity': 0.22,
  'pedal.border': false,
  'effects.enabled': true,
  'effects.velocityScaling': true,
  'effects.minScale': 0.6,
  'effects.maxScale': 1.7,
  'effects.sparks': true,
  'effects.sparksSize': 1,
  'effects.sparksCount': 1,
  'effects.sparksLifetime': 1,
  'effects.sparksSpread': 1,
  'effects.scalingSparks': false,
  'effects.flame': false,
  'effects.explosion': false,
  'effects.glitter': false,
  'effects.sustain': 'glow',
  'effects.pulse': false,
  'effects.soundingGlow': false,
  'effects.keySpill': false,
  'effects.keyCone': false,
  'render.bloomStrength': 0,
}

function complete(values: Readonly<Partial<Record<SettingKey, unknown>>>) {
  return Object.fromEntries(LOOK_KEYS.map((key) => [key, values[key] ?? defaultValue(key)]))
}

/** Built-in looks, shown first in the Look picker. The tuning session adds 3–5 more. */
export const BUILT_IN_LOOKS: readonly Look[] = [
  { id: 'builtin:classic', name: 'Classic', builtIn: true, values: complete(CLASSIC) },
]
