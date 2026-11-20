<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import type { CommandId } from '@/core/commands/CommandId'
import { commandForEvent } from '@/core/commands/shortcutBindings'
import { tempoSliderRange } from '@/core/practice/tempoSliderRange'
import type { HandAssignment } from '@/core/hands/HandAssignment'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import { sameRange } from '@/core/practice/diffFromBookmark'
import type { MetronomeMode } from '@/core/practice/MetronomeMode'
import { summariseMeter } from '@/core/timing/summariseMeter'
import { preRollBeat } from '@/core/transport/preRollBeat'
import type { LoopRange } from '@/core/transport/LoopRange'
import type { OpenedSong } from '@/data/OpenedSong'
import { Engine } from '@/engine/Engine'

import AppIcon from '../components/AppIcon.vue'
import IconButton from '../components/IconButton.vue'
import { formatTime } from '../format/formatTime'
import { isTypingTarget } from '../input/isTypingTarget'
import { keyCapture } from '../input/keyCapture'
import type { LoadedSong } from '../playback/LoadedSong'
import type { PlaybackSession } from '../playback/PlaybackSession'
import { attachPlayLog } from '../playback/playLog'
import { sceneSnapshot } from '../playback/sceneSnapshot'
import { sharedSession } from '../playback/sharedSession'
import { toAudioSettings } from '../playback/toAudioSettings'
import BarBeatCounter from '../player/BarBeatCounter.vue'
import HudMenuButton from '../player/HudMenuButton.vue'
import { playerActionsKey } from '../player/playerActionsKey'
import HudToggle from '../player/HudToggle.vue'
import LoopPopover from '../player/LoopPopover.vue'
import PlayerTimeline from '../player/PlayerTimeline.vue'
import PlayfieldSidebar from '../player/PlayfieldSidebar.vue'
import type { RenderStatus } from '../player/RenderStatus'
import TempoPopover from '../player/TempoPopover.vue'
import { useIdleHide } from '../player/useIdleHide'
import ProfileMenu from '../player/ProfileMenu.vue'
import { useLoopNudge } from '../player/useLoopNudge'
import { useSaveBookmark } from '../player/useSaveBookmark'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useLibraryStore } from '../stores/libraryStore'
import { usePracticeStore } from '../stores/practiceStore'
import { useProfileStore } from '../stores/profileStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import { useUiStateStore } from '../stores/uiStateStore'

// Dialogs aren't needed to play: separate chunks (keeps the main bundle small), fetched when the
// player mounts (see onMounted) so the first open doesn't wait.
const loadPicker = () => import('../picker/SongPicker.vue')
const SongPicker = defineAsyncComponent(loadPicker)
const loadSettingsWindow = () => import('../settings/SettingsWindow.vue')
const SettingsWindow = defineAsyncComponent(loadSettingsWindow)

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()
const library = useLibraryStore()
const toasts = useToastStore()
const ui = useUiStateStore()
const practice = usePracticeStore()
const bookmarks = useBookmarkStore()
const profiles = useProfileStore()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')

// Engine and audio live outside Vue's reactivity; the HUD copies what it shows once per frame.
// The playback session is shared and outlives this view (brief decision 38).
let session: PlaybackSession | null = null
let engine: Engine | null = null
let resizeObserver: ResizeObserver | null = null
let stopProgress: (() => void) | null = null
let hudFrame = 0
let unmounted = false
/** The stored bar to start at, read with the start entry. */
let stoppedBar: number | null = null
let stopBarWatch: (() => void) | null = null

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

