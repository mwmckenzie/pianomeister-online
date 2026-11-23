import type { Look } from '../looks/Look'
import type { Playlist } from './Playlist'

/**
 * What reading a `.pmplaylist.json` file gives: the playlists to add (ids and names made unique,
 * look references resolved), the looks to add with them ("Import its looks too"), how many songs
 * aren't in this library (their entries stay as "Missing song"), and how many of the file's
 * looks were offered — or why nothing can be imported.
 */
export type PlaylistFileResult =
  | {
      readonly ok: true
      readonly playlists: readonly Playlist[]
      readonly looks: readonly Look[]
      /** Distinct songs the playlists name that this library doesn't have. */
      readonly missingSongs: number
      /** Saved looks the file carries (for the "Import its looks too" checkbox). */
      readonly lookCount: number
    }
  | { readonly ok: false; readonly error: 'notPlaylistFile' | 'newer' | 'empty' }
