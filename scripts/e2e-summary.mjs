// Markdown summary of a merged Playwright JSON report (CI, .github/workflows/e2e.yml): totals,
// the duration, and every failed and flaky test by name. Usage: node <this> e2e-results.json

import { readFileSync } from 'node:fs'

const report = JSON.parse(readFileSync(process.argv[2] ?? 'e2e-results.json', 'utf8'))
const failed = []
const flaky = []

function walk(suite, path) {
  const here = suite.title ? [...path, suite.title] : path
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const name = `[${test.projectName}] ${[...here, spec.title].join(' › ')}`
      if (test.status === 'flaky') flaky.push(name)
      else if (test.status === 'unexpected') failed.push(name)
    }
  }
  for (const child of suite.suites ?? []) walk(child, here)
}
for (const suite of report.suites ?? []) walk(suite, [])

const stats = report.stats ?? {}
const minutes = ((stats.duration ?? 0) / 60_000).toFixed(1)
const lines = [
  '## E2E (chromium + polish)',
  '',
  `${stats.expected ?? 0} passed · ${stats.unexpected ?? 0} failed · ${stats.flaky ?? 0} flaky · ` +
    `${stats.skipped ?? 0} skipped · ${minutes} min (wall clock, all shards)`,
  '',
]
if (failed.length > 0) lines.push('### Failed', '', ...failed.map((n) => `- ${n}`), '')
if (flaky.length > 0) {
  lines.push('### Flaky (passed on retry)', '', ...flaky.map((n) => `- ${n}`), '')
}
console.log(lines.join('\n'))
