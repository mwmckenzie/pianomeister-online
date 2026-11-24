import { describe, expect, it, vi } from 'vitest'

import type { Playlist } from '@/core/playlists/Playlist'
import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'

import {
  ListeningController,
  type ListeningHost,
  type ListeningUpdate,
} from './ListeningController'

/** 480 PPQ at 120 bpm: a song of `seconds` (one held note), plus its 0.5 s release. */
function opened(songId: string, seconds: number) {
  const endTick = seconds * 960
  return {
    entry: { songId, title: songId, composer: '' },
    song: {
      id: songId,
      title: songId,
      format: 1,
      trackCount: 1,
      noteIds: [],
      ppq: 480,
      notes: [{ midi: 60, channel: 0, startTick: 0, endTick, velocity: 80 }],
      channels: [],
      tempoEvents: [{ tick: 0, microsPerQuarter: 500_000 }],
      timeSignatureEvents: [{ tick: 0, numerator: 4, denominator: 4 }],
      pedalIntervals: [],
      durationTicks: endTick,
      durationSeconds: seconds,
    },
    hands: { right: [0], left: [] },
    defaultHands: true,
    override: null,
  }
}

const ENTRY = { facts: { durationSeconds: 60 }, title: '', composer: '' }

/** The controller over a transport that only holds a position; song b's load waits for `release`. */
function setUp(crossfade = 2) {
  const transport = {
    position: 0,
    state: 'stopped',
    seekToSeconds: vi.fn<(s: number) => void>((s) => {
      transport.position = s
    }),
    setTempoPercent: () => {},
    songTimeAt: (): number => transport.position,
    pause: () => (transport.state = 'paused'),
    stop: () => {},
  }
  const gains = [1, 1]
  const output = {
    setDeckGain: vi.fn<(deck: 0 | 1, value: number) => number>(
      (deck, value) => (gains[deck] = value),
    ),
    crossfade: vi.fn<() => void>(),
  }
  const session = {
    transport,
    output,
    context: { currentTime: 0 },
    setMuted: () => {},
    play: () => {
      transport.state = 'playing'
      return Promise.resolve()
    },
    loadTimeline: (_: unknown, __: number, at: number) => (transport.position = at),
  }
  let release = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  const openSong = vi.fn<(id: string) => Promise<ReturnType<typeof opened>>>(async (id) => {
    if (id === 'b') await gate
    return opened(id, 60)
  })
  const updates: ListeningUpdate[] = []
  const suspended = vi.fn<(on: boolean) => void>()
  const host = {
    session,
    openSong,
    entry: () => ENTRY,
    savedLooks: () => [],
    deviceClass: 'desktop',
    ownSettings: () => DEFAULT_SETTINGS,
    setOverlay: () => {},
    endOverlay: () => {},
    setTrackingSuspended: suspended,
    crossfadeSec: () => crossfade,
    crossfadeCurve: () => 'sequential',
    showTimeline: () => 0,
    setSeam: () => {},
    currentSettings: () => DEFAULT_SETTINGS,
    previewSettings: () => {},
    reducedMotion: () => false,
    now: () => 0,
    update: (u: ListeningUpdate) => updates.push(u),
    markPlayed: () => {},
    random: () => 0.5,
  } as unknown as ListeningHost
  const listener = new ListeningController(host)
  const playlist: Playlist = {
    id: 'p',
    profileId: 'default',
    name: 'P',
    lookId: null,
    entries: ['a', 'b', 'c'].map((songId) => ({ songId, lookId: null })),
    shuffle: false,
    repeat: 'playlist',
    createdAt: '',
    updatedAt: '',
    lastPlayedAt: null,
  }
  const loads = (id: string) => openSong.mock.calls.filter(([x]) => x === id).length
  return { listener, playlist, transport, output, gains, release, loads, updates, suspended }
}

// Song a ends at 60.5 s (its release): the prepare window starts 12 s before that.
const SEEK_BAR_29 = 29 // 56 s: 4.5 s before the end

