import type { Look } from './Look'

/**
 * What reading a `.pmlook.json` file gives: its looks, ready to add (migrated, validated, ids and
 * names made unique), or why nothing can be imported.
 */
export type LookFileResult =
  | {
      readonly ok: true
      readonly looks: readonly Look[]
      /** Looks already here (backup import only). */
      readonly skipped: number
      /** Each file look's id → its id here (references to it follow, e.g. playlists). */
      readonly idMap: ReadonlyMap<string, string>
    }
  | { readonly ok: false; readonly error: 'notLookFile' | 'newer' | 'empty' }
