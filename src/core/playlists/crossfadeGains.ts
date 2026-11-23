/**
 * Equal-power crossfade at `progress` 0..1 through the overlap (milestone 9.5 D2): the ending
 * song's gain falls as cos, the next song's rises as sin, so the loudness stays even.
 */
export function crossfadeGains(progress: number): { readonly out: number; readonly in: number } {
  const t = Math.min(1, Math.max(0, progress))
  return { out: Math.cos((t * Math.PI) / 2), in: Math.sin((t * Math.PI) / 2) }
}
