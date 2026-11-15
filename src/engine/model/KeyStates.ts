import { keyLayout } from './keyLayout'
import type { KeyState } from './KeyState'

interface Span {
  readonly startTick: number
  readonly endTick: number
}

type NoteSpan = Span & { readonly midi: number }

/**
 * Per-key colour overlay over time. Built once per song; at() runs every frame, so it reuses
 * its output objects and binary-searches each key's notes.
 */
export class KeyStates {
  private readonly spansByKey: readonly (readonly Span[])[]
  private readonly states: KeyState[]

  constructor(notes: readonly NoteSpan[]) {
    const keys = keyLayout()
    const byMidi = new Map<number, Span[]>(keys.map((k) => [k.midi, []]))
    for (const n of notes) byMidi.get(n.midi)?.push({ startTick: n.startTick, endTick: n.endTick })
    this.spansByKey = keys.map((k) =>
      (byMidi.get(k.midi) ?? []).sort((a, b) => a.startTick - b.startTick),
    )
    this.states = keys.map((k) => ({
      midi: k.midi,
      colorIndex: k.midi % 12,
      alpha: 0,
      sounding: false,
    }))
  }

  /**
   * States for all 88 keys at `tick`, in key order. A sounding note (start ≤ tick < end) shows
   * at full strength; otherwise the next onset within `fadeTicks` fades in from 0 up to
   * `maxAlpha`. A sounding note always wins over the next one fading in.
   */
  at(tick: number, fadeTicks: number, maxAlpha: number): readonly KeyState[] {
    for (let i = 0; i < this.states.length; i++) {
      const state = this.states[i] as KeyState
      const spans = this.spansByKey[i] as readonly Span[]
      state.alpha = 0
      state.sounding = false
      if (spans.length === 0) continue
      // First span starting after `tick`.
      let lo = 0
      let hi = spans.length
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if ((spans[mid] as Span).startTick <= tick) lo = mid + 1
        else hi = mid
      }
      // Overlapping same-pitch notes are rare; checking the two latest starts covers them.
      for (let j = lo - 1; j >= Math.max(0, lo - 2); j--) {
        if (tick < (spans[j] as Span).endTick) state.sounding = true
      }
      if (state.sounding) {
        state.alpha = 1
        continue
      }
      const next = spans[lo]
      if (next !== undefined && fadeTicks > 0) {
        const until = next.startTick - tick
        if (until <= fadeTicks) state.alpha = maxAlpha * (1 - until / fadeTicks)
      }
    }
    return this.states
  }
}
