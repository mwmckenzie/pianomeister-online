import type { PlayerSettings } from './PlayerSettings'
import type { SettingHome } from './SettingHome'

/**
 * How a number is shown: `mm` = world units × 23.5 (one white key is 23.5 mm), `percent` =
 * × 100, `wholePercent` = the number itself with "%", `seconds` = "2.5 s". The stored value is always the raw number.
 */
export type SettingUnit =
  'none' | 'mm' | 'percent' | 'wholePercent' | 'deg' | 'beats' | 'times' | 'px' | 'seconds' | 'ms'

interface BaseSetting<V> {
  readonly label: string
  readonly default: V
  /** The default on a tablet, where it differs (brief decision 110). */
  readonly tabletDefault?: V
  readonly home: SettingHome
  /** Subheading inside its section; consecutive settings with the same group share it. */
  readonly group?: string
  /** Hidden while it has no effect (e.g. edge size with square edges). */
  readonly visible?: (settings: PlayerSettings) => boolean
  /** Shown but disabled while it has no effect (e.g. the idle delay with hiding off). */
  readonly enabled?: (settings: PlayerSettings) => boolean
}

export interface NumberSetting extends BaseSetting<number> {
  readonly kind: 'number'
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit: SettingUnit
  /** Decimals shown (mm picks its own: 0 from 10 mm up, else 1). */
  readonly digits: number
}

export interface BooleanSetting extends BaseSetting<boolean> {
  readonly kind: 'boolean'
}

export interface ChoiceSetting<V extends string> extends BaseSetting<V> {
  readonly kind: 'choice'
  readonly options: readonly { readonly value: V; readonly label: string }[]
  /** Segmented buttons (default) or a drop-down select. */
  readonly control?: 'segmented' | 'select'
}

/** A #RRGGBB colour. */
export interface ColorSetting extends BaseSetting<string> {
  readonly kind: 'color'
}

/** The definition matching a value type (non-distributive, so unions stay one choice). */
export type SettingDefinition<V> = [V] extends [number]
  ? NumberSetting
  : [V] extends [boolean]
    ? BooleanSetting
    : [V] extends [string]
      ? string extends V
        ? ColorSetting
        : ChoiceSetting<V>
      : never

export type AnySettingDefinition =
  NumberSetting | BooleanSetting | ChoiceSetting<string> | ColorSetting
