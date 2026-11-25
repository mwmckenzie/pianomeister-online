<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
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
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import { sameRange } from '@/core/practice/diffFromBookmark'
import type { MetronomeMode } from '@/core/practice/MetronomeMode'
import { summariseMeter } from '@/core/timing/summariseMeter'
import { preRollBeat } from '@/core/transport/preRollBeat'
import type { LoopRange } from '@/core/transport/LoopRange'
import type { OpenedSong } from '@/data/OpenedSong'
import { Engine } from '@/engine/Engine'

import { type BenchHost, benchHostKey } from '../bench/BenchHost'
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
import ListeningHud from '../player/ListeningHud.vue'
import { ListeningController, type ListeningUpdate } from '../playback/ListeningController'
import { useListeningStore } from '../stores/listeningStore'
import { usePlaylistStore } from '../stores/playlistStore'
import { useStatsStore } from '../stores/statsStore'
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
import { overviewHostKey } from '../overview/overviewHostKey'
import { useSaveSelection } from '../overview/useSaveSelection'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useLibraryStore } from '../stores/libraryStore'
import { usePracticeStore } from '../stores/practiceStore'
import { loopWindowFor } from '@/core/transport/loopWindowFor'
import { useProfileStore } from '../stores/profileStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useReducedMotion } from '../theme/useReducedMotion'
import { useToastStore } from '../stores/toastStore'
import { useUiStateStore } from '../stores/uiStateStore'

// Dialogs aren't needed to play: separate chunks (keeps the main bundle small), fetched when the
// player mounts (see onMounted) so the first open doesn't wait.
const loadPicker = () => import('../picker/SongPicker.vue')
const SongPicker = defineAsyncComponent(loadPicker)
const loadSettingsWindow = () => import('../settings/SettingsWindow.vue')
const SettingsWindow = defineAsyncComponent(loadSettingsWindow)
// The overview strip draws only while open (brief decision 101); like the dialogs, its chunk and
// the loop editor's are fetched when the player mounts (see onMounted).
const loadOverviewStrip = () => import('../overview/OverviewStrip.vue')
const OverviewStrip = defineAsyncComponent(loadOverviewStrip)
const loadLoopEditor = () => import('./LoopEditorView.vue')
// The perf overlay (milestone 11): only with ?perf=1 or its key.
const PerfOverlay = defineAsyncComponent(() => import('../bench/PerfOverlay.vue'))

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()
const reducedMotion = useReducedMotion()
const library = useLibraryStore()
const toasts = useToastStore()
const ui = useUiStateStore()
const practice = usePracticeStore()
const bookmarks = useBookmarkStore()
const profiles = useProfileStore()
const listening = useListeningStore()
const playlistStore = usePlaylistStore()
const statsStore = useStatsStore()
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
/** Listening mode (milestone 9.5): plays a playlist through the same session and engine. */
let listener: ListeningController | null = null

const entry = shallowRef<LibraryEntry | null>(null)
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
// Before Home opens on a new session (milestone 9.2 D): plain dialogs and popovers close.
watch(
  () => ui.closeOverlays,
  () => {
    pickerOpen.value = false
    settingsOpen.value = false
    tempoOpen.value = false
    loopOpen.value = false
  },
)

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
const overStrip = ref(false)
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
    !overStrip.value &&
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
  const notes = loaded.value?.notes
  if (notes === undefined) return ''
  const right = notes.filter((n) => n.hand === 'right').length
  return `R ${right} notes · L ${notes.length - right} notes`
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
  // Any song opened normally (picker, Library, a bookmark, Resume) ends listening (9.5 C7).
  if (listening.active) listener?.leave()
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

