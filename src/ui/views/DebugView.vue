<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { DEFAULT_AUDIO_SETTINGS } from '@/audio/AudioSettings'
import type { MetronomeMode } from '@/audio/MetronomeMode'
import type { HandNote } from '@/core/hands/HandNote'
import { noteName } from '@/core/noteName'
import type { HandAudio } from '@/core/practice/HandAudio'
import { importMidi } from '@/core/song/importMidi'
import type { Song } from '@/core/song/Song'
import type { MeterOverride } from '@/core/timing/MeterOverride'
import type { PreRollMode } from '@/core/transport/PreRollMode'

import { FIXTURES } from '../playback/FIXTURES'
import type { LoadedSong } from '../playback/LoadedSong'
import { PlaybackSession } from '../playback/PlaybackSession'

// Audio and transport stay outside Vue's reactivity; the UI reads them once per frame.
let session: PlaybackSession | null = null
let loaded: LoadedSong | null = null
const sounding = { right: new Set<HandNote>(), left: new Set<HandNote>() }
let frame = 0
/** Counted from bus events, which the worker ticker drives, so it keeps rising in hidden tabs. */
let noteOnCount = 0

const selected = ref('')
const loading = ref(false)
const error = ref('')
const song = shallowRef<Song | null>(null)
const barCount = ref(0)
const hasBarZero = ref(false)
const pedalList = ref<string[]>([])

const samplesReady = ref(false)
const sampleProgress = ref({ loaded: 0, total: 0 })
const audioState = ref('suspended')

const overrideEnabled = ref(false)
const overrideNumerator = ref(4)
const overrideDenominator = ref(4)
const overrideBarOneTick = ref(0)
const rightChannels = ref('0')
const leftChannels = ref('1')

const tempoPercent = ref(100)
const goToBar = ref(1)
const loopStart = ref(1)
const loopEnd = ref(4)
const loopLabel = ref('off')
const preRollBeats = ref(0)
const preRollMode = ref<PreRollMode>('muted')

const masterVolume = ref(DEFAULT_AUDIO_SETTINGS.master * 100)
const rightVolume = ref(100)
const leftVolume = ref(100)
const rightAudio = ref<HandAudio>('on')
const leftAudio = ref<HandAudio>('on')
const quietLevel = ref(DEFAULT_AUDIO_SETTINGS.quietLevel * 100)
const metronomeMode = ref<MetronomeMode>(DEFAULT_AUDIO_SETTINGS.metronome.mode)
const metronomeVolume = ref(DEFAULT_AUDIO_SETTINGS.metronome.volume * 100)

const readout = ref({
  state: 'stopped',
  songTime: 0,
  barBeat: '–',
  bpm: 0,
  preRoll: false,
  right: '',
  left: '',
  noteOns: 0,
})

const facts = computed(() => {
  const s = song.value
  if (s === null) return null
  return {
    tempos: s.tempoEvents.map((e) => `${e.tick}: ${(60e6 / e.microsPerQuarter).toFixed(2)} BPM`),
    meters: s.timeSignatureEvents.map((e) => `${e.tick}: ${e.numerator}/${e.denominator}`),
  }
})

const sampleStatus = computed(() => {
  if (samplesReady.value) return 'loaded'
  const { loaded: done, total } = sampleProgress.value
  return total > 0 ? `loading ${done}/${total}` : 'loading…'
})

function parseChannels(text: string): number[] {
  return text
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 15)
}

function position(tick: number): string {
  const at = loaded?.barMap.tickToPosition(tick)
  return at === undefined ? '?' : `${at.bar}:${at.beat}`
}

