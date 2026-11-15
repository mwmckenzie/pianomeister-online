import type { PedalInterval } from './PedalInterval'

const DOWN_THRESHOLD = 64

/**
 * Turns CC64 events into down intervals per channel: down at value ≥ 64, up below. Repeated
 * "down" while already down is ignored, and a pedal still down at the end closes at `endTick`.
 */
export function pedalIntervals(
  events: readonly { readonly tick: number; readonly channel: number; readonly value: number }[],
  endTick: number,
): PedalInterval[] {
  const downSince = new Map<number, number>()
  const out: PedalInterval[] = []
  for (const e of [...events].sort((a, b) => a.tick - b.tick)) {
    const down = e.value >= DOWN_THRESHOLD
    const since = downSince.get(e.channel)
    if (down && since === undefined) {
      downSince.set(e.channel, e.tick)
    } else if (!down && since !== undefined) {
      downSince.delete(e.channel)
      if (e.tick > since) out.push({ channel: e.channel, startTick: since, endTick: e.tick })
    }
  }
  for (const [channel, since] of downSince) {
    if (endTick > since) out.push({ channel, startTick: since, endTick })
  }
  return out.sort((a, b) => a.startTick - b.startTick || a.channel - b.channel)
}
