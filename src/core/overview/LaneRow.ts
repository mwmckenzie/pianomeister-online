/** A bookmark's place in the overview's lanes: its row (0 = top), or hidden past the last row. */
export interface LaneRow {
  readonly id: string
  readonly startBar: number
  readonly endBar: number
  readonly row: number
}
