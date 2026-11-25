import type { QualityPreset } from '../settings/QualityPreset'
import type { SettingKey } from '../settings/SettingKey'

/** What is played while a cell is measured. `idle` is the player paused. */
export type BenchSegment =
  'dense' | 'normal' | 'light' | 'loop' | 'crossfade' | 'pauseResume' | 'idle'

export type BenchSuite = 'smoke' | 'standard' | 'full'

/** One thing to measure: a look at a quality preset over a piece of music. */
export interface BenchCell {
  readonly look: string
  readonly quality: QualityPreset
  readonly segment: BenchSegment
  /** A feature probe's name ("no bloom", "fill smoke"), or null. */
  readonly probe: string | null
  /** Settings on top of the look and preset. */
  readonly overrides: Readonly<Partial<Record<SettingKey, unknown>>>
  readonly round: number
}
