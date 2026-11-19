import type { HandAssignment } from '../hands/HandAssignment'
import type { Bookmark } from '../practice/Bookmark'
import type { MetronomeMode } from '../practice/MetronomeMode'
import { settleBookmark } from '../practice/bookmarkNames'
import type { HandAudio } from '../practice/HandAudio'
import type { Profile } from '../profiles/Profile'
import type { PlayRecord } from '../stats/PlayRecord'
import type { Session } from '../stats/Session'
import type { PreRollMode } from '../transport/PreRollMode'
import type { PracticeData } from './PracticeData'
import type { ProfileHandAssignment } from './ProfileHandAssignment'

type Rec = Record<string, unknown>

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string' && v !== ''
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBar = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
const HAND_AUDIO: readonly unknown[] = ['on', 'muted', 'solo'] satisfies HandAudio[]
const METRONOME_MODES: readonly unknown[] = ['off', 'preRoll', 'always'] satisfies MetronomeMode[]
const PRE_ROLL_MODES: readonly unknown[] = ['muted', 'quiet'] satisfies PreRollMode[]

function list<T>(value: unknown, convert: (v: Rec) => T | null): T[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((v) => {
    const converted = isRecord(v) ? convert(v) : null
    return converted === null ? [] : [converted]
  })
}

function toProfile(v: Rec): Profile | null {
  if (!isString(v.id) || typeof v.name !== 'string' || typeof v.color !== 'string') return null
  return {
    id: v.id,
    name: v.name,
    color: v.color,
    createdAt: isNumber(v.createdAt) ? v.createdAt : 0,
  }
}

function toChannels(v: unknown): number[] | null {
  return Array.isArray(v) && v.every((c) => Number.isInteger(c) && c >= 0 && c <= 15)
    ? (v as number[])
    : null
}

function toHands(v: Rec): ProfileHandAssignment | null {
  if (!isString(v.profileId) || !isString(v.songId) || !isRecord(v.hands)) return null
  const right = toChannels(v.hands.right)
  const left = toChannels(v.hands.left)
  if (right === null || left === null) return null
  const hands: HandAssignment = { right, left }
  return { profileId: v.profileId, songId: v.songId, hands }
}

function toBookmark(v: Rec): Bookmark | null {
  const c = v.config
  if (!isString(v.id) || !isString(v.profileId) || !isString(v.songId)) return null
  if (typeof v.name !== 'string' || !isRecord(c) || !isRecord(c.loop) || !isRecord(c.handAudio))
    return null
  const { startBar, endBar } = c.loop
  if (!isBar(startBar) || !isBar(endBar) || startBar > endBar) return null
  const { right, left } = c.handAudio
  if (!HAND_AUDIO.includes(right) || !HAND_AUDIO.includes(left)) return null
  if (!isNumber(c.tempoPercent) || !isBar(c.preRollBeats)) return null
  if (c.preRollMode !== 'muted' && c.preRollMode !== 'quiet') return null
  // Backups from before `autoName` settle it the way the database upgrade does.
  return settleBookmark({
    id: v.id,
    profileId: v.profileId,
    songId: v.songId,
    name: v.name,
    ...(typeof v.autoName === 'boolean' ? { autoName: v.autoName } : {}),
    config: {
      loop: { startBar, endBar },
      tempoPercent: Math.min(200, Math.max(25, c.tempoPercent)),
      handAudio: { right: right as HandAudio, left: left as HandAudio },
      preRollBeats: Math.min(16, c.preRollBeats),
      preRollMode: c.preRollMode,
      ...(METRONOME_MODES.includes(c.metronomeMode)
        ? { metronomeMode: c.metronomeMode as MetronomeMode }
        : {}),
    },
    createdAt: isNumber(v.createdAt) ? v.createdAt : 0,
    updatedAt: isNumber(v.updatedAt) ? v.updatedAt : 0,
  })
}

function toSession(v: Rec): Session | null {
  if (!isString(v.id) || !isString(v.profileId)) return null
  if (!isNumber(v.startedAt) || !isNumber(v.endedAt)) return null
  return { id: v.id, profileId: v.profileId, startedAt: v.startedAt, endedAt: v.endedAt }
}

function toRecord(v: Rec): PlayRecord | null {
  if (!isString(v.id) || !isString(v.profileId) || !isString(v.sessionId)) return null
  if (!isString(v.songId) || !(isString(v.bookmarkId) || v.bookmarkId === null)) return null
  if (!isNumber(v.startedAt) || !isNumber(v.playedMs) || v.playedMs < 0) return null
  return {
    id: v.id,
    profileId: v.profileId,
    sessionId: v.sessionId,
    songId: v.songId,
    bookmarkId: v.bookmarkId,
    startedAt: v.startedAt,
    playedMs: v.playedMs,
    // Backups before 1.2 counted complete passes; they count as plays (decision 70).
    plays: isBar(v.plays) ? v.plays : isBar(v.passes) ? v.passes : 0,
    // The setup it was played with (missing on older records).
    ...(isNumber(v.tempoPercent) ? { tempoPercent: v.tempoPercent } : {}),
    ...(v.loop === null ? { loop: null } : {}),
    ...(isRecord(v.loop) && isBar(v.loop.startBar) && isBar(v.loop.endBar)
      ? { loop: { startBar: v.loop.startBar, endBar: v.loop.endBar } }
      : {}),
    ...(METRONOME_MODES.includes(v.metronomeMode)
      ? { metronomeMode: v.metronomeMode as MetronomeMode }
      : {}),
    ...(isRecord(v.handAudio) &&
    HAND_AUDIO.includes(v.handAudio.right) &&
    HAND_AUDIO.includes(v.handAudio.left)
      ? {
          handAudio: {
            right: v.handAudio.right as HandAudio,
            left: v.handAudio.left as HandAudio,
          },
        }
      : {}),
    ...(isNumber(v.preRollBeats) ? { preRollBeats: v.preRollBeats } : {}),
    ...(PRE_ROLL_MODES.includes(v.preRollMode)
      ? { preRollMode: v.preRollMode as PreRollMode }
      : {}),
    ...(typeof v.temporary === 'boolean' ? { temporary: v.temporary } : {}),
  }
}

/**
 * The profiles part of a backup (format 1.1 and 1.2: 1.2 records count `plays`). Malformed rows are dropped, not fatal; a 1.0
 * backup (no practice data) reads as empty.
 */
export function readPracticeData(value: unknown): PracticeData {
  const v = isRecord(value) ? value : {}
  return {
    profiles: list(v.profiles, toProfile),
    bookmarks: list(v.bookmarks, toBookmark),
    handAssignments: list(v.handAssignments, toHands),
    sessions: list(v.sessions, toSession),
    playRecords: list(v.playRecords, toRecord),
  }
}
