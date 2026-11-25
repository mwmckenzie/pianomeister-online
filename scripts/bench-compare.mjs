// node scripts/bench-compare.mjs a.json b.json …: benchmark files side by side, p95 frame time in
// ms (dropped frames in %). --metric=cpu|gpuMs|median|fps|drawCalls for another number;
// --strip=<folder> also writes each file there without its raw frames (docs/perf).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const load = async (path) =>
  (await runnerImport(path, { configFile: false, root, logLevel: 'error' })).module
const { readBenchRun } = await load('/src/core/bench/readBenchRun.ts')
const { groupCells } = await load('/src/core/bench/groupCells.ts')

const args = process.argv.slice(2)
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const metric = option('metric')
const strip = option('strip')
const runs = args
  .filter((a) => !a.startsWith('--'))
  .map((file) => {
    const run = readBenchRun(JSON.parse(readFileSync(file, 'utf8')))
    if (typeof run === 'string') throw new Error(`${file}: ${run}`)
    return run
  })
const groups = runs.map((run) => new Map(groupCells(run.cells).map((g) => [g.key, g])))
const keys = [...new Set(groups.flatMap((g) => [...g.keys()]))]
for (const run of runs) {
  const { device } = run
  console.log(
    `${run.label}: ${device.gpu} (${device.gpuClass}) · ${device.viewport.join('×')} @ ${device.pixelRatio} · ${(1000 / device.refreshMs).toFixed(0)} Hz · ${run.app.commit} · ${run.notes} · ${run.flags.join(', ')}`,
  )
}
console.log('')
console.log(['cell', ...runs.map((r) => r.label)].join('\t'))
for (const key of keys) {
  const cells = groups.map((g) => {
    const c = g.get(key)
    if (c === undefined) return '-'
    if (metric !== undefined) return c[metric] === null ? 'n/a' : Number(c[metric]).toFixed(2)
    return `${c.p95.toFixed(1)} (${(c.dropped * 100).toFixed(0)} %)`
  })
  console.log([key, ...cells].join('\t'))
}
if (strip !== undefined) {
  for (const run of runs) {
    const cells = run.cells.map((cell) => ({ ...cell, intervals: undefined }))
    writeFileSync(
      `${strip}/baseline-${run.label}.json`,
      `${JSON.stringify({ ...run, cells }, null, 1)}\n`,
    )
  }
}
