import type { MeterOverride } from '@/core/timing/MeterOverride'

/** Per song, shared across profiles (brief decision 3). */
export interface StoredMeterOverride {
  readonly songId: string
  readonly override: MeterOverride
}
