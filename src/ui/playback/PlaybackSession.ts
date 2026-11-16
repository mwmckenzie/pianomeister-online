import { AudioContextClock } from '@/audio/AudioContextClock'
import { AudioScheduler } from '@/audio/AudioScheduler'
import type { AudioSettings } from '@/audio/AudioSettings'
import { LatencyCompensatedClock } from '@/audio/LatencyCompensatedClock'
import { SmplrOutput } from '@/audio/SmplrOutput'
import { WorkerTicker } from '@/audio/WorkerTicker'
import { EventBus } from '@/core/events/EventBus'
import { assignHands } from '@/core/hands/assignHands'
import { DEFAULT_HAND_ASSIGNMENT, type HandAssignment } from '@/core/hands/HandAssignment'
import type { Song } from '@/core/song/Song'
import { applySustain } from '@/core/sustain/applySustain'
import { BarMap } from '@/core/timing/BarMap'
import type { MeterOverride } from '@/core/timing/MeterOverride'
import { TempoMap } from '@/core/timing/TempoMap'
import { Transport } from '@/core/transport/Transport'
import type { TransportEvents } from '@/core/transport/TransportEvents'

import type { LoadedSong } from './LoadedSong'

const SAMPLES_URL = `${import.meta.env.BASE_URL}samples/splendid-grand-piano`

/**
 * Audio context, transport, scheduler and sampled piano wired together, for any screen that
 * plays songs. Plain TS and non-reactive: views keep it outside Vue state.
 */
export class PlaybackSession {
  readonly context = new AudioContext()
  readonly bus = new EventBus<TransportEvents>()
  readonly transport: Transport
  readonly output: SmplrOutput
  readonly ready: Promise<void>
  private readonly scheduler: AudioScheduler
  private readonly visualClock: LatencyCompensatedClock
  private loaded: LoadedSong | null = null
  private loadedKey: string | null = null
  private progress = { loaded: 0, total: 0 }
  private readonly progressListeners = new Set<(loaded: number, total: number) => void>()

  constructor() {
    const clock = new AudioContextClock(this.context)
    this.visualClock = new LatencyCompensatedClock(this.context)
    this.transport = new Transport({ clock, bus: this.bus })
    this.output = new SmplrOutput(this.context, {
      baseUrl: SAMPLES_URL,
      onProgress: (loaded, total) => {
        this.progress = { loaded, total }
        for (const listener of this.progressListeners) listener(loaded, total)
      },
    })
    this.ready = this.output.ready
    this.scheduler = new AudioScheduler({
      transport: this.transport,
      bus: this.bus,
      clock,
      output: this.output,
      ticker: new WorkerTicker(),
    })
    this.scheduler.start()
  }

  get song(): LoadedSong | null {
    return this.loaded
  }

  /** The key passed to the last load(), so a view can tell whether a song is already set up. */
  get songKey(): string | null {
    return this.loadedKey
  }

  /** Sample loading progress; the listener is called now and on every update. Returns an unsubscribe. */
  onSampleProgress(listener: (loaded: number, total: number) => void): () => void {
    this.progressListeners.add(listener)
    listener(this.progress.loaded, this.progress.total)
    return () => this.progressListeners.delete(listener)
  }

  load(
    song: Song,
    options: {
      readonly hands?: HandAssignment
      readonly override?: MeterOverride | null
      readonly key?: string
    } = {},
  ): LoadedSong {
    const hands = options.hands ?? DEFAULT_HAND_ASSIGNMENT
    const tempoMap = new TempoMap(song.ppq, song.tempoEvents)
    const barMap = BarMap.fromSong(song, options.override ?? null)
    const notes = assignHands(applySustain(song.notes, song.pedalIntervals), hands)
    const assigned = new Set([...hands.right, ...hands.left])
    const loaded: LoadedSong = {
      song,
      tempoMap,
      barMap,
      notes,
      pedalIntervals: song.pedalIntervals.filter((p) => assigned.has(p.channel)),
    }
    this.loaded = loaded
    this.loadedKey = options.key ?? null
    this.transport.setSong({ notes, tempoMap, barMap, endTick: song.durationTicks })
    return loaded
  }

  setAudioSettings(settings: AudioSettings): void {
    this.scheduler.setSettings(settings)
  }

  /** Browsers only run the audio clock after a user gesture; call from gesture handlers. */
  async unlock(): Promise<void> {
    if (this.context.state !== 'running') await this.context.resume()
  }

  async play(): Promise<void> {
    await this.unlock()
    this.transport.play()
  }

  async togglePlay(): Promise<void> {
    if (this.transport.state === 'playing') this.transport.pause()
    else await this.play()
  }

  /** Song position in ticks as currently heard (output latency removed), for rendering. */
  audibleTick(): number {
    const loaded = this.loaded
    if (loaded === null) return 0
    const seconds =
      this.transport.state === 'playing'
        ? this.transport.songTimeAt(this.visualClock.now())
        : this.transport.position
    return loaded.tempoMap.secondsToTick(seconds)
  }

  dispose(): void {
    this.transport.stop()
    this.scheduler.dispose()
    this.output.dispose()
    void this.context.close()
  }
}
