/** A confidence as shown: a whole percent. */
export function confidencePercent(confidence: number): number {
  return Math.round(confidence * 100)
}
