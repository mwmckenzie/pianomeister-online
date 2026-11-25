import { BENCH_SCHEMA, BENCH_VERSION, type BenchRun } from './BenchResult'

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

const numbers = (x: Record<string, unknown>, keys: readonly string[]) =>
  keys.every((k) => typeof x[k] === 'number')

function isCell(x: unknown): boolean {
  if (!isObject(x)) return false
  const { cell, frames, cpu, hud, audio, renderer } = x
  return (
    isObject(cell) &&
    ['look', 'quality', 'segment'].every((k) => typeof cell[k] === 'string') &&
    isObject(frames) &&
    numbers(frames, ['median', 'p95', 'p99', 'longest', 'dropped', 'fps']) &&
    isObject(cpu) &&
    numbers(cpu, ['mean']) &&
    isObject(hud) &&
    numbers(hud, ['mean']) &&
    isObject(audio) &&
    numbers(audio, ['late']) &&
    isObject(renderer) &&
    numbers(renderer, ['drawCalls'])
  )
}

function isDevice(x: unknown): boolean {
  return isObject(x) && numbers(x, ['pixelRatio', 'refreshMs']) && Array.isArray(x.viewport)
}

/** A benchmark file's run, or why it isn't one. */
export function readBenchRun(raw: unknown): BenchRun | string {
  if (!isObject(raw) || raw.schema !== BENCH_SCHEMA) return 'Not a PianoMeister benchmark file'
  if (raw.version !== BENCH_VERSION) {
    return `Benchmark file version ${String(raw.version)}, not ${BENCH_VERSION}`
  }
  const texts = ['id', 'label', 'at', 'suite', 'notes'].every((k) => typeof raw[k] === 'string')
  if (
    !texts ||
    !isObject(raw.app) ||
    !isDevice(raw.device) ||
    !Array.isArray(raw.flags) ||
    !Array.isArray(raw.cells) ||
    !raw.cells.every(isCell)
  ) {
    return 'The benchmark file is damaged'
  }
  return raw as unknown as BenchRun
}
