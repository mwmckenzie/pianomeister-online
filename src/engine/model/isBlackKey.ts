const BLACK_PITCH_CLASSES: ReadonlySet<number> = new Set([1, 3, 6, 8, 10])

export function isBlackKey(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(((midi % 12) + 12) % 12)
}
