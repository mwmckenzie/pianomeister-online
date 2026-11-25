const HEX = /^#?([0-9a-f]{6})$/i

/** `#rrggbb` or `rrggbb` in any case as `#RRGGBB`; anything else is null. */
export function parseHex(text: string): string | null {
  const match = HEX.exec(text.trim())
  return match === null ? null : `#${(match[1] as string).toUpperCase()}`
}
