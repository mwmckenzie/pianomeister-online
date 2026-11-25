// npm run perf:fast: the fast loop of perf work (docs/performance.md), under 10 minutes: unit tests
// of the engine, counters and pixel comparison on the GPU, one exact case on software WebGL, then
// the smoke benchmark on strong and weak-cpu. Leave the PC alone for the benchmark.
//   --no-bench   without the benchmark     --label=<name>   its files are bench-<tier>-<name>.json
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const label = args.find((a) => a.startsWith('--label='))?.slice(8) ?? 'fast'
const steps = [
  ['engine unit tests', 'npx vitest run src/engine'],
  ['build', 'npm run build-only'],
  ['counters and pixels (GPU)', 'npx playwright test --project=pixels'],
  ['exact (software WebGL)', 'npx playwright test --project=exact'],
  ...(args.includes('--no-bench')
    ? []
    : [
        [
          'smoke, strong',
          `node scripts/bench-render.mjs --gpu --quality=medium --label=strong-${label}`,
        ],
        [
          'smoke, weak-cpu',
          `node scripts/bench-render.mjs --gpu --throttle=4 --quality=medium --label=weak-cpu-${label}`,
        ],
      ]),
]
let failed = false
const began = Date.now()
for (const [name, command] of steps) {
  const at = Date.now()
  console.log(`\n── ${name}`)
  const ok = spawnSync(command, { stdio: 'inherit', shell: true }).status === 0
  console.log(`── ${name}: ${ok ? 'ok' : 'FAILED'}, ${((Date.now() - at) / 1000).toFixed(0)} s`)
  failed ||= !ok
}
console.log(`\nFast loop: ${((Date.now() - began) / 60_000).toFixed(1)} min`)
process.exit(failed ? 1 : 0)
