<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { HandAssignment } from '@/core/hands/HandAssignment'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import { summariseMeter } from '@/core/timing/summariseMeter'
import { preRollBeat } from '@/core/transport/preRollBeat'
import type { LoopRange } from '@/core/transport/LoopRange'
import type { OpenedSong } from '@/data/OpenedSong'
import { Engine } from '@/engine/Engine'

import IconButton from '../components/IconButton.vue'
import { formatTime } from '../format/formatTime'
import { isTypingTarget } from '../input/isTypingTarget'
import type { LoadedSong } from '../playback/LoadedSong'
import type { PlaybackSession } from '../playback/PlaybackSession'
import { sceneSnapshot } from '../playback/sceneSnapshot'
import { sharedSession } from '../playback/sharedSession'
import { toAudioSettings } from '../playback/toAudioSettings'
import BarBeatCounter from '../player/BarBeatCounter.vue'
import HudMenuButton from '../player/HudMenuButton.vue'
import LoopPopover from '../player/LoopPopover.vue'
import PlayerTimeline from '../player/PlayerTimeline.vue'
import PlayfieldSidebar from '../player/PlayfieldSidebar.vue'
import type { RenderStatus } from '../player/RenderStatus'
import TempoPopover from '../player/TempoPopover.vue'
import { useIdleHide } from '../player/useIdleHide'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import { useUiStateStore } from '../stores/uiStateStore'

// Dialogs aren't needed to play: loaded on first open (keeps the main bundle small).
const SongPicker = defineAsyncComponent(() => import('../picker/SongPicker.vue'))
const SettingsWindow = defineAsyncComponent(() => import('../settings/SettingsWindow.vue'))

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()
const library = useLibraryStore()
const toasts = useToastStore()
const ui = useUiStateStore()
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

const pickerOpen = ref(false)
const pickerLoaded = ref(false)
const settingsOpen = ref(false)
const settingsLoaded = ref(false)
const tempoOpen = ref(false)
const loopOpen = ref(false)

const tempoPercent = ref(100)
const loop = shallowRef<LoopRange | null>(null)
/** What the loop button turns on: the last loop set (bars 1–4 until then). */
const loopDraft = shallowRef<LoopRange>({ startBar: 1, endBar: 4 })

const hud = ref({
  state: 'stopped',
  seconds: 0,
  bar: 0,
  beat: 1,
  beats: 4,
  /** In a count-in: the counter shows its target bar dimmed, the dots count its beats. */
  preRoll: false,
  dotBeat: 1,
  dotBeats: 4,
  songBpm: 0,
  currentBpm: 0,
  tick: 0,
})
/** The pointer is over the app menu or the playback block: they never hide then. */
const overMenu = ref(false)
const overPlayback = ref(false)
/** Keyboard focus is on a playfield panel control. */
const focusInSidebar = ref(false)

// Decision 64: while playing, the app menu and the playback block (transport and toggles) fade
// out after the chosen idle time. The timeline and all the info text stay.
const controlsHidden = useIdleHide(
  () => {
    const after = settingsStore.settings.appearance.hideControls
    return after === 'off' ? null : Number(after) * 1000
  },
  () =>
    hud.value.state === 'playing' &&
    !overMenu.value &&
    !overPlayback.value &&
    !focusInSidebar.value &&
    !pickerOpen.value &&
    !settingsOpen.value &&
    !tempoOpen.value &&
    !loopOpen.value,
)

/** Tracks focus within the playfield panel (focusout to a child is followed by a focusin). */
function trackSidebarFocus(event: FocusEvent): void {
  const panel = event.currentTarget as HTMLElement
  focusInSidebar.value =
    event.type === 'focusin' || panel.contains(event.relatedTarget as Node | null)
}