/** Tempo and loop are the practice store's: a loaded bookmark's are temporary (decision 69). */
const tempoPercent = computed({
  get: () => practice.current.tempoPercent,
  set: (value: number) => practice.setTempo(value),
})
const loop = computed(() => practice.current.loop)
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
    const { hideControls, hideControlsAfter } = settingsStore.settings.appearance
    return hideControls ? hideControlsAfter * 1000 : null
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
/** What's playing now, under the composer (decision 60): a bookmark, Full song, or the setup. */
const nowPlaying = computed(() => practice.now)
/** The custom line's hover hint, with the key in effect for Save as bookmark. */
const customHint = computed(() => {
  const key = shortcutLabel('saveBookmark')
  return key === ''
    ? 'Doesn’t match a bookmark · Save as bookmark to keep it'
    : `Doesn’t match a bookmark · press ${key} to save it`
})
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
/**
 * Opens a song with a bookmark (or Full song). An explicit choice (`songId` given, or a "Load"
 * requested elsewhere) always loads fresh; arriving back at the player keeps what's loaded,
 * temporary changes included.
 */
async function openSong(songId?: string, bookmarkId: string | null = null): Promise<void> {
  const fresh = practice.takeFreshLoad() || songId !== undefined
  error.value = ''
  let opened: OpenedSong | null = null
  let chosen: string | null = bookmarkId
  try {
    await bookmarks.refresh()
    const target: { songId: string; bookmarkId: string | null; bar?: number } =
      songId === undefined ? await library.startEntry() : { songId, bookmarkId }
    chosen = target.bookmarkId
    stoppedBar = target.bar ?? null
    opened = await library.openSong(target.songId)
  } catch (e) {
    showError(e instanceof Error ? e.message : String(e))
    console.error("[player] Couldn't open the song:", e)
  }
  if (unmounted) return
  const playback = session ?? attachSession()
  if (opened !== null) {
    const kept = showSong(playback, opened, chosen, fresh)
    // Starting up: back where playback last stopped (inside the loop, decision 8), so Welcome's
    // backdrop and Resume are there (m7-7 decision 6). A song kept as it was keeps its place.
    if (!kept && songId === undefined && stoppedBar !== null) {
      playback.transport.seekToBar(stoppedBar)
    }
  }
  // The picker lists the whole library: load it now, so its keys work the moment it opens.
  if (!library.loaded) void library.refresh().catch(() => undefined)
}