/** A start-up time for the benchmark (milestone 11). */
function markOnce(name: string): void {
  if (performance.getEntriesByName(name).length === 0) performance.mark(name)
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
    () => {
      samplesReady.value = true
      markOnce('pm-samples')
    },
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
  // The hands themselves, not where they came from: a detection that changes nothing keeps the
  // song as it is loaded.
  const noteHands = opened.song.notes.map((n) => opened.handOf(n)?.[0] ?? '-').join('')
  const key = JSON.stringify([songId, noteHands, opened.override])
  const current = playback.song
  const sameSong = playback.songKey === key && current !== null
  const prepared = sameSong
    ? current
    : playback.load(opened.song, { handOf: opened.handOf, override: opened.override, key })
  entry.value = opened.entry
  loaded.value = prepared
  markOnce('pm-song')
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
  showOnHighway(prepared)
  syncEngineLoop()
  return sameEntry
}

function showOnHighway(prepared: LoadedSong): void {
  engine?.setSong({
    notes: prepared.notes,
    ppq: prepared.song.ppq,
    barMap: prepared.barMap,
    pedalIntervals: prepared.pedalIntervals,
    endTick: prepared.song.durationTicks,
    handCages: prepared.handCages,
  })
}

function listenerFor(playback: PlaybackSession): ListeningController {
  listener ??= new ListeningController({
    session: playback,
    openSong: (songId) => library.openSong(songId),
    entry: (songId) => library.entries.find((e) => e.songId === songId),
    savedLooks: () => settingsStore.looks.saved,
    deviceClass: settingsStore.deviceClass,
    ownSettings: () => settingsStore.ownSettings(),
    setOverlay: (next) => settingsStore.setOverlay(next),
    endOverlay: () => settingsStore.endOverlay(),
    setTrackingSuspended: (on) => (statsStore.trackingSuspended = on || benching),
    crossfadeSec: () => settingsStore.settings.audio.crossfade,
    crossfadeCurve: () => settingsStore.settings.audio.crossfadeCurve,
    showTimeline: (timeline, shiftTicks) => {
      const started = performance.now()
      engine?.setSong(
        {
          notes: timeline.notes,
          ppq: timeline.ppq,
          barMap: timeline.song.barMap,
          pedalIntervals: timeline.pedalIntervals,
          endTick: timeline.song.endTick,
          handCages: timeline.handCages,
        },
        shiftTicks === null ? null : { shiftTicks },
      )
      engine?.setLoop(null)
      return performance.now() - started
    },
    setSeam: (seam, band) => engine?.setPlaylistSeam(seam, band),
    currentSettings: () => settingsStore.settings,
    previewSettings: (next) => engine?.applySettings(next),
    reducedMotion: () => reducedMotion.value,
    now: () => performance.now(),
    update: applyListeningUpdate,
    markPlayed: (id) => {
      if (!benching) void playlistStore.markPlayed(id)
    },
    random: Math.random,
  })
  return listener
}

function applyListeningUpdate(update: ListeningUpdate): void {
  const { announce, ...fields } = update
  Object.assign(listening, fields)
  if (announce === true) listening.announced++
}

/** Starts the playlist a Play button asked for (Playlists tab, Welcome tile, a song row). */
async function startRequested(): Promise<void> {
  const request = listening.request
  if (request === null) return
  listening.request = null
  const playback = session ?? attachSession()
  if (!playlistStore.loaded) await playlistStore.refresh()
  if (!library.loaded) await library.refresh()
  const playlist = playlistStore.byId.get(request.playlistId)
  if (playlist === undefined || unmounted) return
  if (route.name !== 'player') await router.push({ name: 'player' })
  pickerOpen.value = false
  listening.tempoPercent = 100
  listening.muted = false
  await listenerFor(playback).start(playlist, request.start)
}

/** Leaves listening (Esc, Leave): the last song comes back as Full song, parked at its bar. */
async function leaveListening(): Promise<void> {
  const last = listener?.leave() ?? null
  if (last === null) return
  await openSong(last.songId, null)
  session?.transport.seekToBar(last.bar)
}

function listeningTempo(direction: -1 | 0 | 1): void {
  const range = tempoSliderRange(settingsStore.settings.practice.tempoStep)
  const next =
    direction === 0
      ? 100
      : Math.min(range.max, Math.max(range.min, listening.tempoPercent + direction * range.step))
  listening.tempoPercent = next
  listener?.setTempo(next)
}

function toggleListeningMute(): void {
  listening.muted = !listening.muted
  session?.setMuted(listening.muted)
}

