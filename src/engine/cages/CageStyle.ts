import type { NoteFill } from '@/core/settings/NoteFill'

/** How a cage looks (brief decision 115). Colours are hex; widths and radius world units. */
export interface CageStyle {
  readonly fill: NoteFill
  readonly fillColor: string
  readonly fillOpacity: number
  readonly border: boolean
  readonly borderColor: string
  readonly borderWidth: number
  /** Strength on the glow layer (0 = the border doesn't bloom). */
  readonly borderGlow: number
  readonly cornerRadius: number
}
