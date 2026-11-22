import { PerspectiveCamera, Scene } from 'three'

import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import { CageLayer } from './cages/CageLayer'
import { createTimeUniforms } from './createTimeUniforms'
import { NowLineEffects } from './effects/NowLineEffects'
import type { EngineSong } from './EngineSong'
import { Highway } from './Highway'
import { Keyboard } from './Keyboard'
import { blackLaneLift } from './model/blackLaneLift'
import type { CameraPlacement } from './model/CameraPlacement'
import { cameraFit } from './model/cameraFit'
import { KeyStates } from './model/KeyStates'
import { lineColor } from './model/lineColor'
import { mergeSpans } from './model/mergeSpans'
import type { NoteInstance } from './model/NoteInstance'
import { noteInstances } from './model/noteInstances'
import { songClock } from './model/songClock'
import { unitsPerTick } from './model/unitsPerTick'
import { velocityScale } from './model/velocityScale'
import type { GlowTwin } from './GlowTwin'
import { NoteMask } from './notes/NoteMask'
import { ContactShadow } from './notes/ContactShadow'
import { NoteLabelAtlas } from './names/NoteLabelAtlas'
import { type LabelCandidate, type LabelView, NoteNameLayer } from './names/NoteNameLayer'
import { BAR_START, labelRepeatRanks, RUN_START } from './model/labelRepeatRanks'
import { labelStackSlots } from './model/labelStackSlots'
import { placeLabels } from './model/placeLabels'
import type { LabelSnapshot } from './names/LabelSnapshot'
import { HeadLayer } from './notes/HeadLayer'
import { applyNoteStyle, createNoteStyleUniforms, notesEmit } from './notes/noteStyle'
import { SustainLayer } from './notes/SustainLayer'
import type { RenderInfo } from './RenderInfo'
import { RenderPipeline } from './RenderPipeline'
import { srgb } from './srgb'

const FOV_DEG = 40
/** Bigger jumps than this (seeks, loop wraps) are not "notes being reached": no sparks. */
const MAX_SPARK_JUMP_QUARTERS = 2
const STATS_WINDOW = 120
/** Bar/beat lines also cover a few bars before tick 0, for pre-roll count-ins. */
const PRE_SONG_BARS = 4
/** White-lane notes sit just above the highway surface and its lines. */
const WHITE_LANE_Y = 0.01
/** "Paused for ages": with a pinned animation clock, paused frames show every pulse settled. */
const SETTLED_SECONDS = 1e3

/**
 * Draw order of the scene's transparent layers (lower first). Black-lane notes draw after the
 * contact shadow, which draws after the white-lane notes.
 */
const ORDER = {
  noteMasks: 0.5,
  cages: 1,
  whiteSustains: 3,
  whiteHeads: 3.1,
  shadow: 3.5,
  blackSustains: 3.6,
  blackHeads: 3.7,
  whiteNames: 3.15,
  blackNames: 3.75,
} as const

interface Onset {
  readonly tick: number
  readonly midi: number
  readonly velocity: number
}

interface SongParts {
  readonly ppq: number
  readonly highway: Highway
  readonly pedals: CageLayer
  readonly sustains: { readonly white: SustainLayer; readonly black: SustainLayer }
  readonly heads: { readonly white: HeadLayer; readonly black: HeadLayer }
  readonly shadow: ContactShadow
  readonly names: { readonly white: NoteNameLayer; readonly black: NoteNameLayer }
  /** The notes in the stencil buffer, so cages never draw under them. */
  readonly masks: readonly NoteMask[]
  readonly keyStates: KeyStates
  /** Note onsets sorted by tick, for sparks and key re-strikes. */
  readonly onsets: readonly Onset[]
}

/**
 * The Three.js scene behind the player. Imperative and non-reactive: the UI calls mount(),
 * setSong(), applySettings(), resize() and dispose(). Each animation frame it reads the song
 * position from the time source; it never drives timing. requestAnimationFrame stops in
 * hidden tabs, so rendering pauses there while audio keeps playing.
 */
