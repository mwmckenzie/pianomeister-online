/**
 * True when a key press types a character (no Ctrl, Alt or Meta, or AltGr). In a text field such a key
 * belongs to the text, never to a list command bound to that character (decision 60).
 */
export function typesText(event: KeyboardEvent): boolean {
  if (event.metaKey || [...event.key].length !== 1) return false
  // AltGr (reported as Ctrl+Alt) types characters too: "[" or "@" on a German keyboard.
  return event.ctrlKey === event.altKey
}
