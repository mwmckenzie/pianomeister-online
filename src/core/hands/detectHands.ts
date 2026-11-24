import type { DetectedRole, HandDetection, VoiceGuess } from './HandDetection'
import type { VoiceStats } from './VoiceStats'

const MIN_NOTES = 8
const RIGHT_NAME = /\b(right|r\.?\s?h\.?|treble|upper|melody|rechte?|droite|destra)\b/i
const LEFT_NAME = /\b(left|l\.?\s?h\.?|bass|lower|linke?|gauche|sinistra)\b/i

const isKeyboard = (p: number | undefined) => p === undefined || p <= 7 || (p >= 16 && p <= 20)

/**
 * Which voice is the right hand, which the left, and which hold both (HD brief §5): the scoring
 * is deliberately transparent, and every guess carries its reasons.
 */
export function detectHands(stats: readonly VoiceStats[]): HandDetection {
  const guesses = new Map<string, VoiceGuess>()
  const candidates: VoiceStats[] = []
  const guess = (s: VoiceStats, role: DetectedRole, confidence: number, reasons: string[]) =>
    guesses.set(s.id, { voiceId: s.id, role, confidence, reasons })

  for (const s of stats) {
    if (s.channel === 9) {
      guess(s, 'drums', 0.95, ['Channel 9 is the GM drum channel'])
      continue
    }
    if (s.noteCount < MIN_NOTES) {
      guess(s, 'other', 0.5, [`Only ${s.noteCount} notes`])
      continue
    }
    const { score, reasons } = bothHandsScore(s)
    if (score >= 0.45) guess(s, 'both', Math.min(0.95, score), reasons)
    else candidates.push(s)
  }

  // Names are the strongest signal, and always win over pitch.
  let right =
    candidates.find((s) => RIGHT_NAME.test(s.trackName) && !LEFT_NAME.test(s.trackName)) ?? null
  let left = candidates.find((s) => LEFT_NAME.test(s.trackName) && s !== right) ?? null
  const named = new Set([right, left].flatMap((s) => (s === null ? [] : [s.id])))

  const pool = candidates.filter((s) => isKeyboard(s.program))
  const ranked = [...(pool.length >= 2 ? pool : candidates)].sort(
    (a, b) => b.medianPitch - a.medianPitch,
  )
  right ??= ranked.find((s) => s !== left) ?? null
  // A lone voice is a right candidate, never both hands' left.
  if (ranked.length >= 2) left ??= [...ranked].reverse().find((s) => s !== right) ?? null
  if (
    right !== null &&
    left !== null &&
    right.medianPitch < left.medianPitch &&
    !named.has(right.id) &&
    !named.has(left.id)
  ) {
    ;[right, left] = [left, right]
  }

  for (const s of candidates) {
    if (s !== right && s !== left) {
      guess(s, 'other', 0.3, ['Not selected as either hand'])
      continue
    }
    const role = s === right ? 'right' : 'left'
    const other = s === right ? left : right
    const reasons: string[] = []
    let confidence = 0.3
    if (named.has(s.id)) {
      reasons.push(`Track name "${s.trackName}" suggests the ${role} hand`)
      confidence = 0.85
    }
    if (other !== null) {
      const apart = Math.abs(s.medianPitch - other.medianPitch)
      reasons.push(
        `Median pitch ${s.medianPitch} vs ${other.medianPitch} for the other hand (${apart} semitones apart)`,
      )
      confidence = Math.max(confidence, Math.min(0.9, 0.4 + apart / 30))
    } else {
      reasons.push('Only one keyboard voice found')
    }
    if (!isKeyboard(s.program)) {
      reasons.push('Not a keyboard instrument')
      confidence *= 0.7
    }
    guess(s, role, confidence, reasons)
  }

  const ordered = stats.map((s) => guesses.get(s.id) as VoiceGuess)
  const combined = ordered.filter((g) => g.role === 'both').map((g) => g.voiceId)
  return {
    guesses: ordered,
    right: right?.id ?? null,
    left: left?.id ?? null,
    combined,
    named: [...named],
    summary: summarise(right, left, combined, stats, named),
  }
}

/** HD brief §5.2: evidence that one voice holds both hands. */
function bothHandsScore(s: VoiceStats): { score: number; reasons: string[] } {
  const reasons: string[] = []
  const range = s.p90 - s.p10
  let score = 0
  if (s.wideSpanRatio > 0.15) {
    score += Math.min(0.5, s.wideSpanRatio * 1.2)
    reasons.push(
      `${Math.round(s.wideSpanRatio * 100)}% of onsets span more than one hand can reach`,
    )
  }
  if (range >= 28) {
    score += Math.min(0.3, (range - 24) / 40)
    reasons.push(`Wide core range (${range} semitones between 10th and 90th percentile)`)
  }
  if (s.histogramGap >= 4) {
    score += Math.min(0.2, s.histogramGap / 30)
    reasons.push(`Pitch histogram has a ${s.histogramGap}-semitone hole, suggesting two registers`)
  }
  if (s.avgPolyphony >= 2.5) {
    score += 0.1
    reasons.push(`Dense texture (avg ${s.avgPolyphony.toFixed(1)} notes sounding)`)
  }
  if (RIGHT_NAME.test(s.trackName) || LEFT_NAME.test(s.trackName)) score -= 0.4
  return { score, reasons }
}

/** HD brief §5.5. */
function summarise(
  right: VoiceStats | null,
  left: VoiceStats | null,
  combinedIds: readonly string[],
  stats: readonly VoiceStats[],
  named: ReadonlySet<string>,
): string {
  const label = (s: VoiceStats) =>
    `track ${s.track} ch ${s.channel}${s.trackName === '' ? '' : ` ("${s.trackName}")`}`
  const combined = stats
    .filter((s) => combinedIds.includes(s.id))
    .map(label)
    .join(', ')
  if (right !== null && left !== null) {
    const base = `Hands look separate already: right hand is ${label(right)}, left hand is ${label(left)}.`
    return combined === '' ? base : `${base} ${combined} also looks two-handed.`
  }
  if (combined !== '')
    return `Both hands appear to share ${combined}. Pick a split algorithm below.`
  const only = right ?? left
  if (only === null) return 'No piano-like voices found.'
  const kept = named.has(only.id)
    ? `Its name says it is the ${only === right ? 'right' : 'left'} hand.`
    : 'It is set to Split in case it holds both hands.'
  return `Only one playable voice, ${label(only)}. ${kept}`
}
