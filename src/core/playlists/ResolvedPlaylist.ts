/**
 * A playlist as the UI and listening read it: each entry with its song (or missing), and the
 * look in effect (the entry's override, else the playlist's; null = Current look), with a flag
 * when a look it named is gone (shown as a small hint).
 */
export interface ResolvedPlaylist {
  readonly lookId: string | null
  readonly lookMissing: boolean
  readonly entries: readonly {
    readonly songId: string
    readonly missing: boolean
    /** The entry's own override (null = the playlist's look). */
    readonly override: string | null
    readonly overrideMissing: boolean
    /** The look this song plays with: the override, else the playlist's; null = Current look. */
    readonly lookId: string | null
    readonly durationSec: number
  }[]
  /** Total length of the songs that exist. */
  readonly durationSec: number
}
