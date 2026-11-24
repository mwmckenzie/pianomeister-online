import { summariseChannels } from '../song/summariseChannels'
import { readMidiFile } from '../midi/readMidiFile'
import { computeVoiceStats } from './computeVoiceStats'
import { defaultHands } from './defaultHands'
import type { DetectedHands } from './DetectedHands'
import { detectHands } from './detectHands'
import { DETECTOR_VERSION } from './DETECTOR_VERSION'
import { extractNotes } from './extractNotes'
import type { HandSettings } from './HandSettings'
import { initialRoles } from './initialRoles'
import { resolveFileHands } from './resolveFileHands'
import { songConfidence } from './songConfidence'

/** Detects a file's hands and splits what needs splitting with `algorithm`'s defaults. */
export function detectSongHands(bytes: Uint8Array, algorithm: string): DetectedHands {
  const file = readMidiFile(bytes)
  const notes = extractNotes(file)
  const stats = computeVoiceStats(file, notes)
  // The channels as the app sees them: zero-length notes aren't played.
  const channels = summariseChannels(notes.filter((n) => n.endTick > n.startTick))
  const detection = detectHands(stats)
  const roles = initialRoles(detection, stats, defaultHands(channels))
  const settings: HandSettings = { roles, algorithm, params: {}, flips: {} }
  return {
    detectorVersion: DETECTOR_VERSION,
    voices: stats.map(({ id, track, channel, trackName, program, noteCount }) => ({
      id,
      track,
      channel,
      trackName,
      program,
      noteCount,
    })),
    guesses: detection.guesses,
    summary: detection.summary,
    settings,
    confidence: songConfidence(detection, roles),
    resolved: resolveFileHands(file, notes, settings),
  }
}
