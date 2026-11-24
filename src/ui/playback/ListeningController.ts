import { BUILT_IN_LOOKS } from '@/core/looks/BUILT_IN_LOOKS'
import type { Look } from '@/core/looks/Look'
import { easeSettings } from '@/core/looks/easeSettings'
import { lookSettings } from '@/core/looks/lookValues'
import { buildTimeline } from '@/core/playlists/buildTimeline'
import type { CrossfadeBand } from '@/core/playlists/CrossfadeBand'
import type { CrossfadeCurve } from '@/core/playlists/CrossfadeCurve'
import { nextInOrder } from '@/core/playlists/nextInOrder'
import { placeNextSong } from '@/core/playlists/placeNextSong'
import type { Playlist } from '@/core/playlists/Playlist'
import type { PlaylistTimeline } from '@/core/playlists/PlaylistTimeline'
import type { PlayOrder } from '@/core/playlists/PlayOrder'
import { previousInOrder } from '@/core/playlists/previousInOrder'
import { resolvePlaylist } from '@/core/playlists/resolvePlaylist'
import { setShuffle } from '@/core/playlists/setShuffle'
import { songEndSec } from '@/core/playlists/songEndSec'
import { startOrder } from '@/core/playlists/startOrder'
import type { DeviceClass } from '@/core/settings/DeviceClass'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'
import type { Song } from '@/core/song/Song'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { OpenedSong } from '@/data/OpenedSong'

import type { ListeningBars, ListeningSong } from '../stores/listeningStore'
import type { LoadedSong } from './LoadedSong'
import { PlaybackSession } from './PlaybackSession'

/** The next song is made ready this long (plus the crossfade) before the current one ends. */
const PREPARE_AHEAD_SEC = 10
/** A seam that would land in the past (the next song was late) moves this far ahead instead. */
const LATE_SEAM_SEC = 0.5
/** The same after a seek, where everything is re-planned anyway: a short lead is enough. */
const SEEK_SEAM_SEC = 0.1
/** A seek never lands closer to the song's end than this, so the next one still overlaps it. */
const SEEK_END_SEC = 0.5
/** Bar ticks on the listening timeline are thinned out above this many (as in the player). */
const MAX_BAR_TICKS = 64

/** A song of the playlist, parsed and set up for playback. */
interface Prepared {
  readonly entryIndex: number
  readonly loaded: LoadedSong
  readonly endSec: number
  readonly info: ListeningSong
}

/** One song placed in the current timeline. */
interface Part {
  readonly prepared: Prepared
  readonly order: PlayOrder
  readonly startSec: number
  readonly deck: 0 | 1
}

/** The song after the current one, ready to be placed. */
interface NextSong {
  readonly prepared: Prepared
  readonly order: PlayOrder
}

/** What the controller reads and drives; the player view supplies it. */
export interface ListeningHost {
  readonly session: PlaybackSession
  openSong(songId: string): Promise<OpenedSong>
  entry(songId: string): LibraryEntry | undefined
  savedLooks(): readonly Look[]
  readonly deviceClass: DeviceClass
  /** The user's own settings (under any listening overlay). */
  ownSettings(): PlayerSettings
  setOverlay(settings: PlayerSettings): void
  endOverlay(): void
  setTrackingSuspended(on: boolean): void
  crossfadeSec(): number
  crossfadeCurve(): CrossfadeCurve
  /**
   * The engine takes the new timeline; returns how long that took (ms). `shiftTicks` (a swap
   * mid-song; null for a fresh start) keeps the effects in flight across it.
   */
  showTimeline(timeline: PlaylistTimeline, shiftTicks: number | null): number
  /** The seam where the next song starts (its label) and the crossfade band; null: none. */
  setSeam(
    seam: { readonly tick: number; readonly label: string } | null,
    band: CrossfadeBand | null,
  ): void
  /** The settings shown now (the overlay's), where an ease across a seam starts. */
  currentSettings(): PlayerSettings
  /** One frame of an ease: the engine shows these settings (nothing is stored). */
  previewSettings(settings: PlayerSettings): void
  reducedMotion(): boolean
  /** Wall-clock milliseconds (performance.now). */
  now(): number
  /** Writes the HUD state. */
  update(state: ListeningUpdate): void
  markPlayed(playlistId: string): void
  random(): number
}