const title = computed(() => entry.value?.title ?? '')
const composer = computed(() => entry.value?.composer ?? '')
const length = computed(() => formatTime(loaded.value?.song.durationSeconds ?? 0))
const barCount = computed(() => loaded.value?.barMap.barCount ?? 0)
const firstBar = computed(() => loaded.value?.barMap.firstBar ?? 1)
const lastBar = computed(() => Math.max(firstBar.value, barCount.value))
const endTick = computed(() => Math.max(1, loaded.value?.song.durationTicks ?? 1))
/** Slot widths of the bar:beat counter: the highest bar number and the largest beat count. */
const barDigits = computed(() => String(lastBar.value).length)
const beatDigits = computed(() => {
  const map = loaded.value?.barMap
  if (map === undefined) return 1
  const most = Math.max(...summariseMeter(map).runs.map((r) => Number.parseInt(r.meter, 10)))
  return String(Number.isFinite(most) ? most : 4).length
})
const tempoChanged = computed(() => tempoPercent.value !== 100)
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
const position = computed(() => Math.min(1, Math.max(0, hud.value.tick / endTick.value)))
/** Bar lines on the timeline: every bar, or every 2nd, 4th… bar so at most 64 show. */
const barTicks = computed(() => {
  const map = loaded.value?.barMap
  if (map === undefined) return []
  let step = 1
  while (barCount.value / step > 64) step *= 2
  const ticks: number[] = []
  for (let bar = 1 + step; bar <= barCount.value; bar += step) {
    ticks.push(map.barStartTick(bar) / endTick.value)
  }
  return ticks
})
const loopRegion = computed(() => {
  const range = loop.value
  const map = loaded.value?.barMap
  if (range === null || map === undefined) return null
  return {
    from: map.barStartTick(range.startBar) / endTick.value,
    to: Math.min(1, map.barEndTick(range.endBar) / endTick.value),
    startBar: range.startBar,
    endBar: range.endBar,
  }
})

function barAt(fraction: number): number {
  const map = loaded.value?.barMap
  if (map === undefined) return 1
  return Math.min(lastBar.value, map.tickToPosition(fraction * endTick.value).bar)
}

/**
 * Opens a song (the library's start song on arrival, or one chosen in the picker), then
 * attaches the playback session. The order matters on a first visit: creating the session
 * starts ~230 sample downloads, and the song's manifest and MIDI requests would otherwise
 * queue behind them, leaving the player empty for seconds on a slow connection.
 */
async function openSong(songId?: string): Promise<void> {
  error.value = ''
  let opened: OpenedSong | null = null
  try {
    opened = await library.openSong(songId ?? (await library.startSongId()))
  } catch (e) {
    showError(e instanceof Error ? e.message : String(e))
    console.error("[player] Couldn't open the song:", e)
  }
  if (unmounted) return
  const playback = session ?? attachSession()
  if (opened !== null) showSong(playback, opened)
}

