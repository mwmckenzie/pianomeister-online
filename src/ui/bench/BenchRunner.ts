import type { BenchCell, BenchSuite } from '@/core/bench/BenchCell'
import {
  BENCH_SCHEMA,
  BENCH_VERSION,
  type BenchRun,
  type CellResult,
} from '@/core/bench/BenchResult'
import { densestSecond } from '@/core/bench/densestSecond'
import { SEGMENT_SEC, WARM_UP_SEC } from '@/core/bench/SEGMENTS'
import { channelHandOf } from '@/core/hands/channelHandOf'
import { DEFAULT_HAND_ASSIGNMENT } from '@/core/hands/HandAssignment'
import { BUILT_IN_LOOKS } from '@/core/looks/BUILT_IN_LOOKS'
import { lookSettings } from '@/core/looks/lookValues'
import type { Playlist } from '@/core/playlists/Playlist'
import { applyQualityPreset } from '@/core/settings/applyQualityPreset'
import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'
import { restoreValues } from '@/core/settings/settingGroups'
import type { SettingKey } from '@/core/settings/SettingKey'
import { importMidi } from '@/core/song/importMidi'
import type { Song } from '@/core/song/Song'

import longDemoUrl from '../../../test-fixtures/midi/long-demo.mid?url'
import type { BenchHost } from './BenchHost'
import { CellRecorder } from './CellRecorder'
import { measureRefresh, readDevice } from './readDevice'

/** A cell disturbed (tab hidden, window resized) is measured again, so often. */
const TRIES = 3
/** Seconds of the crossfade cell before the second song starts sounding. */
const BEFORE_SEAM_SEC = 3
/** A cell with fewer frames isn't worth percentiles. */
const FEW_FRAMES = 30
/** The most a cell goes on for that many. */
const EXTRA_SEC = 15
/** Software WebGL takes seconds a frame: a cell there is this many frames, whatever they take… */
const SOFTWARE_FRAMES = 10
/** …and gives up here (a window the browser has stopped drawing). */
const SOFTWARE_LIMIT_SEC = 120

export interface BenchOptions {
  readonly suite: BenchSuite
  readonly cells: readonly BenchCell[]
  readonly label: string
  readonly notes: string
  readonly signal: AbortSignal
  /** Puts a cell's settings on screen (never stored). */
  readonly setSettings: (settings: PlayerSettings) => void
  readonly onProgress: (done: number, cell: BenchCell) => void
}

/** What a cell puts on screen: the look and preset over the defaults, with the fixed camera. */
export function cellSettings(cell: BenchCell): PlayerSettings {
  const look = BUILT_IN_LOOKS.find((l) => l.id === cell.look)
  const base = look === undefined ? DEFAULT_SETTINGS : lookSettings(DEFAULT_SETTINGS, look)
  const settings: PlayerSettings = {
    ...base,
    camera: DEFAULT_SETTINGS.camera,
    render: applyQualityPreset(base.render, cell.quality),
    appearance: { ...base.appearance, hideControls: false },
    ...(cell.segment === 'loop' ? { highway: { ...base.highway, lookAheadBeats: 32 } } : {}),
  }
  return restoreValues(settings, new Map(Object.entries(cell.overrides) as [SettingKey, unknown][]))
}

class Cancelled extends Error {}

function wait(seconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer)
      reject(new Cancelled())
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop)
      resolve()
    }, seconds * 1000)
    if (signal.aborted) stop()
    else signal.addEventListener('abort', stop, { once: true })
  })
}

/** Measures every cell on the real player; null when cancelled. Always puts the player back. */
export async function runBench(host: BenchHost, options: BenchOptions): Promise<BenchRun | null> {
  const { signal } = options
  const engine = host.engine()
  const session = host.session()
  if (engine === null || session === null) return null
  const flags = new Set<string>()
  const cells: CellResult[] = []
  let recorder: CellRecorder | null = null
  try {
    host.begin()
    // Cells measure a frame's cost, paused ones too; what resting saves: bench-render --idle.
    engine.setAlwaysDraw(true)
    await session.unlock()
    const songs = await loadSongs(host)
    engine.setFrozen(true)
    const refreshMs = await measureRefresh()
    engine.setFrozen(false)
    if (refreshMs > 30) flags.add('frames capped at 30 per second or fewer')
    const device = readDevice(engine, refreshMs)
    const software = device.gpuClass === 'software'
    if (import.meta.env.DEV) flags.add('development build')
    for (const [i, cell] of options.cells.entries()) {
      options.onProgress(i, cell)
      let result: CellResult | null = null
      for (let attempt = 0; attempt < TRIES && result === null; attempt++) {
        await visible(signal)
        recorder = new CellRecorder(host, cell.segment, refreshMs)
        result = await measure(host, options, cell, songs, recorder, software)
        recorder.detach()
        if (result === null) flags.add('disturbed')
      }
      if (result === null) continue
      if (result.frames.frames < FEW_FRAMES) flags.add('few frames')
      cells.push(result)
    }
    if ((await measureAfter(engine)) / refreshMs > 1.3) flags.add('refresh rate changed')
    return {
      schema: BENCH_SCHEMA,
      version: BENCH_VERSION,
      id: crypto.randomUUID?.() ?? String(Date.now()),
      at: new Date().toISOString(),
      suite: options.suite,
      label: options.label,
      notes: options.notes,
      app: { version: __APP_VERSION__, commit: __APP_COMMIT__, dev: import.meta.env.DEV },
      device,
      startUp: startUp(),
      flags: [...flags],
      cells,
    }
  } catch (e) {
    if (e instanceof Cancelled) return null
    throw e
  } finally {
    recorder?.detach()
    engine.setAlwaysDraw(false)
    await host.end()
  }
}

