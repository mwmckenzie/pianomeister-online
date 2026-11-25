import type { BenchRun } from './BenchResult'
import { groupCells, isNoisy } from './groupCells'

const ms = (x: number | null) => (x === null ? 'n/a' : x.toFixed(1))

/** A run as short plain text (Copy summary, the command line), worst cells first. */
export function summaryText(run: BenchRun): string {
  const { device, app } = run
  const lines = [
    `${run.label} · ${run.suite} · ${run.at}`,
    `${app.version} ${app.commit}${app.dev ? ' (dev build)' : ''}`,
    `${device.gpu ?? 'GPU hidden'} (${device.gpuClass}) · ${device.viewport.join('×')} @ ${device.pixelRatio} · screen ${(1000 / device.refreshMs).toFixed(0)} Hz`,
    ...(run.notes === '' ? [] : [run.notes]),
    ...(run.flags.length === 0 ? [] : [`Flags: ${run.flags.join(', ')}`]),
    '',
    'p95 ms | median | dropped | fps | engine | HUD | GPU | calls | cell',
  ]
  for (const g of [...groupCells(run.cells)].sort((a, b) => b.p95 - a.p95)) {
    lines.push(
      [
        ms(g.p95),
        ms(g.median),
        `${(g.dropped * 100).toFixed(1)} %`,
        g.fps.toFixed(0),
        g.cpu.toFixed(2),
        g.hud.toFixed(2),
        ms(g.gpuMs),
        g.drawCalls.toFixed(0),
        g.key + (isNoisy(g) ? ' (noisy)' : ''),
      ].join(' | '),
    )
  }
  return lines.join('\n')
}
