import type { Bookmark } from '@/core/practice/Bookmark'

import type { PianoMeisterDb } from './PianoMeisterDb'

/** Bookmarks (brief decision 67): every bookmark write goes through here. */
export class Bookmarks {
  constructor(private readonly db: PianoMeisterDb) {}

  /** A profile's bookmarks, oldest first. */
  async forProfile(profileId: string): Promise<Bookmark[]> {
    const rows = await this.db.bookmarks
      .where('[profileId+songId]')
      .between([profileId, ''], [profileId, '￿'])
      .toArray()
    return rows.sort((a, b) => a.createdAt - b.createdAt)
  }

  /** Bookmarks per profile id. */
  async countByProfile(): Promise<Map<string, number>> {
    const counts = new Map<string, number>()
    await this.db.bookmarks.each((b) => counts.set(b.profileId, (counts.get(b.profileId) ?? 0) + 1))
    return counts
  }

  get(id: string): Promise<Bookmark | undefined> {
    return this.db.bookmarks.get(id)
  }

  /** Adds or replaces a bookmark (also how a deleted one is restored by Undo). */
  async put(bookmark: Bookmark): Promise<void> {
    await this.db.bookmarks.put(bookmark)
  }

  async delete(id: string): Promise<void> {
    await this.db.bookmarks.delete(id)
  }
}
