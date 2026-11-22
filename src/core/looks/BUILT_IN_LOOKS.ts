import type { SettingKey } from '../settings/SettingKey'
import type { Look } from './Look'

/**
 * The pre-milestone-9 look, frozen: every look key pinned, so no default change (the tuning
 * session included) can move it. Settings that existed in milestone 8 keep their milestone 8
 * values; every milestone 9 effect is off, and its knobs hold the values they had when Classic
 * was pinned (milestone 9.1).
 */
const CLASSIC: Readonly<Record<SettingKey, unknown>> = {
  'camera.tiltDeg': 45,
  'camera.distanceOffset': 0,
  'camera.pan': 0,
  'keyboard.thickness': 0.6,
  'keyboard.gap': 0.06,
  'keyboard.blackLengthRatio': 0.63,
  'keyboard.blackHeight': 0.5106382978723404,
  'keyboard.edgeProfile': 'chamfer',
  'keyboard.edgeSize': 0.04,
  'keyboard.animate': true,
  'keyboard.pressDepthWhite': 0.22,
  'keyboard.pressDepthBlack': 0.3,
  'keyboard.pivotOffsetWhite': 0,
  // 8.04 until milestone 9.1 trimmed the range to 0–8; the press looks the same.
  'keyboard.pivotOffsetBlack': 8,
  'highway.lookAheadBeats': 8,
  'highway.blackLaneShading': true,
  'highway.blackLaneShadingStrength': 0.22,
  'highway.vignette': 0,
  'colors.background': '#05070F',
  'colors.highway': '#0A0F1E',
  'colors.lane': '#3A4A6E',
  'opacity.lane': 0.35,
  'colors.bar': '#5C6F99',
  'opacity.bar': 0.6,
  'colors.beat': '#5C6F99',
  'opacity.beat': 0.12,
  'lines.nowStyle': 'thin',
  'lines.nowColor': 'custom',
  'lines.nowCustom': '#BFD2FF',
  'lines.nowWidth': 0.08,
  'lines.nowGlow': 0,
  'lines.borders': false,
  'lines.bordersColor': 'custom',
  'lines.bordersCustom': '#5C6F99',
  'lines.bordersWidth': 0.05,
  'lines.bordersGlow': 0.3,
  'lines.octaves': false,
  'lines.octavesEF': false,
  'lines.octavesColor': 'secondary',
  'lines.octavesCustom': '#7EE0C3',
  'lines.octavesWidth': 0.05,
  'lines.octavesGlow': 0.5,
  'lines.barGlow': 0,
  'lines.beatGlow': 0,
  'notes.heads3d': true,
  'notes.headHeight': 0.35,
  'notes.headRounded': true,
  'notes.blackLiftMode': 'keys',
  'notes.blackLift': 0.5106382978723404,
  'notes.contactShadow': true,
  'notes.shadowStrength': 0.45,
  'notes.sustainCenterTransparency': 0.25,
  'notes.sustainEdgeTransparency': 0.75,
  'keys.fadeBeats': 1,
  'keys.maxApproachAlpha': 0.7,
  'noteStyle.headFill': 'solid',
  'noteStyle.sustainFill': 'solid',
  'noteStyle.gradientEnd': 0.35,
  'noteStyle.neonFlicker': false,
  'noteStyle.headStripeA': 'note',
  'noteStyle.headStripeACustom': '#FAC400',
  'noteStyle.headStripeB': 'darker',
  'noteStyle.headStripeBCustom': '#141414',
  'noteStyle.headStripeAOpacity': 1,
  'noteStyle.headStripeBOpacity': 1,
  'noteStyle.headStripeWidth': 0.35,
  'noteStyle.headStripeBalance': 0.5,
  'noteStyle.headStripeAngle': 45,
  'noteStyle.headStripeDrift': false,
  'noteStyle.sustainStripeA': 'note',
  'noteStyle.sustainStripeACustom': '#FAC400',
  'noteStyle.sustainStripeB': 'darker',
  'noteStyle.sustainStripeBCustom': '#141414',
  'noteStyle.sustainStripeAOpacity': 1,
  'noteStyle.sustainStripeBOpacity': 1,
  'noteStyle.sustainStripeWidth': 0.35,
  'noteStyle.sustainStripeBalance': 0.5,
  'noteStyle.sustainStripeAngle': 45,
  'noteStyle.sustainStripeDrift': false,
  'noteStyle.edgeGlow': false,
  'noteStyle.edgeWidth': 0.04,
  'noteStyle.edgeIntensity': 0.5,
  'names.mode': 'off',
  'names.octave': 'c',
  'names.accidentals': 'sharps',
  'names.style': 'facing',
  'names.textSize': 12,
  'names.textColor': 'auto',
  'names.shadow': 0.6,
  'names.showWithin': 0.6,
  'names.fadeLength': 0.15,
  'names.anchor': 'ahead',
  'names.offset': 0,
  'names.height': 6,
  'names.avoidOverlaps': true,
  'names.repeats': 'bar',
  'names.glow': 'off',
  'names.keySize': 11,
  'pedal.show': true,
  'pedal.fill': 'solid',
  'pedal.fillColor': '#4A5468',
  'pedal.fillOpacity': 0.22,
  'pedal.border': false,
  'pedal.borderColor': 'custom',
  'pedal.borderCustom': '#7A86A0',
  'pedal.borderWidth': 0.06,
  'pedal.borderGlow': 0.3,
  'pedal.cornerRadius': 0,
  'pedal.stripeA': '#FAC400',
  'pedal.stripeB': '#141414',
  'pedal.stripeAOpacity': 1,
  'pedal.stripeBOpacity': 1,
  'pedal.stripeWidth': 1,
  'pedal.stripeBalance': 0.5,
  'pedal.stripeAngle': 45,
  'pedal.stripeDrift': false,
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
  'effects.scalingSparksSize': 1,
  'effects.scalingSparksCount': 1,
  'effects.scalingSparksLifetime': 1,
  'effects.scalingSparksSpread': 1,
  'effects.flame': false,
  'effects.flameSize': 1,
  'effects.flameCount': 1,
  'effects.flameLifetime': 1,
  'effects.flameSpread': 1,
  'effects.explosion': false,
  'effects.explosionSize': 1,
  'effects.explosionCount': 1,
  'effects.explosionLifetime': 1,
  'effects.explosionSpread': 1,
  'effects.glitter': false,
  'effects.glitterSize': 1,
  'effects.glitterCount': 1,
  'effects.glitterLifetime': 1,
  'effects.glitterSpread': 1,
  'effects.sustain': 'glow',
  'effects.sustainSize': 1,
  'effects.sustainCount': 1,
  'effects.sustainLifetime': 1,
  'effects.sustainSpread': 1,
  'effects.pulse': false,
  'effects.pulseAmount': 0.5,
  'effects.pulseDecayMs': 200,
  'effects.soundingGlow': false,
  'effects.soundingGlowAmount': 0.3,
  'effects.breathing': false,
  'effects.keySpill': false,
  'effects.keySpillStrength': 0.25,
  'effects.keySpillSpread': 1.5,
  'effects.keyCone': false,
  'effects.keyConeStrength': 0.4,
  'effects.keyConeSpread': 1,
  'render.bloomStrength': 0,
  'render.bloomRadius': 0.4,
  'render.bloomThreshold': 0.1,
} as Readonly<Record<SettingKey, unknown>>

