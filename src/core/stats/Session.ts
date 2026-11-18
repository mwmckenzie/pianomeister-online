/** A practice session (brief decision 5): ends at the last playback before a 10-minute gap. */
export interface Session {
  readonly id: string
  readonly profileId: string
  /** Epoch ms. */
  readonly startedAt: number
  /** The last playback so far. */
  readonly endedAt: number
}