const HUD_MODES = ['show', 'minimal', 'hidden'] as const
function cycleListeningHud(): void {
  const now = HUD_MODES.indexOf(settingsStore.settings.appearance.listeningHud)
  settingsStore.set('appearance.listeningHud', HUD_MODES[(now + 1) % HUD_MODES.length] ?? 'show')
}

/** Shift+← / → while listening. */
const LISTENING_SEEK_SEC = 5
const listeningBarAt = (fraction: number) => listener?.barAt(fraction) ?? 1

/** Listening keys (milestone 9.5): its own commands, then the player's few that still apply. */
const LISTENING_ACTIONS: Readonly<Partial<Record<CommandId, () => void>>> = {
  nextSong: () => void listener?.next(),
  previousSong: () => void listener?.previous(),
  seekBack: () => void listener?.seekBy(-LISTENING_SEEK_SEC),
  seekForward: () => void listener?.seekBy(LISTENING_SEEK_SEC),
  toggleMute: toggleListeningMute,
  cycleListeningHud,
  leaveListening: () => void leaveListening(),
  playPause: togglePlay,
  togglePlayfield: () => (ui.sidebarOpen = !ui.sidebarOpen),
  openSettings: () => openSettings(),
  tempoDown: () => listeningTempo(-1),
  tempoUp: () => listeningTempo(1),
  tempoReset: () => listeningTempo(0),
}

function onListeningKey(event: KeyboardEvent): void {
  const command =
    commandForEvent(settingsStore.bindings, 'listening', event) ??
    commandForEvent(settingsStore.bindings, 'player', event)
  // Esc closes the open panel first.
  if (command === 'leaveListening' && ui.sidebarOpen) {
    event.preventDefault()
    ui.sidebarOpen = false
    return
  }
  const action = command === null ? undefined : LISTENING_ACTIONS[command]
  if (action === undefined) return
  event.preventDefault()
  action()
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
  // Listening: no loop, pre-roll or bookmark; tempo is the session's own (9.5 C2).
  if (listening.active) {
    applyAudio()
    return
  }
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
  syncEngineLoop()
  applyAudio()
}

/**
 * The loop on the highway (milestone 9.2) follows the transport's loop and pre-roll, set in the
 * same tick as them, so the frame that shows the jump to the loop start shows the loop too.
 */
function syncEngineLoop(): void {
  const song = session?.song ?? null
  const transport = session?.transport
  if (song === null || transport === undefined) {
    engine?.setLoop(null)
    return
  }
  engine?.setLoop(
    loopWindowFor(transport.loop, transport.preRoll.beats, song.barMap, song.tempoMap),
  )
}

/** Volumes and the metronome are global; hand modes come from the practice setup. */
function applyAudio(): void {
  const { handAudio, metronomeMode } = listening.active
    ? { handAudio: { right: 'on', left: 'on' } as const, metronomeMode: 'off' as const }
    : practice.current
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
  if (onHudFrame === null) {
    stepHud()
    return
  }
  const started = performance.now()
  stepHud()
  // With what Vue renders because of it, right after this callback.
  void nextTick(() => onHudFrame?.(performance.now() - started))
}

