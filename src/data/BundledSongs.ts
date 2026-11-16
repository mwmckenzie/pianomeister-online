import type { SongManifest } from '@/core/library/SongManifest'

/** Where bundled songs come from: fetched in the app, read from disk in tests. */
export interface BundledSongs {
  manifest(): Promise<SongManifest>
  bytes(fileName: string): Promise<Uint8Array>
}