function rebuild(): void {
  const s = song.value
  if (s === null || session === null) return
  const override: MeterOverride | null = overrideEnabled.value
    ? {
        timeSignature: {
          numerator: overrideNumerator.value,
          denominator: overrideDenominator.value,
        },
        barOneStartTick: overrideBarOneTick.value,
      }
    : null
  loaded = session.load(s, {
    override,
    hands: { right: parseChannels(rightChannels.value), left: parseChannels(leftChannels.value) },
  })
  barCount.value = loaded.barMap.barCount
  hasBarZero.value = loaded.barMap.hasBarZero
  // All channels, not just assigned ones: this list is for checking pedal import by eye.
  pedalList.value = s.pedalIntervals.map(
    (p) => `ch${p.channel}: ${position(p.startTick)} – ${position(p.endTick)}`,
  )
  syncLoopLabel()
}

async function loadFixture(fileName: string): Promise<void> {
  const fixture = FIXTURES.find((f) => f.fileName === fileName)
  if (fixture === undefined) return
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(fixture.url)
    const bytes = new Uint8Array(await response.arrayBuffer())
    song.value = await importMidi(bytes, { fileName })
    rebuild()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function unlockAudio(): Promise<void> {
  await session?.unlock()
  audioState.value = session?.context.state ?? 'closed'
}

async function play(): Promise<void> {
  await unlockAudio()
  session?.transport.play()
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

function names(notes: Set<HandNote>): string {
  return [...notes]
    .sort((a, b) => a.midi - b.midi)
    .map((n) => noteName(n.midi))
    .join(' ')
}

/** Readout only: the scheduler's ticker drives the transport, so this can stop in background tabs. */
function render(): void {
  frame = requestAnimationFrame(render)
  if (session === null) return
  const { transport } = session
  const songPosition = transport.position
  const songTick = loaded?.tempoMap.secondsToTick(songPosition) ?? 0
  const at = loaded?.barMap.tickToPosition(songTick)
  readout.value = {
    state: transport.state,
    songTime: songPosition,
    barBeat: at === undefined ? '–' : `${at.bar}:${at.beat}`,
    bpm: ((loaded?.tempoMap.bpmAt(songTick) ?? 0) * transport.tempoPercent) / 100,
    preRoll: transport.inPreRoll,
    right: names(sounding.right),
    left: names(sounding.left),
    noteOns: noteOnCount,
  }
}

function pushSettings(): void {
  session?.setAudioSettings({
    master: masterVolume.value / 100,
    hands: {
      right: { volume: rightVolume.value / 100, audio: rightAudio.value },
      left: { volume: leftVolume.value / 100, audio: leftAudio.value },
    },
    quietLevel: quietLevel.value / 100,
    metronome: { mode: metronomeMode.value, volume: metronomeVolume.value / 100 },
  })
}

watch(selected, (fileName) => void loadFixture(fileName))
watch(tempoPercent, (p) => session?.transport.setTempoPercent(p))
watch([preRollBeats, preRollMode], ([beats, mode]) =>
  session?.transport.setPreRoll({ beats, mode }),
)
watch(
  [
    masterVolume,
    rightVolume,
    leftVolume,
    rightAudio,
    leftAudio,
    quietLevel,
    metronomeMode,
    metronomeVolume,
  ],
  pushSettings,
)

const onGesture = () => void unlockAudio()

onMounted(() => {
  session = new PlaybackSession({
    onProgress: (done, total) => (sampleProgress.value = { loaded: done, total }),
  })
  audioState.value = session.context.state
  session.ready.then(
    () => (samplesReady.value = true),
    (e: unknown) => (error.value = `Samples failed to load: ${String(e)}`),
  )
  pushSettings()
  const { bus } = session
  bus.on('noteOn', (e) => {
    sounding[e.hand].add(e.note)
    noteOnCount++
  })
  bus.on('noteOff', (e) => sounding[e.hand].delete(e.note))
  bus.on('allNotesOff', () => {
    sounding.right.clear()
    sounding.left.clear()
  })
  window.addEventListener('pointerdown', onGesture)
  window.addEventListener('keydown', onGesture)
  frame = requestAnimationFrame(render)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onGesture)
  window.removeEventListener('keydown', onGesture)
  cancelAnimationFrame(frame)
  session?.dispose()
  session = null
  loaded = null
})
</script>

<template>
  <main class="debug">
    <h1>Transport debug</h1>

    <section>
      <label>
        Song
        <select v-model="selected" data-testid="fixture-select">
          <option value="" disabled>Choose a fixture…</option>
          <option v-for="f in FIXTURES" :key="f.fileName" :value="f.fileName">
            {{ f.fileName }}
          </option>
        </select>
      </label>
      <span v-if="loading"> loading…</span>
      <span class="status">
        Samples: <span data-testid="sample-status">{{ sampleStatus }}</span> · Audio:
        {{ audioState }}
      </span>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section v-if="song && facts">
      <h2>File facts</h2>
      <dl>
        <dt>Title</dt>
        <dd>{{ song.title }}</dd>
        <dt>Format / ppq / tracks</dt>
        <dd>{{ song.format }} / {{ song.ppq }} / {{ song.trackCount }}</dd>
        <dt>Channels</dt>
        <dd>
          <span v-for="c in song.channels" :key="c.channel" class="chip"
            >ch{{ c.channel }}: {{ c.noteCount }} notes</span
          >
        </dd>
        <dt>Tempo events</dt>
        <dd>{{ facts.tempos.join(', ') || 'none (120 BPM)' }}</dd>
        <dt>Time signatures</dt>
        <dd>{{ facts.meters.join(', ') || 'none (4/4)' }}</dd>
        <dt>Duration</dt>
        <dd>{{ song.durationSeconds.toFixed(3) }} s ({{ song.durationTicks }} ticks)</dd>
        <dt>Bars</dt>
        <dd>
          <span data-testid="bar-count">{{ barCount }}</span>
          <span v-if="hasBarZero"> (+ bar 0)</span>
        </dd>
        <dt>Pedal (CC64)</dt>
        <dd data-testid="pedal-list">
          <template v-if="pedalList.length === 0">none</template>
          <ul v-else class="pedals">
            <li v-for="(p, i) in pedalList" :key="i">{{ p }}</li>
          </ul>
        </dd>
      </dl>
    </section>

    <section v-if="song">
      <h2>Meter override &amp; hands</h2>
      <div class="row">
        <label><input v-model="overrideEnabled" type="checkbox" /> Override meter</label>
        <label>
          Time sig
          <input v-model.number="overrideNumerator" type="number" min="1" max="32" />
          /
          <select v-model.number="overrideDenominator">
            <option v-for="d in [1, 2, 4, 8, 16, 32]" :key="d" :value="d">{{ d }}</option>
          </select>
        </label>
        <label>
          Bar 1 start tick
          <input v-model.number="overrideBarOneTick" type="number" min="0" step="1" />
        </label>
      </div>
      <div class="row">
        <label>Right channels <input v-model="rightChannels" size="6" /></label>
        <label>Left channels <input v-model="leftChannels" size="6" /></label>
        <button type="button" @click="rebuild">Apply</button>
      </div>
    </section>

    <section v-if="song">
      <h2>Transport</h2>
      <div class="row">
        <button type="button" :disabled="!samplesReady" @click="play">Play</button>
        <button type="button" @click="session?.transport.pause()">Pause</button>
        <button type="button" @click="session?.transport.stop()">Stop</button>
        <button type="button" @click="session?.transport.prevBar()">◀ Prev bar</button>
        <button type="button" @click="session?.transport.nextBar()">Next bar ▶</button>
        <label>
          Go to bar
          <input v-model.number="goToBar" type="number" step="1" />
        </label>
        <button type="button" @click="session?.transport.seekToBar(goToBar)">Go</button>
      </div>
      <div class="row">
        <label>
          Tempo {{ tempoPercent }}%
          <input v-model.number="tempoPercent" type="range" min="25" max="200" step="5" />
        </label>
      </div>
      <div class="row">
        <label>Loop <input v-model.number="loopStart" type="number" step="1" /></label>
        <label>to <input v-model.number="loopEnd" type="number" step="1" /></label>
        <button type="button" @click="setLoop">Set loop</button>
        <button type="button" @click="clearLoop">Clear loop</button>
        <span>current: {{ loopLabel }}</span>
      </div>
      <div class="row">
        <label>
          Pre-roll beats
          <input v-model.number="preRollBeats" type="number" min="0" max="16" step="1" />
        </label>
        <label>
          Mode
          <select v-model="preRollMode">
            <option value="muted">muted</option>
            <option value="quiet">quiet</option>
          </select>
        </label>
        <label>
          Quiet level {{ quietLevel }}%
          <input v-model.number="quietLevel" type="range" min="0" max="100" step="5" />
        </label>
      </div>
    </section>

    <section v-if="song">
      <h2>Audio</h2>
      <div class="row">
        <label>
          Master {{ masterVolume }}%
          <input v-model.number="masterVolume" type="range" min="0" max="100" step="1" />
        </label>
      </div>
      <div class="row">
        <label>
          Right hand {{ rightVolume }}%
          <input v-model.number="rightVolume" type="range" min="0" max="100" step="1" />
        </label>
        <select v-model="rightAudio" aria-label="Right hand audio">
          <option value="on">on</option>
          <option value="muted">muted</option>
          <option value="solo">solo</option>
        </select>
      </div>
      <div class="row">
        <label>
          Left hand {{ leftVolume }}%
          <input v-model.number="leftVolume" type="range" min="0" max="100" step="1" />
        </label>
        <select v-model="leftAudio" aria-label="Left hand audio">
          <option value="on">on</option>
          <option value="muted">muted</option>
          <option value="solo">solo</option>
        </select>
      </div>
      <div class="row">
        <label>
          Metronome
          <select v-model="metronomeMode">
            <option value="off">off</option>
            <option value="preRoll">pre-roll only</option>
            <option value="always">always</option>
          </select>
        </label>
        <label>
          Volume {{ metronomeVolume }}%
          <input v-model.number="metronomeVolume" type="range" min="0" max="100" step="1" />
        </label>
      </div>
    </section>

    <section v-if="song">
      <h2>Readout</h2>
      <dl>
        <dt>State</dt>
        <dd data-testid="transport-state">{{ readout.state }}</dd>
        <dt>Song time</dt>
        <dd data-testid="song-time">{{ readout.songTime.toFixed(3) }} s</dd>
        <dt>Bar:beat</dt>
        <dd>
          <span data-testid="bar-beat">{{ readout.barBeat }}</span>
          <span v-if="readout.preRoll"> (pre-roll)</span>
        </dd>
        <dt>Tempo</dt>
        <dd>{{ tempoPercent }}% = {{ readout.bpm.toFixed(1) }} BPM</dd>
        <dt>Right hand</dt>
        <dd class="notes">{{ readout.right }}</dd>
        <dt>Left hand</dt>
        <dd class="notes">{{ readout.left }}</dd>
        <dt>Note-ons</dt>
        <dd data-testid="note-on-count">{{ readout.noteOns }}</dd>
      </dl>
    </section>
  </main>
</template>

<style scoped>
.debug {
  max-width: 60rem;
  padding: 1rem;
  font-size: 0.9rem;
}

section {
  margin-bottom: 1.25rem;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
}

dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  margin: 0;
}

dt {
  color: #9e9e9e;
}

dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin-bottom: 0.5rem;
}

input[type='number'] {
  width: 5rem;
}

.chip {
  margin-right: 0.75rem;
}

.status {
  margin-left: 1rem;
  color: #9e9e9e;
}

.pedals {
  margin: 0;
  padding-left: 1rem;
  max-height: 8rem;
  overflow-y: auto;
}

.notes {
  min-height: 1.2em;
  font-family: ui-monospace, monospace;
}

.error {
  color: #ff6b6b;
}
</style>
