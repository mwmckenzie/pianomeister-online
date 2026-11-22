import type { AnySettingDefinition } from './SettingDefinition'

const COLOR = /^#[0-9a-f]{6}$/i

/**
 * A stored value made valid for its setting: numbers clamped to the range, choices listed,
 * colours well-formed (upper case); anything else is the fallback (the default).
 */
export function coerceSetting(
  value: unknown,
  def: AnySettingDefinition,
  fallback: unknown = def.default,
): unknown {
  switch (def.kind) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
      return Math.min(def.max, Math.max(def.min, value))
    case 'boolean':
      return typeof value === 'boolean' ? value : fallback
    case 'choice':
      return def.options.some((o) => o.value === value) ? value : fallback
    case 'color':
      return typeof value === 'string' && COLOR.test(value) ? value.toUpperCase() : fallback
  }
}
