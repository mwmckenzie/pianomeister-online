import { confidencePercent } from './confidencePercent'
import type { SongHands } from './SongHands'

/** Whether a song shows "Check hands": detection's own result, below the threshold (percent). */
export function needsHandsCheck(hands: SongHands, below: number): boolean {
  return (
    hands.source === 'detected' &&
    hands.confidence !== null &&
    confidencePercent(hands.confidence) < below
  )
}
