<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { AudioContextClock } from '@/audio/AudioContextClock'
import { EventBus } from '@/core/events/EventBus'
import { assignHands } from '@/core/hands/assignHands'
import type { HandNote } from '@/core/hands/HandNote'
import { noteName } from '@/core/noteName'
import { importMidi } from '@/core/song/importMidi'
import type { Song } from '@/core/song/Song'
import { BarMap } from '@/core/timing/BarMap'
import type { MeterOverride } from '@/core/timing/MeterOverride'
import { TempoMap } from '@/core/timing/TempoMap'
import type { PreRollMode } from '@/core/transport/PreRollMode'
import { Transport } from '@/core/transport/Transport'
import type { TransportEvents } from '@/core/transport/TransportEvents'
import canonUrl from '../../../test-fixtures/midi/canon-in-d.mid?url'
import inventionUrl from '../../../test-fixtures/midi/invention-1.mid?url'
import minuetUrl from '../../../test-fixtures/midi/minuet-in-g.mid?url'

const FIXTURES = [
  { fileName: 'minuet-in-g.mid', url: minuetUrl },
  { fileName: 'canon-in-d.mid', url: canonUrl },
  { fileName: 'invention-1.mid', url: inventionUrl },
] as const

// Core and audio objects stay outside Vue's reactivity; the UI reads them once per frame.
let audioContext: AudioContext | null = null
let tempoMap: TempoMap | null = null
let barMap: BarMap | null = null
const bus = new EventBus<TransportEvents>()
const sounding = { right: new Set<HandNote>(), left: new Set<HandNote>() }
let transport: Transport | null = null
let frame = 0

const selected = ref('')
const loading = ref(false)
const error = ref('')
const song = shallowRef<Song | null>(null)
const barCount = ref(0)
const hasBarZero = ref(false)

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
const metronome = ref(false)

const readout = ref({
  state: 'stopped',
  songTime: 0,
  barBeat: '–',
  bpm: 0,
  preRoll: false,
  right: '',
  left: '',
})

const facts = computed(() => {
  const s = song.value
  if (s === null) return null
  return {
    tempos: s.tempoEvents.map((e) => `${e.tick}: ${(60e6 / e.microsPerQuarter).toFixed(2)} BPM`),
    meters: s.timeSignatureEvents.map((e) => `${e.tick}: ${e.numerator}/${e.denominator}`),
  }
})

function parseChannels(text: string): number[] {
  return text
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 15)
}

function rebuild(): void {
  const s = song.value
  if (s === null || transport === null) return
  const override: MeterOverride | null = overrideEnabled.value
    ? {
        timeSignature: {
          numerator: overrideNumerator.value,
          denominator: overrideDenominator.value,
        },
        barOneStartTick: overrideBarOneTick.value,
      }
    : null
  tempoMap = new TempoMap(s.ppq, s.tempoEvents)
  barMap = BarMap.fromSong(s, override)
  const notes = assignHands(s.notes, {
    right: parseChannels(rightChannels.value),
    left: parseChannels(leftChannels.value),
  })
  transport.setSong({ notes, tempoMap, barMap, endTick: s.durationTicks })
  barCount.value = barMap.barCount
  hasBarZero.value = barMap.hasBarZero
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

async function play(): Promise<void> {
  // Browsers only let the audio clock run after a user gesture.
  await audioContext?.resume()
  transport?.play()
}

function setLoop(): void {
  try {
    transport?.setLoop({ startBar: loopStart.value, endBar: loopEnd.value })
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  syncLoopLabel()
}

function clearLoop(): void {
  transport?.setLoop(null)
  syncLoopLabel()
}

function syncLoopLabel(): void {
  const loop = transport?.loop ?? null
  loopLabel.value = loop === null ? 'off' : `${loop.startBar}–${loop.endBar}`
}

function names(notes: Set<HandNote>): string {
  return [...notes]
    .sort((a, b) => a.midi - b.midi)
    .map((n) => noteName(n.midi))
    .join(' ')
}

function tick(): void {
  frame = requestAnimationFrame(tick)
  if (transport === null) return
  transport.update()
  const position = transport.position
  const songTick = tempoMap?.secondsToTick(position) ?? 0
  const at = barMap?.tickToPosition(songTick)
  readout.value = {
    state: transport.state,
    songTime: position,
    barBeat: at === undefined ? '–' : `${at.bar}:${at.beat}`,
    bpm: ((tempoMap?.bpmAt(songTick) ?? 0) * transport.tempoPercent) / 100,
    preRoll: transport.inPreRoll,
    right: names(sounding.right),
    left: names(sounding.left),
  }
}

watch(selected, (fileName) => void loadFixture(fileName))
watch(tempoPercent, (p) => transport?.setTempoPercent(p))
watch([preRollBeats, preRollMode, metronome], ([beats, mode, click]) =>
  transport?.setPreRoll({ beats, mode, metronome: click }),
)

onMounted(() => {
  audioContext = new AudioContext()
  transport = new Transport({ clock: new AudioContextClock(audioContext), bus })
  bus.on('noteOn', (e) => sounding[e.hand].add(e.note))
  bus.on('noteOff', (e) => sounding[e.hand].delete(e.note))
  bus.on('allNotesOff', () => {
    sounding.right.clear()
    sounding.left.clear()
  })
  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  transport?.stop()
  transport = null
  void audioContext?.close()
  audioContext = null
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
        <button type="button" @click="play">Play</button>
        <button type="button" @click="transport?.pause()">Pause</button>
        <button type="button" @click="transport?.stop()">Stop</button>
        <button type="button" @click="transport?.prevBar()">◀ Prev bar</button>
        <button type="button" @click="transport?.nextBar()">Next bar ▶</button>
        <label>
          Go to bar
          <input v-model.number="goToBar" type="number" step="1" />
        </label>
        <button type="button" @click="transport?.seekToBar(goToBar)">Go</button>
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
        <label><input v-model="metronome" type="checkbox" /> Metronome</label>
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

.notes {
  min-height: 1.2em;
  font-family: ui-monospace, monospace;
}

.error {
  color: #ff6b6b;
}
</style>
