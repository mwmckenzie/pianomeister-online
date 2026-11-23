import type { Playlist } from '@/core/playlists/Playlist'

import type { PianoMeisterDb } from './PianoMeisterDb'

/** A profile's playlists (milestone 9.5): every write goes through here. */
export class Playlists {
  constructor(
    private readonly db: PianoMeisterDb,
    private readonly profileId: string,
  ) {}

  /** The profile's playlists, oldest first. */
  async list(): Promise<Playlist[]> {
    const rows = await this.db.playlists.where('profileId').equals(this.profileId).toArray()
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /** Every profile's playlists (ids are unique across profiles; imports check against all). */
  async all(): Promise<Playlist[]> {
    return this.db.playlists.toArray()
  }

  async put(playlist: Playlist): Promise<void> {
    await this.db.playlists.put(playlist)
  }

  async bulkAdd(playlists: readonly Playlist[]): Promise<void> {
    await this.db.playlists.bulkAdd([...playlists])
  }

  async delete(id: string): Promise<void> {
    await this.db.playlists.delete(id)
  }
}
