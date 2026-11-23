import type { HandAudio } from '../practice/HandAudio'
import type { PreRollMode } from '../transport/PreRollMode'
import type { LineColor } from './LineColor'
import type { NoteFill } from './NoteFill'
import type { NotePalette } from './NotePalette'
import type { QualityPreset } from './QualityPreset'
import type { StripeColor } from './StripeColor'

/**
 * App settings (playfield, audio, practice, appearance), persisted in localStorage until
 * profiles arrive (milestone 7). Each setting is declared once in SETTINGS_REGISTRY.
 * Colors are #rrggbb; opacities, transparencies and strengths are 0–1; lengths are world units
 * (1 = one white-key width).
 */
export interface PlayerSettings {
  readonly camera: {
    readonly tiltDeg: number
    /** 0 = the keyboard exactly fills the width; positive = farther, negative = closer (crops). */
    readonly distanceOffset: number
    /** Sideways shift in white-key widths. */
    readonly pan: number
  }
  readonly highway: {
    /** Quarter notes from the now line to the 1x look-ahead point (the haze runs to 1.5x). */
    readonly lookAheadBeats: number
    /** Black-key lanes darker than white-key lanes. */
    readonly blackLaneShading: boolean
    readonly blackLaneShadingStrength: number
    /** Darkening towards the screen corners, 0 = none (milestone 9). */
    readonly vignette: number
  }
  readonly keys: {
    /** Fade-in window before an onset, in quarter notes. */
    readonly fadeBeats: number
    readonly maxApproachAlpha: number
  }
  readonly keyboard: {
    /** Height of the key bodies (white and black). */
    readonly thickness: number
    /** Space between neighbouring white keys (key bodies shrink; lanes never move). */
    readonly gap: number
    /** Black key length as a fraction of the white key length. */
    readonly blackLengthRatio: number
    /**
     * Black key top above the white key tops. At most the key thickness, so a black key's body
     * always reaches down to the white keys (see constrainKeyboard).
     */
    readonly blackHeight: number
    readonly edgeProfile: 'none' | 'chamfer' | 'rounded'
    readonly edgeSize: number
    /** Keys pivot down while their note sounds. */
    readonly animate: boolean
    /** How far the front edge of a pressed white key drops. At most the key thickness. */
    readonly pressDepthWhite: number
    /**
     * How far the front edge of a pressed black key drops. At most blackHeight − 0.08, so a
     * pressed black key's top stays above the white key tops.
     */
    readonly pressDepthBlack: number
    /**
     * Distance of the pivot behind each key's visible back edge (0 = at the back edge). Real keys
     * pivot far behind (the balance rail), so they mostly drop with only a slight tilt.
     */
    readonly pivotOffsetWhite: number
    readonly pivotOffsetBlack: number
  }
  readonly notes: {
    /** Note colours: what notes, pressed keys, note-coloured effects and labels use. */
    readonly palette: NotePalette
    /** Mono: the colour of every note. */
    readonly paletteMono: string
    /** Two-tone: notes on white keys. */
    readonly paletteWhite: string
    /** Two-tone: notes on black keys. */
    readonly paletteBlack: string
    readonly sustainCenterTransparency: number
    readonly sustainEdgeTransparency: number
    /** Heads as raised blocks instead of flat strips. */
    readonly heads3d: boolean
    /** 3D head heights; both heads start on the highway (milestone 9.2). */
    readonly whiteHeadHeight: number
    readonly blackHeadHeight: number
    readonly headRounded: boolean
    /** How much darker the side faces of black-lane 3D heads are than their tops (0–1). */
    readonly blackSideShading: number
    /** Black-lane sustains as a low raised ridge (3D heads only). */
    readonly blackRidge: boolean
    readonly blackRidgeHeight: number
    /** A thin dark rim around black-lane notes, on the highway and the white notes beside them. */
    readonly blackOutline: boolean
    readonly blackOutlineStrength: number
  }
  readonly colors: {
    readonly background: string
    readonly highway: string
    readonly lane: string
    readonly bar: string
    readonly beat: string
  }
  readonly opacity: {
    readonly lane: number
    readonly bar: number
    readonly beat: number
  }
  /**
   * Glowing lines (brief decision 111). Widths are world units; glow is the line's strength on
   * the glow layer (0 = it doesn't bloom). Colours name a UI colour or use the `…Custom` value.
   */
  /** Loop visibility on the highway (milestone 9.2). */
  readonly loop: {
    /** Everything on the highway outside [loop start, loop end) is dimmed while a loop is on. */
    readonly dim: boolean
    readonly dimStrength: number
    /** Lines across the highway at the loop start and end. */
    readonly lines: boolean
    readonly linesColor: LineColor
    readonly linesCustom: string
    readonly linesWidth: number
    readonly linesGlow: number
    /** Beyond the loop end: the next iteration ('repeat') or the song as it is ('continue'). */
    readonly after: 'repeat' | 'continue'
  }
  readonly lines: {
    readonly nowStyle: 'thin' | 'glowing' | 'neon'
    readonly nowColor: LineColor | 'pitch'
    readonly nowCustom: string
    readonly nowWidth: number
    readonly nowGlow: number
    readonly borders: boolean
    readonly bordersColor: LineColor
    readonly bordersCustom: string
    readonly bordersWidth: number
    readonly bordersGlow: number
    /** A line on every B/C boundary. */
    readonly octaves: boolean
    /** Also on every E/F boundary. */
    readonly octavesEF: boolean
    readonly octavesColor: LineColor
    readonly octavesCustom: string
    readonly octavesWidth: number
    readonly octavesGlow: number
    /** Faint glow on the existing bar and beat lines. */
    readonly barGlow: number
    readonly beatGlow: number
  }
  /** Note fills and edge rims (brief decisions 112–113). */
  readonly noteStyle: {
    readonly headFill: NoteFill
    readonly sustainFill: NoteFill
    /** Brightness at the far end of a Gradient fill, relative to its start. */
    readonly gradientEnd: number
    /** Diagonal stripes on heads and on sustains, each with its own settings. */
    readonly headStripeA: StripeColor
    readonly headStripeACustom: string
    readonly headStripeB: StripeColor
    readonly headStripeBCustom: string
    readonly headStripeAOpacity: number
    readonly headStripeBOpacity: number
    /** World units per stripe. */
    readonly headStripeWidth: number
    /** Share of each A/B pair that is stripe A. */
    readonly headStripeBalance: number
    /** Degrees from straight across the note. */
    readonly headStripeAngle: number
    readonly headStripeDrift: boolean
    readonly sustainStripeA: StripeColor
    readonly sustainStripeACustom: string
    readonly sustainStripeB: StripeColor
    readonly sustainStripeBCustom: string
    readonly sustainStripeAOpacity: number
    readonly sustainStripeBOpacity: number
    /** World units per stripe. */
    readonly sustainStripeWidth: number
    /** Share of each A/B pair that is stripe A. */
    readonly sustainStripeBalance: number
    /** Degrees from straight across the note. */
    readonly sustainStripeAngle: number
    readonly sustainStripeDrift: boolean
    /** The Neon fill's tube flickers now and then. */
    readonly neonFlicker: boolean
    readonly edgeGlow: boolean
    readonly edgeWidth: number
    readonly edgeIntensity: number
  }
  /** Note names on notes and keys (brief decision 114). */
  readonly names: {
    readonly mode: 'off' | 'notes' | 'keys' | 'both'
    /** Octave number on every C only, or on every name. */
    readonly octave: 'c' | 'all'
    readonly accidentals: 'sharps' | 'flats'
    /** Labels on notes: upright, facing the camera, or lying flat on the note. */
    readonly style: 'facing' | 'flat'
    /** Label text size on screen, in CSS pixels. */
    readonly textSize: number
    readonly textColor: 'auto' | 'note' | 'white' | 'dark'
    /** Strength of the soft halo behind the text (0–1). */
    readonly shadow: number
    /** Labels show up to this share of the look-ahead… */
    readonly showWithin: number
    /** …and fade out over this further share. */
    readonly fadeLength: number
    readonly anchor: 'ahead' | 'on' | 'behind'
    /** Along the note, in lane widths (+ toward the tail). */
    readonly offset: number
    /** Facing camera: gap above the note, in CSS pixels. */
    readonly height: number
    /** The farther of two overlapping labels fades out. */
    readonly avoidOverlaps: boolean
    readonly glow: 'off' | 'subtle'
    /** Repeated notes: label the first of a run in each bar, only the first, or every note. */
    readonly repeats: 'bar' | 'first' | 'all'
    /** Key-top label text size on screen, in CSS pixels (shrinks to fit the key). */
    readonly keySize: number
  }
  /** The pedal cage (brief decisions 115–116). */
  readonly pedal: {
    readonly show: boolean
    readonly fill: NoteFill
    readonly fillColor: string
    readonly fillOpacity: number
    readonly border: boolean
    readonly borderColor: LineColor
    readonly borderCustom: string
    readonly borderWidth: number
    readonly borderGlow: number
    readonly cornerRadius: number
    /** The cage's own stripes (Stripes fill); milestone 10's hand cages reuse the group. */
    readonly stripeA: string
    readonly stripeB: string
    readonly stripeAOpacity: number
    readonly stripeBOpacity: number
    readonly stripeWidth: number
    readonly stripeBalance: number
    readonly stripeAngle: number
    readonly stripeDrift: boolean
  }
  readonly effects: {
    readonly enabled: boolean
    /** Spark and glow size follow note velocity (else uniform size). */
    readonly velocityScaling: boolean
    /** Size factor at velocity 0 and at velocity 127. */
    readonly minScale: number
    readonly maxScale: number
    // Onset effects (brief decision 117), in any combination. Size, count and lifetime are
    // factors of each effect's base look; spread widens where its particles go.
    readonly sparks: boolean
    readonly sparksSize: number
    readonly sparksCount: number
    readonly sparksLifetime: number
    readonly sparksSpread: number
    readonly scalingSparks: boolean
    readonly scalingSparksSize: number
    readonly scalingSparksCount: number
    readonly scalingSparksLifetime: number
    readonly scalingSparksSpread: number
    readonly flame: boolean
    readonly flameSize: number
    readonly flameCount: number
    readonly flameLifetime: number
    readonly flameSpread: number
    readonly explosion: boolean
    readonly explosionSize: number
    readonly explosionCount: number
    readonly explosionLifetime: number
    readonly explosionSpread: number
    readonly glitter: boolean
    readonly glitterSize: number
    readonly glitterCount: number
    readonly glitterLifetime: number
    readonly glitterSpread: number
    /** What a held note shows at the now line. */
    readonly sustain: 'none' | 'glow' | 'embers' | 'flames' | 'smoke'
    readonly sustainSize: number
    /** Factor of the effect's base rate (particles per second per held key). */
    readonly sustainCount: number
    readonly sustainLifetime: number
    readonly sustainSpread: number
    /** Note-on flash on the key overlay and the whole note (brief decision 113). */
    readonly pulse: boolean
    readonly pulseAmount: number
    readonly pulseDecayMs: number
    /** Sounding notes glow brighter. */
    readonly soundingGlow: boolean
    readonly soundingGlowAmount: number
    readonly breathing: boolean
    /** Key light (brief decision 118). */
    readonly keySpill: boolean
    readonly keySpillStrength: number
    /** How far the spill reaches, in white-key widths. */
    readonly keySpillSpread: number
    readonly keyCone: boolean
    readonly keyConeStrength: number
    readonly keyConeSpread: number
  }
  readonly render: {
    /** Render at the device pixel ratio; otherwise at `scale` × CSS pixels. */
    readonly scaleAuto: boolean
    readonly scale: number
    /** Upper bound for the resulting pixel ratio. */
    readonly maxPixelRatio: number
    readonly antialias: 'off' | 'msaa' | 'fxaa' | 'smaa'
    /**
     * Quality preset (brief decision 110): sets the cost settings below. Off is the
     * pre-milestone-9 pipeline.
     */
    readonly quality: QualityPreset
    /** Glow-target resolution relative to the drawing buffer; off = no bloom passes. */
    readonly bloomResolution: 'off' | 'quarter' | 'half' | 'full'
    /** Most particles alive at once. */
    readonly particleBudget: number
    /** Noise octaves, key-light reach and the light cone. */
    readonly shaderDetail: 'minimal' | 'low' | 'medium' | 'high'
    // The bloom look: part of a look, not of the preset (brief decision 121).
    readonly bloomStrength: number
    readonly bloomRadius: number
    readonly bloomThreshold: number
  }
  readonly audio: {
    /** 0–1. */
    readonly master: number
    readonly rightVolume: number
    readonly leftVolume: number
    readonly rightAudio: HandAudio
    readonly leftAudio: HandAudio
    /** Gain for pre-roll notes in 'quiet' mode, 0–1. */
    readonly quietLevel: number
    readonly metronomeMode: 'off' | 'preRoll' | 'always'
    readonly metronomeVolume: number
    /** Only the built-in piano until MIDI out (milestone 11). */
    readonly output: 'piano'
  }
  readonly practice: {
    /** Whole percent per tempo step (slider and keys), 1–10. */
    readonly tempoStep: number
    readonly preRollBeats: number
    readonly preRollMode: PreRollMode
  }
  readonly appearance: {
    /** UI colours only (never the note palette). */
    readonly primary: string
    readonly secondary: string
    /** Glass panel opacity, 0.3–0.95. */
    readonly panelOpacity: number
    /** Background blur behind glass panels, px. */
    readonly blur: number
    readonly motion: 'system' | 'full' | 'reduced'
    /** The player's controls fade out while playing after `hideControlsAfter` idle seconds. */
    readonly hideControls: boolean
    /** 0.5–10 s, in 0.5 s steps. */
    readonly hideControlsAfter: number
    /** Where the app opens (m7-7 decision 1): the Welcome screen or the player. */
    readonly startOn: 'welcome' | 'player'
    /** Switch to Home when a new practice session begins (milestone 9.2). */
    readonly homeOnNewSession: boolean
    /** Minutes without playback after which the next playback is a new session (decision 5). */
    readonly sessionGap: '10' | '20' | '30' | '60'
  }
}
