import type { Look } from './Look'

/**
 * What reading a `.pmlook.json` file gives: its looks, ready to add (migrated, validated, ids and
 * names made unique), or why nothing can be imported.
 */
export type LookFileResult =
  | { readonly ok: true; readonly looks: readonly Look[] }
  | { readonly ok: false; readonly error: 'notLookFile' | 'newer' | 'empty' }
