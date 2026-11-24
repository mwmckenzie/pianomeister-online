import type { HandExportOptions } from './applyHandAssignment'
import type { VoiceRole } from './HandSettings'
import type { VoiceInfo } from './VoiceInfo'

/** What to warn about before exporting with hands split (HD brief §7). */
export function exportWarnings(
  voices: readonly Pick<VoiceInfo, 'id' | 'track' | 'channel'>[],
  roles: Readonly<Record<string, VoiceRole>>,
  { rightChannel, leftChannel }: Pick<HandExportOptions, 'rightChannel' | 'leftChannel'>,
): string[] {
  const same = rightChannel === leftChannel
  const out = same ? [`Both hands would be on channel ${rightChannel}`] : []
  for (const v of voices) {
    if ((roles[v.id] ?? 'hidden') !== 'hidden') continue
    const isRight = v.channel === rightChannel
    if (!isRight && v.channel !== leftChannel) continue
    const hand = same ? 'both hands' : isRight ? 'the right hand' : 'the left hand'
    out.push(`Track ${v.track} · ch ${v.channel} would mix with ${hand}`)
  }
  return out
}
