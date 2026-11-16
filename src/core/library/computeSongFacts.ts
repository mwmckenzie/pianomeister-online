import type { Song } from '../song/Song'
import { BarMap } from '../timing/BarMap'
import type { SongFacts } from './SongFacts'

const DEFAULT_MICROS_PER_QUARTER = 500_000

const round = (value: number, digits: number) => {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

export function computeSongFacts(song: Song): SongFacts {
  const signatures: string[] = []
  for (const e of song.timeSignatureEvents) {
    const label = `${e.numerator}/${e.denominator}`
    if (signatures[signatures.length - 1] !== label) signatures.push(label)
  }
  const first = song.tempoEvents.find((e) => e.tick === 0) ?? song.tempoEvents[0]
  return {
    durationSeconds: round(song.durationSeconds, 3),
    durationTicks: song.durationTicks,
    ppq: song.ppq,
    bars: BarMap.fromSong(song, null).barCount,
    timeSignatures: signatures.length > 0 ? signatures : ['4/4'],
    bpm: round(60e6 / (first?.microsPerQuarter ?? DEFAULT_MICROS_PER_QUARTER), 2),
  }
}
