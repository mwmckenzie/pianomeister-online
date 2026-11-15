// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { EventBus } from './EventBus'

interface Events {
  ping: number
  done: undefined
}

describe('EventBus', () => {
  it('delivers payloads to subscribers of that event only', () => {
    const bus = new EventBus<Events>()
    const ping = vi.fn<(n: number) => void>()
    const done = vi.fn<() => void>()
    bus.on('ping', ping)
    bus.on('done', done)
    bus.emit('ping', 42)
    expect(ping).toHaveBeenCalledWith(42)
    expect(done).not.toHaveBeenCalled()
  })

  it('stops delivering after off() or the returned unsubscribe', () => {
    const bus = new EventBus<Events>()
    const a = vi.fn<(n: number) => void>()
    const b = vi.fn<(n: number) => void>()
    const unsubscribe = bus.on('ping', a)
    bus.on('ping', b)
    unsubscribe()
    bus.off('ping', b)
    bus.emit('ping', 1)
    expect(a).not.toHaveBeenCalled()
    expect(b).not.toHaveBeenCalled()
  })

  it('keeps delivering to later handlers when one unsubscribes mid-emit', () => {
    const bus = new EventBus<Events>()
    const calls: string[] = []
    const unsubscribeFirst = bus.on('ping', () => {
      calls.push('first')
      unsubscribeFirst()
    })
    bus.on('ping', () => calls.push('second'))
    bus.emit('ping', 1)
    bus.emit('ping', 2)
    expect(calls).toEqual(['first', 'second', 'second'])
  })

  it('ignores emits with no subscribers', () => {
    expect(() => new EventBus<Events>().emit('done', undefined)).not.toThrow()
  })
})
