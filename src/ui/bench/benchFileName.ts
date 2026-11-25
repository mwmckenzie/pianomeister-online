import type { BenchRun } from '@/core/bench/BenchResult'

/** `bench-<label>-<date>-<time>.json`, safe for every file system. */
export function benchFileName(run: BenchRun): string {
  const label = run.label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const at = run.at.slice(0, 16).replace('T', '-').replace(':', '')
  return `bench-${label === '' ? 'run' : label}-${at}.json`
}
