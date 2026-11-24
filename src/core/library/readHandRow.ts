import type { CachedHands } from '../hands/CachedHands'
import type { HandLetter } from '../hands/HandLetter'
import type { HandSettings, VoiceRole } from '../hands/HandSettings'
import type { ProfileHandAssignment } from './ProfileHandAssignment'

type Rec = Record<string, unknown>

const ROLES: readonly unknown[] = ['right', 'left', 'split', 'hidden'] satisfies VoiceRole[]
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string' && v !== ''
const everyValue = <T>(v: unknown, check: (x: unknown) => boolean): v is Record<string, T> =>
  isRecord(v) && Object.values(v).every(check)

/** One hand assignment of a backup: format 1.5's, or an older channel map. Null when malformed. */
export function readHandRow(v: Rec): ProfileHandAssignment | null {
  const { profileId, songId } = v
  if (!isString(profileId) || !isString(songId)) return null
  if (isRecord(v.hands)) {
    const right = toChannels(v.hands.right)
    const left = toChannels(v.hands.left)
    return right === null || left === null ? null : { profileId, songId, hands: { right, left } }
  }
  const settings = toSettings(v.settings)
  const resolved = toCached(v.resolved)
  return settings === null || resolved === null ? null : { profileId, songId, settings, resolved }
}

function toChannels(v: unknown): number[] | null {
  return Array.isArray(v) && v.every((c) => Number.isInteger(c) && c >= 0 && c <= 15)
    ? (v as number[])
    : null
}

function toSettings(v: unknown): HandSettings | null {
  if (!isRecord(v) || !isString(v.algorithm)) return null
  const { algorithm, roles, params, flips } = v
  if (!everyValue<VoiceRole>(roles, (r) => ROLES.includes(r))) return null
  if (!everyValue<number>(params, (n) => Number.isFinite(n))) return null
  if (!everyValue<HandLetter>(flips, (h) => h === 'R' || h === 'L')) return null
  return { roles, algorithm, params, flips }
}

function toCached(v: unknown): CachedHands | null {
  if (!isRecord(v) || typeof v.hash !== 'string' || typeof v.hands !== 'string') return null
  if (!/^[RL-]*$/.test(v.hands) || !isRecord(v.summary)) return null
  const { right, left, lowest, highest } = v.summary
  const count = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0
  const pitch = (n: unknown): n is number | null => n === null || count(n)
  if (!count(right) || !count(left) || !pitch(lowest) || !pitch(highest)) return null
  return { hash: v.hash, hands: v.hands, summary: { right, left, lowest, highest } }
}
