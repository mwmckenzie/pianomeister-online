import type { PlayerSettings } from '../settings/PlayerSettings'

/** The "New session after" setting in milliseconds (default 30 min, milestone 9.2). */
export function sessionGapMs(appearance: Pick<PlayerSettings['appearance'], 'sessionGap'>): number {
  return Number(appearance.sessionGap) * 60_000
}
