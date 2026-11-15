import type { PreRollMode } from './PreRollMode'

export interface PreRollConfig {
  readonly beats: number
  readonly mode: PreRollMode
  readonly metronome: boolean
}
