import type { HandNote } from '@/core/hands/HandNote'

import { keyLayout } from './keyLayout'
import type { KeyRect } from './KeyRect'
import type { NoteInstance } from './NoteInstance'

/**
 * Render data for hand-assigned notes (unassigned channels are already gone after
 * assignHands). Notes outside the 88 keys have no lane and are dropped. White-lane notes come
 * first so black-lane notes, which overlap them, are drawn on top.
 */
export function noteInstances(notes: readonly HandNote[], ppq: number): NoteInstance[] {
  const keys = new Map<number, KeyRect>(keyLayout().map((k) => [k.midi, k]))
  const headTicks = ppq / 16
  const out: NoteInstance[] = []
  for (const note of notes) {
    const key = keys.get(note.midi)
    if (key === undefined) continue
    out.push({
      midi: note.midi,
      x: key.x,
      width: key.width,
      isBlack: key.isBlack,
      startTick: note.startTick,
      endTick: note.endTick,
      headEndTick: Math.min(note.endTick, note.startTick + headTicks),
      colorIndex: note.midi % 12,
      hand: note.hand,
    })
  }
  return out.sort(
    (a, b) => Number(a.isBlack) - Number(b.isBlack) || a.startTick - b.startTick || a.midi - b.midi,
  )
}
