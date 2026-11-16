import type { SongMetaEdit } from '@/core/library/SongMetaEdit'

/** The user's metadata edits for one song; no row means the original metadata. */
export interface StoredSongMeta {
  readonly songId: string
  readonly edit: SongMetaEdit
}
