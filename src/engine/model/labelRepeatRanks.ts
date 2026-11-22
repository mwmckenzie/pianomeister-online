/** A note starting a run of repeated notes. */
export const RUN_START = 2
/** Within a run, the first note in a new bar. */
export const BAR_START = 1

/**
 * How each note ranks for "Label repeated notes" (brief decision 114), decided from the music
 * once per song so a label never comes or goes on screen. A run is consecutive notes of one
 * pitch (one lane, so nothing else sits between them) with no gap over `maxGapTicks` (a beat).
 * RUN_START: the first of a run (labelled by every choice); BAR_START: the first of the run in
 * a later bar (labelled by "Once per bar" and "All"); 0: the rest (only "All"). One rank per
 * note, in the input's order.
 */
export function labelRepeatRanks(
  notes: readonly { readonly midi: number; readonly startTick: number; readonly endTick: number }[],
  maxGapTicks: number,
  barOf: (tick: number) => number,
): Uint8Array {
  const ranks = new Uint8Array(notes.length)
  const order = Array.from(notes.keys()).sort((a, b) => {
    const na = notes[a]
    const nb = notes[b]
    if (na === undefined || nb === undefined) return 0
    return na.midi - nb.midi || na.startTick - nb.startTick
  })
  let previous: { readonly midi: number; readonly endTick: number } | undefined
  let lastBar = Number.NaN
  for (const i of order) {
    const note = notes[i]
    if (note === undefined) continue
    const continues =
      previous !== undefined &&
      previous.midi === note.midi &&
      note.startTick - previous.endTick <= maxGapTicks
    const bar = barOf(note.startTick)
    ranks[i] = !continues ? RUN_START : bar !== lastBar ? BAR_START : 0
    lastBar = bar
    // Overlapping repeats (a held note restruck): the run's reach is the later end.
    previous =
      continues && previous !== undefined && previous.endTick > note.endTick ? previous : note
  }
  return ranks
}
