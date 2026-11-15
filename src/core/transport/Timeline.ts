import type { TransportState } from './TransportState'

/**
 * Clock ↔ song mapping while playing: songTime = songAnchor + (clockTime − clockAnchor) · rate.
 * Milestone 2's audio scheduler uses this to schedule notes ahead of the frame loop.
 */
export interface Timeline {
  readonly state: TransportState
  readonly clockAnchor: number
  readonly songAnchor: number
  readonly rate: number
}
