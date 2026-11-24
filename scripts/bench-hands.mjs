// npm run bench:hands -- <folder> [--algos=beam,chord] [--params={"beam":{"reach":13}}]
// Scores the split methods (HD brief criterion 12) on a local folder of MIDI files whose tracks
// are named right/left (or rechts/links). Never commit such files: the repo is public, and only
// synthetic or clearly licensed MIDI goes in it. Not part of `npm run check`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { runnerImport } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const option = (name) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
const folder = args.find((a) => !a.startsWith('--'))

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (folder === undefined || !existsSync(folder) || !statSync(folder).isDirectory()) {
  fail('Usage: npm run bench:hands -- <folder> [--algos=beam,chord] [--params=<JSON>]')
}

const load = async (path) =>
  (await runnerImport(path, { configFile: false, root, logLevel: 'error' })).module
const { benchmarkSplit } = await load('/src/core/hands/benchmarkSplit.ts')
const { SPLIT_ALGORITHMS } = await load('/src/core/hands/SPLIT_ALGORITHMS.ts')

const only = option('algos')?.split(',') ?? SPLIT_ALGORITHMS.map((a) => a.id)
const unknown = only.filter((id) => !SPLIT_ALGORITHMS.some((a) => a.id === id))
if (unknown.length > 0) fail(`Unknown method: ${unknown.join(', ')}`)
const algorithms = SPLIT_ALGORITHMS.filter((a) => only.includes(a.id))
let overrides = {}
try {
  overrides = JSON.parse(option('params') ?? '{}')
} catch (e) {
  fail(`--params isn't valid JSON: ${e.message}`)
}

const percent = (part, whole) => `${((part / whole) * 100).toFixed(1)} %`
const totals = new Map(
  algorithms.map((a) => [a.id, { correct: 0, notes: 0, run: 0, sec: 0, ms: 0 }]),
)
let files = 0
for (const name of readdirSync(folder).sort()) {
  if (!/\.midi?$/i.test(name)) continue
  let result
  try {
    const bytes = new Uint8Array(readFileSync(join(folder, name)))
    result = benchmarkSplit(bytes, algorithms, overrides, () => performance.now())
  } catch (e) {
    console.log(`${name}: can't be read (${e.message})`)
    continue
  }
  if (result === null) {
    console.log(`${name}: skipped, no tracks named right and left`)
    continue
  }
  files++
  const open = result.unreleased > 0 ? `, ${result.unreleased} never released` : ''
  console.log(`${name}: ${result.notes} notes${open}`)
  for (const s of result.scores) {
    const t = totals.get(s.algorithm)
    t.correct += s.correct
    t.notes += result.notes
    t.run = Math.max(t.run, s.wrongRun)
    t.sec = Math.max(t.sec, s.wrongSeconds)
    t.ms += s.ms
    console.log(
      `  ${s.algorithm.padEnd(7)} ${percent(s.correct, result.notes).padStart(7)}` +
        `  longest wrong run ${s.wrongRun} notes / ${s.wrongSeconds.toFixed(1)} s` +
        `  ${s.ms.toFixed(0)} ms`,
    )
  }
}
if (files === 0) fail('No usable MIDI files in that folder.')
console.log(`\nTotal, ${files} ${files === 1 ? 'file' : 'files'}`)
for (const [id, t] of totals) {
  console.log(
    `  ${id.padEnd(7)} ${percent(t.correct, t.notes).padStart(7)}` +
      `  longest wrong run ${t.run} notes / ${t.sec.toFixed(1)} s  ${t.ms.toFixed(0)} ms`,
  )
}
