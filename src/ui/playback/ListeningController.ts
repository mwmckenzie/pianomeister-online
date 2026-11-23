import { BUILT_IN_LOOKS } from '@/core/looks/BUILT_IN_LOOKS'
import type { Look } from '@/core/looks/Look'
import { easeSettings } from '@/core/looks/easeSettings'
import { lookSettings } from '@/core/looks/lookValues'
import { buildTimeline } from '@/core/playlists/buildTimeline'
import { nextInOrder } from '@/core/playlists/nextInOrder'
import type { Playlist } from '@/core/playlists/Playlist'
import type { PlaylistTimeline } from '@/core/playlists/PlaylistTimeline'
import type { PlayOrder } from '@/core/playlists/PlayOrder'
import { previousInOrder } from '@/core/playlists/previousInOrder'
import { resolvePlaylist } from '@/core/playlists/resolvePlaylist'
import { setShuffle } from '@/core/playlists/setShuffle'
import { songEndSec } from '@/core/playlists/songEndSec'
import { songStartTimes } from '@/core/playlists/songStartTimes'
import { startOrder } from '@/core/playlists/startOrder'
import type { DeviceClass } from '@/core/settings/DeviceClass'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'
import type { Song } from '@/core/song/Song'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { OpenedSong } from '@/data/OpenedSong'

import type { ListeningSong } from '../stores/listeningStore'
import type { LoadedSong } from './LoadedSong'
import { PlaybackSession } from './PlaybackSession'

/** The next song is made ready this long (plus the crossfade) before the current one ends. */
const PREPARE_AHEAD_SEC = 10
/** A seam that would land in the past (the next song was late) moves this far ahead instead. */
const LATE_SEAM_SEC = 0.5

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
  /**
   * The engine takes the new timeline; returns how long that took (ms). `shiftTicks` (a swap
   * mid-song; null for a fresh start) keeps the effects in flight across it.
   */
  showTimeline(timeline: PlaylistTimeline, shiftTicks: number | null): number
  /** The seam where the next song starts (its label) and the crossfade band; null: none. */
  setSeam(
    seam: { readonly tick: number; readonly label: string } | null,
    band: { readonly startTick: number; readonly endTick: number; readonly deck: number } | null,
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
  readonly clock?: {
    readonly bar: number
    readonly beat: number
    readonly bpm: number
    readonly elapsedSec: number
    readonly durationSec: number
    readonly playing: boolean
  } | null
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
  private playable: number[] = []
  private parts: Part[] = []
  private current = 0
  private preparing = false
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
      transport.seekToSeconds(part.startSec)
      this.resetDecks()
      return
    }
    await this.playFresh(back.order, transport.state === 'playing')
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

  /** Builds and plays `parts` as the timeline, at `positionSec`; `swap` keeps playing. */
  private rebuild(parts: Part[], positionSec: number, swap: boolean): void {
    // The old timeline's ticks at the new first song's start: 0 for an append (the same first
    // song), its start for a rebase (the next song moved to 0).
    const kept = this.parts.findIndex((p) => p.prepared === parts[0]?.prepared)
    const shiftTicks = swap ? (this.lastTimeline?.segments[kept]?.startTick ?? 0) : null
    const timeline = buildTimeline(
      parts.map((p) => ({
        source: {
          song: p.prepared.loaded.song,
          tempoMap: p.prepared.loaded.tempoMap,
          notes: p.prepared.loaded.notes,
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
    }
    this.host.session.loadTimeline(loaded, timeline.song.endTick, positionSec, swap)
    this.swapMs.push(this.host.showTimeline(timeline, shiftTicks))
    this.lastTimeline = timeline
    this.publishSeam(timeline, parts)
    this.fadeKey = ''
  }

  /** Appends the next song once the current one nears its end (and it's ready). */
  private maybePrepareNext(t: number): void {
    const part = this.parts[this.current]
    if (this.playlist === null || part === undefined || this.preparing) return
    if (this.current !== this.parts.length - 1) return
    const crossfade = this.host.crossfadeSec()
    if (part.startSec + part.prepared.endSec - t > crossfade + PREPARE_AHEAD_SEC) return
    const order = nextInOrder(part.order, this.playlist.repeat, () => this.host.random())
    if (order === null) return
    const index = order.order[order.position]
    if (index === undefined) return
    this.preparing = true
    const generation = this.generation
    void this.prepare(index).then((prepared) => {
      this.preparing = false
      if (generation !== this.generation || prepared === null) return
      const now = this.parts[this.current]
      if (now === undefined) return
      const [, offset] = songStartTimes(
        [now.prepared.endSec, prepared.endSec],
        this.host.crossfadeSec(),
      )
      const at = this.host.session.transport.position
      let startSec = now.startSec + (offset ?? now.prepared.endSec)
      if (startSec < at + LATE_SEAM_SEC) {
        // Ready too late for its place: the seam waits rather than glitch.
        startSec = at + LATE_SEAM_SEC
        this.lateSeams++
      }
      const deck: 0 | 1 = now.deck === 0 ? 1 : 0
      this.rebuild([now, { prepared, order, startSec, deck }], at, true)
      this.current = 0
      // Without a fade the next song's deck must be fully open.
      if (this.host.crossfadeSec() <= 0) this.host.session.output.setDeckGain(deck, 1)
      this.publishPosition()
    })
  }

  /** Keeps the audio crossfade in step with the timeline (scheduled when playing; resumed mid-way). */
  private syncFade(t: number): void {
    const ending = this.parts[this.current]
    const next = this.parts[this.current + 1]
    const { session } = this.host
    if (ending === undefined || next === undefined || session.transport.state !== 'playing') {
      this.fadeKey = ''
      return
    }
    const overlapEnd = ending.startSec + ending.prepared.endSec
    const overlap = overlapEnd - next.startSec
    if (overlap <= 0 || t >= overlapEnd) return
    const key = `${this.generation}:${next.startSec}:${this.tempoPercent}`
    if (key === this.fadeKey) return
    this.fadeKey = key
    const rate = this.tempoPercent / 100
    const audioNow = session.context.currentTime
    const songNow = session.transport.songTimeAt(audioNow)
    const from = Math.max(next.startSec, songNow)
    const progress = (from - next.startSec) / overlap
    session.output.crossfade(
      ending.deck,
      audioNow + (from - songNow) / rate,
      (overlapEnd - from) / rate,
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
        ? { startTick: second.startTick, endTick: first.endTick, deck: parts[0]?.deck ?? 0 }
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
    this.preparing = false
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
    bpm: number
    elapsedSec: number
  } {
    const t = this.host.session.transport.position - part.startSec
    const { tempoMap, barMap } = part.prepared.loaded
    const tick = tempoMap.secondsToTick(Math.max(0, t))
    const at = barMap.tickToPosition(tick)
    return {
      bar: at.bar,
      beat: at.beat,
      bpm: (tempoMap.bpmAt(tick) * this.tempoPercent) / 100,
      elapsedSec: Math.max(0, Math.min(t, part.prepared.endSec)),
    }
  }
}

/** A stand-in Song for the timeline (the player reads its length and PPQ). */
function timelineSong(timeline: PlaylistTimeline, name: string): Song {
  return {
    id: 'playlist-timeline',
    title: name,
    format: 1,
    trackCount: 1,
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
