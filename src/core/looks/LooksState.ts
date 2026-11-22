import type { Look } from './Look'

/**
 * Saved looks and the one picked last (null = none picked since the defaults), device-wide
 * beside the settings (brief decision 121).
 */
export interface LooksState {
  readonly active: string | null
  readonly saved: readonly Look[]
}
