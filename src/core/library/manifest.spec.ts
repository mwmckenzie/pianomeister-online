// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { importMidi } from '../song/importMidi'
import { computeSongFacts } from './computeSongFacts'
import { FACTS_VERSION } from './FACTS_VERSION'
import type { SongManifest } from './SongManifest'

const songsDir = new URL('../../../public/songs/', import.meta.url)
const manifest = JSON.parse(
  readFileSync(new URL('manifest.json', songsDir), 'utf8'),
) as SongManifest
const files = readdirSync(songsDir).filter((f) => /\.midi?$/i.test(f))

/** Each problem names the fix, so a failing diff says what to do. */
const stale = (what: string) => `${what}: run \`npm run songs:manifest\``

describe('bundled song manifest', () => {
  it('is up to date with the files in public/songs', async () => {
    const problems: string[] = []
    const listed = new Set(manifest.songs.map((s) => s.fileName))
    for (const f of files) if (!listed.has(f)) problems.push(stale(`${f} is missing`))
    for (const entry of manifest.songs) {
      if (!files.includes(entry.fileName)) {
        problems.push(stale(`${entry.fileName} has no file`))
        continue
      }
      const bytes = new Uint8Array(readFileSync(new URL(entry.fileName, songsDir)))
      const song = await importMidi(bytes, { fileName: entry.fileName })
      if (entry.id !== song.id) problems.push(stale(`${entry.fileName} has a stale hash`))
      if (JSON.stringify(entry.facts) !== JSON.stringify(computeSongFacts(song))) {
        problems.push(stale(`${entry.fileName} has stale facts`))
      }
    }
    expect(problems).toEqual([])
  })

  it("stores every bundled song's facts at the current FACTS_VERSION", () => {
    const outdated = manifest.songs
      .filter((s) => s.facts.factsVersion !== FACTS_VERSION)
      .map((s) => stale(`${s.fileName} has facts version ${s.facts.factsVersion ?? 'missing'}`))
    expect(outdated).toEqual([])
  })

  it('has a title for every song and starts with the Minuet (the first-run default)', () => {
    expect(manifest.songs.every((s) => s.title.trim() !== '')).toBe(true)
    expect(manifest.songs[0]?.title).toBe('Minuet in G')
  })
})