function stepHud(): void {
  if (session !== null && listening.active) {
    listener?.frame()
    if (hud.value.state !== session.transport.state) {
      hud.value = { ...hud.value, state: session.transport.state }
    }
    return
  }
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
  // A benchmark's places aren't the player's.
  if (benching) return
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
/** The loop editor too (brief decision 106), but playback keeps running under it. */
const onEditor = computed(() => route.name === 'editor')
/** The benchmark's page (milestone 11): over the playing scene, alone on the screen. */
const onBench = computed(() => route.name === 'bench')
/** A still backdrop: no render loop behind Welcome or the editor (weak tablets; m7-7 round 2). */
const frozen = computed(() => onWelcome.value || onEditor.value)
watch(frozen, (still) => engine?.setFrozen(still))
watch(onWelcome, (welcome) => {
  if (!welcome) return
  if (session?.transport.state === 'playing') session.transport.pause()
  else rememberBar()
})

/** The overview strip (brief decision 105): open state kept across reloads, hidden on overlays. */
/**
 * Below this many px between the columns the strip isn't shown (the chevron and V open the
 * loop editor instead); it comes back by itself when there's room again.
 */
const STRIP_MIN_ROOM = 360
const stripFits = computed(() => stripBox.value.room >= STRIP_MIN_ROOM)
const stripShown = computed(
  () =>
    ui.overviewOpen &&
    stripFits.value &&
    loaded.value !== null &&
    !onBench.value &&
    !onWelcome.value &&
    !onEditor.value,
)
const overviewHint = computed(() => {
  const editorKey = shortcutLabel('openLoopEditor')
  if (!stripFits.value) {
    return `Not enough room for the overview here · open the loop editor${editorKey === '' ? '' : ` (${editorKey})`}`
  }
  const key = shortcutLabel('toggleOverview')
  return `${ui.overviewOpen ? 'Close' : 'Open'} overview${key === '' ? '' : ` (${key})`}`
})
const stripBookmarks = computed(() =>
  entry.value === null ? [] : bookmarks.forSong(entry.value.songId),
)
const playingBookmarkId = computed(() =>
  practice.now?.kind === 'bookmark' ? practice.now.bookmark.id : null,
)
const playing = computed(() => hud.value.state === 'playing')
const tick = computed(() => hud.value.tick)

/** The chevron and V: the strip, or — without room for it — the loop editor. */
function toggleOverview(): void {
  if (!stripFits.value) openLoopEditor()
  else ui.overviewOpen = !ui.overviewOpen
}

function openLoopEditor(): void {
  void router.push({ name: onEditor.value ? 'player' : 'editor' })
}

/** A bookmark of the loaded song, from the strip's lane or the editor: a normal load. */
function loadBookmark(id: string): void {
  const songId = entry.value?.songId
  if (songId !== undefined) void openSong(songId, id)
}

watch(
  () => listening.request,
  (request) => {
    if (request !== null && engine !== null) void startRequested()
  },
)

const saveSelection = useSaveSelection(loadBookmark)

provide(overviewHostKey, {
  song: loaded,
  songId: computed(() => entry.value?.songId ?? null),
  title,
  tick,
  playing,
  loop: shownLoop,
  seekBar,
  setLoop,
  playFrom: (bar) => {
    seekBar(bar)
    if (!playing.value) togglePlay()
  },
  loadBookmark,
  saveSelection,
  backToPlayer: () => void router.push({ name: 'player' }),
})

/**
 * Where the strip goes (decision 60, m8 agreed 19): under the timeline, between the HUD
 * columns as they are, about 24 px from each. The left column is measured at its counter and
 * "bar N of M" (the title and composer truncate at the strip instead); the right column whole.
 */
const STRIP_GAP = 24
const stage = useTemplateRef<HTMLElement>('stage')
const counterBlock = useTemplateRef<InstanceType<typeof BarBeatCounter>>('counterBlock')
const barOf = useTemplateRef<HTMLElement>('barOf')
const leftColumn = useTemplateRef<HTMLElement>('leftColumn')
const rightColumn = useTemplateRef<HTMLElement>('rightColumn')
const stripBox = ref({ left: 0, right: 0, titleRoom: 0, room: 0 })
let stripObserver: ResizeObserver | null = null

function measureStrip(): void {
  const stageEl = stage.value
  const left = leftColumn.value
  const right = rightColumn.value
  if (stageEl === null || left === null || right === null) return
  const counterEl = counterBlock.value?.$el as HTMLElement | undefined
  const widest = Math.max(counterEl?.offsetWidth ?? 0, barOf.value?.offsetWidth ?? 0)
  const next = {
    left: left.offsetLeft + widest + STRIP_GAP,
    right: stageEl.clientWidth - right.offsetLeft + STRIP_GAP,
    // The title, composer and now-playing line stop just short of the strip.
    titleRoom: widest + STRIP_GAP - 12,
    room: 0,
  }
  next.room = stageEl.clientWidth - next.left - next.right
  const box = stripBox.value
  if (
    next.left !== box.left ||
    next.right !== box.right ||
    next.titleRoom !== box.titleRoom ||
    next.room !== box.room
  ) {
    stripBox.value = next
  }
}

/** Measured whenever the HUD is shown, strip open or not: it decides whether the strip fits. */
function watchStripRoom(still: boolean): void {
  stripObserver?.disconnect()
  stripObserver = null
  if (still) return
  measureStrip()
  stripObserver = new ResizeObserver(measureStrip)
  for (const el of [
    stage.value,
    rightColumn.value,
    barOf.value,
    counterBlock.value?.$el as HTMLElement | undefined,
  ]) {
    if (el instanceof HTMLElement) stripObserver.observe(el)
  }
}
watch(frozen, watchStripRoom, { flush: 'post' })

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
  toggleOverview,
  openLoopEditor,
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
  // Controls that own Space and Enter (accordion headers toggle with them).
  if (
    (event.key === ' ' || event.key === 'Enter') &&
    event.target instanceof HTMLElement &&
    event.target.closest('[data-own-keys]') !== null
  ) {
    return
  }
  // Behind Welcome the player's keys rest; Welcome has its own (Enter resumes).
  if (onWelcome.value || onBench.value) return
  if (keyCapture.value || pickerOpen.value || settingsOpen.value || ui.shortcutsOpen) return
  if (listening.active) {
    onListeningKey(event)
    return
  }
  const command = commandForEvent(settingsStore.bindings, 'player', event)
  // In the loop editor playback keeps its keys; the playfield panel and the strip aren't there.
  if (onEditor.value && (command === 'togglePlayfield' || command === 'toggleOverview')) return
  const action = command === null ? undefined : PLAYER_ACTIONS[command]
  if (action === undefined) return
  event.preventDefault()
  action()
}

