import type { ChannelInfo } from '../song/ChannelInfo'
import type { MeterSummary } from '../timing/MeterSummary'

/** Summary facts shown in the library list, computed once so listing never parses MIDI. */
export interface SongFacts {
  /**
   * FACTS_VERSION when these facts were computed; missing for facts stored before versioning.
   * Older or missing facts are recomputed (see needsFactsRefresh).
   */
  readonly factsVersion?: number
  readonly durationSeconds: number
  readonly durationTicks: number
  readonly ppq: number
  /** Bar count with the file's own meter (see effectiveBars for overrides). */
  readonly bars: number
  /** Distinct time signatures in order of appearance, e.g. ["3/4"]. */
  readonly timeSignatures: readonly string[]
  /** Tempo at the start of the song. */
  readonly bpm: number
  /**
   * Slowest and fastest tempo up to the song's end (brief decision 56). Missing only for an
   * upload stored before they existed whose file couldn't be re-read: show `bpm` then.
   */
  readonly bpmMin?: number
  readonly bpmMax?: number
  /**
   * Note count and pitch range per channel (with the hand assignment: notes per hand and the
   * range in the picker), and the file's meter (most bars, changes). Missing only for an upload
   * stored before they existed whose file couldn't be re-read.
   */
  readonly channels?: readonly ChannelInfo[]
  readonly meter?: MeterSummary
}
