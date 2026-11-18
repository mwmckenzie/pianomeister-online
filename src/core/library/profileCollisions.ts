import type { PracticeData } from './PracticeData'
import type { ProfileCollision } from './ProfileCollision'
import type { ProfileFacts } from './ProfileFacts'

function factsFor(data: PracticeData, profileId: string): Omit<ProfileFacts, 'profile'> {
  let playedMs = 0
  let lastPlayedAt: number | null = null
  for (const record of data.playRecords) {
    if (record.profileId !== profileId) continue
    playedMs += record.playedMs
    lastPlayedAt = Math.max(lastPlayedAt ?? 0, record.startedAt + record.playedMs)
  }
  const bookmarks = data.bookmarks.filter((b) => b.profileId === profileId).length
  return { bookmarks, playedMs, lastPlayedAt }
}

/**
 * The backup's profiles that collide with local ones by id, in backup order, with what the
 * import dialog shows for each side (brief decision 75).
 */
export function profileCollisions(
  incoming: PracticeData,
  local: PracticeData,
): readonly ProfileCollision[] {
  const localById = new Map(local.profiles.map((p) => [p.id, p]))
  const localBookmarkIds = new Set(local.bookmarks.map((b) => b.id))
  return incoming.profiles.flatMap((profile) => {
    const mine = localById.get(profile.id)
    if (mine === undefined) return []
    const localFacts = { profile: mine, ...factsFor(local, mine.id) }
    const added = incoming.bookmarks.filter(
      (b) => b.profileId === profile.id && !localBookmarkIds.has(b.id),
    ).length
    return [
      {
        local: localFacts,
        incoming: { profile, ...factsFor(incoming, profile.id) },
        defaultChoice: mine.name.trim() === profile.name.trim() ? 'merge' : 'addNew',
        mergedBookmarks: localFacts.bookmarks + added,
      },
    ]
  })
}