/**
 * The playfield defaults when the built-in looks were made (milestone 9.1), pinned like Classic:
 * every look below is this plus its own changes, so no later default change moves a look.
 */
const BASE: Readonly<Record<SettingKey, unknown>> = {
  'camera.tiltDeg': 45,
  'camera.distanceOffset': 0,
  'camera.pan': 0,
  'keyboard.thickness': 0.6,
  'keyboard.gap': 0.06,
  'keyboard.blackLengthRatio': 0.63,
  'keyboard.blackHeight': 0.5106382978723404,
  'keyboard.edgeProfile': 'chamfer',
  'keyboard.edgeSize': 0.04,
  'keyboard.animate': true,
  'keyboard.pressDepthWhite': 0.22,
  'keyboard.pressDepthBlack': 0.3,
  'keyboard.pivotOffsetWhite': 0,
  'keyboard.pivotOffsetBlack': 8,
  'highway.lookAheadBeats': 8,
  'highway.blackLaneShading': true,
  'highway.blackLaneShadingStrength': 0.22,
  'highway.vignette': 0.2,
  'colors.background': '#03050B',
  'colors.highway': '#070B16',
  'colors.lane': '#3A4A6E',
  'opacity.lane': 0.35,
  'colors.bar': '#5C6F99',
  'opacity.bar': 0.6,
  'colors.beat': '#5C6F99',
  'opacity.beat': 0.12,
  'lines.nowStyle': 'glowing',
  'lines.nowColor': 'custom',
  'lines.nowCustom': '#BFD2FF',
  'lines.nowWidth': 0.08,
  'lines.nowGlow': 0.6,
  'lines.borders': true,
  'lines.bordersColor': 'custom',
  'lines.bordersCustom': '#5C6F99',
  'lines.bordersWidth': 0.05,
  'lines.bordersGlow': 0.3,
  'lines.octaves': false,
  'lines.octavesEF': false,
  'lines.octavesColor': 'secondary',
  'lines.octavesCustom': '#7EE0C3',
  'lines.octavesWidth': 0.05,
  'lines.octavesGlow': 0.5,
  'lines.barGlow': 0,
  'lines.beatGlow': 0,
  'notes.heads3d': true,
  'notes.headHeight': 0.35,
  'notes.headRounded': true,
  'notes.blackLiftMode': 'keys',
  'notes.blackLift': 0.5106382978723404,
  'notes.contactShadow': true,
  'notes.shadowStrength': 0.45,
  'notes.sustainCenterTransparency': 0.25,
  'notes.sustainEdgeTransparency': 0.75,
  'keys.fadeBeats': 1,
  'keys.maxApproachAlpha': 0.7,
  'noteStyle.headFill': 'solid',
  'noteStyle.sustainFill': 'solid',
  'noteStyle.gradientEnd': 0.35,
  'noteStyle.neonFlicker': false,
  'noteStyle.headStripeA': 'note',
  'noteStyle.headStripeACustom': '#FAC400',
  'noteStyle.headStripeB': 'darker',
  'noteStyle.headStripeBCustom': '#141414',
  'noteStyle.headStripeAOpacity': 1,
  'noteStyle.headStripeBOpacity': 1,
  'noteStyle.headStripeWidth': 0.35,
  'noteStyle.headStripeBalance': 0.5,
  'noteStyle.headStripeAngle': 45,
  'noteStyle.headStripeDrift': false,
  'noteStyle.sustainStripeA': 'note',
  'noteStyle.sustainStripeACustom': '#FAC400',
  'noteStyle.sustainStripeB': 'darker',
  'noteStyle.sustainStripeBCustom': '#141414',
  'noteStyle.sustainStripeAOpacity': 1,
  'noteStyle.sustainStripeBOpacity': 1,
  'noteStyle.sustainStripeWidth': 0.35,
  'noteStyle.sustainStripeBalance': 0.5,
  'noteStyle.sustainStripeAngle': 45,
  'noteStyle.sustainStripeDrift': false,
  'noteStyle.edgeGlow': true,
  'noteStyle.edgeWidth': 0.04,
  'noteStyle.edgeIntensity': 0.5,
  'names.mode': 'off',
  'names.octave': 'c',
  'names.accidentals': 'sharps',
  'names.style': 'facing',
  'names.textSize': 12,
  'names.textColor': 'auto',
  'names.shadow': 0.6,
  'names.showWithin': 0.6,
  'names.fadeLength': 0.15,
  'names.anchor': 'ahead',
  'names.offset': 0,
  'names.height': 6,
  'names.avoidOverlaps': true,
  'names.repeats': 'bar',
  'names.glow': 'off',
  'names.keySize': 11,
  'pedal.show': true,
  'pedal.fill': 'solid',
  'pedal.fillColor': '#4A5468',
  'pedal.fillOpacity': 0.22,
  'pedal.border': false,
  'pedal.borderColor': 'custom',
  'pedal.borderCustom': '#7A86A0',
  'pedal.borderWidth': 0.06,
  'pedal.borderGlow': 0.3,
  'pedal.cornerRadius': 0,
  'pedal.stripeA': '#FAC400',
  'pedal.stripeB': '#141414',
  'pedal.stripeAOpacity': 1,
  'pedal.stripeBOpacity': 1,
  'pedal.stripeWidth': 1,
  'pedal.stripeBalance': 0.5,
  'pedal.stripeAngle': 45,
  'pedal.stripeDrift': false,
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
  'effects.scalingSparksSize': 1,
  'effects.scalingSparksCount': 1,
  'effects.scalingSparksLifetime': 1,
  'effects.scalingSparksSpread': 1,
  'effects.flame': false,
  'effects.flameSize': 1,
  'effects.flameCount': 1,
  'effects.flameLifetime': 1,
  'effects.flameSpread': 1,
  'effects.explosion': false,
  'effects.explosionSize': 1,
  'effects.explosionCount': 1,
  'effects.explosionLifetime': 1,
  'effects.explosionSpread': 1,
  'effects.glitter': false,
  'effects.glitterSize': 1,
  'effects.glitterCount': 1,
  'effects.glitterLifetime': 1,
  'effects.glitterSpread': 1,
  'effects.sustain': 'glow',
  'effects.sustainSize': 1,
  'effects.sustainCount': 1,
  'effects.sustainLifetime': 1,
  'effects.sustainSpread': 1,
  'effects.pulse': true,
  'effects.pulseAmount': 0.5,
  'effects.pulseDecayMs': 200,
  'effects.soundingGlow': true,
  'effects.soundingGlowAmount': 0.3,
  'effects.breathing': false,
  'effects.keySpill': true,
  'effects.keySpillStrength': 0.25,
  'effects.keySpillSpread': 1.5,
  'effects.keyCone': false,
  'effects.keyConeStrength': 0.4,
  'effects.keyConeSpread': 1,
  'render.bloomStrength': 0.8,
  'render.bloomRadius': 0.4,
  'render.bloomThreshold': 0.1,
} as Readonly<Record<SettingKey, unknown>>

