/** What detection knows about one voice (HD brief §3, §4.2). */
export interface VoiceStats {
  readonly id: string
  readonly track: number
  readonly channel: number
  /** The track's name meta event, or ''. */
  readonly trackName: string
  /** First program change (0-based GM), or undefined. */
  readonly program: number | undefined
  readonly noteCount: number
  readonly minPitch: number
  readonly maxPitch: number
  readonly meanPitch: number
  readonly medianPitch: number
  readonly p10: number
  readonly p90: number
  /** Notes sounding at each onset. */
  readonly avgPolyphony: number
  readonly maxPolyphony: number
  /** Fraction of onsets whose sounding notes span more than ONE_HAND_REACH. */
  readonly wideSpanRatio: number
  /** Longest run of unused semitones between p10 and p90. */
  readonly histogramGap: number
}
