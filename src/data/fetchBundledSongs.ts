import type { SongManifest } from '@/core/library/SongManifest'

import type { BundledSongs } from './BundledSongs'

/** Bundled songs served from public/songs/ under the site's base path. */
export function fetchBundledSongs(baseUrl: string): BundledSongs {
  const get = async (fileName: string) => {
    const response = await fetch(`${baseUrl}songs/${encodeURIComponent(fileName)}`)
    if (!response.ok) throw new Error(`Couldn't load ${fileName} (HTTP ${response.status})`)
    return response
  }
  return {
    manifest: async () => (await (await get('manifest.json')).json()) as SongManifest,
    bytes: async (fileName) => new Uint8Array(await (await get(fileName)).arrayBuffer()),
  }
}
