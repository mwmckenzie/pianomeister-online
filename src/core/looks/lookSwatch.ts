import { notePaletteColors } from '../color/notePaletteColors'
import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import type { Look } from './Look'
import { lookSettings } from './lookValues'

/**
 * The one colour that stands for a look in lists (the playlists' look dots, milestone 9.5): its
 * mono or white-key colour, else the C of its note palette.
 */
export function lookSwatch(look: Look): string {
  const notes = lookSettings(DEFAULT_SETTINGS, look).notes
  if (notes.palette === 'mono') return notes.paletteMono.toUpperCase()
  if (notes.palette === 'twoTone') return notes.paletteWhite.toUpperCase()
  return notePaletteColors(notes)[0] ?? '#8AB4FF'
}
