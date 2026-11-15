// Downloads the Splendid Grand Piano samples that smplr's SplendidGrandPiano requests, into
// public/samples/splendid-grand-piano/, so the app never depends on a third-party sample host.
// Idempotent: files that already exist are skipped. Run with: node scripts/fetch-piano-samples.mjs
//
// The file list comes from smplr's own LAYERS table, so it always matches the installed
// version. Both formats are fetched because smplr picks one per browser: ogg in Chrome,
// Edge and Firefox; m4a in Safari (including iPad), which it skips ogg for.

import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { LAYERS } from 'smplr'

// smplr's default baseUrl for SplendidGrandPiano (not exported; see node_modules/smplr/dist).
const SOURCE = 'https://smpldsnds.github.io/sfzinstruments-splendid-grand-piano/samples'
const FORMATS = ['ogg', 'm4a']
const CONCURRENCY = 8

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'public', 'samples', 'splendid-grand-piano')

// Same rule as src/audio/sampleFileName.ts: '#' and spaces don't survive every static server.
const fileName = (name) => name.replace(/#/g, 's').replace(/ /g, '_')

const names = [...new Set(LAYERS.flatMap((layer) => layer.samples.map(([, name]) => name)))]
const jobs = names.flatMap((name) => FORMATS.map((format) => ({ name, format })))

async function sizeOf(path) {
  try {
    const info = await stat(path)
    return info.size > 0 ? info.size : null
  } catch {
    return null
  }
}

async function fetchOne({ name, format }) {
  const file = join(target, `${fileName(name)}.${format}`)
  const existing = await sizeOf(file)
  if (existing !== null) return { bytes: existing, downloaded: false }
  const url = `${SOURCE}/${encodeURIComponent(name)}.${format}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  await writeFile(file, bytes)
  return { bytes: bytes.length, downloaded: true }
}

await mkdir(target, { recursive: true })
let next = 0
let total = 0
let downloaded = 0
async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++]
    const result = await fetchOne(job)
    total += result.bytes
    if (result.downloaded) downloaded++
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

const mb = (total / 1024 / 1024).toFixed(1)
console.log(
  `${jobs.length} files (${names.length} samples × ${FORMATS.join(' + ')}), ` +
    `${downloaded} downloaded, ${mb} MB total in ${target}`,
)