/** A look on the pinned base. Levels follow the trimmed ranges: subtle / medium / strong are 20 / 50 / 80 % of the slider (its log position for a log slider). */
const on = (changes: Readonly<Partial<Record<SettingKey, unknown>>>) => ({ ...BASE, ...changes })

/** No onset effects and no sustain effect. */
const QUIET = { 'effects.sparks': false, 'effects.sustain': 'none' } as const

const STUDY = on({
  ...QUIET,
  'names.mode': 'both',
  'names.octave': 'c',
  'lines.borders': true,
  'lines.octaves': true,
  'lines.octavesEF': true,
  'lines.octavesGlow': 0.1, // subtle
  'noteStyle.headFill': 'solid',
  'noteStyle.sustainFill': 'solid',
  'noteStyle.edgeGlow': true,
  'noteStyle.edgeIntensity': 0.2, // subtle
  'lines.nowStyle': 'thin',
  'lines.nowColor': 'white',
  'effects.pulse': true,
  'effects.pulseAmount': 0.25, // subtle
  'effects.soundingGlow': true,
  'effects.breathing': false,
  'effects.keySpill': false,
  'render.bloomStrength': 0.1, // subtle
})

const NIGHT_FOCUS = on({
  ...QUIET,
  'colors.highway': '#05060A',
  'opacity.lane': 0.1, // barely visible
  'highway.vignette': 0.8, // strong
  'noteStyle.headFill': 'solid',
  'noteStyle.sustainFill': 'gradient',
  'noteStyle.gradientEnd': 0.15, // a dim tail
  'lines.nowStyle': 'glowing',
  'lines.nowColor': 'primary', // #8AB4FF, the default primary
  'effects.soundingGlow': true,
  'effects.soundingGlowAmount': 0.2, // subtle
  'effects.pulse': false,
  'render.bloomStrength': 0.1, // subtle
  'render.bloomThreshold': 0.32, // high: only the now line and sounding notes
})

