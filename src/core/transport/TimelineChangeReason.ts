/**
 * Why the clock ↔ song mapping changed, so audio can decide whether sounding notes must be
 * released ('seek', 'pause', 'stop', 'tempo', 'song'), only pending ones re-planned ('loop',
 * 'preRoll', 'resync'), or nothing silenced at all ('play', 'end').
 */
export type TimelineChangeReason =
  | 'play'
  | 'pause'
  | 'stop'
  | 'end'
  | 'seek'
  | 'tempo'
  | 'loop'
  | 'preRoll'
  | 'song'
  | 'resync'