const onGesture = () => void session?.unlock()

// ── Benchmark and perf overlay (milestone 11) ────────────────────────────────────────────────
/** A benchmark has the player: nothing it does is remembered. */
let benching = false
/** Where the player was, to go back to. */
let benchBar: number | null = null
/** Called with the HUD's own time per frame, while someone measures it. */
let onHudFrame: ((ms: number) => void) | null = null

function beginBench(): void {
  if (benching || session === null) return
  if (listening.active) listener?.leave()
  rememberBar()
  benchBar = currentBar()
  benching = true
  statsStore.trackingSuspended = true
  const { transport } = session
  transport.stop()
  transport.setLoop(null)
  transport.setPreRoll({ beats: 0, mode: 'muted' })
  transport.setTempoPercent(100)
  session.setMuted(true)
  engine?.setReducedMotion(false)
}

/** Everything back as it was, but the song (the caller opens it again). */
function releaseBench(): void {
  if (!benching) return
  if (listening.active) listener?.leave()
  session?.transport.stop()
  session?.transport.setLoop(null)
  session?.setMuted(false)
  engine?.seedEffects(null)
  engine?.setReducedMotion(reducedMotion.value)
  engine?.setFrozen(frozen.value)
  settingsStore.endBench()
  statsStore.trackingSuspended = false
  benching = false
}

const benchHost: BenchHost = {
  ready: samplesReady,
  engine: () => engine,
  session: () => session,
  begin: beginBench,
  end: async () => {
    if (!benching) return
    releaseBench()
    if (unmounted) return
    await openSong()
    if (benchBar !== null) session?.transport.seekToBar(benchBar)
  },
  show: (song) => {
    loaded.value = song
    showOnHighway(song)
  },
  setLoop: (range) => {
    session?.transport.setLoop(range)
    syncEngineLoop()
  },
  openSong: (songId) => library.openSong(songId),
  entry: (songId) => library.entries.find((e) => e.songId === songId),
  entries: async () => {
    if (!library.loaded) await library.refresh()
    return library.entries
  },
  listen: async (playlist, fromEndSec) => {
    if (session === null) return
    listening.tempoPercent = 100
    const controller = listenerFor(session)
    await controller.start(playlist, 0)
    session.setMuted(true)
    const first = library.entries.find((e) => e.songId === playlist.entries[0]?.songId)
    await controller.seekBy((first?.facts.durationSeconds ?? 0) - fromEndSec)
  },
  leaveListening: () => {
    if (!listening.active) return
    listener?.leave()
    session?.setMuted(benching)
  },
  setHudListener: (listen) => (onHudFrame = listen),
}
provide(benchHostKey, benchHost)

