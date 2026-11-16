<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import type { HandAssignment } from '@/core/hands/HandAssignment'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { OpenedSong } from '@/data/OpenedSong'
import { Engine } from '@/engine/Engine'

import SettingsPanel from '../components/SettingsPanel.vue'
import { formatTime } from '../format/formatTime'
import type { LoadedSong } from '../playback/LoadedSong'
import type { PlaybackSession } from '../playback/PlaybackSession'
import { sharedSession } from '../playback/sharedSession'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'

const route = useRoute()
const settingsStore = useSettingsStore()
const library = useLibraryStore()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

// Engine and audio live outside Vue's reactivity; the HUD copies what it shows once per frame.
// The playback session is shared and outlives this view (brief decision 38).
let session: PlaybackSession | null = null
let engine: Engine | null = null
let resizeObserver: ResizeObserver | null = null
let stopProgress: (() => void) | null = null
let hudFrame = 0
let unmounted = false

const entry = shallowRef<LibraryEntry | null>(null)
const hands = shallowRef<HandAssignment | null>(null)
const loaded = shallowRef<LoadedSong | null>(null)
const samplesReady = ref(false)
const sampleProgress = ref({ loaded: 0, total: 0 })
const error = ref('')
const settingsOpen = ref(false)

const tempoPercent = ref(100)
const loopStart = ref(1)
const loopEnd = ref(4)
const loopLabel = ref('off')
const preRollBeats = ref(0)

const hud = ref({ state: 'stopped', seconds: 0, barBeat: '–', songBpm: 0, currentBpm: 0 })

const title = computed(() => entry.value?.title ?? '')
const length = computed(() => formatTime(loaded.value?.song.durationSeconds ?? 0))
const barCount = computed(() => loaded.value?.barMap.barCount ?? 0)
const handsLabel = computed(() => {
  const h = hands.value
  if (h === null) return ''
  const list = (channels: readonly number[]) =>
    channels.length === 0 ? '–' : channels.map((c) => `ch${c}`).join(',')
  return `R ${list(h.right)} · L ${list(h.left)}`
})
const sampleStatus = computed(() => {
  if (samplesReady.value) return 'loaded'
  const { loaded: done, total } = sampleProgress.value
  return total > 0 ? `loading ${done}/${total}` : 'loading…'
})

/**
 * Opens the library's start song (the last one opened, else the first bundled song), then
 * attaches the playback session. The order matters on a first visit: creating the session
 * starts ~230 sample downloads, and the song's manifest and MIDI requests would otherwise
 * queue behind them, leaving the player empty for seconds on a slow connection.
 */
async function start(): Promise<void> {
  error.value = ''
  let opened: OpenedSong | null = null
  try {
    opened = await library.openSong(await library.startSongId())
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    console.error("[player] Couldn't open the song:", e)
  }
  if (unmounted) return
  const playback = attachSession()
  if (opened !== null) showSong(playback, opened)
}

function attachSession(): PlaybackSession {
  const playback = sharedSession()
  session = playback
  // The controls show what the shared transport already has (e.g. after visiting the library).
  tempoPercent.value = playback.transport.tempoPercent
  preRollBeats.value = playback.transport.preRoll.beats
  stopProgress = playback.onSampleProgress(
    (done, total) => (sampleProgress.value = { loaded: done, total }),
  )
  playback.ready.then(
    () => (samplesReady.value = true),
    (e: unknown) => (error.value = `Samples failed to load: ${String(e)}`),
  )
  return playback
}

/**
 * Sets the song up with its hand assignment and meter override. If the shared session already
 * has exactly that (back from the library without changes), it is kept, position and all.
 */
