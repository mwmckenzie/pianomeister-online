// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { nextInOrder } from './nextInOrder'
import { previousInOrder } from './previousInOrder'
import { seededRandom } from './seededRandom'
import { setShuffle } from './setShuffle'
import { startOrder } from './startOrder'

const ALL = [0, 1, 2, 3, 4]

describe('play order', () => {
  it('plays in order from the chosen song, skipping missing ones', () => {
    const s = startOrder([0, 2, 3], 1, false, seededRandom(1))
    expect(s.order[s.position]).toBe(2)
    expect(nextInOrder(s, 'off', seededRandom(1))?.position).toBe(s.position + 1)
  })

  it('shuffled: the chosen song first, no repeats until every entry has played', () => {
    const random = seededRandom(7)
    let s = startOrder(ALL, 3, true, random)
    expect(s.order[0]).toBe(3)
    const seen: number[] = []
    for (let i = 0; i < ALL.length; i++) {
      seen.push(s.order[s.position] as number)
      s = nextInOrder(s, 'playlist', random) ?? s
    }
    expect([...seen].sort()).toEqual(ALL)
    // Wrapped into a fresh order whose first song isn't the one that just played.
    expect(s.position).toBe(0)
    expect(s.order[0]).not.toBe(seen[seen.length - 1])
    expect([...s.order].sort()).toEqual(ALL)
  })

  it('repeat: playlist wraps, one stays, off finishes', () => {
    const last = { order: ALL, position: 4, shuffle: false }
    expect(nextInOrder(last, 'playlist', seededRandom(1))?.position).toBe(0)
    expect(nextInOrder(last, 'one', seededRandom(1))).toBe(last)
    expect(nextInOrder(last, 'off', seededRandom(1))).toBeNull()
  })

  it('switching shuffle mid-playlist keeps the current song', () => {
    const s = { order: ALL, position: 2, shuffle: false }
    const on = setShuffle(s, ALL, true, seededRandom(3))
    expect(on.order[on.position]).toBe(2)
    expect(on.position).toBe(0)
    const off = setShuffle(on, ALL, false, seededRandom(3))
    expect(off.order[off.position]).toBe(2)
    expect(off.order).toEqual(ALL)
  })

  it('previous: restarts after 3 s or on the first song, else goes back', () => {
    const s = { order: ALL, position: 2, shuffle: false }
    expect(previousInOrder(s, 3.5)).toEqual({ order: s, restart: true })
    expect(previousInOrder(s, 1).order.position).toBe(1)
    expect(previousInOrder({ ...s, position: 0 }, 1).restart).toBe(true)
  })
})
