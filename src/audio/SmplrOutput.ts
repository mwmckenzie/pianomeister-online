import { Instrument, pianoToPreset, SampleLoader, type Smplr, type SmplrPreset } from 'smplr'

import type { Hand } from '@/core/hands/Hand'

import type { AudioOutput } from './AudioOutput'
import type { OutputGains } from './OutputGains'
import { sampleFileName } from './sampleFileName'
import type { ScheduledNote } from './ScheduledNote'

type Route = `${Hand}-${'normal' | 'preRoll'}`
/** A route on one of the two playlist decks (milestone 9.5: a crossfade fades one into the other). */
type DeckRoute = `${Route}:${0 | 1}`

/** Release time in seconds for a note's natural end (smplr's SplendidGrandPiano default). */
const DECAY_SEC = 0.5

/**
 * smplr's Splendid Grand Piano preset, pointed at our self-hosted copy. Its `samples.map`
 * sends each sample name to the URL-safe file name the fetch script saved it under.
 */
function selfHostedPianoPreset(baseUrl: string): SmplrPreset {
  const preset = pianoToPreset({ baseUrl, decayTime: DECAY_SEC, detune: 0 })
  const map: Record<string, string> = {}
  for (const group of preset.groups) {
    for (const region of group.regions) map[region.sample] = sampleFileName(region.sample)
  }
  return { ...preset, samples: { ...preset.samples, map } }
}

const SelfHostedPiano = Instrument<{ readonly baseUrl: string }>((_ctx, options, smplr) =>
  smplr.loadInstrument(selfHostedPianoPreset(options.baseUrl)),
)
const ROUTES: readonly Route[] = ['right-normal', 'left-normal', 'right-preRoll', 'left-preRoll']
const DECK_ROUTES: readonly DeckRoute[] = ROUTES.flatMap((r) => [`${r}:0`, `${r}:1`] as const)
const routeOf = (deckRoute: DeckRoute) => deckRoute.slice(0, -2) as Route
/** Curve points for an equal-power fade (setValueCurveAtTime). */
const FADE_POINTS = 64

/**
 * Generations let releaseAll() fade out everything sounding in ~30 ms while new notes start at
 * once on a fresh set of instruments. Three, round-robin, so a generation's release tails have
 * finished before it is reused even when resets come in quick succession (e.g. a tempo drag).
 */
const GENERATIONS = 3
const FADE_SEC = 0.03
/** Smooths gain changes so slider moves don't click. */
const GAIN_SMOOTHING_SEC = 0.015

interface Generation {
  readonly buses: Record<DeckRoute, GainNode>
  readonly pianos: Record<DeckRoute, Smplr>
}

interface Pending {
  readonly time: number
  readonly cancel: () => void
}

/**
 * Web Audio output: the self-hosted Splendid Grand Piano via smplr, plus a synthesized
 * metronome. smplr has no per-note destination, so each route (hand × normal/pre-roll) is
 * its own instrument; all instruments share one SampleLoader, so samples are fetched and
 * decoded once.
 *
 *   piano (route, deck, generation) → generation bus → deck gain (crossfade)
 *     → route gain (1 or pre-roll level) → hand gain → master → destination;
 *   clicks → metronome gain → master
 *
 * Decks (milestone 9.5): outside listening everything plays on deck 0 at gain 1. A playlist
 * timeline alternates songs between decks, and a crossfade ramps one deck's gains down as the
 * other's come up.
 */
export class SmplrOutput implements AudioOutput {
  readonly ready: Promise<void>
  private readonly master: GainNode
  private readonly handGains: Record<Hand, GainNode>
  private readonly routeGains: Record<Route, GainNode>
  private readonly deckGains: Record<DeckRoute, GainNode>
  private readonly metronomeGain: GainNode
  private generations: Generation[] = []
  private active = 0
  private pending: Pending[] = []
  private stopIds = 0
  private disposed = false
  private masterLevel = 1
  private muted = false

