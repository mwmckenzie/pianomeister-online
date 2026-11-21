import type { LookFileEntry } from './LookFileEntry'

/**
 * A `.pmlook.json` file: one look or many (milestone 9.1, section A). `version` is the settings
 * schema version the values were written with, so an import can migrate older ones.
 */
export interface LookFile {
  readonly format: 'pianomeister-look'
  readonly version: number
  readonly looks: readonly LookFileEntry[]
}
