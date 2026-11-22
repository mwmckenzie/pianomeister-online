import { SETTINGS_VERSION } from '../settings/loadSettings'
import type { Look } from './Look'
import type { LookFile } from './LookFile'
import type { LookFileEntry } from './LookFileEntry'

/**
 * Looks as a `.pmlook.json` file (Copy look, and export from milestone 9.1). Values are
 * nested by section, the shape stored settings have, so an import validates them the same way.
 */
export function toLookFile(
  looks: readonly { readonly look: Look; readonly createdAt: string }[],
): LookFile {
  return {
    format: 'pianomeister-look',
    version: SETTINGS_VERSION,
    looks: looks.map(({ look, createdAt }) => entry(look, createdAt)),
  }
}

function entry(look: Look, createdAt: string): LookFileEntry {
  const settings: Record<string, Record<string, unknown>> = {}
  for (const [key, value] of Object.entries(look.values)) {
    const [section, field] = key.split('.') as [string, string]
    settings[section] ??= {}
    settings[section][field] = value
  }
  return { id: look.id, name: look.name, createdAt, settings }
}
