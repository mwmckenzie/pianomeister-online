import { SONG_IDS, type PracticeSeed } from './support'

const MIN = 60_000
const DAY = 86_400_000

/**
 * A small practice history for sorting tests, relative to `now`: Canon played most (5 plays,
 * 30 min, 3 days ago), Invention played last (1 play, 5 min, today), Minuet never, and two
 * bookmarks on Invention.
 */
export function sortingHistory(now: number): PracticeSeed {
  const record = (
    id: string,
    songId: string,
    startedAt: number,
    minutes: number,
    plays: number,
  ) => ({
    id,
    profileId: 'default',
    sessionId: id,
    songId,
    bookmarkId: `full:${songId}`,
    startedAt,
    playedMs: minutes * MIN,
    plays,
  })
  const bookmark = (id: string, name: string) => ({
    id,
    profileId: 'default',
    songId: SONG_IDS.invention,
    name,
    config: {
      loop: { startBar: 1, endBar: 4 },
      tempoPercent: 100,
      handAudio: { right: 'on', left: 'on' },
      preRollBeats: 0,
      preRollMode: 'muted',
      metronomeMode: 'off',
    },
    createdAt: 1,
    updatedAt: 1,
  })
  return {
    playRecords: [
      record('c1', SONG_IDS.canon, now - 3 * DAY, 30, 5),
      record('i1', SONG_IDS.invention, now - 10 * MIN, 5, 1),
    ],
    sessions: [
      {
        id: 'c1',
        profileId: 'default',
        startedAt: now - 3 * DAY,
        endedAt: now - 3 * DAY + 30 * MIN,
      },
      { id: 'i1', profileId: 'default', startedAt: now - 10 * MIN, endedAt: now - 5 * MIN },
    ],
    bookmarks: [bookmark('b1', 'Opening'), bookmark('b2', 'Ending')],
  }
}