export class Engine {
  private pipeline: RenderPipeline | null = null
  private readonly scene = new Scene()
  /** Glow twins only (brief decision 109): the bloom pass draws this, not the main scene. */
  private readonly glowScene = new Scene()
  /** Bloom state the twins were last synced for; null = sync on the next frame. */
  private glowSyncedFor: boolean | null = null
  private readonly camera = new PerspectiveCamera(FOV_DEG, 1, 0.5, 1000)
  private readonly time = createTimeUniforms()
  private readonly noteStyle = createNoteStyleUniforms()
  private readonly atlas = new NoteLabelAtlas()
  private readonly keyboard = new Keyboard(this.atlas.texture)
  private readonly effects = new NowLineEffects(this.time, DEFAULT_SETTINGS.render.particleBudget)
  private song: SongParts | null = null
  private settings: PlayerSettings = DEFAULT_SETTINGS
  private keyboardKey = ''
  private placement: CameraPlacement | null = null
  private timeSource: () => number = () => 0
  private guides = false
  private reducedMotion = false
  private fixedAnimationTime: number | null = null
  /** Capture mode (test seam): frames come only from captureStep(), on a synthetic clock. */
  private capturing = false
  private captureNow = 0
  /** The transport is playing (setPlaying); paused, the frame settles (brief decision 119). */
  private playing = false
  /** Playback resumed since the last frame: notes up to the paused position don't pulse. */
  private resumed = false
  /** Overlap-pass frame number and the label layout it was placed for (layoutNames). */
  private labelFrame = 0
  private labelLayoutKey = ''
  /** Seconds of looping animation (advances only while playing). */
  private loopClock = 0
  /** Wall-clock seconds since playback paused. */
  private pausedFor = 0
  private frame = 0
  /** While frozen the loop stops; changes ask for a single frame instead (Welcome's backdrop). */
  private frozen = false
  private pendingFrame = 0
  private rendered = 0
  private lastTick: number | null = null
  private lastFrameAt: number | null = null
  private readonly frameMs: number[] = []
  private readonly intervalMs: number[] = []
  private sizeObserver: ResizeObserver | null = null
  /** Device pixel ratio the drawing buffer was last sized for. */
  private sizedForDpr = 0

  constructor() {
    this.scene.add(this.keyboard.group, this.effects.group)
    this.effects.setKeyTops(this.keyboard.keyBodies)
    // Key labels fit their key by the names' widths, which change once the font has loaded.
    this.atlas.onDraw = () => this.keyboard.setGlyphWidths(this.atlas.glyphEms)
    this.keyboard.setGlyphWidths(this.atlas.glyphEms)
  }

  mount(canvas: HTMLCanvasElement): void {
    this.pipeline = new RenderPipeline(canvas, this.scene, this.glowScene, this.camera)
    this.applySettings(this.settings)
    // Size changes in device pixels (window resize, browser zoom); where the browser can't
    // observe the device-pixel box, the CSS box. A device-pixel-ratio change alone is also
    // caught every frame in loop() (not every browser reports it to observers).
    this.sizeObserver = new ResizeObserver(() => this.resize())
    try {
      this.sizeObserver.observe(canvas, { box: 'device-pixel-content-box' })
    } catch {
      this.sizeObserver.observe(canvas)
    }
    this.frame = requestAnimationFrame(this.loop)
  }

  /** Song position source, in ticks; called once per frame. */
  setTimeSource(source: () => number): void {
    this.timeSource = source
  }