function attachSession(): PlaybackSession {
  const playback = sharedSession()
  session = playback
  // The controls show what the shared transport already has (e.g. after visiting the library).
  tempoPercent.value = playback.transport.tempoPercent
  loop.value = playback.transport.loop
  if (loop.value !== null) loopDraft.value = loop.value
  applyPractice()
  playback.setAudioSettings(toAudioSettings(settingsStore.settings.audio))
  stopProgress = playback.onSampleProgress(
    (done, total) => (sampleProgress.value = { loaded: done, total }),
  )
  playback.ready.then(
    () => (samplesReady.value = true),
    (e: unknown) => showError(`Samples failed to load: ${String(e)}`),
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
  const sameSong = playback.songKey === key && current !== null
  const prepared = sameSong
    ? current
    : playback.load(opened.song, { hands: opened.hands, override: opened.override, key })
  entry.value = opened.entry
  hands.value = opened.hands
  loaded.value = prepared
  if (!sameSong) {
    loop.value = null
    loopDraft.value = {
      startBar: prepared.barMap.firstBar,
      endBar: Math.min(prepared.barMap.barCount, 4),
    }
  }
  void library.setLastSongId(songId).then((saved) => {
    if (!saved) showError(library.error)
  })
  engine?.setSong({
    notes: prepared.notes,
    ppq: opened.song.ppq,
    barMap: prepared.barMap,
    pedalIntervals: prepared.pedalIntervals,
    endTick: opened.song.durationTicks,
  })
}

function showError(message: string): void {
  error.value = message
  if (message !== '') toasts.show(message, 'error')
}

function togglePlay(): void {
  if (!samplesReady.value) return
  void session?.togglePlay()
}

function setLoop(range: LoopRange | null): void {
  try {
    session?.transport.setLoop(range)
    loop.value = session?.transport.loop ?? null
    if (loop.value !== null) loopDraft.value = loop.value
    error.value = ''
  } catch (e) {
    showError(e instanceof Error ? e.message : String(e))
  }
}

function toggleLoop(): void {
  setLoop(loop.value === null ? loopDraft.value : null)
}

function backToStart(): void {
  session?.transport.stop()
  loopOpen.value = false
}

function seekBar(bar: number): void {
  session?.transport.seekToBar(bar)
}

function applyPractice(): void {
  const { preRollBeats, preRollMode } = settingsStore.settings.practice
  session?.transport.setPreRoll({ beats: preRollBeats, mode: preRollMode })
}

function updateHud(): void {
  hudFrame = requestAnimationFrame(updateHud)
  const prepared = loaded.value
  if (session === null || prepared === null) return
  const { transport } = session
  const seconds = transport.position
  const tick = prepared.tempoMap.secondsToTick(seconds)
  const songBpm = prepared.tempoMap.bpmAt(Math.max(0, tick))
  // Decision 60: never bar 0 or negative bars during a count-in, but the bar it leads into.
  const count = transport.activePreRoll
  const at = prepared.barMap.tickToPosition(count === null ? tick : count.targetTick)
  const beats = prepared.barMap.beatsPerBar(Math.max(at.bar, prepared.barMap.firstBar))
  hud.value = {
    state: transport.state,
    seconds,
    bar: Math.max(at.bar, prepared.barMap.firstBar),
    beat: count === null ? at.beat : 1,
    beats,
    preRoll: count !== null,
    dotBeat: count === null ? at.beat : preRollBeat(count, seconds),
    dotBeats: count === null ? beats : count.beats,
    songBpm,
    currentBpm: (songBpm * transport.tempoPercent) / 100,
    tick: Math.max(0, tick),
  }
}

function toggleSidebar(): void {
  ui.sidebarOpen = !ui.sidebarOpen
}

function openPicker(): void {
  pickerLoaded.value = true
  pickerOpen.value = true
}

function openSettings(): void {
  settingsLoaded.value = true
  settingsOpen.value = true
}

function openLibrary(): void {
  void router.push({ name: 'library' })
}

function onPicked(songId: string): void {
  pickerOpen.value = false
  void openSong(songId)
}

/** Shortcuts (decision 60); ignored while typing, and while a dialog has the keyboard. */
function onKeyDown(event: KeyboardEvent): void {
  if (session === null || event.defaultPrevented || isTypingTarget(event.target)) return
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (pickerOpen.value || settingsOpen.value) return
  const actions: Record<string, () => void> = {
    Space: togglePlay,
    ArrowLeft: () => session?.transport.prevBar(),
    ArrowRight: () => session?.transport.nextBar(),
    Home: backToStart,
    KeyO: openPicker,
    KeyL: openLibrary,
    KeyP: toggleSidebar,
    Comma: openSettings,
  }
  const action = actions[event.code]
  if (action === undefined) return
  event.preventDefault()
  action()
}

const onGesture = () => void session?.unlock()

/** For the render readout: what the engine renders at and how long a frame takes. */
function renderStatus(): RenderStatus | null {
  const info = engine?.renderInfo() ?? null
  return info === null ? null : { info, frameMs: engine?.stats().averageFrameMs ?? 0 }
}

watch(tempoPercent, (p) => session?.transport.setTempoPercent(p))
watch(
  () => settingsStore.settings,
  (settings, previous) => {
    engine?.applySettings(settingsStore.snapshot())
    if (settings.audio !== previous.audio)
      session?.setAudioSettings(toAudioSettings(settings.audio))
    if (settings.practice !== previous.practice) applyPractice()
  },
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
  void openSong()
})