async function measureAfter(engine: { setFrozen(on: boolean): void }): Promise<number> {
  engine.setFrozen(true)
  const refresh = await measureRefresh()
  engine.setFrozen(false)
  return refresh
}

interface BenchSongs {
  readonly long: Song
  readonly canon: Song
  readonly invention: Song
  readonly canonId: string
  readonly inventionId: string
}

async function loadSongs(host: BenchHost): Promise<BenchSongs> {
  const response = await fetch(longDemoUrl)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const long = await importMidi(bytes, { fileName: 'long-demo.mid' })
  const entries = await host.entries()
  const bundled = async (fileName: string) => {
    const entry = entries.find((e) => e.source === 'bundled' && e.fileName === fileName)
    if (entry === undefined) throw new Error(`${fileName} isn't in the library`)
    return { id: entry.songId, song: (await host.openSong(entry.songId)).song }
  }
  const canon = await bundled('canon-in-d.mid')
  const invention = await bundled('invention-1.mid')
  return {
    long,
    canon: canon.song,
    invention: invention.song,
    canonId: canon.id,
    inventionId: invention.id,
  }
}

/** One cell's numbers; null when it was disturbed and doesn't count. */
async function measure(
  host: BenchHost,
  options: BenchOptions,
  cell: BenchCell,
  songs: BenchSongs,
  recorder: CellRecorder,
  software: boolean,
): Promise<CellResult | null> {
  const { signal } = options
  const session = host.session()
  const engine = host.engine()
  if (session === null || engine === null || signal.aborted) throw new Cancelled()
  const { transport } = session
  const size = () => `${window.innerWidth} ${window.innerHeight} ${window.devicePixelRatio}`
  const before = size()
  let hidden = document.hidden
  const onHidden = () => (hidden ||= document.hidden)
  document.addEventListener('visibilitychange', onHidden)
  try {
    transport.stop()
    host.setLoop(null)
    options.setSettings(cellSettings(cell))
    engine.seedEffects(1)
    recorder.attach()
    if (cell.segment === 'crossfade') {
      await host.listen(playlist(songs, cell), WARM_UP_SEC + BEFORE_SEAM_SEC + 2)
    } else {
      const song =
        cell.segment === 'dense'
          ? songs.long
          : cell.segment === 'light'
            ? songs.invention
            : songs.canon
      const loaded = session.load(song, {
        handOf: channelHandOf(DEFAULT_HAND_ASSIGNMENT),
        key: `bench:${song.id}`,
      })
      host.show(loaded)
      const onsets = loaded.notes
        .map((n) => loaded.tempoMap.tickToSeconds(n.startTick))
        .sort((a, b) => a - b)
      const busiest = densestSecond(onsets, SEGMENT_SEC.normal)
      if (cell.segment === 'loop') {
        const tick = loaded.tempoMap.secondsToTick(busiest)
        const { bar } = loaded.barMap.tickToPosition(tick)
        host.setLoop({ startBar: bar, endBar: bar })
        transport.seekToBar(bar)
      } else {
        transport.seekToSeconds(Math.max(0, busiest - WARM_UP_SEC))
      }
      await session.play()
    }
    await wait(WARM_UP_SEC, signal)
    if (cell.segment === 'idle') {
      transport.pause()
      // Pulses and particles in flight settle.
      await wait(1.5, signal)
    }
    recorder.start()
    /** Measures `share` of the cell: its seconds, or its frames on software WebGL. */
    const measured = async (share: number) => {
      if (!software) return wait(SEGMENT_SEC[cell.segment] * share, signal)
      const until = performance.now() + SOFTWARE_LIMIT_SEC * 1000 * share
      const goal = recorder.frameCount + Math.ceil(SOFTWARE_FRAMES * share)
      while (recorder.frameCount < goal && performance.now() < until) await wait(0.05, signal)
    }
    if (cell.segment === 'pauseResume') {
      await measured(1 / 3)
      transport.pause()
      await measured(1 / 3)
      await session.play()
      await measured(1 / 3)
    } else {
      await measured(1)
      // A slow device needs longer for enough frames (a loop or a seam would come round again).
      const extendable = !software && cell.segment !== 'loop' && cell.segment !== 'crossfade'
      const until = performance.now() + EXTRA_SEC * 1000
      while (extendable && recorder.frameCount < FEW_FRAMES && performance.now() < until) {
        await wait(0.5, signal)
      }
    }
    const result = recorder.stop()
    if (result === null || hidden || size() !== before) return null
    return { cell, ...result }
  } finally {
    document.removeEventListener('visibilitychange', onHidden)
    host.leaveListening()
  }
}

function playlist(songs: BenchSongs, cell: BenchCell): Playlist {
  const at = new Date(0).toISOString()
  return {
    id: 'bench',
    profileId: 'bench',
    name: 'Benchmark',
    lookId: null,
    entries: [
      { songId: songs.canonId, lookId: cell.look },
      { songId: songs.inventionId, lookId: 'builtin:neon' },
    ],
    shuffle: false,
    repeat: 'off',
    createdAt: at,
    updatedAt: at,
    lastPlayedAt: null,
  }
}

/** Waits until the tab is visible. */
async function visible(signal: AbortSignal): Promise<void> {
  while (document.hidden) await wait(0.25, signal)
}

function startUp(): BenchRun['startUp'] {
  const at = (name: string) => {
    const entry = performance.getEntriesByName(name)[0]
    return entry === undefined ? null : Math.round(entry.startTime)
  }
  return {
    firstPaint: at('first-contentful-paint'),
    songOpened: at('pm-song'),
    samplesLoaded: at('pm-samples'),
  }
}
