/**
 * Which notes start a run of repeated notes (brief decision 114), decided from the music once
 * per song so a label never comes or goes on screen. A run is consecutive notes of one pitch
 * (one lane, so nothing else sits between them) with no gap over `maxGapTicks` (a beat); with
 * "Label repeated notes: First of a run" only its first note is labelled. One flag per note, in
 * the input's order.
 */
export function labelRunStarts(
  notes: readonly { readonly midi: number; readonly startTick: number; readonly endTick: number }[],
  maxGapTicks: number,
): Uint8Array {
  const starts = new Uint8Array(notes.length)
  const order = Array.from(notes.keys()).sort((a, b) => {
    const na = notes[a]
    const nb = notes[b]
    if (na === undefined || nb === undefined) return 0
    return na.midi - nb.midi || na.startTick - nb.startTick
  })
  let previous: { readonly midi: number; readonly endTick: number } | undefined
  for (const i of order) {
    const note = notes[i]
    if (note === undefined) continue
    const continues =
      previous !== undefined &&
      previous.midi === note.midi &&
      note.startTick - previous.endTick <= maxGapTicks
    starts[i] = continues ? 0 : 1
    // Overlapping repeats (a held note restruck): the run's reach is the later end.
    previous =
      continues && previous !== undefined && previous.endTick > note.endTick ? previous : note
  }
  return starts
}
