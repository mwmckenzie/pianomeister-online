import type { SongMetaEdit } from './SongMetaEdit'
import type { SongMetaFields } from './SongMetaFields'

/** The edit's fields win where present. "Reset to original" deletes the edit. */
export function mergeMeta(original: SongMetaFields, edit: SongMetaEdit | null): SongMetaFields {
  return {
    title: edit?.title ?? original.title,
    composer: edit?.composer ?? original.composer,
    tags: edit?.tags ?? original.tags,
  }
}
