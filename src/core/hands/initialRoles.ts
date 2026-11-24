import type { HandAssignment } from './HandAssignment'
import type { HandDetection } from './HandDetection'
import type { VoiceRole } from './HandSettings'
import { rolesFromChannels } from './rolesFromChannels'
import type { VoiceStats } from './VoiceStats'

/**
 * The roles detection gives (HD brief §7), with two changes agreed in the plan (§9):
 *
 * - `other` and `drums` voices take the role the default map gives their channel (Q3), so
 *   detection never hides notes that sounded before it;
 * - a lone right-hand voice is split only when it wasn't chosen by its name (Q4b).
 */
export function initialRoles(
  detection: HandDetection,
  stats: readonly VoiceStats[],
  defaults: HandAssignment,
): Record<string, VoiceRole> {
  const fallback = rolesFromChannels(stats, defaults)
  const roles: Record<string, VoiceRole> = {}
  for (const { voiceId, role } of detection.guesses) {
    if (role === 'right' || role === 'left') roles[voiceId] = role
    else if (role === 'both') roles[voiceId] = 'split'
    else roles[voiceId] = fallback[voiceId] ?? 'hidden'
  }
  const { right, left, combined, named } = detection
  if (right !== null && left === null && combined.length === 0 && !named.includes(right)) {
    roles[right] = 'split'
  }
  return roles
}
