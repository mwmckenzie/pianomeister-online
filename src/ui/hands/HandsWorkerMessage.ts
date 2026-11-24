import type { CachedHands } from '@/core/hands/CachedHands'
import type { DetectedHands } from '@/core/hands/DetectedHands'
import type { HandSettings } from '@/core/hands/HandSettings'

export type HandsRequest =
  | { readonly kind: 'detect'; readonly bytes: Uint8Array; readonly algorithm: string }
  | { readonly kind: 'resolve'; readonly bytes: Uint8Array; readonly settings: HandSettings }

export type HandsReply =
  | { readonly id: number; readonly result: DetectedHands | CachedHands }
  | { readonly id: number; readonly error: string }
