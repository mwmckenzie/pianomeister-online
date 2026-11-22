import {
  BufferAttribute,
  type Camera,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  type Texture,
  Vector3,
} from 'three'

import { PITCH_CLASS_COLORS } from '@/core/pitchClassColors'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import { GlowTwin } from '../GlowTwin'
import { KEYBOARD } from '../model/KEYBOARD'
import type { LabelRect } from '../model/LabelRect'
import type { LabelState } from '../model/LabelState'
import { BAR_START, RUN_START } from '../model/labelRepeatRanks'
import type { NoteInstance } from '../model/NoteInstance'
import { srgb } from '../srgb'
import { TIME_GLSL } from '../timeGlsl'
import type { TimeUniforms } from '../TimeUniforms'
import type { LabelSlots } from './LabelSlots'
import type { LabelSnapshot } from './LabelSnapshot'
import { ATLAS_FONT_PX, atlasCell, CELL_H, CELL_W } from './NoteLabelAtlas'

const PALETTE = PITCH_CLASS_COLORS.map((c) => srgb(c.hex))

/** World gap between a label's anchor and the head, ahead of or behind it. */
const GAP = 0.15
/** Behind the head needs at least this much sustain (world units); else the label sits on it. */
const MIN_BEHIND = 0.6
/** The note label hands over to the key-top label over this last share of the look-ahead. */
const HANDOVER = 0.05
/** Below this on-screen height (CSS px) a label is fully transparent. */
const MIN_PX = 8
/** How quickly a hidden label fades in once there's room (seconds). */
const REVEAL_FADE_S = 0.15
/** CSS px between stacked labels (stack slots). */
const STACK_GAP_PX = 2
/** Flat labels stack along the note: one label depth plus this share. */
const FLAT_STACK_GAP = 0.15
const STATES: readonly LabelState[] = ['new', 'hidden', 'shown']

const ANCHOR = { ahead: 0, on: 1, behind: 2 } as const
/** The lowest repeat rank each "Label repeated notes" choice labels (labelRepeatRanks). */
const MIN_RANK = { first: RUN_START, bar: BAR_START, all: 0 } as const
const COLOR = { auto: 0, note: 1, white: 2, dark: 3 } as const

const SHARED_GLSL = /* glsl */ `
${TIME_GLSL}
uniform float uLift;
uniform float uHeadTop;
uniform vec2 uViewport;     // drawing buffer, px
uniform float uPixelRatio;
uniform float uTextPx;      // CSS px
uniform float uFlat;
uniform float uAnchor;      // 0 ahead, 1 on, 2 behind
uniform float uOffset;      // lane widths
uniform float uHeightPx;    // CSS px
uniform float uShowWithin;
uniform float uFadeLength;
uniform float uStack;       // 1: labels take their stack slots (Avoid overlaps)
uniform float uMinRank;     // label repeated notes ranked at least this (labelRepeatRanks)

/** The tick a label sits at, per the anchor (short notes fall back from behind to on). */
float anchorTick(vec3 ticks, float laneWidth) {
  float gap = ${GAP.toFixed(2)} / uUnitsPerTick;
  float onHead = 0.5 * (ticks.x + ticks.z);
  float behind = (ticks.y - ticks.z) * uUnitsPerTick >= ${MIN_BEHIND.toFixed(2)} ? ticks.z + gap : onHead;
  float t = uAnchor < 0.5 ? ticks.x - gap : uAnchor < 1.5 ? onHead : behind;
  return t + uOffset * laneWidth / uUnitsPerTick;
}

vec2 toPx(vec3 world) {
  vec4 c = projectionMatrix * viewMatrix * vec4(world, 1.0);
  return (c.xy / c.w * 0.5 + 0.5) * uViewport;
}
`

