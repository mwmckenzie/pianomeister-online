export interface ChannelInfo {
  readonly channel: number
  readonly noteCount: number
  /** Lowest and highest MIDI note on the channel. */
  readonly minPitch: number
  readonly maxPitch: number
  /** Mean MIDI note number, for picking hands when channels 0 and 1 are empty. */
  readonly averagePitch: number
}
