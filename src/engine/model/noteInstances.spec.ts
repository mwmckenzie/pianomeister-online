// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { assignHands } from '@/core/hands/assignHands'
import type { HandNote } from '@/core/hands/HandNote'
import { importMidi } from '@/core/song/importMidi'
import { applySustain } from '@/core/sustain/applySustain'
import { readFixture } from '@/core/testing/readFixture'

import { keyLayout } from './keyLayout'
import { noteInstances } from './noteInstances'

const note = (midi: number, startTick: number, endTick: number): HandNote => ({
  midi,
  channel: 0,
  startTick,
  endTick,
  soundEndTick: endTick,
  velocity: 90,
  hand: 'right',
})

describe('noteInstances', () => {
  it('builds one instance per assigned note of the Minuet, in its key lane', async () => {
    const song = await importMidi(readFixture('minuet-in-g.mid'), { fileName: 'm' })
    const notes = assignHands(applySustain(song.notes, song.pedalIntervals), {
      right: [0],
      left: [1],
    })
    const instances = noteInstances(notes, song.ppq)
    expect(instances).toHaveLength(408)
    expect(instances.filter((n) => n.hand === 'right')).toHaveLength(258)
    const keys = new Map(keyLayout().map((k) => [k.midi, k]))
    for (const n of instances) {
      expect(n.x).toBe(keys.get(n.midi)?.x)
      expect(n.width).toBe(keys.get(n.midi)?.width)
      expect(n.colorIndex).toBe(n.midi % 12)
      expect(n.velocity).toBeGreaterThan(0)
      expect(n.velocity).toBeLessThanOrEqual(127)
    }
  })

  it('excludes channels assigned to neither hand', async () => {
    const song = await importMidi(readFixture('canon-in-d.mid'), { fileName: 'c' })
    const rightOnly = assignHands(applySustain(song.notes, song.pedalIntervals), {
      right: [0],
      left: [],
    })
    const instances = noteInstances(rightOnly, song.ppq)
    expect(instances).toHaveLength(786)
    expect(instances.every((n) => n.hand === 'right')).toBe(true)
  })

  it('makes the head a 1/64 note (ppq/16), or the whole note if shorter', () => {
    const [long, short] = noteInstances([note(60, 0, 480), note(62, 1000, 1010)], 480)
    expect(long?.headEndTick).toBe(30)
    expect(short?.headEndTick).toBe(1010)
  })

  it('puts white-lane notes before black-lane notes so black ones draw on top', () => {
    const instances = noteInstances([note(61, 0, 10), note(60, 50, 60), note(63, 5, 15)], 480)
    expect(instances.map((n) => [n.midi, n.isBlack])).toEqual([
      [60, false],
      [61, true],
      [63, true],
    ])
  })

  it('drops notes outside the 88 keys', () => {
    const instances = noteInstances([note(20, 0, 10), note(109, 0, 10), note(21, 0, 10)], 480)
    expect(instances.map((n) => n.midi)).toEqual([21])
  })
})
