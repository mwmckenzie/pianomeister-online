import { Instrument, pianoToPreset, SampleLoader, type Smplr, type SmplrPreset } from 'smplr'

import type { Hand } from '@/core/hands/Hand'

import type { AudioOutput } from './AudioOutput'
import type { OutputGains } from './OutputGains'
import { sampleFileName } from './sampleFileName'
import type { ScheduledNote } from './ScheduledNote'

type Route = `${Hand}-${'normal' | 'preRoll'}`

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
  readonly buses: Record<Route, GainNode>
  readonly pianos: Record<Route, Smplr>
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
 *   piano (route, generation) → generation bus → route gain (1 or pre-roll level)
 *     → hand gain → master → destination;   clicks → metronome gain → master
 */
export class SmplrOutput implements AudioOutput {
  readonly ready: Promise<void>
  private readonly master: GainNode
  private readonly handGains: Record<Hand, GainNode>
  private readonly routeGains: Record<Route, GainNode>
  private readonly metronomeGain: GainNode
  private generations: Generation[] = []
  private active = 0
  private pending: Pending[] = []
  private stopIds = 0
  private disposed = false

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
    this.metronomeGain = this.gain(this.master)
    this.ready = this.load(options.baseUrl, options.onProgress)
  }

  playNote(note: ScheduledNote): void {
    const generation = this.generations[this.active]
    if (generation === undefined || this.disposed) return
    const route: Route = `${note.hand}-${note.preRoll ? 'preRoll' : 'normal'}`
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
    for (const route of ROUTES) {
      const bus = old.buses[route].gain
      bus.cancelScheduledValues(now)
      bus.setValueAtTime(bus.value, now)
      bus.linearRampToValueAtTime(0, now + FADE_SEC)
      // Voices release under a silent bus; smplr's own release would take ~0.5 s.
      old.pianos[route].stop({ time: now + FADE_SEC })
    }
    this.active = (this.active + 1) % this.generations.length
    const next = this.generations[this.active] as Generation
    for (const route of ROUTES) {
      const bus = next.buses[route].gain
      bus.cancelScheduledValues(now)
      bus.setValueAtTime(1, now)
    }
  }

  setGains(gains: OutputGains): void {
    const set = (node: GainNode, value: number) =>
      node.gain.setTargetAtTime(value, this.context.currentTime, GAIN_SMOOTHING_SEC)
    set(this.master, gains.master)
    set(this.handGains.right, gains.right)
    set(this.handGains.left, gains.left)
    set(this.routeGains['right-preRoll'], gains.preRoll)
    set(this.routeGains['left-preRoll'], gains.preRoll)
    set(this.metronomeGain, gains.metronome)
  }

  dispose(): void {
    this.disposed = true
    this.cancelPending(-Infinity)
    for (const generation of this.generations) {
      for (const route of ROUTES) {
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
    const make = (route: Route, bus: GainNode, report: boolean): Smplr =>
      SelfHostedPiano(this.context, {
        baseUrl,
        loader,
        destination: bus,
        onLoadProgress: report ? (p) => onProgress?.(p.loaded, p.total) : undefined,
      })

    const buses = (gen: number): Record<Route, GainNode> => {
      const out = {} as Record<Route, GainNode>
      for (const route of ROUTES) out[route] = this.gain(this.routeGains[route], gen === 0 ? 1 : 0)
      return out
    }

    // The loader has no in-flight dedupe: load once, then every other instrument hits its cache.
    const firstBuses = buses(0)
    const first = make('right-normal', firstBuses['right-normal'], true)
    await first.ready
    const generations: Generation[] = []
    for (let gen = 0; gen < GENERATIONS; gen++) {
      const genBuses = gen === 0 ? firstBuses : buses(gen)
      const pianos = {} as Record<Route, Smplr>
      for (const route of ROUTES) {
        pianos[route] =
          gen === 0 && route === 'right-normal' ? first : make(route, genBuses[route], false)
      }
      generations.push({ buses: genBuses, pianos })
    }
    await Promise.all(generations.flatMap((g) => ROUTES.map((r) => g.pianos[r].ready)))
    if (this.disposed) {
      for (const g of generations) for (const r of ROUTES) g.pianos[r].dispose()
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
