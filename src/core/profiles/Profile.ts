/** A local practice profile (brief decision 65). Settings are device-wide, not per profile. */
export interface Profile {
  readonly id: string
  readonly name: string
  /** One of PROFILE_COLORS, as "#RRGGBB". */
  readonly color: string
  /** Epoch ms. */
  readonly createdAt: number
}
