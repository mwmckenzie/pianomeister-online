import type { DetectedHands } from '../hands/DetectedHands'
import type { MeterOverride } from '../timing/MeterOverride'
import { effectiveBars } from './effectiveBars'
import type { LibraryEntry } from './LibraryEntry'
import { mergeMeta } from './mergeMeta'
import type { ProfileHandAssignment } from './ProfileHandAssignment'
import type { SongFacts } from './SongFacts'
import { songHands } from './songHands'
import type { SongManifest } from './SongManifest'
import type { SongMetaEdit } from './SongMetaEdit'
import type { SongMetaFields } from './SongMetaFields'
import type { SongSource } from './SongSource'
import type { UploadInfo } from './UploadInfo'

/**
 * Merges bundled songs, uploads, metadata edits, meter overrides and hands
 * into library entries.
 */
export function buildEntries(
  manifest: SongManifest,
  uploads: readonly UploadInfo[],
  meta: ReadonlyMap<string, SongMetaEdit>,
  overrides: ReadonlyMap<string, MeterOverride>,
  /** The profile's own hands. */
  hands: ReadonlyMap<string, ProfileHandAssignment> = new Map(),
  detections: ReadonlyMap<string, DetectedHands> = new Map(),
): LibraryEntry[] {
  const entry = (
    songId: string,
    source: SongSource,
    fileName: string,
    original: SongMetaFields,
    facts: SongFacts,
    addedAt: number | null,
  ): LibraryEntry => {
    const edit = meta.get(songId) ?? null
    const override = overrides.get(songId) ?? null
    return {
      ...mergeMeta(original, edit),
      songId,
      source,
      fileName,
      original,
      edited: edit !== null,
      facts,
      override,
      bars: effectiveBars(facts, override),
      timeSignature:
        override === null
          ? facts.timeSignatures.join(' → ')
          : `${override.timeSignature.numerator}/${override.timeSignature.denominator}`,
      hands: songHands(facts, hands.get(songId), detections.get(songId)),
      addedAt,
    }
  }
  return [
    ...manifest.songs.map((s) => entry(s.id, 'bundled', s.fileName, s, s.facts, null)),
    ...uploads.map((u) =>
      entry(
        u.songId,
        'uploaded',
        u.fileName,
        { title: u.title, composer: u.composer ?? '', tags: [] },
        u.facts,
        u.addedAt,
      ),
    ),
  ]
}
