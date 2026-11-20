/** What a chart's tooltip shows, and where (px inside the chart's box, at the mark's top centre). */
export interface ChartTip {
  readonly value: string
  readonly label: string
  readonly x: number
  readonly y: number
}
