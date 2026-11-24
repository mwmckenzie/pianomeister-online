import type { CachedHands } from '@/core/hands/CachedHands'
import { detectSongHands } from '@/core/hands/detectSongHands'
import type { DetectedHands } from '@/core/hands/DetectedHands'
import { resolveSongHands } from '@/core/hands/resolveSongHands'

import type { HandsRequest } from './HandsWorkerMessage'

export function answerHandsRequest(request: HandsRequest): DetectedHands | CachedHands {
  return request.kind === 'detect'
    ? detectSongHands(request.bytes, request.algorithm)
    : resolveSongHands(request.bytes, request.settings)
}