/** A change for the listening store (fields left out are unchanged). */
export interface ListeningUpdate {
  readonly active?: boolean
  readonly playlistId?: string | null
  readonly playlistName?: string
  readonly position?: number
  readonly total?: number
  readonly current?: ListeningSong | null
  readonly upNext?: ListeningSong | null
  readonly shuffle?: boolean
  readonly repeat?: Playlist['repeat']
  readonly finished?: boolean
  readonly announce?: boolean
  /** The saved look the current song shows as the playlist's look ("Update playlist look"). */
  readonly playlistLook?: string | null
  readonly clock?: {
    readonly bar: number
    readonly beat: number
    readonly beats: number
    readonly bpm: number
    readonly elapsedSec: number
    readonly durationSec: number
    /** 0–1 of the song, in ticks (the timeline's playhead). */
    readonly progress: number
    readonly playing: boolean
  } | null
  /** The current song's bars, for the timeline. */
  readonly bars?: ListeningBars
}

/**
 * Listening mode (milestone 9.5 C, D): plays a playlist through a rolling timeline — the current
 * song, and once it's ready the next one placed `crossfade` seconds before the current one ends —
 * as one song for the existing transport, scheduler and engine. The next song is appended with
 * an in-place swap (Transport.replaceSong); when the seam crosses the now line the next song
 * becomes current (HUD, look); once the ending song's last release is over the timeline is
 * rebuilt with the current song alone, again in place. Next and Previous start a fresh timeline.
 */
export class ListeningController {
  private playlist: Playlist | null = null
  /** Per entry: its look is the playlist's (no override of its own). */
  private lookFromPlaylist: boolean[] = []
  private playable: number[] = []
  private parts: Part[] = []
  private current = 0
  private loading: {
    readonly generation: number
    readonly song: Promise<NextSong | null>
  } | null = null
  /** Counts seeks: one that waited for the next song gives way to a later one. */
  private seeks = 0
  /** Where a seek still waiting for the next song will land (seconds into the song). */
  private seekTarget: number | null = null
  private tempoPercent = 100
  private fadeKey = ''
  private generation = 0
  /** Timings of every engine rebuild (ms), and seams delayed for a late song: the report's numbers. */
  readonly swapMs: number[] = []
  lateSeams = 0

  constructor(private readonly host: ListeningHost) {}

  get active(): boolean {
    return this.playlist !== null
  }

  /** The song playing now (to reopen on Leave), and its bar. */
  get nowPlaying(): { readonly songId: string; readonly bar: number } | null {
    const part = this.parts[this.current]
    if (part === undefined) return null
    return { songId: part.prepared.info.songId, bar: this.localPosition(part).bar }
  }

  /** The timeline's songs (start and end in timeline seconds) and the current one: tests, debug. */
  debugState(): {
    readonly current: number
    readonly parts: readonly {
      readonly songId: string
      readonly startSec: number
      readonly endSec: number
    }[]
  } {
    return {
      current: this.current,
      parts: this.parts.map((p) => ({
        songId: p.prepared.info.songId,
        startSec: p.startSec,
        endSec: p.startSec + p.prepared.endSec,
      })),
    }
  }

  /** Starts listening to `playlist` at entry `start` (Play: 0). */
  async start(playlist: Playlist, start: number): Promise<void> {
    const looks = new Set([...BUILT_IN_LOOKS, ...this.host.savedLooks()].map((l) => l.id))
    const songs = new Map<string, { durationSec: number }>()
    for (const e of playlist.entries) {
      const entry = this.host.entry(e.songId)
      if (entry !== undefined) songs.set(e.songId, { durationSec: entry.facts.durationSeconds })
    }
    const resolved = resolvePlaylist(playlist, songs, looks)
    this.playable = resolved.entries.flatMap((e, i) => (e.missing ? [] : [i]))
    if (this.playable.length === 0) return
    this.playlist = {
      ...playlist,
      entries: playlist.entries.map((e, i) => ({
        ...e,
        lookId: resolved.entries[i]?.lookId ?? null,
      })),
    }
    this.lookFromPlaylist = resolved.entries.map((e) => e.override === null)
    this.host.setTrackingSuspended(true)
    this.host.markPlayed(playlist.id)
    this.tempoPercent = 100
    const order = startOrder(this.playable, start, playlist.shuffle, () => this.host.random())
    this.host.update({
      active: true,
      playlistId: playlist.id,
      playlistName: playlist.name,
      shuffle: playlist.shuffle,
      repeat: playlist.repeat,
      finished: false,
    })
    await this.playFresh(order, true)
  }

