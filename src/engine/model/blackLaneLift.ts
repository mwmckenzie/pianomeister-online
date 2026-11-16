import { constrainKeyboard } from '@/core/settings/constrainKeyboard'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

/**
 * Height of black-key-lane notes. By default it follows the black key height, so the notes
 * meet the raised key tops exactly at the now line.
 */
export function blackLaneLift(
  notes: PlayerSettings['notes'],
  keyboard: PlayerSettings['keyboard'],
): number {
  return notes.blackLiftMode === 'keys' ? constrainKeyboard(keyboard).blackHeight : notes.blackLift
}
