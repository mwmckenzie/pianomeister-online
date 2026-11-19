import { SONG_IDS, type PracticeSeed } from './support'

const MIN = 60_000
const DAY = 86_400_000

const config = (
  startBar: number,
  endBar: number,
  tempoPercent: number,
  extra: { left?: string; preRollBeats?: number } = {},
) => ({
  loop: { startBar, endBar },
  tempoPercent,
  handAudio: { right: 'on', left: extra.left ?? 'on' },
  preRollBeats: extra.preRollBeats ?? 0,
  preRollMode: 'muted',
  metronomeMode: 'off',
})

/**
 * A deterministic two-week practice history for the visual shots (test-only; the app never
 * seeds data): profiles Me and Anna; Minuet with three bookmarks practised on most days, Canon
 * now and then. `now` is the fixed clock time the shots use.
 */
export function practiceHistory(now: number): PracticeSeed {
  const bookmark = (id: string, songId: string, name: string, c: object, createdAt: number) => ({
    id,
    profileId: 'default',
    songId,
    name,
    // "Bars …" names are automatic (their summary); the others are typed.
    autoName: name.startsWith('Bars '),
    config: c,
    createdAt,
    updatedAt: createdAt,
  })
  const bookmarks = [
    bookmark('bm-b', SONG_IDS.minuet, 'B section', config(17, 32, 85, { preRollBeats: 2 }), 1),
    bookmark(
      'bm-open',
      SONG_IDS.minuet,
      'Bars 1–8 · 100% · both hands · no pre-roll',
      config(1, 8, 100),
      2,
    ),
    bookmark(
      'bm-left',
      SONG_IDS.minuet,
      'Left hand alone',
      config(33, 48, 70, { left: 'solo' }),
      3,
    ),
    bookmark('bm-canon', SONG_IDS.canon, 'Variation 3', config(29, 40, 90), 4),
  ]
  // Minutes per day (14 days ago … today) for each entry.
  const plan: [entry: string | null, songId: string, minutes: number[], playsPerMin: number][] = [
    ['bm-b', SONG_IDS.minuet, [0, 6, 0, 8, 10, 0, 4, 12, 0, 9, 7, 0, 11, 6], 0.6],
    ['bm-open', SONG_IDS.minuet, [3, 0, 4, 0, 0, 5, 0, 2, 3, 0, 0, 4, 0, 3], 0.5],
    ['bm-left', SONG_IDS.minuet, [0, 0, 0, 0, 6, 0, 0, 0, 5, 0, 4, 0, 0, 0], 0.4],
    [`full:${SONG_IDS.minuet}`, SONG_IDS.minuet, [5, 0, 0, 4, 0, 0, 0, 0, 6, 0, 0, 0, 0, 2], 0.08],
    ['bm-canon', SONG_IDS.canon, [0, 0, 8, 0, 0, 0, 7, 0, 0, 0, 6, 0, 0, 0], 0.5],
    // Other setups of the Minuet (matched no bookmark; decision 70).
    [null, SONG_IDS.minuet, [0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 5, 0, 0, 4], 0.9],
  ]
  const startOfToday = new Date(now)
  startOfToday.setHours(9, 0, 0, 0)
  const playRecords: object[] = []
  const sessions = new Map<string, { id: string; startedAt: number; endedAt: number }>()
  for (const [entry, songId, minutes, playsPerMin] of plan) {
    minutes.forEach((m, i) => {
      if (m === 0) return
      const day = 13 - i
      const sessionId = `s-${day}`
      const session = sessions.get(sessionId) ?? {
        id: sessionId,
        startedAt: startOfToday.getTime() - day * DAY,
        endedAt: startOfToday.getTime() - day * DAY,
      }
      const startedAt = session.endedAt
      session.endedAt = startedAt + m * MIN
      sessions.set(sessionId, session)
      playRecords.push({
        id: `${entry ?? 'other'}-${day}`,
        profileId: 'default',
        sessionId,
        songId,
        bookmarkId: entry,
        startedAt,
        playedMs: m * MIN,
        plays: Math.max(1, Math.round(m * playsPerMin)),
      })
    })
  }
  return {
    profiles: [{ id: 'anna', name: 'Anna', color: '#FFB38A', createdAt: 10 }],
    bookmarks,
    playRecords,
    sessions: [...sessions.values()].map((s) => ({ ...s, profileId: 'default' })),
    appState: [
      {
        key: 'lastOpened:default',
        value: JSON.stringify({ songId: SONG_IDS.minuet, bookmarkId: 'bm-b' }),
      },
    ],
  }
}
