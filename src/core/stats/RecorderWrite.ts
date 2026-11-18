import type { PlayRecord } from './PlayRecord'
import type { Session } from './Session'

/** What the play recorder asks to be stored: both rows are upserts by id. */
export interface RecorderWrite {
  readonly record: PlayRecord
  readonly session: Session
}
