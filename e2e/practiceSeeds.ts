import { earlierToday, middayDaysAgo, SONG_IDS, type PracticeSeed } from './support'

const MIN = 60_000

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
  // Day labels ("3 days", "Today") read these: anchored so the hour the test runs never moves them.
  const threeDaysAgo = middayDaysAgo(3, now)
  const today = earlierToday(now)
  return {
    playRecords: [
      record('c1', SONG_IDS.canon, threeDaysAgo, 30, 5),
      record('i1', SONG_IDS.invention, today, 5, 1),
    ],
    sessions: [
      {
        id: 'c1',
        profileId: 'default',
        startedAt: threeDaysAgo,
        endedAt: threeDaysAgo + 30 * MIN,
      },
      { id: 'i1', profileId: 'default', startedAt: today, endedAt: today + 5 * MIN },
    ],
    bookmarks: [bookmark('b1', 'Opening'), bookmark('b2', 'Ending')],
  }
}
