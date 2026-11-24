/**
 * The background detection pass: one song at a time, after the app is idle, never while a song
 * plays. Returns the songs it detected; a song that fails is reported and skipped.
 */
export async function runHandsPass(options: {
  readonly songIds: readonly string[]
  readonly isPlaying: () => boolean
  /** Resolves when the browser has time. */
  readonly idle: () => Promise<void>
  /** Resolves after a while, while a song plays. */
  readonly wait: () => Promise<void>
  /** Returns false when the song is gone. */
  readonly detect: (songId: string) => Promise<boolean>
  readonly onFailed?: (songId: string, error: unknown) => void
}): Promise<string[]> {
  const detected: string[] = []
  for (const songId of options.songIds) {
    await options.idle()
    while (options.isPlaying()) await options.wait()
    try {
      if (await options.detect(songId)) detected.push(songId)
    } catch (e) {
      options.onFailed?.(songId, e)
    }
  }
  return detected
}
