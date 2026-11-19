/**
 * A keyboard binding (brief decision 87). `char` matches the character a key types
 * (`KeyboardEvent.key`, case-insensitive), so it works wherever that character is on the
 * user's layout; it never has Ctrl, Alt or Meta, and Shift is folded into the character.
 * `code` matches the physical key (`KeyboardEvent.code`) with exactly these modifiers: Space,
 * arrows, Home/End, F-keys, Enter, and every combo with Ctrl, Alt or Meta.
 */
export interface KeyBinding {
  readonly kind: 'key'
  readonly match: 'char' | 'code'
  /** The lower-case character, or the KeyboardEvent.code. */
  readonly value: string
  readonly ctrl: boolean
  readonly alt: boolean
  readonly shift: boolean
  readonly meta: boolean
}
