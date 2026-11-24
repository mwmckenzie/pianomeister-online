import { META_TRACK_NAME, type MidiFile } from '../midi/MidiFile'
import type { RawNote } from './RawNote'
import { voiceId } from './voiceId'
import type { VoiceStats } from './VoiceStats'

/** Semitones beyond which notes sounding together are unlikely to be one hand. */
export const ONE_HAND_REACH = 15

/** One VoiceStats per (track, channel), by track, then channel (HD brief §4.2). */
export function computeVoiceStats(file: MidiFile, notes: readonly RawNote[]): VoiceStats[] {
  const voices = new Map<string, RawNote[]>()
  for (const n of notes) {
    const list = voices.get(voiceId(n))
    if (list === undefined) voices.set(voiceId(n), [n])
    else list.push(n)
  }
  const out: VoiceStats[] = []
  for (const [id, list] of voices) {
    const { track, channel } = list[0] as RawNote
    const pitches = list.map((n) => n.midi).sort((a, b) => a - b)
    const onsets = soundingAtOnsets(list)
    const p10 = percentile(pitches, 0.1)
    const p90 = percentile(pitches, 0.9)
    const wide = onsets.filter((s) => Math.max(...s) - Math.min(...s) > ONE_HAND_REACH).length
    out.push({
      id,
      track,
      channel,
      trackName: trackName(file, track),
      program: firstProgram(file, track, channel),
      noteCount: list.length,
      minPitch: pitches[0] ?? 0,
      maxPitch: pitches[pitches.length - 1] ?? 0,
      meanPitch: pitches.reduce((a, b) => a + b, 0) / pitches.length,
      medianPitch: percentile(pitches, 0.5),
      p10,
      p90,
      avgPolyphony: onsets.reduce((sum, s) => sum + s.length, 0) / onsets.length,
      maxPolyphony: Math.max(...onsets.map((s) => s.length)),
      wideSpanRatio: wide / onsets.length,
      histogramGap: histogramGap(pitches, p10, p90),
    })
  }
  return out.sort((a, b) => a.track - b.track || a.channel - b.channel)
}

/** Nearest rank. */
function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.round((sorted.length - 1) * p)] ?? 0
}

/** The pitches sounding at each distinct onset: notes still held plus those starting there. */
function soundingAtOnsets(notes: readonly RawNote[]): number[][] {
  const out: number[][] = []
  let active: RawNote[] = []
  let i = 0
  while (i < notes.length) {
    const tick = (notes[i] as RawNote).startTick
    active = active.filter((n) => n.endTick > tick)
    while (notes[i]?.startTick === tick) active.push(notes[i++] as RawNote)
    out.push(active.map((n) => n.midi))
  }
  return out
}

function histogramGap(pitches: readonly number[], p10: number, p90: number): number {
  const used = new Set(pitches)
  let gap = 0
  let run = 0
  for (let p = p10; p <= p90; p++) {
    run = used.has(p) ? 0 : run + 1
    gap = Math.max(gap, run)
  }
  return gap
}

/** The channel's first program change in the same track, else in any track. */
function firstProgram(file: MidiFile, track: number, channel: number): number | undefined {
  for (const t of [file.tracks[track], ...file.tracks]) {
    for (const e of t?.events ?? []) {
      if (e.kind === 'programChange' && e.channel === channel) return e.program
    }
  }
  return undefined
}

const utf8 = new TextDecoder('utf-8', { fatal: true })

function trackName(file: MidiFile, track: number): string {
  for (const e of file.tracks[track]?.events ?? []) {
    if (e.kind !== 'meta' || e.metaType !== META_TRACK_NAME) continue
    // MIDI text has no declared encoding: UTF-8 when it decodes as such, else Latin-1.
    try {
      return utf8.decode(e.data)
    } catch {
      return String.fromCharCode(...e.data)
    }
  }
  return ''
}
