import type { BarMap } from './BarMap'
import type { MeterChange } from './MeterChange'
import type { MeterSummary } from './MeterSummary'

/**
 * The meter that covers the most bars (the earlier one on a tie), and every place the meter
 * changes, from bar 1 to the last bar. Bar 0 (a pickup) uses bar 1's grid, so it's not a change.
 */
export function summariseMeter(barMap: BarMap): MeterSummary {
  const runs: MeterChange[] = []
  const bars = new Map<string, number>()
  for (let bar = 1; bar <= barMap.barCount; bar++) {
    const { numerator, denominator } = barMap.timeSignature(bar)
    const meter = `${numerator}/${denominator}`
    if (runs[runs.length - 1]?.meter !== meter) runs.push({ bar, meter })
    bars.set(meter, (bars.get(meter) ?? 0) + 1)
  }
  let main = runs[0]?.meter ?? '4/4'
  for (const [meter, count] of bars) if (count > (bars.get(main) ?? 0)) main = meter
  return { main, changes: Math.max(0, runs.length - 1), runs }
}