onBeforeUnmount(() => {
  unmounted = true
  // The library shows the scene's last frame behind its glass.
  sceneSnapshot.value = engine?.captureFrame() ?? sceneSnapshot.value
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
  <main class="player" :class="{ 'with-sidebar': ui.sidebarOpen }">
    <div class="stage" :class="{ idle: controlsHidden }">
      <canvas ref="canvas" class="canvas" data-testid="stage" />

      <!-- Decision 60: the timeline runs along the top edge and never hides. -->
      <PlayerTimeline
        class="timeline-strip"
        :position="position"
        :loop="loopRegion"
        :ticks="barTicks"
        :bar="hud.bar"
        :first-bar="firstBar"
        :last-bar="lastBar"
        :bar-at="barAt"
        @seek-bar="seekBar"
      />

      <!-- Left: what you're playing and where you are, then the app menu. -->
      <div class="side left">
        <section class="hud-text song" aria-label="Song">
          <h1 class="title" :title="title" data-testid="hud-title">
            {{ title }}
          </h1>
          <p v-if="composer" class="composer" :title="composer" data-testid="hud-composer">
            {{ composer }}
          </p>
          <BarBeatCounter
            :bar="hud.bar"
            :beat="hud.beat"
            :pre-roll="hud.preRoll"
            :dot-beat="hud.dotBeat"
            :dot-beats="hud.dotBeats"
            :bar-digits="barDigits"
            :beat-digits="beatDigits"
          />
          <p class="sub">
            bar {{ hud.bar }} of
            <span data-testid="hud-bars">{{ barCount }}</span>
          </p>
          <p class="visually-hidden" data-testid="hud-hands">
            {{ handsLabel }}
          </p>
        </section>

        <nav
          class="app-menu fades"
          :class="{ hidden: controlsHidden }"
          aria-label="App"
          data-testid="app-menu"
          @pointerenter="overMenu = true"
          @pointerleave="overMenu = false"
        >
          <HudMenuButton
            icon="song"
            label="Change song"
            shortcut="O"
            data-testid="open-picker"
            @click="openPicker"
          />
          <HudMenuButton
            icon="library"
            label="Library"
            shortcut="L"
            data-testid="menu-library"
            @click="openLibrary"
          />
          <HudMenuButton
            icon="sliders"
            label="Playfield panel"
            shortcut="P"
            :active="ui.sidebarOpen"
            data-testid="toggle-sidebar"
            @click="toggleSidebar"
          />
          <HudMenuButton
            icon="settings"
            label="Settings"
            shortcut=","
            data-testid="menu-settings"
            @click="openSettings"
          />
        </nav>
      </div>

      <!-- Right: tempo and time, then playback. -->
      <div class="side right">
        <section class="hud-text tempo" aria-label="Tempo and time">
          <p class="bpm-line">
            <span class="bpm" data-testid="hud-bpm">{{ hud.currentBpm.toFixed(0) }}</span>
            <span class="unit">bpm</span>
          </p>
          <p class="sub" data-testid="hud-tempo">
            <span :class="{ accent: tempoChanged }" data-testid="hud-tempo-percent"
              >{{ tempoPercent }}%</span
            >
            of {{ hud.songBpm.toFixed(0) }} bpm
          </p>
          <p class="time">
            <span data-testid="hud-position">{{ formatTime(hud.seconds) }}</span>
            / {{ length }}
          </p>
        </section>

        <section
          class="playback fades"
          :class="{ hidden: controlsHidden }"
          aria-label="Playback"
          data-testid="player-controls"
          @pointerenter="overPlayback = true"
          @pointerleave="overPlayback = false"
        >
          <div class="transport" role="toolbar" aria-label="Transport">
            <IconButton icon="prevBar" label="Previous bar" @click="session?.transport.prevBar()" />
            <IconButton
              :icon="hud.state === 'playing' ? 'pause' : 'play'"
              :label="hud.state === 'playing' ? 'Pause' : 'Play'"
              size="lg"
              variant="outline"
              :disabled="!samplesReady"
              data-testid="play-pause"
              @click="togglePlay"
            />
            <IconButton icon="nextBar" label="Next bar" @click="session?.transport.nextBar()" />
          </div>
          <div class="toggles">
            <LoopPopover
              v-model:open="loopOpen"
              :loop="loop"
              :draft="loopDraft"
              :first-bar="firstBar"
              :last-bar="lastBar"
              @update:draft="loopDraft = $event"
              @toggle="toggleLoop"
              @set="setLoop"
              @clear="setLoop(null)"
              @to-start="backToStart"
            />
            <TempoPopover
              v-model:open="tempoOpen"
              v-model:tempo-percent="tempoPercent"
              :current-bpm="hud.currentBpm"
            />
          </div>
        </section>

        <p class="status">
          <span v-if="!samplesReady">Piano samples </span>
          <span :class="{ 'visually-hidden': samplesReady }" data-testid="sample-status">{{
            sampleStatus
          }}</span>
          <span class="visually-hidden" data-testid="transport-state">{{ hud.state }}</span>
          <span v-if="error" class="visually-hidden" data-testid="player-error">{{ error }}</span>
        </p>
      </div>
    </div>

    <Transition name="sidebar">
      <PlayfieldSidebar
        v-if="ui.sidebarOpen"
        :render-status="renderStatus"
        @close="ui.sidebarOpen = false"
        @open-settings="openSettings"
        @focusin="trackSidebarFocus($event)"
        @focusout="trackSidebarFocus($event)"
      />
    </Transition>

    <SongPicker
      v-if="pickerLoaded"
      v-model:open="pickerOpen"
      :current-song-id="entry?.songId ?? null"
      @load="onPicked"
      @open-library="openLibrary"
    />
    <SettingsWindow
      v-if="settingsLoaded"
      v-model:open="settingsOpen"
      @open-playfield="((settingsOpen = false), (ui.sidebarOpen = true))"
    />
  </main>
</template>

<style scoped>
.player {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  /* One row exactly the viewport tall: the sidebar scrolls inside it instead of stretching the
     row (and the canvas) to its content height. */
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
  background: var(--bg);
}

.stage {
  position: relative;
  min-width: 0;
  overflow: hidden;
}

.canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* Decision 60: no panels, pills or scrims behind the HUD; text shadows keep it readable. */
.timeline-strip {
  position: absolute;
  top: 0;
  right: 28px;
  left: 28px;
}

.side {
  position: absolute;
  top: 50px;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.side > * {
  pointer-events: auto;
}

.left {
  left: 28px;
  max-width: 45%;
}

.right {
  right: 28px;
  align-items: flex-end;
}

.hud-text {
  display: flex;
  flex-direction: column;
  color: var(--text-1);
  text-shadow: var(--text-shadow-hud);
}

.hud-text p {
  margin: 0;
}

.song {
  gap: 2px;
}

.tempo {
  align-items: flex-end;
  gap: 2px;
}

.title,
.composer {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  line-height: 1.25;
}

.composer {
  color: var(--text-3);
  font-size: var(--text-sm);
}

.sub {
  color: var(--text-3);
  font-size: var(--text-sm);
}

.song .sub {
  margin-top: 6px;
}

.bpm-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  line-height: 1;
}

.bpm {
  font-size: var(--text-hero);
  font-weight: var(--weight-light);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  text-shadow: var(--text-shadow-hud-number);
}

.unit {
  color: var(--text-4);
  font-size: var(--text-sm);
}

.accent {
  color: var(--primary);
}

.time {
  margin-top: var(--space-3) !important;
  color: var(--text-2);
  font-size: var(--text-sm);
}

.app-menu {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin-top: 44px;
}

.playback {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  margin-top: 36px;
}

.transport {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: -9px;
  filter: var(--icon-shadow-hud);
}

.transport :deep(.icon-button) {
  background: transparent;
  color: rgb(232 236 246 / 85%);
}

.transport :deep(.icon-button:hover:not(:disabled)) {
  background: transparent;
  color: var(--text-strong);
}

.toggles {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  margin-top: 6px;
}

/* Idle while playing: the menu and the playback block fade (no movement) and stop taking clicks
   until the next activity. */
.fades {
  transition: opacity var(--dur-slow) var(--ease-out);
}

.fades.hidden {
  opacity: 0;
  pointer-events: none;
}

.stage.idle {
  cursor: none;
}

.status {
  min-height: 1em;
  margin: var(--space-2) 0 0;
  color: var(--text-3);
  font-size: var(--text-xs);
  text-shadow: var(--text-shadow-hud);
}
.sidebar-enter-active,
.sidebar-leave-active {
  transition:
    transform var(--dur-slow) var(--ease-out),
    opacity var(--dur-slow) var(--ease-out);
}

.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
  transform: translateX(calc(var(--move) * 40px));
}

@media (width < 900px) {
  .timeline-strip {
    right: var(--space-4);
    left: var(--space-4);
  }

  .left {
    left: var(--space-4);
  }

  .right {
    right: var(--space-4);
  }
}
</style>
