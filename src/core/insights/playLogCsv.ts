import type { PlayRecord } from '../stats/PlayRecord'

const HEADER = [
  'Date',
  'Time',
  'Song',
  'Bookmark',
  'Minutes',
  'Plays',
  'Tempo %',
  'Loop',
  'Hands',
  'Pre-roll',
  'Metronome',
]

/** A CSV field: quoted when it holds a comma, a quote or a line break (quotes doubled). */
function field(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const METRONOME: Readonly<Record<string, string>> = {
  off: 'off',
  preRoll: 'in pre-roll',
  always: 'always',
}

/**
 * The play log as CSV (m7-7 decision 22): one row per record, oldest first, with the local date
 * and time it started, the song, what it matched ("Full song", "Other setup", a bookmark's name,
 * or "Deleted bookmark"), minutes, plays and the setup. UTF-8 with a byte-order mark (so
 * spreadsheet apps read the accents right) and a header row; lines end in CRLF (RFC 4180).
 */
export function playLogCsv(
  records: readonly PlayRecord[],
  names: {
    readonly songTitle: (songId: string) => string
    readonly bookmarkName: (bookmarkId: string) => string | null
  },
  timeZone?: string,
): string {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const rows = [...records]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((r) => {
      const entry =
        r.bookmarkId === null
          ? 'Other setup'
          : r.bookmarkId.startsWith('full:')
            ? 'Full song'
            : (names.bookmarkName(r.bookmarkId) ?? 'Deleted bookmark')
      const loop =
        r.loop == null
          ? ''
          : r.loop.startBar === r.loop.endBar
            ? String(r.loop.startBar)
            : `${r.loop.startBar}–${r.loop.endBar}`
      const hands =
        r.handAudio === undefined ? '' : `right ${r.handAudio.right}, left ${r.handAudio.left}`
      const preRoll =
        r.preRollBeats === undefined
          ? ''
          : r.preRollBeats === 0
            ? 'none'
            : `${r.preRollBeats}${r.preRollMode === 'quiet' ? ' (quiet)' : ''}`
      return [
        date.format(r.startedAt),
        time.format(r.startedAt),
        names.songTitle(r.songId),
        entry,
        (r.playedMs / 60_000).toFixed(1),
        r.plays,
        r.tempoPercent ?? '',
        loop,
        hands,
        preRoll,
        r.metronomeMode === undefined ? '' : (METRONOME[r.metronomeMode] ?? r.metronomeMode),
      ]
        .map(field)
        .join(',')
    })
  return '﻿' + [HEADER.join(','), ...rows].join('\r\n') + '\r\n'
}