const BLUEPRINT_BLUE = '#6FA8FF'
const BLUEPRINT = on({
  'colors.highway': '#07101F',
  // Notes keep their pitch colours (there is no note colour setting); the blue is in the lines.
  'noteStyle.headFill': 'outline',
  'noteStyle.sustainFill': 'outline',
  'opacity.bar': 0.8, // visible
  'opacity.beat': 0.1, // subtle
  'lines.borders': true,
  'lines.bordersColor': 'custom',
  'lines.bordersCustom': BLUEPRINT_BLUE,
  'lines.bordersGlow': 0.4, // medium
  'lines.octaves': true,
  'lines.octavesEF': false,
  'lines.octavesColor': 'custom',
  'lines.octavesCustom': BLUEPRINT_BLUE,
  'lines.octavesGlow': 0.4, // medium
  'lines.nowStyle': 'thin',
  'lines.nowColor': 'white',
  'effects.sparks': false,
  'pedal.show': true,
  'pedal.fillOpacity': 0, // border only
  'pedal.border': true,
  'pedal.borderColor': 'custom',
  'pedal.borderCustom': BLUEPRINT_BLUE,
  'render.bloomStrength': 0.4, // medium
})

const NEON = on({
  'noteStyle.headFill': 'neon',
  'noteStyle.sustainFill': 'neon',
  'lines.nowStyle': 'neon',
  'lines.nowColor': 'pitch',
  'effects.sparks': true,
  'lines.borders': true,
  'lines.bordersGlow': 0.4, // glowing: medium
  'render.bloomStrength': 1.3, // strong
})