function showSong(playback: PlaybackSession, opened: OpenedSong): void {
  const songId = opened.entry.songId
  const key = JSON.stringify([songId, opened.hands, opened.override])
  const current = playback.song
  const prepared =
    playback.songKey === key && current !== null
      ? current
      : playback.load(opened.song, { hands: opened.hands, override: opened.override, key })
  entry.value = opened.entry
  hands.value = opened.hands
  loaded.value = prepared
  void library.setLastSongId(songId).then((saved) => {
    if (!saved) error.value = library.error
  })
  engine?.setSong({
    notes: prepared.notes,
    ppq: opened.song.ppq,
    barMap: prepared.barMap,
    pedalIntervals: prepared.pedalIntervals,
    endTick: opened.song.durationTicks,
  })
  syncLoopLabel()
}

function togglePlay(): void {
  if (!samplesReady.value) return
  void session?.togglePlay()
}

function setLoop(): void {
  try {
    session?.transport.setLoop({ startBar: loopStart.value, endBar: loopEnd.value })
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  syncLoopLabel()
}

function clearLoop(): void {
  session?.transport.setLoop(null)
  syncLoopLabel()
}

function syncLoopLabel(): void {
  const loop = session?.transport.loop ?? null
  loopLabel.value = loop === null ? 'off' : `${loop.startBar}–${loop.endBar}`
}

function updateHud(): void {
  hudFrame = requestAnimationFrame(updateHud)
  const prepared = loaded.value
  if (session === null || prepared === null) return
  const { transport } = session
  const seconds = transport.position
  const tick = prepared.tempoMap.secondsToTick(seconds)
  const at = prepared.barMap.tickToPosition(tick)
  const songBpm = prepared.tempoMap.bpmAt(Math.max(0, tick))
  hud.value = {
    state: transport.state,
    seconds,
    barBeat: `${at.bar}:${at.beat}`,
    songBpm,
    currentBpm: (songBpm * transport.tempoPercent) / 100,
  }
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  )
}

function onKeyDown(event: KeyboardEvent): void {
  if (session === null || isTyping(event.target)) return
  if (event.code === 'Space') {
    event.preventDefault()
    togglePlay()
  } else if (event.code === 'ArrowLeft') {
    event.preventDefault()
    session.transport.prevBar()
  } else if (event.code === 'ArrowRight') {
    event.preventDefault()
    session.transport.nextBar()
  }
}

const onGesture = () => void session?.unlock()

/** For the settings readout: what the engine renders at and how long a frame takes. */
function renderStatus() {
  const info = engine?.renderInfo() ?? null
  return info === null ? null : { info, frameMs: engine?.stats().averageFrameMs ?? 0 }
}

watch(tempoPercent, (p) => session?.transport.setTempoPercent(p))
watch(preRollBeats, (beats) => session?.transport.setPreRoll({ beats, mode: 'muted' }))
watch(
  () => settingsStore.settings,
  () => engine?.applySettings(settingsStore.snapshot()),
  { deep: true },
)

