/** One use's diagonal stripes (brief decision 112); colours are hex. */
export interface StripeStyle {
  /** 'note' and 'darker' follow each note's colour; 'custom' uses the hex colour. */
  readonly a: { readonly mode: 'note' | 'darker' | 'custom'; readonly color: string }
  readonly b: { readonly mode: 'note' | 'darker' | 'custom'; readonly color: string }
  readonly aOpacity: number
  readonly bOpacity: number
  /** World units per stripe. */
  readonly width: number
  /** Share of each pair that is stripe A. */
  readonly balance: number
  readonly angleDeg: number
  readonly drift: boolean
}