  setSong(song: EngineSong): void {
    this.disposeSong()
    const instances = noteInstances(song.notes, song.ppq)
    const white = instances.filter((n) => !n.isBlack)
    const black = instances.filter((n) => n.isBlack)
    // Label stack slots and runs of repeated notes come from the music, across both lane
    // colours (brief decision 114); by default the first of a run in each bar is labelled.
    const ranks = labelRepeatRanks(
      instances,
      song.ppq,
      (tick) => song.barMap.tickToPosition(tick).bar,
    )
    const lanes = instances.map((n) => ({ startTick: n.startTick, centre: n.x + n.width / 2 }))
    /** Stack slots among the notes ranked at least `rank` (the ones a choice labels). */
    const slotsFrom = (rank: number) => {
      const labelled = instances.flatMap((_, i) => ((ranks[i] ?? 0) >= rank ? [i] : []))
      const slots = new Uint8Array(instances.length)
      labelStackSlots(labelled.map((i) => lanes[i] ?? { startTick: 0, centre: 0 })).forEach(
        (slot, k) => (slots[labelled[k] ?? 0] = slot),
      )
      return slots
    }
    const choiceSlots = {
      first: slotsFrom(RUN_START),
      bar: slotsFrom(BAR_START),
      all: slotsFrom(0),
    }
    const pick = (slots: Uint8Array, black: boolean) =>
      Uint8Array.from(slots.filter((_, i) => instances[i]?.isBlack === black))
    const slotsOf = (black: boolean) => ({
      first: pick(choiceSlots.first, black),
      bar: pick(choiceSlots.bar, black),
      all: pick(choiceSlots.all, black),
    })
    const ranksOf = (black: boolean) => pick(ranks, black)
    const { barMap } = song
    const barTicks = song.ppq * 4
    const beats = barMap
      .beatTicksBetween(-PRE_SONG_BARS * barTicks, song.endTick + barTicks)
      .map((tick) => ({ tick, isBar: barMap.tickToPosition(tick).beat === 1 }))
    const sustains = {
      white: new SustainLayer(white, this.time, this.noteStyle, ORDER.whiteSustains),
      black: new SustainLayer(black, this.time, this.noteStyle, ORDER.blackSustains),
    }
    const heads = {
      white: new HeadLayer(white, this.time, this.noteStyle, ORDER.whiteHeads),
      black: new HeadLayer(black, this.time, this.noteStyle, ORDER.blackHeads),
    }
    this.song = {
      ppq: song.ppq,
      highway: new Highway(beats, this.time),
      // The pedal cage (brief decision 116): full width while the pedal is down.
      pedals: new CageLayer(
        mergeSpans(song.pedalIntervals).map((s) => ({
          startTick: s.startTick,
          endTick: s.endTick,
          lowMidi: null,
          highMidi: null,
        })),
        this.time,
        this.noteStyle,
        { y: 0.003, renderOrder: ORDER.cages },
      ),
      sustains,
      heads,
      masks: [sustains.white, sustains.black, heads.white, heads.black].map(
        (layer) => new NoteMask(layer.mesh, ORDER.noteMasks),
      ),
      shadow: new ContactShadow(black, this.time, ORDER.shadow),
      names: {
        white: new NoteNameLayer(
          white,
          this.time,
          this.atlas.texture,
          ORDER.whiteNames,
          slotsOf(false),
          ranksOf(false),
        ),
        black: new NoteNameLayer(
          black,
          this.time,
          this.atlas.texture,
          ORDER.blackNames,
          slotsOf(true),
          ranksOf(true),
        ),
      },
      keyStates: new KeyStates(instances),
      onsets: onsetsOf(instances),
    }
    const s = this.song
    this.scene.add(
      s.highway.group,
      s.pedals.mesh,
      s.sustains.white.mesh,
      s.heads.white.mesh,
      s.shadow.mesh,
      s.sustains.black.mesh,
      s.heads.black.mesh,
      s.names.white.mesh,
      s.names.black.mesh,
      ...s.masks.map((m) => m.mesh),
    )
    this.lastTick = null
    this.effects.clear()
    this.applySettings(this.settings)
    this.invalidate()
  }

