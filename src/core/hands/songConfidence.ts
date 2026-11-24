import type { HandDetection } from './HandDetection'
import type { VoiceRole } from './HandSettings'

/**
 * The lowest confidence among the voices detection set to Right, Left or Split. When it found no
 * hand at all (only tiny or other voices), the lowest among the voices that are shown; null when
 * nothing is.
 */
export function songConfidence(
  detection: HandDetection,
  roles: Readonly<Record<string, VoiceRole>>,
): number | null {
  const isHand = (role: string) => role === 'right' || role === 'left' || role === 'both'
  const hands = detection.guesses.filter((g) => isHand(g.role))
  const counted =
    hands.length > 0
      ? hands
      : detection.guesses.filter((g) => (roles[g.voiceId] ?? 'hidden') !== 'hidden')
  return counted.length === 0 ? null : Math.min(...counted.map((g) => g.confidence))
}