  /** Leaves listening: stops, drops the look overlay and resumes tracking. Returns what played. */
  leave(): { readonly songId: string; readonly bar: number } | null {
    if (this.playlist === null) return null
    const last = this.nowPlaying
    this.generation++
    const { session } = this.host
    session.transport.stop()
    session.setMuted(false)
    session.transport.setTempoPercent(100)
    this.resetDecks()
    this.easing = null
    this.host.setSeam(null, null)
    this.playlist = null
    this.parts = []
    this.host.endOverlay()
    this.host.setTrackingSuspended(false)
    this.host.update({
      active: false,
      playlistId: null,
      current: null,
      upNext: null,
      finished: false,
      clock: null,
      playlistLook: null,
    })
    return last
  }

  /** Called every frame while listening: seams, the next song, the fade, the HUD clock. */
  frame(): void {
    const part = this.parts[this.current]
    if (this.playlist === null || part === undefined) return
    const { transport } = this.host.session
    const t = transport.position
    const next = this.parts[this.current + 1]
    // The seam crossed the now line: the next song is the current one.
    if (next !== undefined && t >= next.startSec) {
      this.current++
      this.becameCurrent(next, true)
    }
    const now = this.parts[this.current] as Part
    // The ending song's last release is over: the current song alone, rebased to 0.
    const ended = this.current > 0 ? this.parts[this.current - 1] : undefined
    if (ended !== undefined && t >= ended.startSec + ended.prepared.endSec) {
      this.rebuild([{ ...now, startSec: 0 }], t - now.startSec, true)
    }
    // The rebase moved the timeline: read the position again.
    const at = transport.position
    this.maybePrepareNext(at)
    this.syncFade(at)
    // The setting changed while a band shows.
    if (this.bandCurve !== this.host.crossfadeCurve() && this.lastTimeline !== null) {
      this.publishSeam(this.lastTimeline, this.parts)
    }
    this.stepEasing()
    if (transport.state === 'stopped' && this.parts.length === 1 && at <= 0 && this.wasPlaying) {
      this.finish()
    }
    this.wasPlaying = transport.state === 'playing'
    const shown = this.parts[this.current] as Part
    const local = this.localPosition(shown)
    this.host.update({
      clock: {
        ...local,
        playing: transport.state === 'playing',
        durationSec: shown.prepared.endSec,
      },
    })
  }

  private wasPlaying = false
  /** The curve the band on the highway shows. */
  private bandCurve: CrossfadeCurve = 'sequential'
  /** A look easing across a seam (milestone 9.5 D6), wall-clock ms. */
  private easing: {
    readonly from: PlayerSettings
    readonly to: PlayerSettings
    readonly start: number
    readonly duration: number
  } | null = null
  /** The timeline last built, for the tick shift of the next swap. */
  private lastTimeline: PlaylistTimeline | null = null

  async next(): Promise<void> {
    const part = this.parts[this.current]
    if (this.playlist === null || part === undefined) return
    const repeat = this.playlist.repeat === 'one' ? 'playlist' : this.playlist.repeat
    const order = nextInOrder(part.order, repeat, () => this.host.random())
    if (order === null) {
      this.finish()
      return
    }
    await this.playFresh(order, this.host.session.transport.state === 'playing')
  }

  async previous(): Promise<void> {
    const part = this.parts[this.current]
    if (this.playlist === null || part === undefined) return
    const { transport } = this.host.session
    const into = transport.position - part.startSec
    const back = previousInOrder(part.order, into)
    if (back.restart) {
      await this.seekTo(0)
      return
    }
    await this.playFresh(back.order, transport.state === 'playing')
  }

  /** Seeks to a bar of the current song (the timeline). */
  async seekToBar(bar: number): Promise<void> {
    const part = this.parts[this.current]
    if (part === undefined) return
    const { barMap, tempoMap } = part.prepared.loaded
    await this.seekTo(tempoMap.tickToSeconds(barMap.barStartTick(bar)))
  }

