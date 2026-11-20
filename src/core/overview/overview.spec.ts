import { describe, expect, it } from 'vitest'

import { BarMap } from '../timing/BarMap'
import { barAtTick } from './barAtTick'
import { clampView } from './clampView'
import { followView } from './followView'
import { hitTest } from './hitTest'
import type { HitTarget } from './HitTarget'
import { isLabelledBar } from './isLabelledBar'
import { labelStep } from './labelStep'
import { layoutBars } from './layoutBars'
import { moveBarCursor } from './moveBarCursor'
import { moveRange } from './moveRange'
import { notesInView } from './notesInView'
import { pitchRange } from './pitchRange'
import { playFromBar } from './playFromBar'
import { resizeRange } from './resizeRange'
import { snapSelection } from './snapSelection'
import { stackLanes } from './stackLanes'
import { viewForBars } from './viewForBars'
import { zoomAround } from './zoomAround'

const PPQ = 480
const BAR_44 = 4 * PPQ
const BAR_34 = 3 * PPQ

/** 8 bars of 4/4, then 4 bars of 3/4. */
const meterChange = BarMap.fromSong(
  {
    ppq: PPQ,
    durationTicks: 8 * BAR_44 + 4 * BAR_34,
    timeSignatureEvents: [
      { tick: 0, numerator: 4, denominator: 4 },
      { tick: 8 * BAR_44, numerator: 3, denominator: 4 },
    ],
  },
  null,
)

/** 16 bars of 4/4 with a one-beat pickup (bar 1 starts at beat 2). */
const pickup = BarMap.fromSong(
  { ppq: PPQ, durationTicks: PPQ + 16 * BAR_44, timeSignatureEvents: [] },
  { timeSignature: { numerator: 4, denominator: 4 }, barOneStartTick: PPQ },
)

/** 64 bars of 4/4. */
const plain = BarMap.fromSong(
  { ppq: PPQ, durationTicks: 64 * BAR_44, timeSignatureEvents: [] },
  null,
)

describe('layoutBars', () => {
  it('gives each bar its true width across a meter change', () => {
    const layout = layoutBars(meterChange)
    expect(layout.bars).toHaveLength(12)
    expect(layout.bars[7]).toMatchObject({ bar: 8, startTick: 7 * BAR_44, endTick: 8 * BAR_44 })
    expect(layout.bars[8]).toMatchObject({ bar: 9, startTick: 8 * BAR_44 })
    expect(layout.bars[8]?.endTick).toBe(8 * BAR_44 + BAR_34)
    expect(layout.bars[8]?.beatTicks).toEqual([8 * BAR_44 + PPQ, 8 * BAR_44 + 2 * PPQ])
    expect(layout.endTick).toBe(8 * BAR_44 + 4 * BAR_34)
  })

  it('starts with a pickup bar 0, and every 4th bar from bar 1 is strong', () => {
    const layout = layoutBars(pickup)
    expect(layout.firstBar).toBe(0)
    expect(layout.bars[0]).toMatchObject({ bar: 0, startTick: 0, endTick: PPQ, strong: false })
    expect(layout.bars[1]).toMatchObject({ bar: 1, startTick: PPQ, strong: true })
    expect(layout.bars.filter((b) => b.strong).map((b) => b.bar)).toEqual([1, 5, 9, 13])
    // The one-beat pickup doesn't make the narrowest zoom a single bar.
    expect(layout.minSpan).toBe(4 * BAR_44)
  })

  it('sets the narrowest view to four average bars', () => {
    expect(layoutBars(plain).minSpan).toBe(4 * BAR_44)
  })
})

describe('views: clamp, zoom, presets, follow', () => {
  const layout = layoutBars(plain)
  const whole = 64 * BAR_44

  it('keeps a view inside the song and between 4 bars and the whole song', () => {
    expect(clampView({ startTick: -500, span: 10 }, layout)).toEqual({
      startTick: 0,
      span: 4 * BAR_44,
    })
    expect(clampView({ startTick: whole, span: 8 * BAR_44 }, layout)).toEqual({
      startTick: whole - 8 * BAR_44,
      span: 8 * BAR_44,
    })
    expect(clampView({ startTick: 100, span: 2 * whole }, layout)).toEqual({
      startTick: 0,
      span: whole,
    })
  })

  it('zooms around the pointer: the anchor stays at the same fraction of the view', () => {
    const view = { startTick: 0, span: whole }
    const anchor = 16 * BAR_44 // a quarter of the way
    const zoomed = zoomAround(view, 0.5, anchor, layout)
    expect(zoomed.span).toBe(whole / 2)
    expect((anchor - zoomed.startTick) / zoomed.span).toBeCloseTo(0.25)
    // At the end of the song the clamp moves it.
    const atEnd = zoomAround({ startTick: 0, span: whole }, 0.5, whole, layout)
    expect(atEnd.startTick).toBe(whole / 2)
    // Never past 4 bars.
    expect(zoomAround(view, 0.0001, anchor, layout).span).toBe(4 * BAR_44)
  })

  it('presets show N bars from the bar at the view start, shifted in near the end', () => {
    expect(viewForBars(layout, 32, 8 * BAR_44 + 10)).toEqual({
      startTick: 8 * BAR_44,
      span: 32 * BAR_44,
    })
    expect(viewForBars(layout, 32, 60 * BAR_44)).toEqual({
      startTick: 32 * BAR_44,
      span: 32 * BAR_44,
    })
    expect(viewForBars(layout, null, 12345)).toEqual({ startTick: 0, span: whole })
    // Bars of different meters: 4 bars across the change are measured, not averaged.
    const mixed = layoutBars(meterChange)
    expect(viewForBars(mixed, 4, 7 * BAR_44)).toEqual({
      startTick: 7 * BAR_44,
      span: BAR_44 + 3 * BAR_34,
    })
  })

  it('follows the playhead in pages, not every frame', () => {
    const view = { startTick: 0, span: 8 * BAR_44 }
    expect(followView(view, 4 * BAR_44, layout)).toBe(view)
    const paged = followView(view, 7.5 * BAR_44, layout)
    expect(paged.startTick).toBeCloseTo(7.5 * BAR_44 - 0.8 * BAR_44)
    expect(followView(view, whole - 10, layout).startTick).toBe(whole - 8 * BAR_44)
  })
})

