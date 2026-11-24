import { META_TEMPO, ticksPerBeat, type MidiFile } from '../midi/MidiFile'
import { TempoMap } from '../timing/TempoMap'
import type { SplitContext } from './SplitAlgorithm'

/** The split methods' view of a file's timing (120 bpm without tempo events). */
export function fileSplitContext(file: MidiFile): SplitContext {
  const tempoEvents = file.tracks.flatMap((t) =>
    t.events.flatMap((e) => {
      if (e.kind !== 'meta' || e.metaType !== META_TEMPO || e.data.length < 3) return []
      const [a = 0, b = 0, c = 0] = e.data
      return [{ tick: e.tick, microsPerQuarter: (a << 16) | (b << 8) | c }]
    }),
  )
  const beat = ticksPerBeat(file)
  const map = new TempoMap(beat, tempoEvents)
  return { ticksPerBeat: beat, seconds: (tick) => map.tickToSeconds(tick) }
}