function attachSession(): PlaybackSession {
  const playback = sharedSession()
  session = playback
  attachPlayLog(playback)
  // Remember where playback stopped, for Welcome's Resume (m7-7 decision 6).
  stopBarWatch = playback.bus.on('timelineChange', ({ reason }) => {
    if (reason === 'pause' || reason === 'stop' || reason === 'end') rememberBar()
    // Behind Welcome the scene is frozen: a seek or a new song still needs its one frame.
    engine?.invalidate()
  })
  if (loop.value !== null) loopDraft.value = loop.value
  applyPractice()
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
function showSong(
  playback: PlaybackSession,
  opened: OpenedSong,
  requestedBookmarkId: string | null,
  fresh: boolean,
): boolean {
  const songId = opened.entry.songId
  // A bookmark that's gone (deleted, another profile's, another song's) loads Full song.
  const bookmarkId =
    requestedBookmarkId !== null && bookmarks.byId.get(requestedBookmarkId)?.songId === songId
      ? requestedBookmarkId
      : null
  const sameEntry = !fresh && practice.songId === songId && practice.bookmarkId === bookmarkId
  loopNudge.cancel()
  const key = JSON.stringify([songId, opened.hands, opened.override])
  const current = playback.song
  const sameSong = playback.songKey === key && current !== null
  const prepared = sameSong
    ? current
    : playback.load(opened.song, { hands: opened.hands, override: opened.override, key })
  entry.value = opened.entry
  hands.value = opened.hands
  loaded.value = prepared
  const map = prepared.barMap
  // Loading another song or bookmark drops temporary changes; coming back keeps them.
  if (!sameEntry) {
    practice.load(songId, bookmarkId, {
      first: map.firstBar,
      last: Math.max(map.firstBar, map.barCount),
    })
  }
  loopDraft.value = loop.value ?? { startBar: map.firstBar, endBar: Math.min(map.barCount, 4) }
  applyPractice()
  void library.setLastOpened(songId, bookmarkId).then((saved) => {
    if (!saved) showError(library.error)
  })
  engine?.setSong({
    notes: prepared.notes,
    ppq: opened.song.ppq,
    barMap: prepared.barMap,
    pedalIntervals: prepared.pedalIntervals,
    endTick: opened.song.durationTicks,
  })
  return sameEntry
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
  loopNudge.cancel()
  practice.setLoop(range)
  if (range !== null) loopDraft.value = range
}

function toggleLoop(): void {
  const pending = loopNudge.pending.value
  if (pending !== null) {
    // Nudges still waiting show the loop as on, so the button turns it off; their range becomes
    // the one the button turns on next.
    loopDraft.value = pending
    setLoop(null)
    return
  }
  setLoop(loop.value === null ? loopDraft.value : null)
}

/** Loop nudges (decision 92): shown at once, applied (loop on, one jump) when they pause. */
const loopNudge = useLoopNudge({
  base: () => loop.value ?? loopDraft.value,
  firstBar: () => firstBar.value,
  lastBar: () => lastBar.value,
  apply: (range) => {
    if (!sameRange(loop.value, range)) setLoop(range)
  },
})
/** The loop as shown: nudges still waiting, else the loop in effect. */
const shownLoop = computed(() => loopNudge.pending.value ?? loop.value)

function backToStart(): void {
  session?.transport.stop()
  loopOpen.value = false
}

function seekBar(bar: number): void {
  session?.transport.seekToBar(bar)
}

/** The loop jump (practice.loopJump) the transport has carried out. */
let appliedJump = -1

/**
 * Applies the practice setup (decisions 68–69) to the transport and the audio. A committed loop
 * change also moves the playhead to the loop start (decision 8): this is the one place that
 * happens, after the new loop is set.
 */
function applyPractice(): void {
  if (session === null) return
  const { transport } = session
  const current = practice.current
  const preRoll = transport.preRoll
  if (preRoll.beats !== current.preRollBeats || preRoll.mode !== current.preRollMode) {
    transport.setPreRoll({ beats: current.preRollBeats, mode: current.preRollMode })
  }
  if (transport.tempoPercent !== current.tempoPercent) {
    transport.setTempoPercent(current.tempoPercent)
  }
  if (session.song !== null && !sameRange(transport.loop, current.loop)) {
    try {
      transport.setLoop(current.loop)
      error.value = ''
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e))
    }
  }
  if (session.song !== null && appliedJump !== practice.loopJump) {
    appliedJump = practice.loopJump
    transport.seekToLoopStart()
  }
  applyAudio()
}

/** Volumes and the metronome are global; hand modes come from the practice setup. */
function applyAudio(): void {
  const { handAudio, metronomeMode } = practice.current
  session?.setAudioSettings(
    toAudioSettings({
      ...settingsStore.settings.audio,
      rightAudio: handAudio.right,
      leftAudio: handAudio.left,
      metronomeMode,
    }),
  )
}

/** The mode M and the metronome icon turn on: the last one that wasn't off. */
const lastMetronomeMode = ref<Exclude<MetronomeMode, 'off'>>('always')
const metronomeMode = computed(() => practice.current.metronomeMode)
watch(metronomeMode, (mode) => {
  if (mode !== 'off') lastMetronomeMode.value = mode
})

/** Off ↔ the last mode; temporary with a bookmark loaded, the setting with Full song (decision 61). */
function toggleMetronome(): void {
  practice.setMetronomeMode(metronomeMode.value === 'off' ? lastMetronomeMode.value : 'off')
}

/** "Save as bookmark" (icon, B, loop popover): one click, no dialog (decision 69). */
const saveAsBookmark = useSaveBookmark()

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
  if (onWelcome.value) {
    ui.sidebarOpen = true
    void router.push({ name: 'player' })
    return
  }
  ui.sidebarOpen = !ui.sidebarOpen
}

/** The bar the playhead is in now, for remembering where playback stopped. */
function currentBar(): number | null {
  const song = loaded.value
  if (song === null || session === null) return null
  const tick = song.tempoMap.secondsToTick(Math.max(0, session.transport.position))
  return song.barMap.tickToPosition(tick).bar
}

function rememberBar(): void {
  const bar = currentBar()
  if (bar !== null) void library.setStoppedBar(bar)
}