  /** Seeks `seconds` forward (or back) within the current song. */
  async seekBy(seconds: number): Promise<void> {
    const part = this.parts[this.current]
    if (part === undefined) return
    const from = this.seekTarget ?? this.host.session.transport.position - part.startSec
    await this.seekTo(from + seconds)
  }

  /** The current song's bar at a 0–1 timeline position. */
  barAt(fraction: number): number {
    const part = this.parts[this.current]
    if (part === undefined) return 1
    const { barMap } = part.prepared.loaded
    return Math.min(this.lastBar(part), barMap.tickToPosition(fraction * this.endTick(part)).bar)
  }

  /**
   * Seeks within the current song (the one the timeline shows). In the last part of a song the
   * next one is loaded first, then placed in the same step as the seek, so the seam is never
   * missed and the end never reached without it. While two songs sound, the ending one is cut.
   */
  private async seekTo(seconds: number): Promise<void> {
    const part = this.parts[this.current]
    if (this.playlist === null || part === undefined) return
    const target = Math.min(Math.max(0, part.prepared.endSec - SEEK_END_SEC), Math.max(0, seconds))
    const seek = ++this.seeks
    const generation = this.generation
    let next: NextSong | null = this.parts[this.current + 1] ?? null
    if (next === null && this.inPrepareWindow(part, part.startSec + target)) {
      this.seekTarget = target
      next = await this.loadNext(part)
      if (seek !== this.seeks) return
      this.seekTarget = null
      // Meanwhile another song may have started, or listening ended.
      if (generation !== this.generation) return
      if (this.parts[this.current]?.prepared !== part.prepared) return
    }
    this.seekTarget = null
    const now: Part = { ...part, startSec: 0 }
    const after = next === null ? [] : [this.placed(now, next, target, SEEK_SEAM_SEC)]
    if (this.parts.length > 1 || after.length > 0) {
      this.rebuild([now, ...after], target, true, true)
      this.current = 0
    }
    this.host.session.transport.seekToSeconds(target)
    this.resetDecks()
    this.host.update({ finished: false })
    this.publishPosition()
  }

  /** "Play again" after a finished playlist (repeat off). */
  async playAgain(): Promise<void> {
    if (this.playlist === null) return
    this.host.update({ finished: false })
    await this.playFresh(
      startOrder(this.playable, 0, this.playlist.shuffle, () => this.host.random()),
      true,
    )
  }

  setShuffle(on: boolean): void {
    if (this.playlist === null) return
    this.playlist = { ...this.playlist, shuffle: on }
    const part = this.parts[this.current]
    if (part !== undefined) {
      const order = setShuffle(part.order, this.playable, on, () => this.host.random())
      this.parts[this.current] = { ...part, order }
      this.dropUnstartedNext()
      this.publishPosition()
    }
    this.host.update({ shuffle: on })
  }

  setRepeat(repeat: Playlist['repeat']): void {
    if (this.playlist === null) return
    this.playlist = { ...this.playlist, repeat }
    this.dropUnstartedNext()
    this.publishPosition()
    this.host.update({ repeat })
  }

  /** The listening session's tempo (it resets when listening ends). */
  setTempo(percent: number): void {
    this.tempoPercent = percent
    this.host.session.transport.setTempoPercent(percent)
    this.fadeKey = ''
  }

  // --- internals -------------------------------------------------------------------------------

  /** A fresh timeline with the song at `order` alone. */
  private async playFresh(order: PlayOrder, play: boolean): Promise<void> {
    const index = order.order[order.position]
    if (index === undefined) return
    const generation = ++this.generation
    this.seekTarget = null
    const prepared = await this.prepare(index)
    if (generation !== this.generation || prepared === null) return
    this.current = 0
    this.resetDecks()
    this.rebuild([{ prepared, order, startSec: 0, deck: 0 }], 0, false)
    this.becameCurrent(this.parts[0] as Part, false)
    const { session } = this.host
    session.transport.setTempoPercent(this.tempoPercent)
    this.host.update({ finished: false })
    if (play) await session.play()
  }