const VERTEX = /* glsl */ `
${SHARED_GLSL}
attribute vec2 aLane;   // left x, width
attribute vec3 aTicks;  // start, end, head end
attribute vec4 aCell;   // atlas u0, v0, u1, v1
attribute vec3 aColor;
attribute float aShown; // 0..1: hidden by an overlap
attribute float aSlot;  // stack slot, fixed per song
attribute float aRank;  // 2 first of a run, 1 first of the run in a bar, 0 other repeats
varying vec2 vUv;
varying vec3 vColor;
varying float vFade;

void main() {
  float tick = anchorTick(aTicks, aLane.y);
  float ahead = (tick - uTick) / uLookAheadTicks;
  vec3 anchor = vec3(aLane.x + 0.5 * aLane.y, uLift + uHeadTop, tickToZ(tick));
  // Distance fade (a ramp, no hard cut), the handover before the now line, overlaps.
  float fade = 1.0 - smoothstep(uShowWithin, uShowWithin + max(uFadeLength, 1e-3), ahead);
  fade *= smoothstep(0.0, ${HANDOVER.toFixed(2)}, ahead) * aShown * hazeAlpha(tick);
  fade *= step(uMinRank - 0.5, aRank);
  float heightPx = uTextPx * ${(CELL_H / ATLAS_FONT_PX).toFixed(4)} * uPixelRatio;
  vec2 corner = uv - 0.5;
  float slot = aSlot * uStack;
  if (uFlat > 0.5) {
    // Flat on the note, as wide on screen as a facing label (not stretched along the note).
    vec2 a = toPx(anchor);
    float pxPerUnit = max(distance(a, toPx(anchor + vec3(1.0, 0.0, 0.0))), 1e-3);
    float width = heightPx * ${(CELL_W / CELL_H).toFixed(4)} / pxPerUnit;
    float depth = width * ${(CELL_H / CELL_W).toFixed(4)};
    anchor.z -= slot * depth * ${(1 + FLAT_STACK_GAP).toFixed(2)};
    vec3 near = anchor + vec3(0.0, 0.0, 0.5 * depth);
    vec3 far = anchor - vec3(0.0, 0.0, 0.5 * depth);
    fade *= smoothstep(${MIN_PX}.0, ${MIN_PX + 3}.0, distance(toPx(near), toPx(far)) / uPixelRatio);
    vec3 world = anchor + vec3(corner.x * width, 0.0, -corner.y * depth) * step(0.004, fade);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  } else {
    // Facing the camera: upright, a constant size on screen, raised above the note.
    vec4 clip = projectionMatrix * viewMatrix * vec4(anchor, 1.0);
    vec2 size = vec2(heightPx * ${(CELL_W / CELL_H).toFixed(4)}, heightPx) * step(0.004, fade);
    float stackPx = slot * (heightPx + ${STACK_GAP_PX}.0 * uPixelRatio);
    vec2 raise = vec2(0.0, uHeightPx * uPixelRatio + 0.5 * heightPx + stackPx);
    clip.xy += (corner * size + raise) * 2.0 / uViewport * clip.w;
    gl_Position = clip;
  }
  vUv = mix(aCell.xy, aCell.zw, uv);
  vColor = aColor;
  vFade = fade;
}
`

const FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uColorMode;   // 0 auto, 1 note, 2 white, 3 dark
uniform float uShadow;
varying vec2 vUv;
varying vec3 vColor;
varying float vFade;
void main() {
  if (vFade <= 0.004) discard;
  vec4 t = texture2D(uAtlas, vUv);
  float text = t.r;
#ifdef GLOW_PASS
  // Subtle label glow, tinted with the note colour.
  float glow = text * vFade * 0.45;
  if (glow <= 0.002) discard;
  gl_FragColor = vec4(vColor * glow, 1.0);
#else
  // Note colour is lifted a little toward white so it separates from its own note.
  vec3 color = uColorMode < 0.5 ? mix(vColor, vec3(1.0), 0.75)
    : uColorMode < 1.5 ? mix(vColor, vec3(1.0), 0.3)
    : uColorMode < 2.5 ? vec3(1.0)
    : vec3(0.06, 0.07, 0.1);
  // A soft halo for readability: dark behind light text, light behind dark text (at least 85 %,
  // so dark text never sits dark-on-dark). Never a box.
  bool dark = uColorMode > 2.5;
  vec3 haloColor = dark ? vec3(0.95) : vec3(0.02, 0.03, 0.06);
  float halo = t.g * (dark ? max(uShadow, 0.85) : uShadow) * (1.0 - text);
  float alpha = text + halo;
  if (alpha * vFade <= 0.004) discard;
  gl_FragColor = vec4((color * text + haloColor * halo) / max(alpha, 1e-4), alpha * vFade);
#endif
}
`

/** A label near enough to take part in the overlap pass. */
export interface LabelCandidate {
  readonly layer: NoteNameLayer
  readonly index: number
  /** Share of the look-ahead from the now line (nearest first). */
  readonly ahead: number
  readonly rect: LabelRect
  readonly state: LabelState
}

/** Layout values shared with the shader, for the overlap pass on the CPU. */
export interface LabelView {
  readonly camera: Camera
  readonly tick: number
  readonly unitsPerTick: number
  readonly nowZ: number
  readonly lookAheadTicks: number
  /** Canvas size in CSS pixels. */
  readonly width: number
  readonly height: number
  /**
   * Overlap-pass frame number. A label not placed in the previous frame is new again, so a seek
   * (the engine skips a frame number) places every label afresh, at once.
   */
  readonly frame: number
}

/**
 * Note names on notes (brief decision 114), one instanced draw per lane colour: facing the
 * camera at a constant screen size (or flat on the note), in the note's tinted colour with a
 * soft halo, fading in with distance and out before the now line (where the key-top label
 * takes over). Avoid overlaps: labels of chords in neighbouring lanes stack in fixed slots, and
 * of two labels that still overlap the farther stays hidden until there's room; once shown, a
 * label stays shown (placeLabels, on the CPU), so labels never jump or blink.
 */
export class NoteNameLayer {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>
  /** Label glow "Subtle": the text on the glow scene. */
  readonly twin: GlowTwin<InstancedBufferGeometry>
  private readonly notes: readonly NoteInstance[]
  /** Note indices sorted by start tick, for the overlap pass's window. */
  private readonly byStart: Int32Array
  private readonly shown: Float32Array
  private readonly target: Float32Array
  /** Stack slots for each "Label repeated notes" choice; `slots` is the one in use. */
  private readonly slotSets: LabelSlots
  private slots: Uint8Array
  private readonly ranks: Uint8Array
  private minRank: number = MIN_RANK.bar
  private readonly state: Uint8Array
  private readonly placedAt: Int32Array
  private settings: PlayerSettings['names'] | null = null
  private headTop = 0

  constructor(
    notes: readonly NoteInstance[],
    time: TimeUniforms,
    atlas: Texture,
    renderOrder: number,
    slots: LabelSlots,
    ranks: Uint8Array,
  ) {
    this.notes = notes
    this.byStart = Int32Array.from(notes.keys()).sort(
      (a, b) => (notes[a]?.startTick ?? 0) - (notes[b]?.startTick ?? 0),
    )
    this.shown = new Float32Array(notes.length).fill(1)
    this.target = new Float32Array(notes.length).fill(1)
    this.slotSets = slots
    this.slots = slots.bar
    this.ranks = ranks
    this.state = new Uint8Array(notes.length)
    this.placedAt = new Int32Array(notes.length).fill(-2)
    const g = new InstancedBufferGeometry()
    g.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 0, -0.5, 0, 0]), 3),
    )
    g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.setAttribute(
      'aLane',
      new InstancedBufferAttribute(new Float32Array(notes.flatMap((n) => [n.x, n.width])), 2),
    )
    g.setAttribute(
      'aTicks',
      new InstancedBufferAttribute(
        new Float32Array(notes.flatMap((n) => [n.startTick, n.endTick, n.headEndTick])),
        3,
      ),
    )
    g.setAttribute(
      'aCell',
      new InstancedBufferAttribute(
        new Float32Array(notes.flatMap((n) => atlasCell(n.midi - KEYBOARD.lowest))),
        4,
      ),
    )
    g.setAttribute(
      'aColor',
      new InstancedBufferAttribute(
        new Float32Array(
          notes.flatMap((n) => {
            const c = PALETTE[n.colorIndex]
            return [c?.r ?? 1, c?.g ?? 1, c?.b ?? 1]
          }),
        ),
        3,
      ),
    )
    g.setAttribute('aShown', new InstancedBufferAttribute(this.shown, 1))
    g.setAttribute('aSlot', new InstancedBufferAttribute(Float32Array.from(slots.bar), 1))
    g.setAttribute('aRank', new InstancedBufferAttribute(Float32Array.from(ranks), 1))
    g.instanceCount = notes.length
    this.mesh = new Mesh(
      g,
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          ...time,
          uLift: { value: 0.012 },
          uHeadTop: { value: 0 },
          uViewport: { value: [1280, 720] },
          uPixelRatio: { value: 1 },
          uTextPx: { value: 12 },
          uFlat: { value: 0 },
          uAnchor: { value: 0 },
          uOffset: { value: 0 },
          uHeightPx: { value: 6 },
          uShowWithin: { value: 0.4 },
          uFadeLength: { value: 0.15 },
          uStack: { value: 1 },
          uMinRank: { value: MIN_RANK.bar },
          uColorMode: { value: 0 },
          uShadow: { value: 0.6 },
          uAtlas: { value: atlas },
        },
        transparent: true,
        depthWrite: false,
      }),
    )
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    this.mesh.visible = false
    this.twin = new GlowTwin(this.mesh, 'emitter')
  }

  applySettings(names: PlayerSettings['names'], headTop: number): void {
    this.settings = names
    this.headTop = headTop
    this.uniform('uHeadTop', headTop)
    this.uniform('uTextPx', names.textSize)
    this.uniform('uFlat', names.style === 'flat' ? 1 : 0)
    this.uniform('uAnchor', ANCHOR[names.anchor])
    this.uniform('uOffset', names.offset)
    this.uniform('uHeightPx', names.height)
    this.uniform('uShowWithin', names.showWithin)
    this.uniform('uFadeLength', names.fadeLength)
    this.uniform('uColorMode', COLOR[names.textColor])
    this.uniform('uShadow', names.shadow)
    this.uniform('uStack', names.avoidOverlaps ? 1 : 0)
    this.minRank = MIN_RANK[names.repeats]
    this.uniform('uMinRank', this.minRank)
    const slots = this.slotSets[names.repeats]
    if (slots !== this.slots) {
      this.slots = slots
      const attribute = this.mesh.geometry.getAttribute('aSlot') as InstancedBufferAttribute
      ;(attribute.array as Float32Array).set(slots)
      attribute.clearUpdateRanges()
      attribute.needsUpdate = true
    }
    this.twin.enabled = names.glow === 'subtle'
    if (!names.avoidOverlaps) {
      this.target.fill(1)
      this.shown.fill(1)
      this.placedAt.fill(-2)
      this.markShown(0, this.shown.length - 1)
    }
  }

  setLift(y: number, onTop: boolean): void {
    this.uniform('uLift', y + 0.002)
    this.mesh.material.depthTest = !onTop
  }

  /** Drawing-buffer size and device pixel ratio, for constant-size labels. */
  setViewport(bufferWidth: number, bufferHeight: number, pixelRatio: number): void {
    const u = this.mesh.material.uniforms
    if (u.uViewport) u.uViewport.value = [bufferWidth, bufferHeight]
    this.uniform('uPixelRatio', pixelRatio)
  }

  /** Labels close enough to show, with their screen rectangles (CSS px), for the overlap pass. */
  candidates(view: LabelView, out: LabelCandidate[]): void {
    const s = this.settings
    if (s === null || !this.mesh.visible) return
    const range = (s.showWithin + s.fadeLength) * view.lookAheadTicks
    const margin = (1.5 + Math.abs(s.offset)) / Math.max(view.unitsPerTick, 1e-6)
    const from = lowerBound(this.notes, this.byStart, view.tick - margin)
    const heightPx = s.textSize * (CELL_H / ATLAS_FONT_PX)
    const widthPx = heightPx * (CELL_W / CELL_H)
    const stackPx = s.style === 'flat' ? heightPx * 0.5 + STACK_GAP_PX : heightPx + STACK_GAP_PX
    for (let k = from; k < this.byStart.length; k++) {
      const index = this.byStart[k] as number
      const n = this.notes[index]
      if (n === undefined || n.startTick > view.tick + range + margin) break
      if ((this.ranks[index] ?? 0) < this.minRank) continue
      const tick = anchorTick(n, s, view.unitsPerTick)
      const ahead = (tick - view.tick) / view.lookAheadTicks
      if (ahead <= 0 || ahead >= s.showWithin + s.fadeLength) continue
      const z = view.nowZ - (tick - view.tick) * view.unitsPerTick
      const centre = toCss(ANCHOR_POINT.set(n.x + n.width / 2, this.headTop, z), view)
      const lift = (this.slots[index] ?? 0) * stackPx
      const rect: LabelRect =
        s.style === 'flat'
          ? { x: centre.x, y: centre.y - lift, width: widthPx, height: heightPx * 0.5 }
          : {
              x: centre.x,
              y: centre.y - s.height - heightPx / 2 - lift,
              width: widthPx,
              height: heightPx,
            }
      const placed = this.placedAt[index] === view.frame - 1
      const state = placed ? (STATES[this.state[index] ?? 0] ?? 'new') : 'new'
      out.push({ layer: this, index, ahead, rect, state })
    }
  }

  /**
   * Records a label's placement. A newly placed label appears (or not) at once: it enters at the
   * far fade, or after a seek where it should simply be in place. A revealed one fades in.
   */
  place(index: number, state: LabelState, frame: number): void {
    const wasNew = this.placedAt[index] !== frame - 1
    this.placedAt[index] = frame
    this.state[index] = STATES.indexOf(state)
    const goal = state === 'shown' ? 1 : 0
    this.target[index] = goal
    if (wasNew && this.shown[index] !== goal) {
      this.shown[index] = goal
      this.markShown(index, index)
    }
  }

  /** The labels placed in `frame`, for tests. */
  snapshot(frame: number, prefix: string, out: LabelSnapshot[]): void {
    for (let i = 0; i < this.placedAt.length; i++) {
      if (this.placedAt[i] !== frame) continue
      out.push({
        id: `${prefix}${i}`,
        state: STATES[this.state[i] ?? 0] ?? 'new',
        shown: this.shown[i] ?? 0,
        slot: this.slots[i] ?? 0,
      })
    }
  }

  /** Fades revealed labels in (at once under reduced motion). Never fades one out. */
  update(dt: number, instant: boolean): void {
    let lo = Infinity
    let hi = -1
    const step = instant ? 1 : dt / REVEAL_FADE_S
    for (let i = 0; i < this.shown.length; i++) {
      const current = this.shown[i] as number
      const goal = this.target[i] as number
      if (current >= goal) continue
      this.shown[i] = Math.min(goal, current + step)
      lo = Math.min(lo, i)
      hi = i
    }
    if (hi >= 0) this.markShown(lo, hi)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this.twin.dispose()
  }

  private markShown(lo: number, hi: number): void {
    const attribute = this.mesh.geometry.getAttribute('aShown') as InstancedBufferAttribute
    attribute.clearUpdateRanges()
    attribute.addUpdateRange(lo, hi - lo + 1)
    attribute.needsUpdate = true
  }

  private uniform(name: string, value: number): void {
    const u = this.mesh.material.uniforms[name]
    if (u) u.value = value
  }
}

const ANCHOR_POINT = new Vector3()

/** The anchor tick, as the shader's anchorTick(). */
function anchorTick(n: NoteInstance, s: PlayerSettings['names'], unitsPerTick: number): number {
  const gap = GAP / unitsPerTick
  const onHead = (n.startTick + n.headEndTick) / 2
  const behind =
    (n.endTick - n.headEndTick) * unitsPerTick >= MIN_BEHIND ? n.headEndTick + gap : onHead
  const t = s.anchor === 'ahead' ? n.startTick - gap : s.anchor === 'on' ? onHead : behind
  return t + (s.offset * n.width) / unitsPerTick
}

/** A world point in CSS pixels, y down. */
function toCss(p: Vector3, view: LabelView): { x: number; y: number } {
  p.project(view.camera)
  return { x: (p.x * 0.5 + 0.5) * view.width, y: (0.5 - p.y * 0.5) * view.height }
}

/** First position in `order` whose note starts at or after `tick`. */
function lowerBound(notes: readonly NoteInstance[], order: Int32Array, tick: number): number {
  let lo = 0
  let hi = order.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((notes[order[mid] as number]?.startTick ?? 0) < tick) lo = mid + 1
    else hi = mid
  }
  return lo
}
