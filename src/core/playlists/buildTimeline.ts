import type { HandCage } from '../cages/HandCage'
import type { Hand } from '../hands/Hand'
import type { HandNote } from '../hands/HandNote'
import type { PedalInterval } from '../song/PedalInterval'
import type { TempoEvent } from '../song/TempoEvent'
import type { TimeSignatureEvent } from '../song/TimeSignatureEvent'
import { BarMap } from '../timing/BarMap'
import { TempoMap } from '../timing/TempoMap'
import type { PlaylistTimeline } from './PlaylistTimeline'
import { songEndSec } from './songEndSec'
import { TIMELINE_PPQ } from './TIMELINE_PPQ'
import type { TimelineSource } from './TimelineSource'
import type { PlaylistTimelineSegment } from './TimelineSegment'

/**
 * Places songs one after another in time (milestone 9.5 D): each part starts at `startSec`
 * (songStartTimes) on its deck. The joined tempo map takes each song's tempi from its start, so
 * every song's notes keep their exact times; during an overlap the ending song's notes are placed
 * by the next song's tempo, which only changes where they sit on the (beat-based) highway, never
 * when they sound. Bars restart at each song (BarMap.joined). From the middle of an overlap the
 * ending song starts nothing new (notes, pedal, cages); what already sounds rings out.
 */
export function buildTimeline(
  parts: readonly {
    readonly source: TimelineSource
    readonly startSec: number
    readonly deck: number
  }[],
): PlaylistTimeline {
  const ppq = TIMELINE_PPQ
  // Tempo: each song's events from its start, in seconds first; ticks follow once the map exists.
  const tempoBySec: { sec: number; micros: number }[] = []
  for (const { source, startSec } of parts) {
    const events =
      source.song.tempoEvents.length > 0
        ? source.song.tempoEvents
        : [{ tick: 0, microsPerQuarter: 500_000 }]
    for (const e of events) {
      const sec = startSec + source.tempoMap.tickToSeconds(e.tick)
      // A song's events never reach back before its start: the previous song's tempo ends there.
      tempoBySec.push({ sec: Math.max(startSec, sec), micros: e.microsPerQuarter })
    }
  }
  tempoBySec.sort((a, b) => a.sec - b.sec)
  const tempoEvents: TempoEvent[] = []
  let tick = 0
  let at = 0
  let micros = tempoBySec[0]?.micros ?? 500_000
  for (const e of tempoBySec) {
    tick += ((e.sec - at) * 1e6 * ppq) / micros
    at = e.sec
    micros = e.micros
    tempoEvents.push({ tick, microsPerQuarter: e.micros })
  }
  const tempoMap = new TempoMap(ppq, tempoEvents)
  const toTick = (source: TimelineSource, startSec: number, songTick: number) =>
    tempoMap.secondsToTick(startSec + source.tempoMap.tickToSeconds(songTick))

  const notes: (HandNote & { deck: number })[] = []
  const pedalIntervals: PedalInterval[] = []
  const handCages: Record<Hand, (HandCage & { deck: number })[]> = { right: [], left: [] }
  const segments: PlaylistTimelineSegment[] = []
  const meterParts: { startTick: number; events: TimeSignatureEvent[] }[] = []
  parts.forEach(({ source, startSec, deck }, i) => {
    const endSec = startSec + songEndSec(source.notes, source.tempoMap)
    const nextSec = parts[i + 1]?.startSec ?? Infinity
    const lastSec = nextSec < endSec ? (nextSec + endSec) / 2 : Infinity
    const starts = (songTick: number) =>
      startSec + source.tempoMap.tickToSeconds(songTick) <= lastSec
    for (const n of source.notes) {
      if (!starts(n.startTick)) continue
      notes.push({
        ...n,
        startTick: toTick(source, startSec, n.startTick),
        endTick: toTick(source, startSec, n.endTick),
        soundEndTick: toTick(source, startSec, n.soundEndTick),
        deck,
      })
    }
    for (const p of source.song.pedalIntervals) {
      if (!starts(p.startTick)) continue
      pedalIntervals.push({
        ...p,
        startTick: toTick(source, startSec, p.startTick),
        endTick: toTick(source, startSec, p.endTick),
      })
    }
    for (const hand of ['right', 'left'] as const) {
      for (const c of source.handCages?.[hand] ?? []) {
        if (!starts(c.startTick)) continue
        handCages[hand].push({
          ...c,
          startTick: toTick(source, startSec, c.startTick),
          endTick: toTick(source, startSec, c.endTick),
          deck,
        })
      }
    }
    const startTick = tempoMap.secondsToTick(startSec)
    segments.push({ deck, startSec, endSec, startTick, endTick: tempoMap.secondsToTick(endSec) })
    meterParts.push({
      startTick,
      events: source.song.timeSignatureEvents.map((e) => ({
        ...e,
        tick: toTick(source, startSec, e.tick),
      })),
    })
  })
  notes.sort((a, b) => a.startTick - b.startTick)
  const endTick = Math.max(0, ...segments.map((s) => s.endTick))
  return {
    ppq,
    notes,
    pedalIntervals,
    handCages,
    segments,
    song: { notes, tempoMap, barMap: BarMap.joined(ppq, endTick, meterParts), endTick },
  }
}