const perfOpen = ref(route.query.perf === '1')
/** Ctrl+Alt+P; not a command: it isn't for players. */
function onPerfKey(event: KeyboardEvent): void {
  if (!event.ctrlKey || !event.altKey || event.code !== 'KeyP') return
  event.preventDefault()
  perfOpen.value = !perfOpen.value
}

/** For the render readout: what the engine renders at and how long a frame takes. */
function renderStatus(): RenderStatus | null {
  const info = engine?.renderInfo() ?? null
  return info === null ? null : { info, frameMs: engine?.stats().averageFrameMs ?? 0 }
}

watch(() => [practice.current, practice.loopJump], applyPractice)
watch(reducedMotion, (reduced) => engine?.setReducedMotion(reduced))
// Paused, the scene settles and holds still (brief decision 119).
watch(playing, (now) => engine?.setPlaying(now))
watch(
  () => settingsStore.settings,
  (settings, previous) => {
    engine?.applySettings(settingsStore.snapshot())
    if (settings.audio !== previous.audio) applyAudio()
  },
)
watch(
  () => settingsStore.noteColourSets,
  (sets) => engine?.setColourSets(sets),
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
  engine.setColourSets(settingsStore.noteColourSets)
  engine.applySettings(settingsStore.snapshot())
  engine.setGuides(route.query.guides === '1')
  engine.setReducedMotion(reducedMotion.value)
  engine.setPlaying(playing.value)
  // Debug-only (like ?guides=1): pins the animation clock so visual shots are repeatable.
  const animTime = Number(route.query.animTime)
  if (route.query.animTime !== undefined && Number.isFinite(animTime)) {
    engine.setFixedAnimationTime(animTime)
  }
  if (route.query.stats === '1') {
    // Debug-only (like ?guides=1): lets a test harness read frame timings for perf reports.
    const stats = () => engine?.stats()
    const renderInfo = () => engine?.renderInfo()
    const labels = () => engine?.labelSnapshot()
    Object.assign(window, {
      // Listening (milestone 9.5): start a playlist, and read the timeline swaps for the report.
      pianomeisterCages: () => engine?.handCageInfo() ?? null,
      pianomeisterCageBars: () => loaded.value?.handCages ?? null,
      pianomeisterListening: {
        play: (playlistId: string, start = 0) => listening.requestPlay(playlistId, start),
        swapMs: () => [...(listener?.swapMs ?? [])],
        lateSeams: () => listener?.lateSeams ?? 0,
        state: () => listener?.debugState() ?? null,
        position: () => session?.transport.position ?? 0,
        seek: (seconds: number) => session?.transport.seekToSeconds(seconds),
      },
      pianomeisterEngineStats: stats,
      pianomeisterRenderInfo: renderInfo,
      pianomeisterLabels: labels,
      pianomeisterNoteColors: () => engine?.noteColorHexes() ?? null,
    })
  }
  if (route.query.capture === '1') {
    // Test-only (like ?stats=1): fixed-step, repeatable frames for the range contact sheets.
    Object.assign(window, {
      pianomeisterCapture: {
        start: (seed?: number) => engine?.startCapture(seed),
        /** The song position `seconds` after the start of `bar`. */
        tickAt: (bar: number, seconds: number) => {
          const song = loaded.value
          if (song === null) return 0
          const from = song.tempoMap.tickToSeconds(song.barMap.barStartTick(bar))
          return song.tempoMap.secondsToTick(from + seconds)
        },
        step: (tick: number, dt: number, playing = true) => engine?.captureStep(tick, dt, playing),
        /** Only the notes in view (true) or the whole song (milestone 11). */
        cull: (on: boolean, broken: 'near' | 'far' | null = null) => engine?.setCulling(on, broken),
        drawn: () => engine?.drawnNotes(),
        info: () => engine?.renderInfo(),
        /** The tick `seconds` into the loaded timeline (a playlist's too). */
        tickAtSeconds: (seconds: number) => session?.song?.tempoMap.secondsToTick(seconds) ?? 0,
        particles: () => engine?.particleStats(),
        /** A loop with its pre-roll (the loop sheets, milestone 9.2); null turns it off. */
        loop: (range: LoopRange | null, preRollBeats = 0) => {
          practice.setPreRollBeats(preRollBeats)
          practice.setLoop(range)
        },
      },
    })
  }
  engine.setTimeSource(() => session?.audibleTick() ?? 0)
  if (canvas.value !== null) {
    engine.mount(canvas.value)
    engine.setFrozen(frozen.value)
    resizeObserver = new ResizeObserver(() => engine?.resize())
    resizeObserver.observe(canvas.value)
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keydown', onPerfKey)
  window.addEventListener('pointerdown', onGesture)
  hudFrame = requestAnimationFrame(updateHud)
  // Ask for the picker and settings chunks before the session starts ~230 sample downloads:
  // requests queue per host, and behind the samples the first O or Settings click would wait
  // for seconds on a slow connection (or a busy dev server). Imports are cached, so the click
  // later finds them ready.
  void loadPicker()
  void loadSettingsWindow()
  watchStripRoom(frozen.value)
  void loadOverviewStrip()
  void loadLoopEditor()
  if (listening.request !== null) void startRequested()
  else void openSong()
})