  constructor(
    private readonly context: AudioContext,
    options: {
      readonly baseUrl: string
      readonly onProgress?: (loaded: number, total: number) => void
    },
  ) {
    this.master = this.gain(context.destination)
    this.handGains = { right: this.gain(this.master), left: this.gain(this.master) }
    this.routeGains = {
      'right-normal': this.gain(this.handGains.right),
      'left-normal': this.gain(this.handGains.left),
      'right-preRoll': this.gain(this.handGains.right, 0),
      'left-preRoll': this.gain(this.handGains.left, 0),
    }
    this.deckGains = {} as Record<DeckRoute, GainNode>
    for (const dr of DECK_ROUTES) this.deckGains[dr] = this.gain(this.routeGains[routeOf(dr)])
    this.metronomeGain = this.gain(this.master)
    this.ready = this.load(options.baseUrl, options.onProgress)
  }

  playNote(note: ScheduledNote): void {
    const generation = this.generations[this.active]
    if (generation === undefined || this.disposed) return
    const route: DeckRoute = `${note.hand}-${note.preRoll ? 'preRoll' : 'normal'}:${note.deck === 1 ? 1 : 0}`
    // A unique stopId lets cancelPending() stop just this note, not every note of that pitch.
    const stop = generation.pianos[route].start({
      note: note.midi,
      velocity: note.velocity,
      time: note.time,
      duration: note.duration,
      stopId: ++this.stopIds,
    })
    this.track({ time: note.time, cancel: () => stop() })
  }

  playClick(time: number, accent: boolean): void {
    if (this.disposed) return
    const osc = this.context.createOscillator()
    const envelope = this.context.createGain()
    osc.type = 'square'
    osc.frequency.value = accent ? 1600 : 1100
    const peak = accent ? 0.5 : 0.3
    envelope.gain.setValueAtTime(0, time)
    envelope.gain.linearRampToValueAtTime(peak, time + 0.002)
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
    osc.connect(envelope).connect(this.metronomeGain)
    osc.start(time)
    osc.stop(time + 0.06)
    osc.onended = () => envelope.disconnect()
    this.track({ time, cancel: () => osc.stop() })
  }

  cancelPending(time: number): void {
    const keep: Pending[] = []
    for (const p of this.pending) {
      if (p.time >= time) p.cancel()
      else keep.push(p)
    }
    this.pending = keep
  }

  releaseAll(): void {
    const old = this.generations[this.active]
    if (old === undefined) return
    const now = this.context.currentTime
    this.cancelPending(now)
    for (const route of DECK_ROUTES) {
      const bus = old.buses[route].gain
      bus.cancelScheduledValues(now)
      bus.setValueAtTime(bus.value, now)
      bus.linearRampToValueAtTime(0, now + FADE_SEC)
      // Voices release under a silent bus; smplr's own release would take ~0.5 s.
      old.pianos[route].stop({ time: now + FADE_SEC })
    }
    this.active = (this.active + 1) % this.generations.length
    const next = this.generations[this.active] as Generation
    for (const route of DECK_ROUTES) {
      const bus = next.buses[route].gain
      bus.cancelScheduledValues(now)
      bus.setValueAtTime(1, now)
    }
  }

  setGains(gains: OutputGains): void {
    const set = (node: GainNode, value: number) =>
      node.gain.setTargetAtTime(value, this.context.currentTime, GAIN_SMOOTHING_SEC)
    this.masterLevel = gains.master
    set(this.master, this.muted ? 0 : gains.master)
    set(this.handGains.right, gains.right)
    set(this.handGains.left, gains.left)
    set(this.routeGains['right-preRoll'], gains.preRoll)
    set(this.routeGains['left-preRoll'], gains.preRoll)
    set(this.metronomeGain, gains.metronome)
  }

  /** Listening's mute: silences the master without touching the volume settings. */
  setMuted(muted: boolean): void {
    this.muted = muted
    this.master.gain.setTargetAtTime(
      muted ? 0 : this.masterLevel,
      this.context.currentTime,
      GAIN_SMOOTHING_SEC,
    )
  }

