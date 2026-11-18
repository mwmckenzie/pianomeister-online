import type { BackupMergePlan } from './BackupMergePlan'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * The profile part of the import toast, e.g. "merged into Me (+5 bookmarks), added 1 new
 * profile"; empty when the backup had no profiles.
 */
export function formatImportSummary(summary: BackupMergePlan['summary']): string {
  const parts = [
    ...summary.merged.map(
      (m) => `merged into ${m.name} (+${plural(m.bookmarksAdded, 'bookmark', 'bookmarks')})`,
    ),
    ...summary.replaced.map((name) => `replaced ${name}`),
  ]
  if (summary.addedProfiles > 0) {
    parts.push(`added ${plural(summary.addedProfiles, 'new profile', 'new profiles')}`)
  }
  return parts.join(', ')
}
