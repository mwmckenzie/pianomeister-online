// npm run songs:manifest — scans public/songs/ and writes public/songs/manifest.json.
// Hand-edited title, composer and tags are kept; ids (SHA-256) and facts are recomputed.
// The logic lives in src/core (importMidi, computeSongFacts, updateManifest); Vite's module
// runner loads those TypeScript modules here, so nothing is duplicated.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { runnerImport } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const songsDir = join(root, 'public', 'songs')
const manifestPath = join(songsDir, 'manifest.json')

const config = {
  configFile: false,
  root,
  logLevel: 'error',
  resolve: {
    alias: {
      '@tonejs/midi': join(root, 'scripts', 'tonejs-midi-shim.mjs'),
      '@': join(root, 'src'),
    },
  },
}
const load = async (path) => (await runnerImport(path, config)).module

const { importMidi } = await load('/src/core/song/importMidi.ts')
const { computeSongFacts } = await load('/src/core/library/computeSongFacts.ts')
const { updateManifest } = await load('/src/core/library/updateManifest.ts')

const scanned = []
for (const fileName of readdirSync(songsDir).filter((f) => /\.midi?$/i.test(f))) {
  const song = await importMidi(new Uint8Array(readFileSync(join(songsDir, fileName))), {
    fileName,
  })
  scanned.push({ fileName, id: song.id, facts: computeSongFacts(song) })
}

const existing = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null
const manifest = updateManifest(existing, scanned)
const text = `${JSON.stringify(manifest, null, 2)}\n`
if (existing !== null && readFileSync(manifestPath, 'utf8') === text) {
  console.log(`manifest.json is up to date (${manifest.songs.length} songs)`)
} else {
  writeFileSync(manifestPath, text)
  console.log(`Wrote manifest.json (${manifest.songs.length} songs)`)
}
