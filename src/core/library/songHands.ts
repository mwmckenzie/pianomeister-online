import { defaultHands } from '../hands/defaultHands'
import type { DetectedHands } from '../hands/DetectedHands'
import { sameChannelHands } from '../hands/sameChannelHands'
import type { SongHands } from '../hands/SongHands'
import { summariseHandNotes } from '../hands/summariseHandNotes'
import type { ProfileHandAssignment } from './ProfileHandAssignment'
import type { SongFacts } from './SongFacts'

/**
 * The hands in effect, for lists: the profile's row, else the detection, else the default map. A
 * channel map from before milestone 10.5 counts as the player's unless it equals the default.
 */
export function songHands(
  facts: Pick<SongFacts, 'channels'>,
  row: ProfileHandAssignment | undefined,
  detected: DetectedHands | undefined,
): SongHands {
  const confidence = detected?.confidence ?? null
  const { channels } = facts
  if (row !== undefined && 'settings' in row) {
    return { source: 'user', confidence, summary: row.resolved.summary }
  }
  const untouched =
    row === undefined ||
    (channels !== undefined && sameChannelHands(channels, row.hands, defaultHands(channels)))
  if (!untouched) {
    const summary = channels === undefined ? null : summariseHandNotes(channels, row.hands)
    return { source: 'user', confidence, summary }
  }
  if (detected !== undefined) {
    return { source: 'detected', confidence, summary: detected.resolved.summary }
  }
  const summary =
    channels === undefined ? null : summariseHandNotes(channels, defaultHands(channels))
  return { source: 'default', confidence: null, summary }
}
