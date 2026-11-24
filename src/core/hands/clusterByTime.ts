import type { RawNote } from './RawNote'

/** Notes played as one chord. */
export interface NoteCluster {
  /** Lowest first. */
  readonly notes: readonly RawNote[]
  /** Seconds at the first note's start. */
  readonly time: number
}

/** Groups notes starting within `chordSecs` of a chord's first note (HD brief §6.1). */
export function clusterByTime(
  notes: readonly RawNote[],
  chordSecs: number,
  seconds: (tick: number) => number,
): NoteCluster[] {
  const sorted = [...notes].sort((a, b) => a.startTick - b.startTick || a.midi - b.midi)
  const out: { notes: RawNote[]; time: number }[] = []
  for (const note of sorted) {
    const at = seconds(note.startTick)
    const last = out[out.length - 1]
    if (last !== undefined && at - last.time <= chordSecs) last.notes.push(note)
    else out.push({ notes: [note], time: at })
  }
  for (const cluster of out) cluster.notes.sort((a, b) => a.midi - b.midi)
  return out
}
