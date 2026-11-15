import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'

import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

import { createTimeUniforms } from './createTimeUniforms'
import { Effects } from './Effects'
import type { EngineSong } from './EngineSong'
import { Highway } from './Highway'
import { Keyboard } from './Keyboard'
import type { CameraPlacement } from './model/CameraPlacement'
import { cameraFit } from './model/cameraFit'
import { KeyStates } from './model/KeyStates'
import { noteInstances } from './model/noteInstances'
import { unitsPerTick } from './model/unitsPerTick'
import { NoteLayer } from './NoteLayer'
import { PedalBands } from './PedalBands'

const FOV_DEG = 40
const MAX_PIXEL_RATIO = 2
/** Bigger jumps than this (seeks, loop wraps) are not "notes being reached": no sparks. */
const MAX_SPARK_JUMP_QUARTERS = 2
const STATS_WINDOW = 120
/** Bar/beat lines also cover a few bars before tick 0, for pre-roll count-ins. */
const PRE_SONG_BARS = 4

interface SongParts {
  readonly ppq: number
  readonly notes: NoteLayer
  readonly highway: Highway
  readonly pedals: PedalBands
  readonly keyStates: KeyStates
  /** Note onsets sorted by tick, for spark spawning. */
  readonly onsets: readonly { readonly tick: number; readonly midi: number }[]
}

/**
 * The Three.js scene behind the player. Imperative and non-reactive: the UI calls mount(),
 * setSong(), applySettings(), resize() and dispose(). Each animation frame it reads the song
 * position from the time source; it never drives timing. requestAnimationFrame stops in
 * hidden tabs, so rendering pauses there while audio keeps playing.
 */
export class Engine {
  private renderer: WebGLRenderer | null = null
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(FOV_DEG, 1, 0.5, 1000)
  private readonly time = createTimeUniforms()
  private readonly keyboard = new Keyboard()
  private readonly effects = new Effects()
  private song: SongParts | null = null
  private settings: PlayerSettings = DEFAULT_SETTINGS
  private placement: CameraPlacement | null = null
  private timeSource: () => number = () => 0
  private guides = false
  private frame = 0
  private lastTick: number | null = null
  private lastFrameAt: number | null = null
  private readonly frameMs: number[] = []
  private readonly intervalMs: number[] = []

  constructor() {
    this.scene.add(new AmbientLight('#ffffff', 1.6))
    const sun = new DirectionalLight('#ffffff', 1.4)
    sun.position.set(20, 30, 25)
    this.scene.add(sun, this.keyboard.group, this.effects.group)
  }

  mount(canvas: HTMLCanvasElement): void {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO))
    this.applySettings(this.settings)
    this.resize()
    this.frame = requestAnimationFrame(this.loop)
  }

  /** Song position source, in ticks; called once per frame. */
  setTimeSource(source: () => number): void {
    this.timeSource = source
  }

  setSong(song: EngineSong): void {
    this.disposeSong()
    const instances = noteInstances(song.notes, song.ppq)
    const { barMap } = song
    const barTicks = song.ppq * 4
    const beats = barMap
      .beatTicksBetween(-PRE_SONG_BARS * barTicks, song.endTick + barTicks)
      .map((tick) => ({ tick, isBar: barMap.tickToPosition(tick).beat === 1 }))
    this.song = {
      ppq: song.ppq,
      notes: new NoteLayer(instances, this.time),
      highway: new Highway(beats, this.time),
      pedals: new PedalBands(song.pedalIntervals, this.time),
      keyStates: new KeyStates(instances),
      onsets: instances
        .map((n) => ({ tick: n.startTick, midi: n.midi }))
        .sort((a, b) => a.tick - b.tick),
    }
    this.scene.add(this.song.highway.group, this.song.pedals.mesh, this.song.notes.mesh)
    this.lastTick = null
    this.effects.clear()
    this.applySettings(this.settings)
  }

  applySettings(settings: PlayerSettings): void {
    this.settings = settings
    this.scene.background = new Color(settings.colors.background)
    this.effects.group.visible = settings.effects.enabled
    const song = this.song
    if (song !== null) {
      song.highway.applySettings(settings)
      song.pedals.setStyle(settings.colors.pedal, settings.opacity.pedal)
      song.notes.setSustainTransparency(
        settings.notes.sustainCenterTransparency,
        settings.notes.sustainEdgeTransparency,
      )
    }
    this.placeCamera()
  }

  /** Debug review aid: marker lines at 1× and 1.5× look-ahead. */
  setGuides(visible: boolean): void {
    this.guides = visible
    this.placeCamera()
  }

  resize(): void {
    const renderer = this.renderer
    if (renderer === null) return
    const canvas = renderer.domElement
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.placeCamera()
    const bufferHeight = height * renderer.getPixelRatio()
    this.effects.setScale(bufferHeight / (2 * Math.tan(((FOV_DEG / 2) * Math.PI) / 180)))
  }

  /** Average CPU time per frame and average interval between frames, in ms. */
  stats(): {
    readonly averageFrameMs: number
    readonly averageIntervalMs: number
    readonly frames: number
  } {
    const mean = (xs: readonly number[]) =>
      xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
    return {
      averageFrameMs: mean(this.frameMs),
      averageIntervalMs: mean(this.intervalMs),
      frames: this.frameMs.length,
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.disposeSong()
    this.keyboard.dispose()
    this.effects.dispose()
    this.renderer?.dispose()
    this.renderer = null
  }

  private readonly loop = (now: number): void => {
    this.frame = requestAnimationFrame(this.loop)
    const renderer = this.renderer
    if (renderer === null) return
    const started = performance.now()
    const dt = this.lastFrameAt === null ? 0 : (now - this.lastFrameAt) / 1000
    if (this.lastFrameAt !== null) this.record(this.intervalMs, now - this.lastFrameAt)
    this.lastFrameAt = now

    const tick = this.timeSource()
    this.time.uTick.value = tick
    const song = this.song
    if (song !== null) {
      const { keys } = this.settings
      const states = song.keyStates.at(tick, keys.fadeBeats * song.ppq, keys.maxApproachAlpha)
      this.keyboard.update(states)
      if (this.settings.effects.enabled) {
        this.spawnSparks(song, tick)
        this.effects.update(dt, states)
      }
    }
    this.lastTick = tick
    renderer.render(this.scene, this.camera)
    this.record(this.frameMs, performance.now() - started)
  }

  /** Sparks for onsets crossed since the last frame, unless the position jumped. */
  private spawnSparks(song: SongParts, tick: number): void {
    const last = this.lastTick
    if (last === null || tick <= last || tick - last > MAX_SPARK_JUMP_QUARTERS * song.ppq) return
    const onsets = song.onsets
    let lo = 0
    let hi = onsets.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if ((onsets[mid]?.tick ?? 0) <= last) lo = mid + 1
      else hi = mid
    }
    for (let i = lo; i < onsets.length; i++) {
      const onset = onsets[i]
      if (onset === undefined || onset.tick > tick) break
      this.effects.spawn(onset.midi)
    }
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

  private disposeSong(): void {
    const song = this.song
    if (song === null) return
    this.scene.remove(song.highway.group, song.pedals.mesh, song.notes.mesh)
    song.highway.dispose()
    song.pedals.dispose()
    song.notes.dispose()
    this.song = null
  }

  private record(window: number[], value: number): void {
    window.push(value)
    if (window.length > STATS_WINDOW) window.shift()
  }
}
