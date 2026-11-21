/** Lane centres closer than this (white-key widths) are neighbours: white–white, white–black, black–black. */
const NEIGHBOUR = 1.05

/**
 * Fixed stack slots for note labels (brief decision 114), decided from the music once per song
 * so a label never moves while it's on screen. Notes starting at the same tick in neighbouring
 * lanes would put their labels side by side: in pitch order, each takes the lowest slot no
 * neighbour already holds, so the later one is lifted by a label height. `centre` is the lane
 * centre in white-key widths; the result is one slot per note, in the input's order.
 */
export function labelStackSlots(
  notes: readonly { readonly startTick: number; readonly centre: number }[],
): Uint8Array {
  const slots = new Uint8Array(notes.length)
  const order = Array.from(notes.keys()).sort((a, b) => {
    const na = notes[a]
    const nb = notes[b]
    if (na === undefined || nb === undefined) return 0
    return na.startTick - nb.startTick || na.centre - nb.centre
  })
  let groupStart = 0
  for (let k = 0; k < order.length; k++) {
    const i = order[k] as number
    const note = notes[i]
    if (note === undefined) continue
    if (notes[order[groupStart] as number]?.startTick !== note.startTick) groupStart = k
    let slot = 0
    for (;;) {
      let taken = false
      for (let j = groupStart; j < k; j++) {
        const other = order[j] as number
        const o = notes[other]
        if (o !== undefined && slots[other] === slot && Math.abs(o.centre - note.centre) < NEIGHBOUR) {
          taken = true
          break
        }
      }
      if (!taken) break
      slot++
    }
    slots[i] = slot
  }
  return slots
}
