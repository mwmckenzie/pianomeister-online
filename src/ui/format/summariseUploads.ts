import { formatImportSummary } from '@/core/library/formatImportSummary'
import type { ImportReport } from '@/data/ImportReport'
import type { UploadResult } from '@/data/UploadResult'

/** "2 added, 1 duplicate, 1 rejected — not a MIDI file" */
export function summariseUploads(results: readonly UploadResult[]): string {
  const count = (outcome: UploadResult['outcome']) =>
    results.filter((r) => r.outcome === outcome).length
  const parts = [`${count('added')} added`]
  if (count('duplicate') > 0) parts.push(`${count('duplicate')} duplicate`)
  const rejected = results.filter((r) => r.outcome === 'rejected')
  if (rejected.length > 0) {
    const reasons = [...new Set(rejected.map((r) => r.reason))].join('; ')
    parts.push(`${rejected.length} rejected — ${reasons}`)
  }
  return parts.join(', ')
}

/** What a library import did, in one line. */
export function summariseImport(report: ImportReport): string {
  const parts = [`Imported: ${summariseUploads(report.uploads)}`]
  const applied = report.metaApplied + report.overridesApplied
  if (applied > 0) parts.push(`${applied} song settings applied`)
  const kept = report.metaKept + report.overridesKept
  if (kept > 0) parts.push(`local edits kept for ${kept} (not overwritten)`)
  if (report.unknownSongs > 0) parts.push(`${report.unknownSongs} skipped (song not in library)`)
  const profiles = formatImportSummary(report.profiles)
  if (profiles !== '') parts.push(`Profiles: ${profiles}`)
  return parts.join('. ')
}