onBeforeUnmount(() => {
  unmounted = true
  if (benching) {
    releaseBench()
    // The benchmark's song isn't the player's: the bar is already remembered.
    loaded.value = null
  }
  if (listening.active) listener?.leave()
  // The library shows the scene's last frame behind its glass.
  sceneSnapshot.value = engine?.captureFrame() ?? sceneSnapshot.value
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keydown', onPerfKey)
  window.removeEventListener('pointerdown', onGesture)
  cancelAnimationFrame(hudFrame)
  resizeObserver?.disconnect()
  stripObserver?.disconnect()
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
    :class="{
      'with-sidebar': ui.sidebarOpen && !frozen && !onBench,
      welcome: onWelcome,
      editor: onEditor,
      overview: stripShown,
    }"
    :style="{ '--title-room': `${stripBox.titleRoom}px` }"
  >
    <div ref="stage" class="stage" :class="{ idle: controlsHidden }">
      <canvas ref="canvas" class="canvas" data-testid="stage" />
      <div v-if="onWelcome" class="welcome-dim" aria-hidden="true" />

      <ListeningHud
        v-if="listening.active"
        :idle="controlsHidden"
        :reduced-motion="reducedMotion"
        :sidebar-open="ui.sidebarOpen"
        :bar-at="listeningBarAt"
        @seek-bar="listener?.seekToBar($event)"
        @leave="leaveListening"
        @next="listener?.next()"
        @previous="listener?.previous()"
        @toggle-play="togglePlay"
        @toggle-mute="toggleListeningMute"
        @play-again="listener?.playAgain()"
        @open-playlists="router.push({ name: 'playlists' })"
        @toggle-playfield="ui.sidebarOpen = !ui.sidebarOpen"
        @open-settings="openSettings"
        @set-shuffle="listener?.setShuffle($event)"
        @set-repeat="listener?.setRepeat($event)"
      />
      <template v-else>
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
        <button
          type="button"
          class="overview-toggle"
          :class="{ open: stripShown }"
          :aria-label="overviewHint"
          :title="overviewHint"
          :aria-expanded="stripShown"
          :data-room="stripFits ? 'yes' : 'no'"
          data-testid="overview-toggle"
          @click="toggleOverview"
        >
          <AppIcon :name="stripShown ? 'chevronUp' : 'chevronDown'" :size="16" />
        </button>

        <!-- Brief decision 105: the overview strip, under the timeline between the columns. -->
        <OverviewStrip
          v-if="stripShown && loaded"
          class="overview-strip"
          :style="{ left: `${stripBox.left}px`, right: `${stripBox.right}px` }"
          :song="loaded"
          :title="title"
          :bookmarks="stripBookmarks"
          :playing-id="playingBookmarkId"
          :loop="shownLoop"
          :tick="tick"
          :playing="playing"
          :controls-hidden="controlsHidden"
          :save-key="shortcutLabel('saveBookmark')"
          :editor-key="shortcutLabel('openLoopEditor')"
          :close-key="shortcutLabel('toggleOverview')"
          @seek-bar="seekBar"
          @set-loop="setLoop"
          @load-bookmark="loadBookmark"
          @save-selection="saveSelection"
          @open-editor="openLoopEditor"
          @close="ui.overviewOpen = false"
          @pointerenter="overStrip = true"
          @pointerleave="overStrip = false"
        />

        <!-- Left: what you're playing and where you are, then the app menu. -->
        <div ref="leftColumn" class="side left" data-testid="hud-left">
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
                <AppIcon
                  name="bookmark"
                  :size="15"
                  class="entry-icon"
                  data-testid="hud-entry-icon"
                />
                <span
                  :data-testid="nowPlaying.kind === 'bookmark' ? 'hud-bookmark' : 'hud-full-song'"
                  >{{ nowPlaying.label }}</span
                >
              </template>
              <span v-else data-testid="hud-custom">{{ nowPlaying.label }}</span>
            </p>
            <BarBeatCounter
              ref="counterBlock"
              :bar="hud.bar"
              :beat="hud.beat"
              :pre-roll="hud.preRoll"
              :dot-beat="hud.dotBeat"
              :dot-beats="hud.dotBeats"
              :bar-digits="barDigits"
              :beat-digits="beatDigits"
            />
            <p ref="barOf" class="sub bar-of">
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
              icon="loopEditor"
              label="Loop editor"
              :shortcut="shortcutLabel('openLoopEditor')"
              :active="onEditor"
              data-testid="menu-loop-editor"
              @click="router.push({ name: 'editor' })"
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
        <div ref="rightColumn" class="side right">
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
      </template>
    </div>

    <!-- Welcome over the paused scene; the loop editor over the playing one. -->
    <RouterView />
    <PerfOverlay v-if="perfOpen" :quiet="onBench" />

    <Transition name="sidebar">
      <PlayfieldSidebar
        v-if="ui.sidebarOpen && !frozen && !onBench"
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
      :current-bookmark-id="practice.bookmarkId"
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
.player.welcome .overview-toggle,
.player.welcome .song,
.player.welcome .side.right {
  visibility: hidden;
}

/* The loop editor (QGOverviewB): the frozen scene, blurred, under its page; no HUD. */
.player.editor .canvas {
  filter: blur(12px);
  scale: 1.04;
}

.player.editor .stage > :not(.canvas) {
  visibility: hidden;
}

/* The chevron at the timeline's right end that opens and closes the overview strip. */
.overview-toggle {
  position: absolute;
  top: 2px;
  right: 24px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgb(200 206 220 / 55%);
  filter: var(--icon-shadow-hud);
  cursor: pointer;
}

.overview-toggle:hover,
.overview-toggle.open {
  color: var(--text-1);
}

.overview-toggle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* (More specific than the strip's own `position: relative`.) */
.stage .overview-strip {
  position: absolute;
  z-index: 1;
  top: 34px;
}

/* With the strip open the columns stay put; the long lines truncate at the strip's edge. */
.player.overview .song .title,
.player.overview .song .composer {
  max-width: var(--title-room);
}

/* Decision 60: no panels, pills or scrims behind the HUD; text shadows keep it readable. */
.timeline-strip {
  position: absolute;
  top: 0;
  right: 56px;
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
  /* 2 px (4 before milestone 8's Loop editor item): the column clears the keyboard at 720. */
  gap: 2px;
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
    right: calc(var(--space-4) + 28px);
    left: var(--space-4);
  }

  .overview-toggle {
    right: 12px;
  }

  .left {
    left: var(--space-4);
  }

  .right {
    right: var(--space-4);
  }
}
</style>
