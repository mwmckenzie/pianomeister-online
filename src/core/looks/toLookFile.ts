import { SETTINGS_VERSION } from '../settings/loadSettings'
import { COST_KEYS } from './COST_KEYS'
import type { Look } from './Look'
import type { LookFile } from './LookFile'
import type { LookFileEntry } from './LookFileEntry'

/**
 * Looks as a `.pmlook.json` file (Copy look, Export; milestone 9.1, section A). Values are
 * nested by section, the shape stored settings have, so an import validates them the same way.
 * Device cost is never written.
 */
export function toLookFile(looks: readonly Look[]): LookFile {
  return { format: 'pianomeister-look', version: SETTINGS_VERSION, looks: looks.map(toLookEntry) }
}

/** One look as a file entry (also the backup's form of a saved look). */
export function toLookEntry(look: Look): LookFileEntry {
  const settings: Record<string, Record<string, unknown>> = {}
  for (const [key, value] of Object.entries(look.values)) {
    if (COST_KEYS.has(key as keyof Look['values'])) continue
    const [section, field] = key.split('.') as [string, string]
    settings[section] ??= {}
    settings[section][field] = value
  }
  return { id: look.id, name: look.name, createdAt: look.createdAt, settings }
}
