/** A value a SettingRow shows and edits instead of the stored setting. */
export interface SettingOverride {
  readonly value: unknown
  /** The reset icon is lit (it resets to something other than what's shown). */
  readonly changed: boolean
  set(value: unknown): void
  reset(): void
}
