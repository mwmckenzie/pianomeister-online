// npm run bench:render -- [options]: the benchmark in a browser of its own, on a production build.
//   --suite=smoke|standard|full   (smoke)        --label=<name>   --notes=<text>
//   --quality=off|low|medium|high (smoke's preset; off)
//   --gpu            headed Chrome with the real GPU (else headless: software WebGL)
//   --no-gpu         headed Chrome with --disable-gpu
//   --throttle=4     CPU throttle of the page's main thread (not of the GPU process)
//   --cores=2        this many processor cores for the browser
//   --size=1600x900  window
//   --compare=<file> prints the difference   --out=<file>
//   --idle           main-thread and process time: playing, paused, Home
//   --trace          a 10 s Chrome trace of Canon playing (unminified build), summed up
// Results are written to test-results/bench/. They compare commits on one machine.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { runnerImport } from 'vite'

import { benchServer } from './benchServer.mjs'
import { traceSummary } from './traceSummary.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const option = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const flag = (name) => args.includes(`--${name}`)
const load = async (path) =>
  (await runnerImport(path, { configFile: false, root, logLevel: 'error' })).module

const suite = option('suite', 'smoke')
const throttle = Number(option('throttle', '1'))
const cores = Number(option('cores', '0'))
const [width, height] = option('size', '1600x900').split('x').map(Number)
const headed = flag('gpu') || flag('no-gpu')
const label = option('label', headed ? 'local' : 'headless')
const out = `${root}test-results/bench`
mkdirSync(out, { recursive: true })

const mask = 2 ** cores - 1
const powershell = (command) =>
  execFileSync('powershell', ['-NoProfile', '-Command', command], { encoding: 'utf8' }).trim()

/** Limits a process to `cores` cores, or reads its limit. The browser inherits this process's. */
function affinity(pid, set) {
  if (process.platform === 'win32') {
    const of = `(Get-Process -Id ${pid})`
    return Number(
      powershell(
        `${set ? `${of}.ProcessorAffinity = ${mask}; ` : ''}[int64]${of}.ProcessorAffinity`,
      ),
    )
  }
  if (set) execFileSync('taskset', ['-a', '-p', mask.toString(16), String(pid)])
  const out = execFileSync('taskset', ['-p', String(pid)], { encoding: 'utf8' })
  return Number.parseInt(out.split(':').pop(), 16)
}

/** Every process of the browser, checked: Chrome's GPU process lifts the limit for itself. */
async function limitBrowser(set) {
  const cdp = await browser.newBrowserCDPSession()
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo')
  await cdp.detach()
  for (const p of processInfo) {
    if (affinity(p.id, set) !== mask) throw new Error(`${p.type} isn't limited to ${cores} cores`)
  }
}

const server = await benchServer({ named: flag('trace') })
if (cores > 0) affinity(process.pid, true)
const browser = await chromium.launch({
  headless: !headed,
  ...(headed ? { channel: 'chrome' } : {}),
  args: [
    '--autoplay-policy=no-user-gesture-required',
    ...(flag('no-gpu') ? ['--disable-gpu'] : []),
  ],
})
let failed = false
try {
  const context = await browser.newContext({ viewport: { width, height } })
  // As the first visit, without Home opening over it.
  await context.addInitScript(() => {
    if (location.protocol === 'about:') return
    if (localStorage.getItem('pianomeister.settings') !== null) return
    const settings = { appearance: { homeOnNewSession: false, hideControls: false } }
    localStorage.setItem('pianomeister.settings', JSON.stringify({ version: 6, settings }))
  })
  // Software WebGL can take seconds a frame.
  context.setDefaultTimeout(180_000)
  const page = await context.newPage()
  page.on('pageerror', (e) => console.error('page error:', e.message))
  const cdp = await context.newCDPSession(page)
  if (cores > 0) {
    await page.goto(server.url)
    await page.getByTestId('stage').waitFor()
    await limitBrowser(true)
  }
  const slow = () => cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
  if (flag('idle')) await idle(page, cdp, slow)
  else if (flag('trace')) await trace(page, slow)
  else await bench(page, slow)
  if (cores > 0) await limitBrowser(false)
} catch (e) {
  console.error(e)
  failed = true
} finally {
  await browser.close()
  await server.close()
}
process.exit(failed ? 1 : 0)