function goHome(): void {
  void router.push({ name: 'welcome' })
}

function openStats(): void {
  void router.push({ name: 'stats' })
}

/** Welcome is shown over the player (m7-7 decision 12): the scene, paused, is its backdrop. */
const onWelcome = computed(() => route.name === 'welcome')
watch(onWelcome, (welcome) => {
  // A still backdrop: no render loop while Welcome is shown (weak tablets; m7-7 round 2).
  engine?.setFrozen(welcome)
  if (!welcome) return
  if (session?.transport.state === 'playing') session.transport.pause()
  else rememberBar()
})

provide(playerActionsKey, {
  resume: () => void router.push({ name: 'player' }),
  play: async (songId, bookmarkId) => {
    practice.requestFreshLoad()
    await openSong(songId, bookmarkId)
    await router.push({ name: 'player' })
  },
  choose: openPicker,
  openPlayfield: () => {
    ui.sidebarOpen = true
    void router.push({ name: 'player' })
  },
  openSettings: (tab) => {
    if (tab !== undefined) ui.settingsTabRequest = tab
    openSettings()
  },
})

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

function onPicked(songId: string, bookmarkId: string | null): void {
  pickerOpen.value = false
  void openSong(songId, bookmarkId)
  // Chosen from Welcome ("Choose another..."): straight to the player.
  if (onWelcome.value) void router.push({ name: 'player' })
}

/** A command's key as written in hints ("B"), or "" without one (decision 87). */
const shortcutLabel = (id: CommandId) => settingsStore.shortcutLabel(id)

/**
 * Tempo keys (decision 89): the tempo step up or down, inside the tempo slider's range, or back
 * to 100%. Through the practice store, so with a bookmark loaded they're temporary changes.
 */
function stepTempo(direction: -1 | 1): void {
  const range = tempoSliderRange(settingsStore.settings.practice.tempoStep)
  const next = tempoPercent.value + direction * range.step
  tempoPercent.value = Math.min(range.max, Math.max(range.min, next))
}

/** What each player command does; its keys come from the shortcuts (decisions 80, 88). */
const PLAYER_ACTIONS: Readonly<Partial<Record<CommandId, () => void>>> = {
  playPause: togglePlay,
  previousBar: () => session?.transport.prevBar(),
  nextBar: () => session?.transport.nextBar(),
  stop: backToStart,
  saveBookmark: () => void saveAsBookmark(),
  toggleMetronome,
  openPicker,
  openLibrary,
  togglePlayfield: toggleSidebar,
  openSettings,
  tempoDown: () => stepTempo(-1),
  tempoUp: () => stepTempo(1),
  tempoReset: () => (tempoPercent.value = 100),
  toggleLoop,
  loopStartEarlier: () => loopNudge.nudge('start', -1),
  loopStartLater: () => loopNudge.nudge('start', 1),
  loopEndEarlier: () => loopNudge.nudge('end', -1),
  loopEndLater: () => loopNudge.nudge('end', 1),
  // "Back to bookmark": nothing to do while the setup matches the last loaded entry.
  revertBookmark: () => {
    if (practice.changed.length > 0) practice.backToLoaded()
  },
}

