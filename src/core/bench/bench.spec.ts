import { describe, expect, it } from 'vitest'

import { SETTING_KEYS } from '../settings/SETTING_KEYS'
import { BENCH_SCHEMA, BENCH_VERSION, type BenchRun, type CellResult } from './BenchResult'
import { buildSuite, suiteSec } from './buildSuite'
import { classifyGpu } from './classifyGpu'
import { compareRuns } from './compareRuns'
import { densestSecond } from './densestSecond'
import { groupCells, isNoisy } from './groupCells'
import { mulberry32 } from './mulberry32'
import { readBenchRun } from './readBenchRun'
import { costStats, frameBudget, frameStats, percentile } from './stats'
import { summaryText } from './summaryText'

const result = (p95: number, over: Partial<CellResult> = {}, round = 1): CellResult => ({
  cell: {
    look: 'builtin:study',
    quality: 'medium',
    segment: 'dense',
    probe: null,
    overrides: {},
    round,
  },
  seconds: 5,
  frames: { ...frameStats([16.7], 16.7), p95 },
  warmUpLongest: 20,
  cpu: { median: 1, p95: 2 },
  hud: { median: 0.2, p95: 0.4 },
  gpuMs: null,
  longTasks: null,
  motionErrorP95: null,
  audio: {
    marginMin: 0.1,
    marginP5: 0.1,
    handed: 10,
    late: 0,
    expected: 10,
    missing: 0,
    driftMs: 0,
    outputLatencyMs: null,
  },
  renderer: {
    drawCalls: 50,
    triangles: 1,
    points: 0,
    programs: 1,
    geometries: 1,
    textures: 1,
    width: 1,
    height: 1,
    targetBytes: 0,
  },
  heapStart: null,
  heapEnd: null,
  ...over,
})

const run = (cells: readonly CellResult[], over: Partial<BenchRun> = {}): BenchRun => ({
  schema: BENCH_SCHEMA,
  version: BENCH_VERSION,
  id: 'r',
  at: '2026-11-25T10:00:00.000Z',
  suite: 'smoke',
  label: 'strong',
  notes: '',
  app: { version: '0', commit: 'abc', dev: false },
  device: {
    gpu: 'X',
    gpuClass: 'unknown',
    gpuRule: '',
    webgl2: true,
    gpuTimer: false,
    floatTargets: true,
    maxTextureSize: 1,
    cores: 4,
    memoryGb: null,
    screen: [1, 1],
    viewport: [1, 1],
    pixelRatio: 1,
    refreshMs: 16.7,
    reducedMotion: false,
    userAgent: '',
  },
  startUp: { firstPaint: null, songOpened: null, samplesLoaded: null },
  flags: [],
  cells,
  ...over,
})

describe('frame statistics', () => {
  it('takes nearest-rank percentiles', () => {
    const values = Array.from({ length: 100 }, (_, i) => 100 - i)
    expect([50, 95, 99, 100].map((p) => percentile(values, p))).toEqual([50, 95, 99, 100])
    expect(percentile([], 95)).toBe(0)
    expect(percentile([7], 1)).toBe(7)
  })

  it('judges a fast screen at 60 Hz and a slow one at its own rate', () => {
    expect(frameBudget(8.3)).toBeCloseTo(16.67, 2)
    expect(frameBudget(33.3)).toBe(33.3)
    const intervals = [8, 8, 24, 26, 40]
    expect(frameStats(intervals, 8.3)).toMatchObject({
      frames: 5,
      longest: 40,
      over18: 0.6,
      over35: 0.2,
      dropped: 0.4,
    })
    expect(frameStats(intervals, 33.3).dropped).toBe(0)
    expect(frameStats([], 16).fps).toBe(0)
    expect(costStats([1, 2, 3]).median).toBe(2)
  })
})