const EMBER = on({
  'noteStyle.headFill': 'hotCore',
  'noteStyle.sustainFill': 'gradient',
  'effects.sustain': 'embers',
  'effects.sparks': false,
  'effects.scalingSparks': true,
  'lines.nowStyle': 'glowing',
  'lines.nowColor': 'custom',
  'lines.nowCustom': '#FFB46B',
  'effects.keySpill': true,
  'render.bloomStrength': 0.4, // medium
})

const CRYSTAL = on({
  'noteStyle.headFill': 'crystal',
  'noteStyle.sustainFill': 'crystal',
  'effects.sparks': false,
  'effects.glitter': true,
  // Cool lines in Primary: the now line and the borders.
  'lines.nowColor': 'primary',
  'lines.borders': true,
  'lines.bordersColor': 'primary',
  'effects.keyCone': true,
  'render.bloomStrength': 0.4, // medium
  'render.bloomThreshold': 0.08, // low
})

const AURORA = on({
  'noteStyle.headFill': 'gradient',
  'noteStyle.sustainFill': 'gradient',
  'effects.sustain': 'smoke',
  'effects.sparks': false, // not named; a soft look
  // "Glow in Secondary": the borders glow in Secondary (#7EE0C3, the default secondary).
  'lines.borders': true,
  'lines.bordersColor': 'secondary',
  'lines.bordersGlow': 0.4, // medium
  'lines.nowStyle': 'neon',
  'lines.nowColor': 'secondary',
  'effects.soundingGlow': true,
  'effects.breathing': true,
  'render.bloomRadius': 0.8, // wide
  'render.bloomStrength': 0.4, // medium
})

const SYNTH_PINK = '#FF4FD8'
const SYNTH_CYAN = '#4FE3FF'
const SYNTHWAVE = on({
  'colors.highway': '#0A0612',
  'lines.borders': true,
  'lines.bordersColor': 'custom',
  'lines.bordersCustom': SYNTH_PINK,
  'lines.bordersGlow': 0.4, // glowing: medium
  'lines.octaves': true,
  'lines.octavesColor': 'custom',
  'lines.octavesCustom': SYNTH_CYAN,
  'lines.octavesGlow': 0.4, // glowing: medium
  'noteStyle.headFill': 'neon',
  'noteStyle.sustainFill': 'stripes',
  'lines.nowStyle': 'neon',
  'lines.nowColor': 'custom',
  'lines.nowCustom': SYNTH_PINK,
  'effects.sparks': false,
  'effects.scalingSparks': true,
  'pedal.show': true,
  'pedal.fill': 'stripes',
  // Stripe colours aren't named: the cyan of the border on the highway colour.
  'pedal.stripeA': SYNTH_CYAN,
  'pedal.stripeB': '#0A0612',
  // The pedal is down most of the time: quiet stripes keep the notes on top.
  'pedal.stripeAOpacity': 0.25,
  'pedal.stripeBOpacity': 0.5,
  'pedal.border': true,
  'pedal.borderColor': 'custom',
  'pedal.borderCustom': SYNTH_CYAN,
  'effects.keyCone': true,
  'render.bloomStrength': 1.3, // strong
})

const INFERNO = on({
  'noteStyle.headFill': 'hotCore',
  'noteStyle.sustainFill': 'hotCore',
  'effects.sparks': false,
  'effects.flame': true,
  'effects.sustain': 'flames',
  'lines.nowStyle': 'neon',
  'lines.nowColor': 'custom',
  'lines.nowCustom': '#FF8A3D',
  'effects.keySpill': true,
  'effects.keySpillStrength': 0.8, // strong
  'effects.keyCone': true,
  'effects.pulse': true,
  'effects.pulseAmount': 0.95, // strong
  'render.bloomStrength': 1.3, // strong
  'highway.vignette': 0.5, // medium
})

const STARDUST = on({
  'colors.highway': '#04040A',
  'noteStyle.headFill': 'bubbles',
  'noteStyle.sustainFill': 'gradient',
  // There is no note colour setting: a light tail stands in for "#E9E4FF-ish" sustains.
  'noteStyle.gradientEnd': 0.65,
  'effects.sparks': false,
  'effects.glitter': true,
  'effects.sustain': 'glow',
  'effects.soundingGlow': true,
  'effects.breathing': true,
  'lines.nowStyle': 'glowing',
  'lines.nowColor': 'pitch',
  'render.bloomStrength': 0.4, // medium
  'render.bloomThreshold': 0.08, // low
  'render.bloomRadius': 0.8, // wide
})