/** Shortcuts (decision 60); ignored while typing, and while a dialog has the keyboard. */
function onKeyDown(event: KeyboardEvent): void {
  if (session === null || event.defaultPrevented || isTypingTarget(event.target)) return
  // Behind Welcome the player's keys rest; Welcome has its own (Enter resumes).
  if (onWelcome.value) return
  if (keyCapture.value || pickerOpen.value || settingsOpen.value || ui.shortcutsOpen) return
  const command = commandForEvent(settingsStore.bindings, 'player', event)
  const action = command === null ? undefined : PLAYER_ACTIONS[command]
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

watch(() => [practice.current, practice.loopJump], applyPractice)
watch(
  () => settingsStore.settings,
  (settings, previous) => {
    engine?.applySettings(settingsStore.snapshot())
    if (settings.audio !== previous.audio) applyAudio()
  },
)
// "Change shortcuts…" from the cheat sheet on another page: open the settings once here.
watch(
  () => ui.settingsTabRequest,
  (tab) => {
    if (tab !== null) openSettings()
  },
  { immediate: true },
)
// Switching profiles stops playback and opens that profile's last song or bookmark (decision 66).
watch(
  () => profiles.switches,
  () => {
    session?.transport.stop()
    practice.unload()
    void openSong().then(() => toasts.show(`Switched to ${profiles.active.name}`))
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
    engine.setFrozen(onWelcome.value)
    resizeObserver = new ResizeObserver(() => engine?.resize())
    resizeObserver.observe(canvas.value)
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('pointerdown', onGesture)
  hudFrame = requestAnimationFrame(updateHud)
  // Ask for the picker and settings chunks before the session starts ~230 sample downloads:
  // requests queue per host, and behind the samples the first O or Settings click would wait
  // for seconds on a slow connection (or a busy dev server). Imports are cached, so the click
  // later finds them ready.
  void loadPicker()
  void loadSettingsWindow()
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
  else rememberBar()
  stopBarWatch?.()
  engine = null
  session = null
})
</script>

<template>
  <main
    class="player"
    :class="{ 'with-sidebar': ui.sidebarOpen && !onWelcome, welcome: onWelcome }"
  >
    <div class="stage" :class="{ idle: controlsHidden }">
      <canvas ref="canvas" class="canvas" data-testid="stage" />
      <div v-if="onWelcome" class="welcome-dim" aria-hidden="true" />

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
      <div class="side left" data-testid="hud-left">
        <section class="hud-text song" aria-label="Song">
          <h1 class="title" :title="title" data-testid="hud-title">
            {{ title }}
          </h1>
          <p v-if="composer" class="composer" :title="composer" data-testid="hud-composer">
            {{ composer }}
          </p>
          <p
            v-if="entry && nowPlaying"
            class="composer entry"
            :class="{ custom: nowPlaying.kind === 'custom' }"
            :title="
              nowPlaying.kind === 'custom'
                ? `${nowPlaying.label}
${customHint}`
                : nowPlaying.label
            "
            :data-kind="nowPlaying.kind"
            data-testid="hud-entry"
          >
            <template v-if="nowPlaying.kind !== 'custom'">
              <AppIcon name="bookmark" :size="15" class="entry-icon" data-testid="hud-entry-icon" />
              <span
                :data-testid="nowPlaying.kind === 'bookmark' ? 'hud-bookmark' : 'hud-full-song'"
                >{{ nowPlaying.label }}</span
              >
            </template>
            <span v-else data-testid="hud-custom">{{ nowPlaying.label }}</span>
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
            icon="home"
            label="Home"
            :shortcut="shortcutLabel('goHome')"
            :active="onWelcome"
            data-testid="menu-home"
            @click="goHome"
          />
          <HudMenuButton
            icon="song"
            label="Change song"
            :shortcut="shortcutLabel('openPicker')"
            data-testid="open-picker"
            @click="openPicker"
          />
          <HudMenuButton
            icon="library"
            label="Library"
            :shortcut="shortcutLabel('openLibrary')"
            data-testid="menu-library"
            @click="openLibrary"
          />
          <HudMenuButton
            icon="stats"
            label="Stats"
            :shortcut="shortcutLabel('openStats')"
            data-testid="menu-stats"
            @click="openStats"
          />
          <HudMenuButton
            icon="sliders"
            label="Playfield panel"
            :shortcut="shortcutLabel('togglePlayfield')"
            :active="ui.sidebarOpen"
            data-testid="toggle-sidebar"
            @click="toggleSidebar"
          />
          <HudMenuButton
            icon="settings"
            label="Settings"
            :shortcut="shortcutLabel('openSettings')"
            data-testid="menu-settings"
            @click="openSettings"
          />
          <HudMenuButton
            icon="keyboard"
            label="Keyboard shortcuts"
            :shortcut="shortcutLabel('showShortcuts')"
            data-testid="menu-shortcuts"
            @click="ui.shortcutsOpen = true"
          />
          <ProfileMenu v-if="profiles.profiles.length > 1" />
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
            <IconButton
              icon="stop"
              label="Stop"
              :shortcut="shortcutLabel('stop')"
              data-testid="stop"
              @click="backToStart"
            />
            <IconButton
              icon="prevBar"
              label="Previous bar"
              :shortcut="shortcutLabel('previousBar')"
              @click="session?.transport.prevBar()"
            />
            <IconButton
              :icon="hud.state === 'playing' ? 'pause' : 'play'"
              :label="hud.state === 'playing' ? 'Pause' : 'Play'"
              :shortcut="shortcutLabel('playPause')"
              size="lg"
              variant="outline"
              :disabled="!samplesReady"
              data-testid="play-pause"
              @click="togglePlay"
            />
            <IconButton
              icon="nextBar"
              label="Next bar"
              :shortcut="shortcutLabel('nextBar')"
              @click="session?.transport.nextBar()"
            />
          </div>
          <div class="toggles">
            <LoopPopover
              v-model:open="loopOpen"
              :loop="shownLoop"
              :draft="loopDraft"
              :first-bar="firstBar"
              :last-bar="lastBar"
              @update:draft="loopDraft = $event"
              @toggle="toggleLoop"
              @set="setLoop"
              @clear="setLoop(null)"
              @nudge="loopNudge.nudge"
              @to-start="backToStart"
              @save-bookmark="saveAsBookmark"
              @revert="practice.backToLoaded()"
            />
            <TempoPopover
              v-model:open="tempoOpen"
              v-model:tempo-percent="tempoPercent"
              :current-bpm="hud.currentBpm"
            />
            <div class="hud-row">
              <span v-if="metronomeMode === 'preRoll'" class="value" data-testid="metronome-value"
                >pre-roll</span
              >
              <HudToggle
                icon="metronome"
                :on="metronomeMode !== 'off'"
                hint="Metronome"
                :shortcut="shortcutLabel('toggleMetronome')"
                :aria-label="`Metronome (${shortcutLabel('toggleMetronome')})`"
                :aria-pressed="metronomeMode !== 'off'"
                data-testid="toggle-metronome"
                @click="toggleMetronome"
              />
            </div>
            <HudToggle
              icon="bookmarkAdd"
              :on="false"
              hint="Save as bookmark"
              :shortcut="shortcutLabel('saveBookmark')"
              :aria-label="`Save as bookmark (${shortcutLabel('saveBookmark')})`"
              :disabled="entry === null"
              data-testid="save-bookmark-icon"
              @click="saveAsBookmark"
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

    <!-- Welcome, over the paused scene. -->
    <RouterView />

    <Transition name="sidebar">
      <PlayfieldSidebar
        v-if="ui.sidebarOpen && !onWelcome"
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

/* Welcome's backdrop (m7-7 decision 12, QGWelcomeA): the scene blurred and dimmed, scaled a
   little so the blur shows no soft edges; of the HUD only the app menu stays. */
.player.welcome .canvas {
  filter: blur(9px) saturate(120%);
  opacity: 0.9;
  scale: 1.04;
}

.welcome-dim {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 30% 40%, rgb(5 7 15 / 45%), rgb(5 7 15 / 82%));
  pointer-events: none;
}

.player.welcome .timeline-strip,
.player.welcome .song,
.player.welcome .side.right {
  visibility: hidden;
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

/* What's playing (decision 60): a matching bookmark or Full song with the bookmark icon, in the
   secondary colour like the loop region; any other setup in plain dim text. */
.composer.entry {
  display: flex;
  align-items: center;
  color: var(--secondary);
}

.composer.entry > span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer.entry.custom {
  color: var(--text-4);
}

.entry-icon {
  flex-shrink: 0;
  margin: 0 3px 0 -2px;
  filter: var(--icon-shadow-hud);
}

.hud-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hud-row .value {
  color: var(--primary);
  font-size: var(--text-sm);
  text-shadow: var(--text-shadow-hud);
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