describe('bar numbers', () => {
  it('numbers every bar with room, else every 2nd, 4th, 8th…', () => {
    expect(labelStep(27)).toBe(1)
    expect(labelStep(18.9)).toBe(2)
    expect(labelStep(7)).toBe(4)
    expect(labelStep(1.5)).toBe(16)
    expect(labelStep(0)).toBe(1024)
  })

  it('counts from bar 1 and never numbers a pickup', () => {
    expect([0, 1, 2, 5, 9].filter((b) => isLabelledBar(b, 4))).toEqual([1, 5, 9])
    expect(isLabelledBar(0, 1)).toBe(false)
  })
})

describe('pitchRange', () => {
  it('fits the notes with a margin of two semitones', () => {
    expect(pitchRange([{ midi: 48 }, { midi: 79 }, { midi: 60 }])).toEqual({ low: 46, high: 81 })
  })

  it('is at least an octave, and the middle octaves without notes', () => {
    expect(pitchRange([{ midi: 60 }])).toEqual({ low: 54, high: 66 })
    expect(pitchRange([])).toEqual({ low: 54, high: 78 })
  })
})

describe('notesInView', () => {
  const notes = [0, 100, 200, 300, 400, 500].map((startTick) => ({ startTick }))

  it('finds the notes that can overlap the view, starting early by the longest note', () => {
    expect(notesInView(notes, 0, 200, 400)).toEqual({ from: 2, to: 4 })
    expect(notesInView(notes, 150, 200, 400)).toEqual({ from: 1, to: 4 })
    expect(notesInView(notes, 0, 600, 900)).toEqual({ from: 6, to: 6 })
    expect(notesInView([], 0, 0, 10)).toEqual({ from: 0, to: 0 })
  })
})

describe('hitTest', () => {
  const lane: HitTarget = { kind: 'laneItem', id: 'b', x: 100, y: 50, width: 200, height: 22 }
  const laneStart: HitTarget = { kind: 'laneStart', id: 'b', x: 98, y: 50, width: 4, height: 22 }
  const start: HitTarget = { kind: 'loopStart', x: 197, y: 86, width: 6, height: 130 }
  const end: HitTarget = { kind: 'loopEnd', x: 203, y: 86, width: 6, height: 130 }

  it('grabs a handle a few px beyond its box', () => {
    expect(hitTest([start], 200, 100)?.kind).toBe('loopStart')
    expect(hitTest([start], 191, 100)?.kind).toBe('loopStart')
    expect(hitTest([start], 190, 100)).toBeNull()
    expect(hitTest([start], 200, 85)).toBeNull()
  })

  it('takes the nearer of two touching handles (a one-bar loop)', () => {
    expect(hitTest([start, end], 199, 100)?.kind).toBe('loopStart')
    expect(hitTest([start, end], 207, 100)?.kind).toBe('loopEnd')
  })

  it('prefers a grip over the lane item it sits on, and the item over nothing', () => {
    expect(hitTest([lane, laneStart], 101, 60)?.kind).toBe('laneStart')
    expect(hitTest([lane, laneStart], 150, 60)?.kind).toBe('laneItem')
    expect(hitTest([lane, laneStart], 150, 80)).toBeNull()
    expect(hitTest([lane], 300, 72)?.id).toBe('b')
    expect(hitTest([lane], 301, 72)).toBeNull()
  })
})