const MIST = on({
  'noteStyle.headFill': 'gradient',
  'noteStyle.gradientEnd': 0.4, // soft
  'noteStyle.sustainFill': 'smoke',
  'effects.sustain': 'smoke',
  'effects.sparks': false, // not named; a soft look
  // No lines except a thin now line.
  'lines.borders': false,
  'lines.octaves': false,
  'opacity.lane': 0,
  'opacity.bar': 0,
  'opacity.beat': 0,
  'lines.nowStyle': 'thin',
  'lines.nowColor': 'custom',
  'lines.nowCustom': '#B8C7E0',
  'pedal.show': true,
  'pedal.fill': 'smoke',
  'render.bloomRadius': 0.8, // wide
  'render.bloomStrength': 0.1, // low
})

const FIREWORKS = on({
  'effects.sparks': false,
  'effects.glitter': false,
  'effects.explosion': true,
  'effects.explosionCount': 1.65, // strong
  'noteStyle.headFill': 'neon',
  'noteStyle.sustainFill': 'solid',
  'effects.pulse': true,
  'effects.pulseAmount': 0.95, // strong
  'lines.nowStyle': 'glowing',
  'lines.nowColor': 'white',
  'render.bloomStrength': 1.3, // strong
  'highway.lookAheadBeats': 10, // a little more than the default 8: room for the bursts
})

const HAZARD_YELLOW = '#FFC21A'
const HAZARD_BLACK = '#141414'
const HAZARD = on({
  ...QUIET,
  'colors.highway': '#0B0B0D',
  'noteStyle.headFill': 'stripes',
  'noteStyle.sustainFill': 'stripes',
  'noteStyle.headStripeA': 'custom',
  'noteStyle.headStripeACustom': HAZARD_YELLOW,
  'noteStyle.headStripeB': 'custom',
  'noteStyle.headStripeBCustom': HAZARD_BLACK,
  'noteStyle.sustainStripeA': 'custom',
  'noteStyle.sustainStripeACustom': HAZARD_YELLOW,
  'noteStyle.sustainStripeB': 'custom',
  'noteStyle.sustainStripeBCustom': HAZARD_BLACK,
  'noteStyle.edgeGlow': false,
  'lines.nowStyle': 'thin',
  'lines.nowColor': 'white',
  'lines.borders': true,
  'lines.bordersGlow': 0, // plain lines
  'pedal.show': true,
  'pedal.fill': 'stripes',
  'pedal.stripeA': HAZARD_YELLOW,
  'pedal.stripeB': HAZARD_BLACK,
  // Quiet stripes: full-strength yellow under yellow-striped notes hid the notes.
  'pedal.stripeAOpacity': 0.2,
  'pedal.stripeBOpacity': 0.5,
  'pedal.border': true,
  'pedal.borderColor': 'custom',
  'pedal.borderCustom': HAZARD_YELLOW,
  'pedal.borderGlow': 0,
  'render.bloomStrength': 0, // bloom off: flat and graphic
})

/** When the built-in looks were made; they never change, so neither does this. */
const BUILT_IN_DATE = '2026-11-22T00:00:00.000Z'

const builtIn = (id: string, name: string, values: Look['values']): Look => ({
  id: `builtin:${id}`,
  name,
  builtIn: true,
  createdAt: BUILT_IN_DATE,
  updatedAt: BUILT_IN_DATE,
  values,
})

/** Built-in looks, shown first in the Look picker in this order (milestone 9.1, section C). */
export const BUILT_IN_LOOKS: readonly Look[] = [
  builtIn('classic', 'Classic', CLASSIC),
  builtIn('study', 'Study', STUDY),
  builtIn('night-focus', 'Night Focus', NIGHT_FOCUS),
  builtIn('blueprint', 'Blueprint', BLUEPRINT),
  builtIn('neon', 'Neon', NEON),
  builtIn('ember', 'Ember', EMBER),
  builtIn('crystal', 'Crystal', CRYSTAL),
  builtIn('aurora', 'Aurora', AURORA),
  builtIn('synthwave', 'Synthwave', SYNTHWAVE),
  builtIn('inferno', 'Inferno', INFERNO),
  builtIn('stardust', 'Stardust', STARDUST),
  builtIn('mist', 'Mist', MIST),
  builtIn('fireworks', 'Fireworks', FIREWORKS),
  builtIn('hazard', 'Hazard', HAZARD),
]
