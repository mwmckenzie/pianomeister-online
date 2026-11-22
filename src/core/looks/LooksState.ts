import type { Look } from './Look'

/**
 * Saved looks and the one picked last (null = none picked since the defaults), device-wide
 * (brief decision 121): saved looks in the database, the picked id beside the settings.
 */
export interface LooksState {
  readonly active: string | null
  readonly saved: readonly Look[]
}
