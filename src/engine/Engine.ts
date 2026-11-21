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
import { NoteNameLayer } from './names/NoteNameLayer'
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
  /** The transport is playing (setPlaying); paused, the frame settles (brief decision 119). */
  private playing = false
  /** Playback resumed since the last frame: notes up to the paused position don't pulse. */
  private resumed = false
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
        white: new NoteNameLayer(white, this.time, this.atlas.texture, ORDER.whiteNames),
        black: new NoteNameLayer(black, this.time, this.atlas.texture, ORDER.blackNames),
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
      for (const [layer, y, top] of [
        [song.names.white, WHITE_LANE_Y, false],
        [song.names.black, Math.max(lift, WHITE_LANE_Y + 0.005), onTop],
      ] as const) {
        layer.mesh.visible = namesOnNotes
        layer.setLift(y, top)
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
    if (frozen === this.frozen) return
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
    for (const layer of this.song === null ? [] : Object.values(this.song.names)) {
      layer.setViewport(bufferHeight, pipeline.renderer.getPixelRatio())
    }
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
    this.lastTick = tick
    // The chain can change after applySettings (FXAA/SMAA passes load asynchronously).
    if (pipeline.bloomActive !== this.glowSyncedFor) this.syncGlow()
    pipeline.render()
    this.rendered++
    this.record(this.frameMs, performance.now() - started)
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
