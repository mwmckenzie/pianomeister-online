/** Bar numbers count from bar 1 (1, 1 + step, 1 + 2·step…); a pickup bar 0 is never numbered. */
export function isLabelledBar(bar: number, step: number): boolean {
  return bar >= 1 && (bar - 1) % step === 0
}
