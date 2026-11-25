import type { NotePalette } from '../settings/NotePalette'

/** The built-in note colour sets, in list order. */
export const BUILT_IN_COLOUR_SETS: readonly { readonly id: NotePalette; readonly name: string }[] =
  [
    { id: 'default', name: 'Default' },
    { id: 'warm', name: 'Warm' },
    { id: 'cool', name: 'Cool' },
    { id: 'neon', name: 'Neon' },
    { id: 'pastel', name: 'Pastel' },
    { id: 'mono', name: 'Mono' },
    { id: 'twoTone', name: 'Two-tone' },
  ]
