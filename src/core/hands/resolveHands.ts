import type { HandSettings } from './HandSettings'
import type { HandLetter } from './HandLetter'
import type { RawNote } from './RawNote'
import { SPLIT_ALGORITHMS, splitAlgorithm } from './SPLIT_ALGORITHMS'
import type { SplitContext } from './SplitAlgorithm'
import { voiceId } from './voiceId'

export interface ResolvedHands {
  /** One char per note in extractNotes order: R, L, or - (Hidden). */
  readonly hands: string
  /** The method's hands for Split notes, before flips. */
  readonly computed: ReadonlyMap<string, HandLetter>
  /** Split notes the method isn't sure about and the player hasn't flipped. */
  readonly uncertain: ReadonlySet<string>
}

/** Every note's hand: Hidden by its voice, else the player's flip, else the role, else the method. */
export function resolveHands(
  notes: readonly RawNote[],
  settings: HandSettings,
  context: SplitContext,
): ResolvedHands {
  const roleOf = (n: RawNote) => settings.roles[voiceId(n)] ?? 'hidden'
  const split = notes.filter((n) => roleOf(n) === 'split')
  const method = splitAlgorithm(settings.algorithm)
  const known = SPLIT_ALGORITHMS.some((a) => a.id === settings.algorithm)
  const params = Object.fromEntries(
    method.params.map((p) => [
      p.key,
      // Parameters of a method this version doesn't know mean nothing to the default one.
      known ? (settings.params[p.key] ?? p.default) : p.default,
    ]),
  )
  const result =
    split.length === 0
      ? { hands: new Map<string, HandLetter>(), uncertain: new Set<string>() }
      : method.run(split, params, context)
  let hands = ''
  for (const n of notes) {
    const role = roleOf(n)
    if (role === 'hidden') hands += '-'
    else {
      hands +=
        settings.flips[n.id] ??
        (role === 'split' ? (result.hands.get(n.id) ?? 'R') : role === 'right' ? 'R' : 'L')
    }
  }
  return {
    hands,
    computed: result.hands,
    uncertain: new Set([...result.uncertain].filter((id) => settings.flips[id] === undefined)),
  }
}