onMounted(() => {
  engine = new Engine()
  engine.applySettings(settingsStore.snapshot())
  engine.setGuides(route.query.guides === '1')
  if (route.query.stats === '1') {
    // Debug-only (like ?guides=1): lets a test harness read frame timings for perf reports.
    const stats = () => engine?.stats()
    const renderInfo = () => engine?.renderInfo()
    Object.assign(window, { pianomeisterEngineStats: stats, pianomeisterRenderInfo: renderInfo })
  }
  engine.setTimeSource(() => session?.audibleTick() ?? 0)
  if (canvas.value !== null) {
    engine.mount(canvas.value)
    resizeObserver = new ResizeObserver(() => engine?.resize())
    resizeObserver.observe(canvas.value)
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('pointerdown', onGesture)
  hudFrame = requestAnimationFrame(updateHud)
  void start()
})

onBeforeUnmount(() => {
  unmounted = true
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('pointerdown', onGesture)
  cancelAnimationFrame(hudFrame)
  resizeObserver?.disconnect()
  stopProgress?.()
  engine?.dispose()
  if (session?.transport.state === 'playing') session.transport.pause()
  engine = null
  session = null
})
</script>

<template>
  <main class="player">
    <canvas ref="canvas" class="stage" data-testid="stage" />

    <section class="hud left" aria-label="Song">
      <div class="title" data-testid="hud-title">{{ title }}</div>
      <div>
        <span data-testid="hud-position">{{ formatTime(hud.seconds) }}</span> / {{ length }}
      </div>
      <div class="big">
        Bar <span data-testid="hud-bar-beat">{{ hud.barBeat }}</span>
        <span class="of">
          / <span data-testid="hud-bars">{{ barCount }}</span></span
        >
      </div>
      <div class="muted" data-testid="hud-hands">{{ handsLabel }}</div>
    </section>

    <section class="hud center" aria-label="Controls">
      <div class="row">
        <RouterLink :to="{ name: 'library' }" class="button" data-testid="open-library">
          Library
        </RouterLink>
        <button type="button" :disabled="!samplesReady" @click="togglePlay">
          {{ hud.state === 'playing' ? 'Pause' : 'Play' }}
        </button>
        <button type="button" @click="session?.transport.stop()">Stop</button>
        <button type="button" aria-label="Previous bar" @click="session?.transport.prevBar()">
          ◀
        </button>
        <button type="button" aria-label="Next bar" @click="session?.transport.nextBar()">▶</button>
      </div>
      <div class="row">
        <label>
          Tempo {{ tempoPercent }}%
          <input v-model.number="tempoPercent" type="range" min="25" max="200" step="5" />
        </label>
        <label>Loop <input v-model.number="loopStart" type="number" min="0" step="1" /></label>
        <label>– <input v-model.number="loopEnd" type="number" min="0" step="1" /></label>
        <button type="button" @click="setLoop">Set</button>
        <button type="button" @click="clearLoop">Clear</button>
        <span class="muted">{{ loopLabel }}</span>
        <label>
          Pre-roll <input v-model.number="preRollBeats" type="number" min="0" max="16" step="1" />
        </label>
      </div>
      <div class="row muted">
        Samples: <span data-testid="sample-status">{{ sampleStatus }}</span>
        <span data-testid="transport-state">{{ hud.state }}</span>
        <span v-if="error" class="error" data-testid="player-error">{{ error }}</span>
      </div>
    </section>

    <section class="hud right" aria-label="Tempo">
      <div class="big">
        <span data-testid="hud-bpm">{{ hud.currentBpm.toFixed(0) }}</span> BPM
      </div>
      <div class="muted">song {{ hud.songBpm.toFixed(0) }} BPM × {{ tempoPercent }}%</div>
      <button
        type="button"
        class="gear"
        aria-label="Settings"
        data-testid="open-settings"
        @click="settingsOpen = !settingsOpen"
      >
        ⚙
      </button>
    </section>

    <SettingsPanel
      v-if="settingsOpen"
      :render-status="renderStatus"
      @close="settingsOpen = false"
    />
  </main>
</template>

<style scoped>
.player {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #05070f;
}

.stage {
  display: block;
  width: 100%;
  height: 100%;
}

.hud {
  position: absolute;
  top: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: rgb(5 7 15 / 35%);
  text-shadow: 0 1px 3px rgb(0 0 0 / 80%);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  pointer-events: auto;
}

.left {
  left: 0.75rem;
}

.right {
  right: 0.75rem;
  text-align: right;
}

.center {
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100vw - 26rem);
}

.title {
  font-weight: 600;
  font-size: 1rem;
}

.big {
  font-size: 1.25rem;
  font-weight: 600;
}

.of {
  font-size: 0.9rem;
  font-weight: normal;
  color: #8c9abf;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.6rem;
  margin-bottom: 0.35rem;
}

.row input[type='number'] {
  width: 3.5rem;
}

.button {
  padding: 0.1rem 0.6rem;
  border: 1px solid rgb(120 140 190 / 45%);
  border-radius: 4px;
  background: rgb(58 74 110 / 55%);
  color: inherit;
  text-decoration: none;
}

.muted {
  color: #8c9abf;
}

.error {
  color: #ff6b6b;
}

.gear {
  margin-top: 0.35rem;
  font-size: 1.1rem;
}
</style>