  applySettings(settings: PlayerSettings): void {
    this.settings = settings
    this.scene.background = srgb(settings.colors.background)
    applyNoteStyle(this.noteStyle, settings)
    this.atlas.draw(settings.names)
    this.effects.group.visible = settings.effects.enabled
    this.effects.setBudget(settings.render.particleBudget)
    const keyboardKey = JSON.stringify(settings.keyboard)
    if (keyboardKey !== this.keyboardKey) {
      this.keyboardKey = keyboardKey
      this.keyboard.rebuild(settings.keyboard)
      this.effects.setKeyTops(this.keyboard.keyBodies)
    }
    this.keyboard.applySettings(settings)
    const song = this.song
    if (song !== null) {
      const { notes } = settings
      const lift = blackLaneLift(notes, settings.keyboard)
      song.highway.applySettings(settings)
      const { pedal, appearance } = settings
      song.pedals.mesh.visible = pedal.show
      song.pedals.setStyle({
        fill: pedal.fill,
        fillColor: pedal.fillColor,
        fillOpacity: pedal.fillOpacity,
        border: pedal.border,
        borderColor: lineColor(pedal.borderColor, pedal.borderCustom, appearance),
        borderWidth: pedal.borderWidth,
        borderGlow: pedal.borderGlow,
        cornerRadius: pedal.cornerRadius,
        stripes: {
          a: { mode: 'custom', color: pedal.stripeA },
          b: { mode: 'custom', color: pedal.stripeB },
          aOpacity: pedal.stripeAOpacity,
          bOpacity: pedal.stripeBOpacity,
          width: pedal.stripeWidth,
          balance: pedal.stripeBalance,
          angleDeg: pedal.stripeAngle,
          drift: pedal.stripeDrift,
        },
      })
      const emit = notesEmit(settings)
      for (const layer of [song.sustains.white, song.sustains.black]) layer.twin.enabled = emit
      // Floating below the white heads' tops, black-lane notes would intersect them: draw them on
      // top instead, so black-lane notes always win (brief decision 39).
      const onTop = lift < WHITE_LANE_Y + (notes.heads3d ? notes.headHeight : 0.01)
      for (const [layer, y, top] of [
        [song.sustains.white, WHITE_LANE_Y, false],
        [song.sustains.black, Math.max(lift, WHITE_LANE_Y + 0.005), onTop],
      ] as const) {
        layer.setLift(y, top)
        layer.setFlatHeads(!notes.heads3d)
        layer.setSustainTransparency(notes.sustainCenterTransparency, notes.sustainEdgeTransparency)
      }
      for (const [layer, y, top] of [
        [song.heads.white, WHITE_LANE_Y, false],
        [song.heads.black, Math.max(lift, WHITE_LANE_Y), onTop],
      ] as const) {
        layer.mesh.visible = notes.heads3d
        layer.setLift(y, top)
        layer.setShape(notes.headHeight, notes.headRounded)
      }
      song.shadow.set(notes.contactShadow, notes.shadowStrength, lift)
      const namesOnNotes = settings.names.mode === 'notes' || settings.names.mode === 'both'
      const headTop = notes.heads3d ? notes.headHeight : 0
      for (const [layer, y, top] of [
        [song.names.white, WHITE_LANE_Y, false],
        [song.names.black, Math.max(lift, WHITE_LANE_Y + 0.005), onTop],
      ] as const) {
        layer.mesh.visible = namesOnNotes
        layer.setLift(y, top)
        layer.applySettings(settings.names, headTop)
      }
      const cageShown = pedal.show && (pedal.fillOpacity > 0 || pedal.border)
      for (const mask of song.masks) mask.sync(cageShown)
    }
    if (this.pipeline !== null) {
      this.pipeline.configure(settings.render, settings.highway.vignette)
      this.resize()
    }
    this.placeCamera()
    this.syncGlow()
    this.invalidate()
  }

