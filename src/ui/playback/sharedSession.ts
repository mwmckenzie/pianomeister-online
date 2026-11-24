import { PlaybackSession } from './PlaybackSession'

let session: PlaybackSession | null = null

/**
 * The app's one playback session (brief decision 38). Created on first use and kept for the
 * page's lifetime, so moving between the player, library and debug page doesn't reload the
 * piano samples or open another AudioContext.
 */
export function sharedSession(): PlaybackSession {
  session ??= new PlaybackSession()
  return session
}

/** Whether a song is playing; never creates the session. */
export function songIsPlaying(): boolean {
  return session?.transport.state === 'playing'
}
