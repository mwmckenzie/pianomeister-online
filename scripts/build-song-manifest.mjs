// npm run songs:manifest — scans public/songs/ and writes public/songs/manifest.json.
// Hand-edited title, composer and tags are kept; ids (SHA-256) and facts are recomputed.
// With --check (npm run songs:manifest:check) it writes nothing and exits with an error when the
// manifest is out of date, e.g. an entry's facts predate the current FACTS_VERSION.
// New files get a guessed title and composer.
// The logic lives in src/core (importMidi, computeSongFacts, guessSongMetadata, updateManifest);
// Vite's module runner loads those TypeScript modules here, so nothing is duplicated.
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
const { FACTS_VERSION } = await load('/src/core/library/FACTS_VERSION.ts')
const { readMidiText } = await load('/src/core/song/readMidiText.ts')
const { guessSongMetadata } = await load('/src/core/library/guessSongMetadata.ts')
const checkOnly = process.argv.includes('--check')

const existing = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null
// New files get a guessed title and composer, matching composers already in the manifest.
const composers = [...new Set((existing?.songs ?? []).map((s) => s.composer).filter(Boolean))]

const scanned = []
for (const fileName of readdirSync(songsDir).filter((f) => /\.midi?$/i.test(f))) {
  const bytes = new Uint8Array(readFileSync(join(songsDir, fileName)))
  const song = await importMidi(bytes, { fileName })
  const guess = guessSongMetadata({ fileName, text: readMidiText(bytes) }, composers)
  scanned.push({ fileName, id: song.id, facts: computeSongFacts(song), guess })
}

const manifest = updateManifest(existing, scanned)
const text = `${JSON.stringify(manifest, null, 2)}\n`
if (checkOnly) {
  const staleVersions = (existing?.songs ?? []).filter(
    (s) => s.facts?.factsVersion !== FACTS_VERSION,
  )
  for (const s of staleVersions) {
    const found = s.facts?.factsVersion ?? 'missing'
    console.error(`${s.fileName}: facts version ${found}, expected ${FACTS_VERSION}`)
  }
  if (
    staleVersions.length > 0 ||
    existing === null ||
    readFileSync(manifestPath, 'utf8') !== text
  ) {
    console.error('manifest.json is out of date: run `npm run songs:manifest`')
    process.exit(1)
  }
  console.log(`manifest.json is up to date (${manifest.songs.length} songs)`)
} else if (existing !== null && readFileSync(manifestPath, 'utf8') === text) {
  console.log(`manifest.json is up to date (${manifest.songs.length} songs)`)
} else {
  writeFileSync(manifestPath, text)
  console.log(`Wrote manifest.json (${manifest.songs.length} songs)`)
}