  /** Sets a deck's gain now (both 1 outside a crossfade; a seek skips any fade in progress). */
  setDeckGain(deck: 0 | 1, value: number): void {
    const now = this.context.currentTime
    for (const route of ROUTES) {
      const gain = this.deckGains[`${route}:${deck}`].gain
      gain.cancelScheduledValues(now)
      gain.setValueAtTime(value, now)
    }
  }

  /**
   * An equal-power crossfade (milestone 9.5 D2): from `time` over `duration` seconds, deck `from`
   * falls as cos and deck `to` rises as sin. Both decks end where the next song plays alone.
   */
  crossfade(from: 0 | 1, time: number, duration: number, fromProgress = 0): void {
    const to = from === 0 ? 1 : 0
    const out = new Float32Array(FADE_POINTS)
    const fadeIn = new Float32Array(FADE_POINTS)
    // A fade picked up part-way (playback resumed mid-overlap) runs from `fromProgress` to the end.
    const p0 = Math.min(1, Math.max(0, fromProgress))
    for (let i = 0; i < FADE_POINTS; i++) {
      const t = p0 + (1 - p0) * (i / (FADE_POINTS - 1))
      out[i] = Math.cos((t * Math.PI) / 2)
      fadeIn[i] = Math.sin((t * Math.PI) / 2)
    }
    const start = Math.max(time, this.context.currentTime)
    const length = Math.max(0.01, duration)
    for (const route of ROUTES) {
      for (const [deck, curve] of [
        [from, out],
        [to, fadeIn],
      ] as const) {
        const gain = this.deckGains[`${route}:${deck}`].gain
        gain.cancelScheduledValues(start)
        gain.setValueCurveAtTime(curve, start, length)
      }
    }
  }

  dispose(): void {
    this.disposed = true
    this.cancelPending(-Infinity)
    for (const generation of this.generations) {
      for (const route of DECK_ROUTES) {
        generation.pianos[route].dispose()
        generation.buses[route].disconnect()
      }
    }
    this.generations = []
    this.master.disconnect()
  }

  private async load(
    baseUrl: string,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    const loader = SampleLoader(this.context)
    const make = (route: DeckRoute, bus: GainNode, report: boolean): Smplr =>
      SelfHostedPiano(this.context, {
        baseUrl,
        loader,
        destination: bus,
        onLoadProgress: report ? (p) => onProgress?.(p.loaded, p.total) : undefined,
      })

    const buses = (gen: number): Record<DeckRoute, GainNode> => {
      const out = {} as Record<DeckRoute, GainNode>
      for (const route of DECK_ROUTES)
        out[route] = this.gain(this.deckGains[route], gen === 0 ? 1 : 0)
      return out
    }

    // The loader has no in-flight dedupe: load once, then every other instrument hits its cache.
    const firstBuses = buses(0)
    const first = make('right-normal:0', firstBuses['right-normal:0'], true)
    await first.ready
    const generations: Generation[] = []
    for (let gen = 0; gen < GENERATIONS; gen++) {
      const genBuses = gen === 0 ? firstBuses : buses(gen)
      const pianos = {} as Record<DeckRoute, Smplr>
      for (const route of DECK_ROUTES) {
        pianos[route] =
          gen === 0 && route === 'right-normal:0' ? first : make(route, genBuses[route], false)
      }
      generations.push({ buses: genBuses, pianos })
    }
    await Promise.all(generations.flatMap((g) => DECK_ROUTES.map((r) => g.pianos[r].ready)))
    if (this.disposed) {
      for (const g of generations) for (const r of DECK_ROUTES) g.pianos[r].dispose()
      return
    }
    this.generations = generations
  }

  private gain(destination: AudioNode, value = 1): GainNode {
    const node = this.context.createGain()
    node.gain.value = value
    node.connect(destination)
    return node
  }

  private track(item: Pending): void {
    // Drop entries that have started; only future ones can still be cancelled.
    const now = this.context.currentTime
    if (this.pending.length > 256) this.pending = this.pending.filter((p) => p.time >= now)
    this.pending.push(item)
  }
}
