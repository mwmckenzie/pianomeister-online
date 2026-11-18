/** The letter shown in a profile's badge: its name's first letter or digit, upper-cased. */
export function profileInitial(name: string): string {
  const letter = [...name.trim()].find((c) => /[\p{L}\p{N}]/u.test(c))
  return (letter ?? '?').toLocaleUpperCase()
}
