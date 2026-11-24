import type { DetectedHands } from '@/core/hands/DetectedHands'

/** Detected hands per song, shared by all profiles and safe to recompute. */
export interface StoredDetection extends DetectedHands {
  readonly songId: string
}
