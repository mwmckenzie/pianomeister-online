import type { VoiceStats } from './VoiceStats'

/** What the Library shows of a voice. */
export type VoiceInfo = Pick<
  VoiceStats,
  'id' | 'track' | 'channel' | 'trackName' | 'program' | 'noteCount'
>
