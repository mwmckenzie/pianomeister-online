import type { PracticeData } from '../library/PracticeData'
import type { Bookmark } from '../practice/Bookmark'
import type { PlayRecord } from '../stats/PlayRecord'

const MIN = 60_000

/** A bookmark for tests; override only what the test cares about. */
export function makeBookmark(
  fields: Partial<Bookmark> & { readonly id: string; readonly profileId: string },
): Bookmark {
  return {
    songId: 'song',
    name: fields.id,
    autoName: false,
    config: {
      loop: { startBar: 1, endBar: 4 },
      tempoPercent: 100,
      handAudio: { right: 'on', left: 'on' },
      preRollBeats: 0,
      preRollMode: 'muted',
      metronomeMode: 'off',
    },
    createdAt: 0,
    updatedAt: 0,
    ...fields,
  }
}

/** A play record for tests; minutes of practice in a session. */
export function makeRecord(
  fields: Partial<PlayRecord> & { readonly id: string; readonly profileId: string },
): PlayRecord {
  return {
    sessionId: `${fields.profileId}-s1`,
    songId: 'song',
    bookmarkId: 'full:song',
    startedAt: 0,
    playedMs: 10 * MIN,
    passes: 1,
    ...fields,
  }
}

/**
 * One profile's practice data: `bookmarks` bookmarks (ids `<prefix>b1`…), one session, and a
 * record per bookmark of `minutesEach` minutes.
 */
export function makePracticeData(options: {
  readonly profileId?: string
  readonly name?: string
  readonly prefix?: string
  readonly bookmarks?: number
  readonly minutesEach?: number
  readonly startedAt?: number
}): PracticeData {
  const profileId = options.profileId ?? 'default'
  const prefix = options.prefix ?? ''
  const count = options.bookmarks ?? 2
  const startedAt = options.startedAt ?? 0
  const bookmarks = Array.from({ length: count }, (_, i) =>
    makeBookmark({ id: `${prefix}b${i + 1}`, profileId }),
  )
  const sessionId = `${prefix}s1`
  return {
    profiles: [{ id: profileId, name: options.name ?? 'Me', color: '#8AB4FF', createdAt: 0 }],
    bookmarks,
    handAssignments: [{ profileId, songId: 'song', hands: { right: [1], left: [0] } }],
    sessions: [{ id: sessionId, profileId, startedAt, endedAt: startedAt + count * MIN }],
    playRecords: bookmarks.map((b, i) =>
      makeRecord({
        id: `${prefix}r${i + 1}`,
        profileId,
        sessionId,
        bookmarkId: b.id,
        startedAt: startedAt + i * MIN,
        playedMs: (options.minutesEach ?? 10) * MIN,
      }),
    ),
  }
}
