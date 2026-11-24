import type { HandExportOptions } from '@/core/hands/applyHandAssignment'
import type { CachedHands } from '@/core/hands/CachedHands'
import type { DetectedHands } from '@/core/hands/DetectedHands'
import type { HandReview } from '@/core/hands/HandReview'
import type { HandSettings } from '@/core/hands/HandSettings'

export type HandsRequest =
  | { readonly kind: 'detect'; readonly bytes: Uint8Array; readonly algorithm: string }
  | {
      readonly kind: 'resolve' | 'review'
      readonly bytes: Uint8Array
      readonly settings: HandSettings
    }
  | {
      readonly kind: 'export'
      readonly bytes: Uint8Array
      readonly settings: HandSettings
      readonly options: HandExportOptions
    }

export type HandsResult = DetectedHands | CachedHands | HandReview | Uint8Array

export type HandsReply =
  | { readonly id: number; readonly result: HandsResult }
  | { readonly id: number; readonly error: string }
