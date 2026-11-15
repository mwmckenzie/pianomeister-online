<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import { importMidi } from '@/core/song/importMidi'
import { Engine } from '@/engine/Engine'

import SettingsPanel from '../components/SettingsPanel.vue'
import { FIXTURES } from '../playback/FIXTURES'
import type { LoadedSong } from '../playback/LoadedSong'
import { PlaybackSession } from '../playback/PlaybackSession'
import { useSettingsStore } from '../stores/settingsStore'

type FixtureName = (typeof FIXTURES)[number]['fileName']

const route = useRoute()
const settingsStore = useSettingsStore()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

// Engine and audio live outside Vue's reactivity; the HUD copies what it shows once per frame.
let session: PlaybackSession | null = null
let engine: Engine | null = null
let resizeObserver: ResizeObserver | null = null
let hudFrame = 0

const selected = ref<FixtureName>('minuet-in-g.mid')
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

const title = computed(() => FIXTURES.find((f) => f.fileName === selected.value)?.title ?? '')
const length = computed(() => formatTime(loaded.value?.song.durationSeconds ?? 0))
const sampleStatus = computed(() => {
  if (samplesReady.value) return 'loaded'
  const { loaded: done, total } = sampleProgress.value
  return total > 0 ? `loading ${done}/${total}` : 'loading…'
})

function formatTime(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const whole = Math.floor(Math.abs(seconds))
  return `${sign}${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

async function loadSong(fileName: FixtureName): Promise<void> {
  const fixture = FIXTURES.find((f) => f.fileName === fileName)
  if (fixture === undefined || session === null) return
  error.value = ''
  try {
    const bytes = new Uint8Array(await (await fetch(fixture.url)).arrayBuffer())
    const song = await importMidi(bytes, { fileName })
    const prepared = session.load(song)
    loaded.value = prepared
    engine?.setSong({
      notes: prepared.notes,
      ppq: song.ppq,
      barMap: prepared.barMap,
      pedalIntervals: prepared.pedalIntervals,
      endTick: song.durationTicks,
    })
    syncLoopLabel()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
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

watch(selected, (fileName) => void loadSong(fileName))
watch(tempoPercent, (p) => session?.transport.setTempoPercent(p))
watch(preRollBeats, (beats) => session?.transport.setPreRoll({ beats, mode: 'muted' }))
watch(
  () => settingsStore.settings,
  () => engine?.applySettings(settingsStore.snapshot()),
  { deep: true },
)

onMounted(() => {
  session = new PlaybackSession({
    onProgress: (done, total) => (sampleProgress.value = { loaded: done, total }),
  })
  session.ready.then(
    () => (samplesReady.value = true),
    (e: unknown) => (error.value = `Samples failed to load: ${String(e)}`),
  )
  const audibleTick = session.audibleTick.bind(session)
  engine = new Engine()
  engine.applySettings(settingsStore.snapshot())
  engine.setGuides(route.query.guides === '1')
  if (route.query.stats === '1') {
    // Debug-only (like ?guides=1): lets a test harness read frame timings for perf reports.
    const stats = () => engine?.stats()
    Object.assign(window, { pianomeisterEngineStats: stats })
  }
  engine.setTimeSource(audibleTick)
  if (canvas.value !== null) {
    engine.mount(canvas.value)
    resizeObserver = new ResizeObserver(() => engine?.resize())
    resizeObserver.observe(canvas.value)
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('pointerdown', onGesture)
  hudFrame = requestAnimationFrame(updateHud)
  void loadSong(selected.value)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('pointerdown', onGesture)
  cancelAnimationFrame(hudFrame)
  resizeObserver?.disconnect()
  engine?.dispose()
  session?.dispose()
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
      </div>
    </section>

    <section class="hud center" aria-label="Controls">
      <div class="row">
        <select v-model="selected" data-testid="song-picker" aria-label="Song">
          <option v-for="f in FIXTURES" :key="f.fileName" :value="f.fileName">{{ f.title }}</option>
        </select>
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
        <span v-if="error" class="error">{{ error }}</span>
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

    <SettingsPanel v-if="settingsOpen" @close="settingsOpen = false" />
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