  /** Reduced motion (brief decision 54): no flicker, breathing, drift or moving particles. */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced
    this.time.uReducedMotion.value = reduced ? 1 : 0
    this.invalidate()
  }

  /**
   * Whether the transport is playing. Paused, pulses and particles in flight finish on the wall
   * clock, looping animation and sustain spawning stop, and seeking starts no pulses, so the
   * frame settles and then holds still (brief decision 119).
   */
  setPlaying(playing: boolean): void {
    if (playing === this.playing) return
    if (playing) this.resumed = true
    this.playing = playing
  }

  /**
   * Test seam for the visual shots: pins the animation clock (seconds) so flicker, noise and
   * breathing render the same frame every run; null follows the frame timestamps again.
   */
  setFixedAnimationTime(seconds: number | null): void {
    this.fixedAnimationTime = seconds
    this.invalidate()
  }

  /**
   * Test seam (`?capture=1`, for the range contact sheets): stops the render loop for good and
   * makes frames repeatable — spawns use a seeded random source and the animation clock starts
   * at `loopTime`. Frames are then drawn only by captureStep().
   */
  startCapture(seed = 1, loopTime = 3): void {
    cancelAnimationFrame(this.frame)
    cancelAnimationFrame(this.pendingFrame)
    this.pendingFrame = 0
    this.capturing = true
    this.frozen = true
    this.fixedAnimationTime = null
    this.loopClock = loopTime
    this.captureNow = 100_000
    this.lastFrameAt = null
    let state = seed >>> 0
    // mulberry32: small, fast and good enough for particle variation.
    this.effects.setRandom(() => {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    })
    this.effects.clear()
    this.effects.resetParticleStats()
    // The first captured frame is a jump: it fires no onsets crossed since the last real frame.
    this.lastTick = null
  }

  /**
   * Capture mode: draws one frame at song position `tick`, `dt` seconds after the previous
   * one, as if playing (onsets crossed since the last step fire). The first step after
   * startCapture() is a jump, so it fires nothing.
   */
  captureStep(tick: number, dt: number): void {
    if (!this.capturing) return
    const now = this.captureNow + dt * 1000
    this.lastFrameAt = this.captureNow
    this.captureNow = now
    this.timeSource = () => tick
    this.playing = true
    this.draw(now)
  }

  /** Particle counts against the budget (capture mode's "where it hits the budget"). */
  particleStats() {
    return this.effects.particleStats()
  }

  /** Debug review aid: marker lines at 1× and 1.5× look-ahead. */
  setGuides(visible: boolean): void {
    this.guides = visible
    this.placeCamera()
    this.invalidate()
  }

  /**
   * Stops (true) or restarts (false) the render loop. Frozen, the scene renders one frame now
   * and then only when invalidate() is called or its size, settings or song change.
   */
  setFrozen(frozen: boolean): void {
    if (frozen === this.frozen || this.capturing) return
    this.frozen = frozen
    cancelAnimationFrame(this.frame)
    cancelAnimationFrame(this.pendingFrame)
    this.pendingFrame = 0
    // A stale timestamp would make the first frame after a freeze one long time step.
    this.lastFrameAt = null
    if (this.pipeline === null) return
    if (frozen) this.invalidate()
    else this.frame = requestAnimationFrame(this.loop)
  }

  /** While frozen, renders one more frame (e.g. after a seek); running, the loop already does. */
  invalidate(): void {
    if (this.capturing) return
    if (!this.frozen || this.pipeline === null || this.pendingFrame !== 0) return
    this.pendingFrame = requestAnimationFrame((now) => {
      this.pendingFrame = 0
      this.lastFrameAt = null
      this.draw(now)
    })
  }

  resize(): void {
    const pipeline = this.pipeline
    if (pipeline === null) return
    const canvas = pipeline.renderer.domElement
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    pipeline.resize(width, height)
    this.sizedForDpr = window.devicePixelRatio
    this.camera.aspect = width / height
    this.placeCamera()
    const bufferHeight = height * pipeline.renderer.getPixelRatio()
    this.effects.setScale(bufferHeight / (2 * Math.tan(((FOV_DEG / 2) * Math.PI) / 180)))
    const ratio = pipeline.renderer.getPixelRatio()
    const sized = [this.keyboard, ...(this.song === null ? [] : Object.values(this.song.names))]
    for (const layer of sized) layer.setViewport(width * ratio, bufferHeight, ratio)
    this.invalidate()
  }

  /** Average CPU time per frame and average interval between frames, in ms. */
  stats(): {
    readonly averageFrameMs: number
    readonly averageIntervalMs: number
    readonly frames: number
    /** Frames rendered since mount. */
    readonly rendered: number
  } {
    const mean = (xs: readonly number[]) =>
      xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
    return {
      averageFrameMs: mean(this.frameMs),
      averageIntervalMs: mean(this.intervalMs),
      frames: this.frameMs.length,
      rendered: this.rendered,
    }
  }

  /**
   * The scene as it is now, scaled down to at most `maxWidth` pixels wide, as a JPEG data URL
   * (the library's backdrop). It renders a frame first: a WebGL canvas can only be read in the
   * same task that drew it.
   */
  captureFrame(maxWidth = 960): string | null {
    const pipeline = this.pipeline
    if (pipeline === null) return null
    const source = pipeline.renderer.domElement
    if (source.width === 0 || source.height === 0) return null
    pipeline.render()
    const scale = Math.min(1, maxWidth / source.width)
    const copy = document.createElement('canvas')
    copy.width = Math.max(1, Math.round(source.width * scale))
    copy.height = Math.max(1, Math.round(source.height * scale))
    const context = copy.getContext('2d')
    if (context === null) return null
    context.drawImage(source, 0, 0, copy.width, copy.height)
    return copy.toDataURL('image/jpeg', 0.85)
  }

  /** Internal resolution and anti-aliasing actually in use. */
  renderInfo(): RenderInfo | null {
    return this.pipeline?.info() ?? null
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    cancelAnimationFrame(this.pendingFrame)
    this.sizeObserver?.disconnect()
    this.disposeSong()
    this.keyboard.dispose()
    this.effects.dispose()
    this.atlas.dispose()
    this.pipeline?.dispose()
    this.pipeline = null
  }

  private readonly loop = (now: number): void => {
    this.frame = requestAnimationFrame(this.loop)
    this.draw(now)
  }

  private draw(now: number): void {
    const pipeline = this.pipeline
    if (pipeline === null) return
    // Moving to another monitor or zooming changes the DPR without necessarily resizing the
    // canvas; a stale buffer would be stretched and look soft (the m4 renderer's main blur).
    if (window.devicePixelRatio !== this.sizedForDpr) this.resize()
    const started = performance.now()
    const dt = this.lastFrameAt === null ? 0 : (now - this.lastFrameAt) / 1000
    if (this.lastFrameAt !== null) this.record(this.intervalMs, now - this.lastFrameAt)
    this.lastFrameAt = now

    const tick = this.timeSource()
    const playing = this.playing
    if (playing) {
      this.loopClock += dt
      this.pausedFor = 0
    } else {
      this.pausedFor += dt
    }
    const fixed = this.fixedAnimationTime
    this.time.uTick.value = tick
    this.time.uTime.value = fixed ?? now / 1000
    this.time.uLoopTime.value = fixed ?? this.loopClock
    this.time.uPausedFor.value = fixed === null || playing ? this.pausedFor : SETTLED_SECONDS
    const clock = songClock(
      this.lastTick,
      tick,
      dt,
      this.song?.ppq ?? 480,
      this.time.uTicksPerSecond.value,
      playing,
    )
    this.time.uTicksPerSecond.value = clock.rate
    if (clock.jumped) this.time.uJumpTick.value = tick
    else if (this.resumed) this.time.uJumpTick.value = this.lastTick ?? tick
    this.resumed = false
    const song = this.song
    if (song !== null) {
      const { keys, effects } = this.settings
      const crossed = playing ? this.crossedOnsets(song, tick) : []
      for (const onset of crossed) {
        this.keyboard.restrike(onset.midi, velocityScale(onset.velocity, effects))
        if (effects.enabled) {
          this.effects.onset(
            onset.midi,
            velocityScale(onset.velocity, effects),
            effects,
            this.reducedMotion,
          )
        }
      }
      const states = song.keyStates.at(tick, keys.fadeBeats * song.ppq, keys.maxApproachAlpha)
      this.keyboard.update(states, dt)
      if (effects.enabled) {
        this.effects.update(
          dt,
          states,
          effects,
          (v) => velocityScale(v, effects),
          this.reducedMotion,
          playing,
        )
      }
    }
    if (song !== null) this.layoutNames(song, tick, dt, clock.jumped)
    this.lastTick = tick
    // The chain can change after applySettings (FXAA/SMAA passes load asynchronously).
    if (pipeline.bloomActive !== this.glowSyncedFor) this.syncGlow()
    pipeline.render()
    this.rendered++
    this.record(this.frameMs, performance.now() - started)
  }

  /** Labels placed in the last overlap pass, for tests (`?stats=1`). */
  labelSnapshot(): LabelSnapshot[] {
    const out: LabelSnapshot[] = []
    this.song?.names.white.snapshot(this.labelFrame, 'w', out)
    this.song?.names.black.snapshot(this.labelFrame, 'b', out)
    return out
  }

  /**
   * The overlap pass (brief decision 114), across both lane colours, nearest first: one-way, so
   * a shown label stays shown and a hidden one shows once there's room. A seek, or a change to
   * how labels are laid out, places every label afresh, at once (no fades).
   */
  private layoutNames(song: SongParts, tick: number, dt: number, jumped: boolean): void {
    const { names } = this.settings
    const onNotes = names.mode === 'notes' || names.mode === 'both'
    if (!onNotes || !names.avoidOverlaps) return
    const layoutKey = JSON.stringify([
      names.style,
      names.textSize,
      names.anchor,
      names.offset,
      names.height,
      names.showWithin,
      names.fadeLength,
      names.repeats,
      this.settings.notes.heads3d,
      this.settings.notes.headHeight,
    ])
    // Skipping a frame number makes every label new.
    this.labelFrame += jumped || layoutKey !== this.labelLayoutKey ? 2 : 1
    this.labelLayoutKey = layoutKey
    const canvas = this.pipeline?.renderer.domElement
    const view: LabelView = {
      camera: this.camera,
      tick,
      unitsPerTick: this.time.uUnitsPerTick.value,
      nowZ: this.time.uNowZ.value,
      lookAheadTicks: this.time.uLookAheadTicks.value,
      width: canvas?.clientWidth ?? 1,
      height: canvas?.clientHeight ?? 1,
      frame: this.labelFrame,
    }
    const labels: LabelCandidate[] = []
    song.names.white.candidates(view, labels)
    song.names.black.candidates(view, labels)
    labels.sort((a, b) => a.ahead - b.ahead)
    placeLabels(labels).forEach((state, i) => {
      const label = labels[i]
      label?.layer.place(label.index, state, this.labelFrame)
    })
    for (const layer of [song.names.white, song.names.black]) layer.update(dt, this.reducedMotion)
  }

  /** Onsets reached since the last frame, unless the position jumped (seek, loop wrap). */
  private crossedOnsets(song: SongParts, tick: number): readonly Onset[] {
    const last = this.lastTick
    if (last === null || tick <= last || tick - last > MAX_SPARK_JUMP_QUARTERS * song.ppq) return []
    const onsets = song.onsets
    let lo = 0
    let hi = onsets.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if ((onsets[mid]?.tick ?? 0) <= last) lo = mid + 1
      else hi = mid
    }
    const out: Onset[] = []
    for (let i = lo; i < onsets.length; i++) {
      const onset = onsets[i]
      if (onset === undefined || onset.tick > tick) break
      out.push(onset)
    }
    return out
  }

  private placeCamera(): void {
    const { camera: cam, highway } = this.settings
    const placement = cameraFit({
      tiltDeg: cam.tiltDeg,
      fovDeg: FOV_DEG,
      aspect: this.camera.aspect,
      distanceOffset: cam.distanceOffset,
      pan: cam.pan,
    })
    this.placement = placement
    this.camera.position.set(placement.position.x, placement.position.y, placement.position.z)
    this.camera.lookAt(placement.target.x, placement.target.y, placement.target.z)
    this.camera.updateProjectionMatrix()
    const ppq = this.song?.ppq ?? 480
    const lookAheadTicks = highway.lookAheadBeats * ppq
    this.time.uNowZ.value = placement.nowZ
    this.time.uLookAheadTicks.value = lookAheadTicks
    this.time.uUnitsPerTick.value = unitsPerTick(placement, lookAheadTicks)
    this.song?.highway.setGuides(
      this.guides,
      placement.nowZ - placement.lookAheadLength,
      placement.nowZ - placement.highwayLength,
    )
  }

  /**
   * Refills the glow scene and syncs every twin with its mesh (brief decision 109). Only when
   * settings, the song or the pass chain change: per-frame changes reach twins through shared
   * uniforms and buffers, so frames don't pay for it.
   */
  private syncGlow(): void {
    const bloomActive = this.pipeline?.bloomActive ?? false
    this.glowSyncedFor = this.pipeline === null ? null : bloomActive
    const song = this.song
    const twins: GlowTwin[] = [...this.keyboard.twins, ...this.effects.twins]
    if (song !== null) {
      twins.push(
        ...song.highway.twins,
        song.pedals.twin,
        song.sustains.white.twin,
        song.sustains.black.twin,
        song.heads.white.twin,
        song.heads.black.twin,
        song.names.white.twin,
        song.names.black.twin,
      )
    }
    this.glowScene.clear()
    for (const twin of twins) {
      twin.sync(bloomActive)
      this.glowScene.add(twin.mesh)
    }
  }

  private disposeSong(): void {
    const song = this.song
    if (song === null) return
    const parts = [
      song.sustains.white,
      song.sustains.black,
      song.heads.white,
      song.heads.black,
      song.shadow,
      song.pedals,
      song.names.white,
      song.names.black,
    ]
    this.scene.remove(
      song.highway.group,
      ...parts.map((p) => p.mesh),
      ...song.masks.map((m) => m.mesh),
    )
    for (const mask of song.masks) mask.dispose()
    song.highway.dispose()
    for (const part of parts) part.dispose()
    this.song = null
    this.syncGlow()
  }

  private record(window: number[], value: number): void {
    window.push(value)
    if (window.length > STATS_WINDOW) window.shift()
  }
}

function onsetsOf(notes: readonly NoteInstance[]): Onset[] {
  return notes
    .map((n) => ({ tick: n.startTick, midi: n.midi, velocity: n.velocity }))
    .sort((a, b) => a.tick - b.tick)
}