describe('GPU classes', () => {
  it.each([
    [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
      'software',
    ],
    ['ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11)', 'software'],
    ['llvmpipe (LLVM 15.0.7, 256 bits)', 'software'],
    [
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'strong',
    ],
    ['ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A0) Direct3D11, D3D11)', 'mainstream'],
    ['ANGLE (Intel, Intel(R) HD Graphics 520 Direct3D11 vs_5_0 ps_5_0)', 'weak'],
    ['ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11)', 'weak'],
    ['ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11)', 'mainstream'],
    ['ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11)', 'strong'],
    ['ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11)', 'mainstream'],
    ['ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11)', 'strong'],
    ['Adreno (TM) 650', 'mainstream'],
    ['Adreno (TM) 506', 'weak'],
    ['Mali-G52', 'weak'],
    ['Mali-G710', 'mainstream'],
    ['ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', 'mainstream'],
    ['Apple GPU', 'unknown'],
    ['Something New 9000', 'unknown'],
    [null, 'unknown'],
  ] as const)('%s is %s', (renderer, expected) => {
    expect(classifyGpu(renderer).gpuClass).toBe(expected)
  })
})

describe('suites', () => {
  it('only overrides settings that exist', () => {
    const keys = new Set<string>(SETTING_KEYS)
    for (const cell of buildSuite('full', 'medium')) {
      for (const key of Object.keys(cell.overrides)) expect(keys).toContain(key)
    }
  })

  it('covers every look, in the time the page promises', () => {
    const full = buildSuite('full', 'medium')
    expect(new Set(full.map((c) => c.look)).size).toBe(14)
    expect(suiteSec(buildSuite('smoke', 'low'))).toBeLessThan(40)
    expect(suiteSec(buildSuite('standard', 'low')) / 60).toBeLessThan(13)
    expect(suiteSec(full) / 60).toBeLessThan(28)
    expect(buildSuite('smoke', 'low').every((c) => c.quality === 'low')).toBe(true)
  })
})

describe('reading and comparing', () => {
  it('reads its own file back and refuses others', () => {
    const file: unknown = JSON.parse(JSON.stringify(run([result(17)])))
    expect(readBenchRun(file)).toMatchObject({ label: 'strong' })
    expect(readBenchRun({ schema: 'x' })).toMatch(/Not a/)
    expect(readBenchRun({ ...run([]), version: 2 })).toMatch(/version 2/)
    expect(readBenchRun({ ...run([]), cells: [{}] })).toMatch(/damaged/)
    expect(readBenchRun({ ...run([]), device: {} })).toMatch(/damaged/)
    expect(readBenchRun(null)).toMatch(/Not a/)
  })

  it('averages rounds and marks noisy cells', () => {
    const [group] = groupCells([result(10), result(20, {}, 2)])
    expect(group).toMatchObject({ p95: 15, spread: 1 })
    expect(group && isNoisy(group)).toBe(true)
  })

  it('shows changes above the noise, and warns about other devices', () => {
    const base = run([result(20)])
    expect(compareRuns(base, run([result(21)])).changes).toEqual([])
    const more = { ...result(1).renderer, drawCalls: 51 }
    const worse = compareRuns(base, run([result(30, { renderer: more })]))
    expect(worse.changes.map((c) => c.metric)).toEqual(['p95', 'drawCalls'])
    expect(worse.changes[0]?.change).toBeCloseTo(0.5)
    const other = run([result(20)], {
      device: { ...base.device, gpu: 'Y' },
      app: { ...base.app, dev: true },
    })
    expect(compareRuns(base, other).warnings).toHaveLength(2)
    // Rounds far apart: a difference within their spread isn't called a change.
    const noisy = run([result(20), result(35, {}, 2)])
    expect(compareRuns(noisy, run([result(33), result(30, {}, 2)])).changes).toEqual([])
  })

  it('writes a summary, worst first', () => {
    const normal = { ...result(1).cell, segment: 'normal' as const }
    const text = summaryText(run([result(17), result(30, { cell: normal })]))
    expect(text.indexOf('normal')).toBeLessThan(text.indexOf('dense'))
  })
})

it('finds the densest stretch and repeats its random numbers', () => {
  expect(densestSecond([0, 5, 5.2, 5.4, 9], 1)).toBe(5)
  expect(densestSecond([], 1)).toBe(0)
  const a = mulberry32(3)
  const b = mulberry32(3)
  expect([a(), a()]).toEqual([b(), b()])
})
