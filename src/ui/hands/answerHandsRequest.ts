import { detectSongHands } from '@/core/hands/detectSongHands'
import { exportSongHands } from '@/core/hands/exportSongHands'
import { resolveSongHands } from '@/core/hands/resolveSongHands'
import { reviewSongHands } from '@/core/hands/reviewSongHands'

import type { HandsRequest, HandsResult } from './HandsWorkerMessage'

export function answerHandsRequest(request: HandsRequest): HandsResult {
  switch (request.kind) {
    case 'detect':
      return detectSongHands(request.bytes, request.algorithm)
    case 'resolve':
      return resolveSongHands(request.bytes, request.settings)
    case 'review':
      return reviewSongHands(request.bytes, request.settings)
    case 'export':
      return exportSongHands(request.bytes, request.settings, request.options)
  }
}