async function bench(page, slow) {
  const query = new URLSearchParams({ auto: '1', suite, label, quality: option('quality', 'off') })
  if (throttle > 1) await slow()
  await page.goto(`${server.url}#/bench?${query}`)
  const result = await page.waitForFunction(
    () => {
      const b = window.pianomeisterBench
      if (b?.error) return { error: b.error }
      return b?.state === 'done' ? { run: b.run } : null
    },
    null,
    { timeout: 60 * 60_000, polling: 1000 },
  )
  const { run, error } = await result.jsonValue()
  if (error) throw new Error(error)
  const limits = [
    throttle > 1 && `CPU ${throttle}×`,
    cores > 0 && `${cores} cores`,
    flag('no-gpu') && '--disable-gpu',
    !headed && 'headless',
  ]
  run.notes = [option('notes', ''), ...limits].filter(Boolean).join(' · ')
  const file = option('out', `${out}/bench-${label}.json`)
  writeFileSync(file, JSON.stringify(run))
  const { summaryText } = await load('/src/core/bench/summaryText.ts')
  console.log(summaryText(run))
  console.log(`\n${file}`)
  const other = option('compare', null)
  if (other !== null) {
    const { compareRuns } = await load('/src/core/bench/compareRuns.ts')
    const { readBenchRun } = await load('/src/core/bench/readBenchRun.ts')
    const before = readBenchRun(JSON.parse(readFileSync(other, 'utf8')))
    if (typeof before === 'string') throw new Error(`${other}: ${before}`)
    const { warnings, shared, changes } = compareRuns(before, run)
    console.log(`\nAgainst ${other}: ${shared} cells in common, ${changes.length} changes`)
    for (const w of warnings) console.log(`! ${w}`)
    for (const c of changes) {
      console.log(
        `${c.key} ${c.metric}: ${c.before.toFixed(1)} → ${c.after.toFixed(1)} (${(c.change * 100).toFixed(0)} %)`,
      )
    }
  }
}

/** Canon, opened and (its samples loaded) ready to play. */
async function openCanon(page) {
  await page.goto(`${server.url}#/library`)
  await page.getByTestId('song-row').filter({ hasText: 'Canon in D' }).click()
  await page.getByTestId('details-play').click()
  await page.getByTestId('hud-title').filter({ hasText: 'Canon in D' }).waitFor()
  await page
    .getByTestId('sample-status')
    .filter({ hasText: 'loaded' })
    .waitFor({ state: 'attached', timeout: 120_000 })
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function state(page, wanted) {
  await page
    .getByTestId('transport-state')
    .filter({ hasText: wanted })
    .waitFor({ state: 'attached', timeout: 60_000 })
}

/** Core-seconds each of the browser's processes has used, by kind. */
async function processTimes() {
  const cdp = await browser.newBrowserCDPSession()
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo')
  const by = {}
  for (const p of processInfo) by[p.type] = (by[p.type] ?? 0) + p.cpuTime
  await cdp.detach()
  return by
}

async function idle(page, cdp, slow) {
  await openCanon(page)
  if (throttle > 1) await slow()
  await cdp.send('Performance.enable')
  const task = async () =>
    (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'TaskDuration').value
  const measure = async (name) => {
    await pause(3000)
    const [t0, p0, at0] = [await task(), await processTimes(), Date.now()]
    await pause(15_000)
    const [t1, p1, at1] = [await task(), await processTimes(), Date.now()]
    const sec = (at1 - at0) / 1000
    const row = { state: name, mainThreadMsPerSec: Math.round(((t1 - t0) * 1000) / sec) }
    for (const type of Object.keys(p1)) {
      row[`${type} core %`] = Number((((p1[type] - (p0[type] ?? 0)) / sec) * 100).toFixed(1))
    }
    return row
  }
  const rows = []
  await page.getByTestId('play-pause').click()
  await state(page, 'playing')
  rows.push(await measure('playing'))
  await page.getByTestId('play-pause').click()
  await state(page, 'paused')
  rows.push(await measure('paused'))
  await page.getByTestId('menu-home').click()
  await page.getByTestId('welcome').waitFor()
  rows.push(await measure('home (frozen)'))
  await page.goto('about:blank')
  rows.push(await measure('blank page'))
  console.table(rows)
  writeFileSync(`${out}/idle-${label}.json`, JSON.stringify(rows, null, 2))
}

async function trace(page, slow) {
  await openCanon(page)
  await page.getByTestId('play-pause').click()
  await state(page, 'playing')
  await pause(3000)
  if (throttle > 1) await slow()
  const file = `${out}/trace-${label}.json`
  await browser.startTracing(page, {
    path: file,
    categories: [
      '-*',
      'devtools.timeline',
      'v8.execute',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-v8.cpu_profiler',
      'toplevel',
      'blink.user_timing',
    ],
  })
  await pause(10_000)
  await browser.stopTracing()
  console.log(traceSummary(JSON.parse(readFileSync(file, 'utf8'))))
  console.log(`\n${file}`)
}
