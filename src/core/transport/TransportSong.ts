import type { HandNote } from '../hands/HandNote'
import type { BarMap } from '../timing/BarMap'
import type { TempoMap } from '../timing/TempoMap'

/** What the transport plays. Rebuild it (and call setSong) when the meter override or hands change. */
export interface TransportSong {
  readonly notes: readonly HandNote[]
  readonly tempoMap: TempoMap
  readonly barMap: BarMap
  /** Playback auto-stops here when no loop is set (normally the song's last note-off). */
  readonly endTick: number
}
