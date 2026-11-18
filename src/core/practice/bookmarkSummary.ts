import type { PracticeConfig } from './PracticeConfig'
import { rangeLabel } from './bookmarkNames'

function handsPart(config: PracticeConfig): string | null {
  const { right, left } = config.handAudio
  if (right === 'on' && left === 'on') return null
  if (right === 'solo' && left !== 'solo') return 'right only'
  if (left === 'solo' && right !== 'solo') return 'left only'
  if (right === 'muted' && left === 'muted') return 'both muted'
  if (right === 'muted') return 'right muted'
  if (left === 'muted') return 'left muted'
  return 'both hands'
}

/**
 * A one-line summary of a setup, e.g. "Bars 17–32 · 85% · left muted · pre-roll 2". The
 * bookmark manager leaves out parts at their defaults (both hands on, no pre-roll); the picker
 * always names the hands ("both hands"); an automatic bookmark name names every part ("no
 * pre-roll" too). A quiet pre-roll says so ("quiet pre-roll 2"). The metronome is named only when on ("metronome", "metronome in pre-roll").
 * A null loop is the whole song.
 */
export function bookmarkSummary(
  config: PracticeConfig,
  lastBar: number,
  options: { readonly alwaysHands?: boolean; readonly allParts?: boolean } = {},
): string {
  const parts = [
    rangeLabel(config.loop ?? { startBar: 1, endBar: lastBar }),
    `${config.tempoPercent}%`,
  ]
  const all = options.allParts === true
  const hands = handsPart(config) ?? (options.alwaysHands === true || all ? 'both hands' : null)
  if (hands !== null) parts.push(hands)
  // A quiet pre-roll is named ("quiet pre-roll 2"); muted is the default and stays implicit.
  const quiet = config.preRollMode === 'quiet' ? 'quiet ' : ''
  if (config.preRollBeats > 0) parts.push(`${quiet}pre-roll ${config.preRollBeats}`)
  else if (all) parts.push('no pre-roll')
  if (config.metronomeMode === 'always') parts.push('metronome')
  else if (config.metronomeMode === 'preRoll') parts.push('metronome in pre-roll')
  return parts.join(' · ')
}
