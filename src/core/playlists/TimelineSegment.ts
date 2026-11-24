/** One song's place in a playlist timeline: its deck (0 or 1, alternating) and its span. */
export interface PlaylistTimelineSegment {
  readonly deck: number
  /** Where the song starts and ends (its last release) in the timeline, in seconds and ticks. */
  readonly startSec: number
  readonly endSec: number
  readonly startTick: number
  readonly endTick: number
}