describe('stackLanes', () => {
  it('stacks overlapping ranges, reusing rows once a range has ended', () => {
    const { rows, rowCount, hidden } = stackLanes([
      { id: 'a', startBar: 1, endBar: 8 },
      { id: 'b', startBar: 5, endBar: 12 },
      { id: 'c', startBar: 9, endBar: 16 },
      { id: 'd', startBar: 17, endBar: 20 },
    ])
    expect(Object.fromEntries(rows.map((r) => [r.id, r.row]))).toEqual({ a: 0, b: 1, c: 0, d: 0 })
    expect(rowCount).toBe(2)
    expect(hidden).toBe(0)
  })

  it('a range sharing its first bar with another one’s last bar overlaps it', () => {
    const { rows } = stackLanes([
      { id: 'a', startBar: 1, endBar: 8 },
      { id: 'b', startBar: 8, endBar: 9 },
    ])
    expect(rows.find((r) => r.id === 'b')?.row).toBe(1)
  })

  it('hides what needs more rows than allowed, and counts it', () => {
    const { rows, hidden } = stackLanes(
      [
        { id: 'a', startBar: 1, endBar: 8 },
        { id: 'b', startBar: 1, endBar: 4 },
        { id: 'c', startBar: 2, endBar: 3 },
      ],
      2,
    )
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(hidden).toBe(1)
  })
})

describe('selection and bars', () => {
  const layout = layoutBars(meterChange)

  it('finds the bar at a tick, clamped to the song', () => {
    expect(barAtTick(layout, 0)).toBe(1)
    expect(barAtTick(layout, BAR_44 - 1)).toBe(1)
    expect(barAtTick(layout, BAR_44)).toBe(2)
    expect(barAtTick(layout, 8 * BAR_44 + BAR_34)).toBe(10)
    expect(barAtTick(layout, -10)).toBe(1)
    expect(barAtTick(layout, 10 ** 9)).toBe(12)
  })

  it('snaps a drag to whole bars in either direction', () => {
    expect(snapSelection(layout, BAR_44 + 10, 3 * BAR_44 + 5)).toEqual({ startBar: 2, endBar: 4 })
    expect(snapSelection(layout, 3 * BAR_44 + 5, BAR_44 + 10)).toEqual({ startBar: 2, endBar: 4 })
    expect(snapSelection(layout, -100, 10 ** 9)).toEqual({ startBar: 1, endBar: 12 })
  })

  it('moves the bar cursor; Shift extends a selection from where it was', () => {
    let state = moveBarCursor({ bar: 5, anchor: null }, 1, false, 1, 12)
    expect(state).toEqual({ cursor: { bar: 6, anchor: null }, selection: null })
    state = moveBarCursor(state.cursor, 1, true, 1, 12)
    expect(state.selection).toEqual({ startBar: 6, endBar: 7 })
    state = moveBarCursor(state.cursor, 1, true, 1, 12)
    expect(state.selection).toEqual({ startBar: 6, endBar: 8 })
    state = moveBarCursor(state.cursor, -1, true, 1, 12)
    state = moveBarCursor(state.cursor, -1, true, 1, 12)
    state = moveBarCursor(state.cursor, -1, true, 1, 12)
    expect(state.selection).toEqual({ startBar: 5, endBar: 6 })
    expect(moveBarCursor({ bar: 12, anchor: null }, 1, false, 1, 12).cursor.bar).toBe(12)
    expect(moveBarCursor({ bar: 1, anchor: null }, -1, true, 1, 12).selection).toEqual({
      startBar: 1,
      endBar: 1,
    })
  })
})

describe('range edits', () => {
  it('moves a range keeping its length, stopping at the song ends', () => {
    expect(moveRange({ startBar: 17, endBar: 32 }, 4, 1, 64)).toEqual({ startBar: 21, endBar: 36 })
    expect(moveRange({ startBar: 17, endBar: 32 }, 100, 1, 64)).toEqual({
      startBar: 49,
      endBar: 64,
    })
    expect(moveRange({ startBar: 17, endBar: 32 }, -100, 1, 64)).toEqual({
      startBar: 1,
      endBar: 16,
    })
  })

  it('resizes by the loop rules: kept inside the song, pushing the other end', () => {
    expect(resizeRange({ startBar: 17, endBar: 32 }, 'end', 36, 1, 64)).toEqual({
      startBar: 17,
      endBar: 36,
    })
    expect(resizeRange({ startBar: 17, endBar: 32 }, 'start', 40, 1, 64)).toEqual({
      startBar: 40,
      endBar: 40,
    })
    expect(resizeRange({ startBar: 17, endBar: 32 }, 'end', 99, 1, 64)).toEqual({
      startBar: 17,
      endBar: 64,
    })
  })
})

describe('playFromBar', () => {
  const loop = { startBar: 17, endBar: 32 }

  it('starts at the selection, else the loop, else the cursor', () => {
    expect(playFromBar({ startBar: 20, endBar: 24 }, loop, 3)).toBe(20)
    expect(playFromBar(null, loop, 3)).toBe(17)
    expect(playFromBar(null, null, 3)).toBe(3)
    expect(playFromBar({ startBar: 41, endBar: 48 }, null, 3)).toBe(41)
  })

  it('lands on the loop start for a selection outside the loop', () => {
    expect(playFromBar({ startBar: 41, endBar: 48 }, loop, 3)).toBe(17)
  })
})
