/** Note counts per hand and the pitch range across both hands (MIDI notes; null when silent). */
export interface HandNoteSummary {
  readonly right: number
  readonly left: number
  readonly lowest: number | null
  readonly highest: number | null
}
