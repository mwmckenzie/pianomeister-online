import type { ParsedMidi } from '../song/ParsedMidi'
import { tempoRange } from '../timing/tempoRange'
import { BarMap } from '../timing/BarMap'
import { FACTS_VERSION } from './FACTS_VERSION'
import { summariseMeter } from '../timing/summariseMeter'
import type { SongFacts } from './SongFacts'

const DEFAULT_MICROS_PER_QUARTER = 500_000

const round = (value: number, digits: number) => {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

export function computeSongFacts(song: ParsedMidi): SongFacts {
  const signatures: string[] = []
  for (const e of song.timeSignatureEvents) {
    const label = `${e.numerator}/${e.denominator}`
    if (signatures[signatures.length - 1] !== label) signatures.push(label)
  }
  const range = tempoRange(song.tempoEvents, song.durationTicks, song.ppq)
  const barMap = BarMap.fromSong(song, null)
  const first = song.tempoEvents.find((e) => e.tick === 0) ?? song.tempoEvents[0]
  return {
    factsVersion: FACTS_VERSION,
    durationSeconds: round(song.durationSeconds, 3),
    durationTicks: song.durationTicks,
    ppq: song.ppq,
    bars: barMap.barCount,
    timeSignatures: signatures.length > 0 ? signatures : ['4/4'],
    bpm: round(60e6 / (first?.microsPerQuarter ?? DEFAULT_MICROS_PER_QUARTER), 2),
    bpmMin: round(range.min, 2),
    bpmMax: round(range.max, 2),
    channels: song.channels.map((c) => ({ ...c, averagePitch: round(c.averagePitch, 2) })),
    meter: summariseMeter(barMap),
  }
}
