import { Midi } from '@tonejs/midi'

import { buildSmf, ev } from './buildSmf'

/**
 * Synthetic MIDI files with exactly known bar boundaries (docs/milestones/m1.md, fixtures 1–6).
 * @tonejs/midi writes 480 ppq, format 1, one channel per track; the rest use the raw builder.
 */
export const synthFixtures = {
  /** 1. Type 0: one track, right hand on ch0 and left hand on ch1, 4/4 at 120 BPM, 2 bars. */
  type0(): Uint8Array {
    return buildSmf({
      format: 0,
      ppq: 480,
      tracks: [
        [
          ev.trackName(0, 'Type Zero'),
          ev.tempo(0, 500_000),
          ev.timeSignature(0, 4, 4),
          ev.noteOn(0, 0, 72),
          ev.noteOn(0, 1, 48),
          ev.noteOff(480, 0, 72),
          ev.noteOn(480, 0, 74),
          ev.noteOff(960, 0, 74),
          ev.noteOff(1920, 1, 48),
          ev.noteOn(1920, 1, 43),
          ev.noteOff(3840, 1, 43),
        ],
      ],
    })
  },

  /**
   * 2. 120 ppq, conductor track (tempo/meta only), notes split over two tracks with mixed
   * channels (ch0 appears in both), and one empty track. 3/4 at 90 BPM.
   */
  conductorAndSplitTracks(): Uint8Array {
    return buildSmf({
      format: 1,
      ppq: 120,
      tracks: [
        [ev.trackName(0, 'Conductor'), ev.tempo(0, 666_667), ev.timeSignature(0, 3, 4)],
        [ev.noteOn(0, 0, 76), ev.noteOff(120, 0, 76), ev.noteOn(0, 1, 52), ev.noteOff(360, 1, 52)],
        [
          ev.noteOn(120, 0, 77),
          ev.noteOff(240, 0, 77),
          ev.noteOn(360, 1, 50),
          ev.noteOff(720, 1, 50),
        ],
        [],
      ],
    })
  },

  /** 3. 3/4 with a one-beat pickup: first note at tick 0, bar 1 at tick 480, 3 full bars after. */
  pickup(): Uint8Array {
    const midi = new Midi()
    midi.header.tempos.push({ ticks: 0, bpm: 120 })
    // The file (wrongly, as is common) starts its 3/4 bars at tick 0.
    midi.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 4] })
    midi.header.update()
    const track = midi.addTrack()
    track.addNote({ midi: 67, ticks: 0, durationTicks: 480, velocity: 0.8 })
    for (let beat = 0; beat < 9; beat++) {
      track.addNote({ midi: 72, ticks: 480 + beat * 480, durationTicks: 480, velocity: 0.8 })
    }
    return midi.toArray()
  },

  /** 4. 4/4 for 2 bars, 3/4 for 2 bars, 4/4 for 2 bars: bar starts 0, 1920, 3840, 5280, 6720, 8640. */
  meterChanges(): Uint8Array {
    const midi = new Midi()
    midi.header.tempos.push({ ticks: 0, bpm: 120 })
    midi.header.timeSignatures.push(
      { ticks: 0, timeSignature: [4, 4] },
      { ticks: 3840, timeSignature: [3, 4] },
      { ticks: 6720, timeSignature: [4, 4] },
    )
    midi.header.update()
    const track = midi.addTrack()
    track.addNote({ midi: 60, ticks: 0, durationTicks: 10560, velocity: 0.8 })
    return midi.toArray()
  },

  /** 5. No tempo or time-signature events: defaults are 120 BPM and 4/4. */
  noMeta(): Uint8Array {
    const midi = new Midi()
    const track = midi.addTrack()
    track.addNote({ midi: 60, ticks: 0, durationTicks: 960, velocity: 0.5 })
    track.addNote({ midi: 62, ticks: 1920, durationTicks: 1920, velocity: 0.5 })
    return midi.toArray()
  },

  /** 6. Overlapping same-pitch notes on one channel, plus a zero-length note to drop. */
  overlapping(): Uint8Array {
    const midi = new Midi()
    const track = midi.addTrack()
    track.addNote({ midi: 64, ticks: 0, durationTicks: 480, velocity: 1 })
    track.addNote({ midi: 64, ticks: 240, durationTicks: 480, velocity: 64 / 127 })
    track.addNote({ midi: 65, ticks: 960, durationTicks: 0, velocity: 1 })
    return midi.toArray()
  },

  /** Note-offs written as velocity-0 note-ons with running status. */
  velocityZeroNoteOffs(): Uint8Array {
    return buildSmf({
      format: 0,
      ppq: 96,
      tracks: [
        [
          { tick: 0, bytes: [0x90, 60, 100] },
          { tick: 0, bytes: [64, 90] },
          { tick: 96, bytes: [60, 0] },
          { tick: 192, bytes: [64, 0] },
        ],
      ],
    })
  },

  /**
   * Pedal fixtures (480 ppq, 120 BPM, 4/4). Pedal down spans several notes on ch0, with a
   * repeated "down" in the middle that must be ignored, then a note after the pedal is up.
   */
  pedalSpan(): Uint8Array {
    return buildSmf({
      format: 0,
      ppq: 480,
      tracks: [
        [
          ev.cc(0, 0, 64, 127),
          ev.noteOn(0, 0, 60),
          ev.noteOff(240, 0, 60),
          ev.noteOn(480, 0, 64),
          ev.cc(600, 0, 64, 100),
          ev.noteOff(720, 0, 64),
          ev.noteOn(960, 0, 67),
          ev.noteOff(1200, 0, 67),
          ev.cc(1440, 0, 64, 0),
          ev.noteOn(1920, 0, 72),
          ev.noteOff(2160, 0, 72),
        ],
      ],
    })
  },

  /** C4 struck twice under one pedal; a D4 alongside keeps ringing to pedal-up. */
  restruckUnderPedal(): Uint8Array {
    return buildSmf({
      format: 0,
      ppq: 480,
      tracks: [
        [
          ev.cc(0, 0, 64, 127),
          ev.noteOn(0, 0, 60),
          ev.noteOn(0, 0, 62),
          ev.noteOff(240, 0, 60),
          ev.noteOff(240, 0, 62),
          ev.noteOn(960, 0, 60),
          ev.noteOff(1200, 0, 60),
          ev.cc(1920, 0, 64, 0),
        ],
      ],
    })
  },

  /**
   * Pedal on ch0 only, written in its own track with no notes (tonejs would misread its
   * channel), using the exact 64/63 threshold values. The ch1 note must not be sustained.
   */
  pedalOneChannel(): Uint8Array {
    return buildSmf({
      format: 1,
      ppq: 480,
      tracks: [
        [ev.tempo(0, 500_000)],
        [ev.noteOn(0, 0, 72), ev.noteOff(240, 0, 72), ev.noteOn(0, 1, 48), ev.noteOff(240, 1, 48)],
        [ev.cc(0, 1, 7, 100), ev.cc(0, 0, 64, 64), ev.cc(1920, 0, 64, 63)],
      ],
    })
  },

  /** Pedal goes down at tick 480 and never comes up; the song ends at tick 1920. */
  unterminatedPedal(): Uint8Array {
    return buildSmf({
      format: 0,
      ppq: 480,
      tracks: [
        [
          ev.noteOn(0, 0, 60),
          ev.noteOff(240, 0, 60),
          ev.cc(480, 0, 64, 127),
          ev.noteOn(480, 0, 64),
          ev.noteOff(720, 0, 64),
          ev.noteOn(1680, 0, 67),
          ev.noteOff(1920, 0, 67),
        ],
      ],
    })
  },
}
