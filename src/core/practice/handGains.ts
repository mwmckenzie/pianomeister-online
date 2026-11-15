import type { HandMix } from './HandMix'

/** Effective gain per hand: volume × mute/solo. If any hand is soloed, only soloed hands sound. */
export function handGains(mix: HandMix): { readonly right: number; readonly left: number } {
  const anySolo = mix.right.audio === 'solo' || mix.left.audio === 'solo'
  const gain = (hand: HandMix['right']): number => {
    if (hand.audio === 'muted') return 0
    if (anySolo && hand.audio !== 'solo') return 0
    return Math.min(1, Math.max(0, hand.volume))
  }
  return { right: gain(mix.right), left: gain(mix.left) }
}
