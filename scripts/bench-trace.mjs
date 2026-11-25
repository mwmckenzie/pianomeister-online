// node scripts/bench-trace.mjs <trace.json>: sums up a trace saved by DevTools or bench:render.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { traceSummary } from './traceSummary.mjs'

const file = process.argv[2]
if (file === undefined) {
  console.error('Usage: node scripts/bench-trace.mjs <trace.json or .json.gz>')
  process.exit(1)
}
const bytes = readFileSync(file)
console.log(traceSummary(JSON.parse((file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString())))