  private async prepare(entryIndex: number): Promise<Prepared | null> {
    const songId = this.playlist?.entries[entryIndex]?.songId
    if (songId === undefined) return null
    try {
      const opened = await this.host.openSong(songId)
      const loaded = PlaybackSession.prepare(opened.song, {
        hands: opened.hands,
        override: opened.override,
      })
      return {
        entryIndex,
        loaded,
        endSec: songEndSec(loaded.notes, loaded.tempoMap),
        info: {
          songId,
          title: opened.entry.title,
          composer: opened.entry.composer,
          durationSec: songEndSec(loaded.notes, loaded.tempoMap),
        },
      }
    } catch (e) {
      console.error('[listening] A song could not be opened:', e)
      return null
    }
  }

  /**
   * Builds and plays `parts` as the timeline, at `positionSec`; `swap` keeps playing. A `seek`
   * jumps, so the engine keeps no effects in flight.
   */
  private rebuild(parts: Part[], positionSec: number, swap: boolean, seek = false): void {
    // The old timeline's ticks at the new first song's start: 0 for an append (the same first
    // song), its start for a rebase (the next song moved to 0).
    const kept = this.parts.findIndex((p) => p.prepared === parts[0]?.prepared)
    const shiftTicks = swap && !seek ? (this.lastTimeline?.segments[kept]?.startTick ?? 0) : null
    const timeline = buildTimeline(
      parts.map((p) => ({
        source: {
          song: p.prepared.loaded.song,
          tempoMap: p.prepared.loaded.tempoMap,
          notes: p.prepared.loaded.notes,
          handCages: p.prepared.loaded.handCages,
        },
        startSec: p.startSec,
        deck: p.deck,
      })),
    )
    const shownAt = this.current
    this.parts = parts
    this.current = Math.min(shownAt, parts.length - 1)
    if (swap) this.current = parts.length - 1
    const loaded: LoadedSong = {
      song: timelineSong(timeline, this.playlist?.name ?? ''),
      tempoMap: timeline.song.tempoMap,
      barMap: timeline.song.barMap,
      notes: timeline.notes,
      pedalIntervals: timeline.pedalIntervals,
      handCages: timeline.handCages,
    }
    this.host.session.loadTimeline(loaded, timeline.song.endTick, positionSec, swap)
    this.swapMs.push(this.host.showTimeline(timeline, shiftTicks))
    this.lastTimeline = timeline
    this.publishSeam(timeline, parts)
    this.fadeKey = ''
  }

  /** Whether `at` is close enough to the current song's end for the next one to be made ready. */
  private inPrepareWindow(part: Part, at: number): boolean {
    return part.startSec + part.prepared.endSec - at <= this.host.crossfadeSec() + PREPARE_AHEAD_SEC
  }

  /** The song after `part`, opened once: a seek and the usual look-ahead share one load. */
  private loadNext(part: Part): Promise<NextSong | null> {
    if (this.loading !== null && this.loading.generation === this.generation) {
      return this.loading.song
    }
    const order = nextInOrder(part.order, this.playlist?.repeat ?? 'off', () => this.host.random())
    const index = order === null ? undefined : order.order[order.position]
    if (order === null || index === undefined) return Promise.resolve(null)
    const song = this.prepare(index).then((prepared) =>
      prepared === null ? null : { prepared, order },
    )
    const loading = { generation: this.generation, song }
    this.loading = loading
    void song.then(() => {
      if (this.loading === loading) this.loading = null
    })
    return song
  }

  /** `next` after `part`, its seam `lead` ahead of `at` at the earliest. */
  private placed(part: Part, next: NextSong, at: number, lead: number): Part {
    const { startSec, late } = placeNextSong(
      { startSec: part.startSec, durationSec: part.prepared.endSec },
      next.prepared.endSec,
      this.host.crossfadeSec(),
      at,
      lead,
    )
    if (late && lead === LATE_SEAM_SEC) this.lateSeams++
    return { prepared: next.prepared, order: next.order, startSec, deck: part.deck === 0 ? 1 : 0 }
  }

  /** Appends the next song once the current one nears its end (and it's ready). */
  private maybePrepareNext(t: number): void {
    const part = this.parts[this.current]
    if (this.playlist === null || part === undefined || this.loading !== null) return
    if (this.current !== this.parts.length - 1 || !this.inPrepareWindow(part, t)) return
    const generation = this.generation
    void this.loadNext(part).then((next) => {
      const now = this.parts[this.current]
      if (generation !== this.generation || next === null || now === undefined) return
      if (this.current !== this.parts.length - 1) return
      const at = this.host.session.transport.position
      // Ready too late for its place: the seam waits rather than glitch.
      this.rebuild([now, this.placed(now, next, at, LATE_SEAM_SEC)], at, true)
      this.current = 0
      this.openNextDeck()
      this.publishPosition()
    })
  }

