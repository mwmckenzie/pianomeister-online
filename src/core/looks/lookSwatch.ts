import type { NoteColourSets } from '../color/NoteColourSets'
import { notePaletteColors } from '../color/notePaletteColors'
import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import type { Look } from './Look'
import { lookSettings } from './lookValues'

/**
 * The one colour that stands for a look in lists (the playlists' look dots, milestone 9.5): the C
 * of its note colours (the mono or white-key colour, unless the player changed it).
 */
export function lookSwatch(look: Look, sets: NoteColourSets): string {
  return notePaletteColors(lookSettings(DEFAULT_SETTINGS, look).notes, sets)[0] ?? '#8AB4FF'
}