describe('ListeningController seeking', () => {
  it('a seek into the prepare window loads the next song first, then lands with it placed', async () => {
    const t = setUp()
    await t.listener.start(t.playlist, 0)
    t.transport.position = 10
    const seek = t.listener.seekToBar(SEEK_BAR_29)
    // Frames meanwhile: the song plays on, and nothing is loaded twice.
    t.listener.frame()
    t.listener.frame()
    expect(t.transport.position).toBe(10)
    t.release()
    await seek
    expect(t.transport.position).toBe(56)
    const { parts, current } = t.listener.debugState()
    expect(current).toBe(0)
    expect(parts.map((p) => [p.songId, p.startSec])).toEqual([
      ['a', 0],
      ['b', 58.5],
    ])
    expect(t.loads('b')).toBe(1)
    // The seam: the next song becomes current once, announced.
    t.transport.position = 58.6
    t.listener.frame()
    t.listener.frame()
    expect(t.listener.debugState().current).toBe(1)
    expect(t.updates.filter((u) => u.announce === true)).toHaveLength(1)
    expect(t.loads('b')).toBe(1)
    expect(t.suspended.mock.calls).toEqual([[true]])
  })

  it('a seek inside the crossfade starts the next song at once, still overlapping', async () => {
    const t = setUp()
    t.release()
    await t.listener.start(t.playlist, 0)
    await t.listener.seekBy(500)
    const [a, b] = t.listener.debugState().parts
    expect(t.transport.position).toBe(60)
    expect(b?.startSec).toBeCloseTo(60.1, 9)
    expect(b?.startSec).toBeLessThan(a?.endSec ?? 0)
  })

  it('a seek back keeps one next song, at its usual place', async () => {
    const t = setUp()
    t.release()
    await t.listener.start(t.playlist, 0)
    await t.listener.seekBy(500)
    await t.listener.seekBy(-40)
    expect(t.transport.position).toBe(20)
    expect(t.listener.debugState().parts.map((p) => p.startSec)).toEqual([0, 58.5])
    expect(t.loads('b')).toBe(1)
  })

  it('while both songs sound, a seek stays in the song shown, alone at full volume', async () => {
    const t = setUp()
    t.release()
    await t.listener.start(t.playlist, 0)
    await t.listener.seekToBar(SEEK_BAR_29)
    t.transport.position = 59
    t.listener.frame()
    expect(t.listener.debugState().current).toBe(1)
    t.gains.fill(0.7)
    t.output.crossfade.mockClear()
    await t.listener.seekBy(5)
    const { parts, current } = t.listener.debugState()
    expect(parts.map((p) => p.songId)).toEqual(['b'])
    expect(current).toBe(0)
    expect(t.transport.position).toBeCloseTo(5.5, 9)
    expect(t.gains).toEqual([1, 1])
    t.listener.frame()
    // The old fade is gone: nothing left to fade.
    expect(t.output.crossfade).not.toHaveBeenCalled()
  })

  it('the last of two quick seeks wins, and presses add up while the next song loads', async () => {
    const t = setUp()
    await t.listener.start(t.playlist, 0)
    t.transport.position = 45
    const first = t.listener.seekBy(5)
    const second = t.listener.seekBy(5)
    t.release()
    await Promise.all([first, second])
    expect(t.transport.seekToSeconds.mock.calls).toEqual([[55]])
    expect(t.listener.debugState().parts).toHaveLength(2)
  })

  it('a seek that was waiting does nothing once listening ended', async () => {
    const t = setUp()
    await t.listener.start(t.playlist, 0)
    const seek = t.listener.seekToBar(SEEK_BAR_29)
    t.listener.leave()
    t.release()
    await seek
    expect(t.transport.seekToSeconds).not.toHaveBeenCalled()
  })

  it('crossfade 0 keeps its short gap after a seek', async () => {
    const t = setUp(0)
    t.release()
    await t.listener.start(t.playlist, 0)
    await t.listener.seekBy(57)
    expect(t.listener.debugState().parts.map((p) => p.startSec)).toEqual([0, 61.5])
  })

  it('pausing drops a scheduled fade; playing on schedules it again', async () => {
    const t = setUp()
    t.release()
    await t.listener.start(t.playlist, 0)
    await t.listener.seekToBar(SEEK_BAR_29)
    t.listener.frame()
    expect(t.output.crossfade).toHaveBeenCalledTimes(1)
    t.transport.state = 'paused'
    t.output.setDeckGain.mockClear()
    t.listener.frame()
    expect(t.output.setDeckGain).toHaveBeenCalled()
    t.transport.state = 'playing'
    t.listener.frame()
    expect(t.output.crossfade).toHaveBeenCalledTimes(2)
  })
})