  /** Without an overlap there's no fade: the next song's deck must be fully open. */
  private openNextDeck(): void {
    const [now, next] = this.parts
    if (now === undefined || next === undefined) return
    if (next.startSec >= now.startSec + now.prepared.endSec) {
      this.host.session.output.setDeckGain(next.deck, 1)
    }
  }

  /** Keeps the audio crossfade in step with the timeline (scheduled when playing; resumed mid-way). */
  private syncFade(t: number): void {
    const [ending, next] = this.parts
    const { session } = this.host
    if (ending === undefined || next === undefined || session.transport.state !== 'playing') {
      // A scheduled fade runs on the audio clock: paused, it would go on without the music.
      if (this.fadeKey !== '') this.resetDecks()
      return
    }
    const overlapEnd = ending.startSec + ending.prepared.endSec
    const overlap = overlapEnd - next.startSec
    if (overlap <= 0 || t >= overlapEnd) return
    const curve = this.host.crossfadeCurve()
    const key = `${this.generation}:${next.startSec}:${this.tempoPercent}:${curve}`
    if (key === this.fadeKey) return
    const rate = this.tempoPercent / 100
    const audioNow = session.context.currentTime
    const songNow = session.transport.songTimeAt(audioNow)
    const from = Math.max(next.startSec, songNow)
    const progress = (from - next.startSec) / overlap
    // Drops a fade scheduled for an earlier place (a seek, a tempo change).
    if (progress === 0) this.resetDecks()
    this.fadeKey = key
    session.output.crossfade(
      ending.deck,
      audioNow + (from - songNow) / rate,
      (overlapEnd - from) / rate,
      curve,
      progress,
    )
  }

  private becameCurrent(part: Part, announce: boolean): void {
    // Across a seam the look eases; a fresh start takes it at once.
    this.applyLook(part, announce)
    this.publishPosition(announce)
  }

  /** The seam and band of a two-song timeline (none for one song). */
  private publishSeam(timeline: PlaylistTimeline, parts: readonly Part[]): void {
    this.bandCurve = this.host.crossfadeCurve()
    const [first, second] = timeline.segments
    const next = parts[1]
    if (first === undefined || second === undefined || next === undefined) {
      this.host.setSeam(null, null)
      return
    }
    const { title, composer } = next.prepared.info
    this.host.setSeam(
      { tick: second.startTick, label: composer === '' ? title : `${title} · ${composer}` },
      first.endTick > second.startTick
        ? {
            startTick: second.startTick,
            endTick: first.endTick,
            deck: parts[0]?.deck ?? 0,
            curve: this.bandCurve,
          }
        : null,
    )
  }

  /** One frame of a look easing across a seam; at its end the overlay takes the new look. */
  private stepEasing(): void {
    const easing = this.easing
    if (easing === null) return
    const progress = (this.host.now() - easing.start) / easing.duration
    if (this.host.reducedMotion()) {
      // No easing under reduced motion: the switch happens at the midpoint.
      if (progress < 0.5) return
    } else if (progress < 1) {
      this.host.previewSettings(easeSettings(easing.from, easing.to, progress))
      return
    }
    this.easing = null
    this.host.setOverlay(easing.to)
  }

  /** The HUD's song, position and up next. */
  private publishPosition(announce = false): void {
    const part = this.parts[this.current]
    if (this.playlist === null || part === undefined) return
    const after = this.parts[this.current + 1]
    const upNextOrder = after?.order ?? nextInOrder(part.order, this.playlist.repeat, () => 0.5)
    const upIndex = upNextOrder === null ? undefined : upNextOrder.order[upNextOrder.position]
    const upSong = upIndex === undefined ? undefined : this.playlist.entries[upIndex]?.songId
    const upEntry = upSong === undefined ? undefined : this.host.entry(upSong)
    this.host.update({
      position: part.order.position + 1,
      total: part.order.order.length,
      current: part.prepared.info,
      bars: this.barsOf(part),
      upNext:
        after !== undefined
          ? after.prepared.info
          : upEntry === undefined || upSong === undefined
            ? null
            : {
                songId: upSong,
                title: upEntry.title,
                composer: upEntry.composer,
                durationSec: upEntry.facts.durationSeconds,
              },
      announce,
    })
  }

