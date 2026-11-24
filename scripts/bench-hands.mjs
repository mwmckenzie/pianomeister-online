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

const percent = (part, whole) => (whole === 0 ? 'n/a' : `${((part / whole) * 100).toFixed(1)} %`)
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
// With two hands every wrong note was given the other hand's, so what tells a swap from a
// passage one hand took over is whether both hands' notes are in the run.
const place = (r) =>
  `${r.notes} notes / ${r.seconds.toFixed(1)} s, bar ${r.startBar} (${clock(r.startSeconds)}), ` +
  `${r.rightGivenLeft > 0 && r.leftGivenRight > 0 ? 'both ways' : 'one way'} ` +
  `(R to L ${r.rightGivenLeft}, L to R ${r.leftGivenRight})`
/** Only methods that mark notes get this line. */
const stripes = (s, notes) =>
  s.uncertain === 0
    ? null
    : `          uncertain: ${percent(s.uncertainWrong, notes - s.correct)} of wrong notes marked, ` +
      `${percent(s.uncertainWrong, s.uncertain)} of marked notes wrong ` +
      `(${s.uncertain} marked, ${notes - s.correct} wrong, ${s.uncertainWrong} both)`
const totals = new Map(
  algorithms.map((a) => [
    a.id,
    { correct: 0, notes: 0, run: 0, sec: 0, uncertain: 0, uncertainWrong: 0, ms: 0 },
  ]),
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
    t.run = Math.max(t.run, s.longestRun?.notes ?? 0)
    t.sec = Math.max(t.sec, s.longestTime?.seconds ?? 0)
    t.uncertain += s.uncertain
    t.uncertainWrong += s.uncertainWrong
    t.ms += s.ms
    console.log(
      `  ${s.algorithm.padEnd(7)} ${percent(s.correct, result.notes).padStart(7)}` +
        `  longest wrong run ${s.longestRun === null ? 'none' : place(s.longestRun)}` +
        `  ${s.ms.toFixed(0)} ms`,
    )
    if (s.longestTime !== null && s.longestTime.seconds > s.longestRun.seconds) {
      console.log(`          longest in time: ${place(s.longestTime)}`)
    }
    const marked = stripes(s, result.notes)
    if (marked !== null) console.log(marked)
  }
}
if (files === 0) fail('No usable MIDI files in that folder.')
console.log(`\nTotal, ${files} ${files === 1 ? 'file' : 'files'}`)
for (const [id, t] of totals) {
  console.log(
    `  ${id.padEnd(7)} ${percent(t.correct, t.notes).padStart(7)}` +
      `  longest wrong run ${t.run} notes / ${t.sec.toFixed(1)} s  ${t.ms.toFixed(0)} ms`,
  )
  const marked = stripes(t, t.notes)
  if (marked !== null) console.log(marked)
}
