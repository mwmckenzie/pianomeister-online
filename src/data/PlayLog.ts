import type { PlayRecord } from '@/core/stats/PlayRecord'
import type { RecorderWrite } from '@/core/stats/RecorderWrite'
import type { Session } from '@/core/stats/Session'

import type { PianoMeisterDb } from './PianoMeisterDb'

/** The raw play log and sessions (brief decision 70): every write goes through here. */
export class PlayLog {
  constructor(private readonly db: PianoMeisterDb) {}

  /** Stores a recorder write: both rows are upserts, so a stretch is rewritten as it grows. */
  async write(write: RecorderWrite): Promise<void> {
    const { db } = this
    await db.transaction('rw', [db.playRecords, db.sessions], async () => {
      await db.playRecords.put(write.record)
      await db.sessions.put(write.session)
    })
  }

  /** Every profile's records (the Profiles tab totals each profile). */
  allRecords(): Promise<PlayRecord[]> {
    return this.db.playRecords.toArray()
  }

  records(profileId: string): Promise<PlayRecord[]> {
    return this.db.playRecords.where('profileId').equals(profileId).toArray()
  }

  /** The profile's most recent session, which the next playback may continue. */
  async lastSession(profileId: string): Promise<Session | null> {
    const last = await this.db.sessions
      .where('[profileId+endedAt]')
      .between([profileId, -Infinity], [profileId, Infinity])
      .last()
    return last ?? null
  }
}