  /** The song's look (its own, else the playlist's) over the user's settings; none = theirs. */
  private applyLook(part: Part, ease: boolean): void {
    const id = this.playlist?.entries[part.prepared.entryIndex]?.lookId ?? null
    const look =
      id === null
        ? undefined
        : [...BUILT_IN_LOOKS, ...this.host.savedLooks()].find((l) => l.id === id)
    const own = this.host.ownSettings()
    const target = look === undefined ? own : lookSettings(own, look, this.host.deviceClass)
    const fromPlaylist = this.lookFromPlaylist[part.prepared.entryIndex] === true
    this.host.update({
      playlistLook: look !== undefined && !look.builtIn && fromPlaylist ? look.id : null,
    })
    const from = this.host.currentSettings()
    if (!ease || JSON.stringify(from) === JSON.stringify(target)) {
      this.easing = null
      this.host.setOverlay(target)
      return
    }
    this.easing = {
      from,
      to: target,
      start: this.host.now(),
      duration: Math.max(this.host.crossfadeSec(), 0.5) * 1000,
    }
  }

  /** A pending next song not yet sounding is dropped (shuffle or repeat changed): it's re-chosen. */
  private dropUnstartedNext(): void {
    const part = this.parts[this.current]
    if (part === undefined || this.parts.length < 2 || this.current !== 0) return
    const at = this.host.session.transport.position
    const next = this.parts[1] as Part
    if (at >= next.startSec) return
    this.generation++
    this.rebuild([part], at, true)
    this.resetDecks()
  }

  private finish(): void {
    const { session } = this.host
    if (session.transport.state === 'playing') session.transport.pause()
    this.host.update({ finished: true, upNext: null })
  }

  private resetDecks(): void {
    const { output } = this.host.session
    output.setDeckGain(0, 1)
    output.setDeckGain(1, 1)
    this.fadeKey = ''
  }

  /** Bar, beat, bpm and time of the current song, numbered from its own start. */
  private localPosition(part: Part): {
    bar: number
    beat: number
    beats: number
    bpm: number
    elapsedSec: number
    progress: number
  } {
    const t = this.host.session.transport.position - part.startSec
    const { tempoMap, barMap } = part.prepared.loaded
    const tick = tempoMap.secondsToTick(Math.max(0, t))
    const at = barMap.tickToPosition(tick)
    return {
      bar: at.bar,
      beat: at.beat,
      beats: barMap.beatsPerBar(Math.max(at.bar, barMap.firstBar)),
      bpm: (tempoMap.bpmAt(tick) * this.tempoPercent) / 100,
      elapsedSec: Math.max(0, Math.min(t, part.prepared.endSec)),
      progress: Math.min(1, tick / this.endTick(part)),
    }
  }

  private endTick(part: Part): number {
    return Math.max(1, part.prepared.loaded.tempoMap.secondsToTick(part.prepared.endSec))
  }

  private lastBar(part: Part): number {
    const { barMap } = part.prepared.loaded
    return Math.max(barMap.firstBar, barMap.tickToPosition(this.endTick(part) - 1).bar)
  }

  private barsOf(part: Part): ListeningBars {
    const { barMap } = part.prepared.loaded
    const last = this.lastBar(part)
    let step = 1
    while (last / step > MAX_BAR_TICKS) step *= 2
    const ticks: number[] = []
    for (let bar = 1 + step; bar <= last; bar += step) {
      ticks.push(barMap.barStartTick(bar) / this.endTick(part))
    }
    return { first: barMap.firstBar, last, ticks }
  }
}

/** A stand-in Song for the timeline (the player reads its length and PPQ). */
function timelineSong(timeline: PlaylistTimeline, name: string): Song {
  return {
    id: 'playlist-timeline',
    title: name,
    format: 1,
    trackCount: 1,
    noteIds: [],
    ppq: timeline.ppq,
    notes: [],
    channels: [],
    tempoEvents: [],
    timeSignatureEvents: [],
    pedalIntervals: [...timeline.pedalIntervals],
    durationTicks: timeline.song.endTick,
    durationSeconds: timeline.song.tempoMap.tickToSeconds(timeline.song.endTick),
  }
}
