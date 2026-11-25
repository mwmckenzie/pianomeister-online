<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { BenchSuite } from '@/core/bench/BenchCell'
import type { BenchRun } from '@/core/bench/BenchResult'
import { buildSuite, suiteSec } from '@/core/bench/buildSuite'
import { cellKey } from '@/core/bench/cellKey'
import { compareRuns } from '@/core/bench/compareRuns'
import { groupCells, isNoisy } from '@/core/bench/groupCells'
import { readBenchRun } from '@/core/bench/readBenchRun'
import { cellSec } from '@/core/bench/SEGMENTS'
import { summaryText } from '@/core/bench/summaryText'

import { benchFileName } from '../bench/benchFileName'
import { keepRun, readHistory } from '../bench/benchHistory'
import { benchHostKey } from '../bench/BenchHost'
import { runBench } from '../bench/BenchRunner'
import AppButton from '../components/AppButton.vue'
import SelectField from '../components/SelectField.vue'
import { formatTime } from '../format/formatTime'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'

/**
 * The benchmark (milestone 11, Phase 0): measures the real player under fixed looks, presets and
 * music, and hands the numbers over as a file. `?auto=1` runs it without a click
 * (`npm run bench:render`).
 */
const host = inject(benchHostKey)
const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()
const toasts = useToastStore()

const LABELS = ['strong', 'mainstream', 'weak-battery', 'weak-cpu', 'floor', 'tablet', 'phone']
const SUITES = [
  { value: 'smoke', label: 'Smoke' },
  { value: 'standard', label: 'Standard' },
  { value: 'full', label: 'Full' },
]
const isSuite = (x: unknown): x is BenchSuite => SUITES.some((s) => s.value === x)

const suite = ref<BenchSuite>(isSuite(route.query.suite) ? route.query.suite : 'standard')
const label = ref(typeof route.query.label === 'string' ? route.query.label : '')
const notes = ref('')
const state = ref<'setup' | 'running' | 'done'>('setup')
const error = ref('')
const done = ref(0)
const now = ref('')
const run = shallowRef<BenchRun | null>(null)
const history = shallowRef(readHistory())
const against = shallowRef<BenchRun | null>(null)
let abort: AbortController | null = null

const ready = computed(() => host?.ready.value === true)
/** Smoke runs the preset in use, or the one `bench:render` asks for. */
const quality = computed(() => {
  const asked = route.query.quality
  return asked === 'off' || asked === 'low' || asked === 'medium' || asked === 'high'
    ? asked
    : settings.settings.render.quality
})
const cells = computed(() => buildSuite(suite.value, quality.value))
const minutes = (sec: number) => (sec < 90 ? `${Math.round(sec)} s` : `${Math.round(sec / 60)} min`)
const estimate = computed(() => minutes(suiteSec(cells.value)))
const left = computed(() =>
  formatTime(cells.value.slice(done.value).reduce((sum, c) => sum + cellSec(c.segment), 0)),
)
const groups = computed(() =>
  run.value === null ? [] : [...groupCells(run.value.cells)].sort((a, b) => b.p95 - a.p95),
)
const comparison = computed(() =>
  run.value === null || against.value === null ? null : compareRuns(against.value, run.value),
)

async function start(): Promise<void> {
  if (host === undefined || state.value === 'running') return
  error.value = ''
  run.value = null
  against.value = null
  done.value = 0
  state.value = 'running'
  abort = new AbortController()
  // Read once: the settings change as the cells go by.
  const list = cells.value
  try {
    const result = await runBench(host, {
      suite: suite.value,
      cells: list,
      label: label.value.trim() === '' ? 'run' : label.value.trim(),
      notes: notes.value.trim(),
      signal: abort.signal,
      setSettings: settings.setBench,
      onProgress: (n, cell) => {
        done.value = n
        now.value = cellKey(cell)
      },
    })
    if (result === null) {
      state.value = 'setup'
      return
    }
    keepRun(result)
    history.value = readHistory()
    run.value = result
    against.value = history.value[1] ?? null
    state.value = 'done'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    state.value = 'setup'
  } finally {
    abort = null
  }
}

function cancel(): void {
  abort?.abort()
}

function onKey(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (state.value === 'running') cancel()
  else void router.push({ name: 'player' })
}

function download(): void {
  if (run.value === null) return
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(run.value)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = benchFileName(run.value)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

async function copy(): Promise<void> {
  if (run.value === null) return
  try {
    await navigator.clipboard.writeText(summaryText(run.value))
    toasts.show('Summary copied')
  } catch {
    toasts.show("Couldn't copy: the browser doesn't allow it here", 'error')
  }
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file === undefined) return
  let read: BenchRun | string = 'Not a PianoMeister benchmark file'
  try {
    read = readBenchRun(JSON.parse(await file.text()))
  } catch {
    // Not JSON: said below.
  }
  if (typeof read === 'string') toasts.show(read, 'error')
  else against.value = read
}

const compareId = computed({
  get: () => against.value?.id ?? '',
  set: (id: string) => (against.value = history.value.find((r) => r.id === id) ?? null),
})
const compareOptions = computed(() =>
  history.value
    .filter((r) => r.id !== run.value?.id)
    .map((r) => ({ value: r.id, label: `${r.label} · ${r.suite} · ${r.at.slice(0, 16)}` })),
)

watch([state, run, error], () =>
  Object.assign(window, {
    pianomeisterBench: { state: state.value, run: run.value, error: error.value },
  }),
)
onMounted(() => {
  window.addEventListener('keydown', onKey)
  if (route.query.auto !== '1') return
  watch(ready, (on) => on && void start(), { immediate: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  cancel()
})
</script>

<template>
  <p v-if="state === 'running'" class="running glass" role="status" data-testid="bench-running">
    <span>{{ done + 1 }} of {{ cells.length }} · {{ left }} left · {{ now }}</span>
    <AppButton size="sm" data-testid="bench-cancel" @click="cancel">Cancel</AppButton>
  </p>

  <section v-else class="bench glass" aria-label="Benchmark" data-testid="bench-page">
    <header class="head">
      <h1 class="title">Benchmark</h1>
      <AppButton size="sm" data-testid="bench-close" @click="router.push({ name: 'player' })">
        Close
      </AppButton>
    </header>

    <div class="setup">
      <p class="text">
        Plays fixed music under fixed looks, without sound, and measures how smoothly it runs. Leave
        the window alone and in front meanwhile. Your settings, songs and statistics stay as they
        are; the result stays on this device until you download it.
      </p>
      <div class="fields">
        <label class="field">
          What to run
          <SelectField v-model="suite" :options="SUITES" label="What to run" />
        </label>
        <label class="field">
          Device label
          <input
            v-model="label"
            class="form-control"
            list="bench-labels"
            maxlength="40"
            data-testid="bench-label"
          />
          <datalist id="bench-labels">
            <option v-for="name in LABELS" :key="name" :value="name" />
          </datalist>
        </label>
        <label class="field wide">
          Notes (power, throttling)
          <input v-model="notes" class="form-control" maxlength="120" />
        </label>
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="actions">
        <AppButton variant="primary" :disabled="!ready" data-testid="bench-start" @click="start">
          Start ({{ estimate }})
        </AppButton>
        <span v-if="!ready" class="text">Loading the piano…</span>
      </div>
    </div>

    <div v-if="run" class="result" data-testid="bench-result">
      <div class="actions">
        <AppButton variant="primary" data-testid="bench-download" @click="download">
          Download JSON
        </AppButton>
        <AppButton data-testid="bench-copy" @click="copy">Copy summary</AppButton>
      </div>
      <p class="text">
        {{ run.device.gpu ?? 'GPU hidden by the browser' }} ({{ run.device.gpuClass }}) ·
        {{ run.device.viewport.join(' × ') }} at {{ run.device.pixelRatio }} ·
        {{ (1000 / run.device.refreshMs).toFixed(0) }} Hz
      </p>
      <p v-if="run.flags.length > 0" class="error" data-testid="bench-flags">
        {{ run.flags.join(' · ') }}
      </p>
      <table class="table">
        <thead>
          <tr>
            <th>Cell</th>
            <th>p95 ms</th>
            <th>Median</th>
            <th>Dropped</th>
            <th>Engine ms</th>
            <th>GPU ms</th>
            <th>Calls</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in groups" :key="g.key">
            <td>{{ g.key }}{{ isNoisy(g) ? ' (noisy)' : '' }}</td>
            <td>{{ g.p95.toFixed(1) }}</td>
            <td>{{ g.median.toFixed(1) }}</td>
            <td>{{ (g.dropped * 100).toFixed(1) }} %</td>
            <td>{{ g.cpu.toFixed(2) }}</td>
            <td>{{ g.gpuMs?.toFixed(1) ?? 'n/a' }}</td>
            <td>{{ g.drawCalls.toFixed(0) }}</td>
          </tr>
        </tbody>
      </table>

      <h2 class="section-caps">Compare with</h2>
      <div class="actions">
        <SelectField
          v-if="compareOptions.length > 0"
          v-model="compareId"
          :options="compareOptions"
          label="Earlier run"
        />
        <label class="file">
          A file…
          <input
            type="file"
            accept=".json,application/json"
            data-testid="bench-file"
            @change="onFile"
          />
        </label>
      </div>
      <div v-if="comparison" data-testid="bench-comparison">
        <p v-for="warning in comparison.warnings" :key="warning" class="error">{{ warning }}</p>
        <p class="text">
          {{ comparison.shared }} cells in common, {{ comparison.changes.length }} changes beyond
          the noise.
        </p>
        <ul class="text">
          <li v-for="c in comparison.changes.slice(0, 20)" :key="c.key + c.metric">
            {{ c.key }} {{ c.metric }}: {{ c.before.toFixed(1) }} → {{ c.after.toFixed(1) }} ({{
              (c.change * 100).toFixed(0)
            }}
            %)
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.running {
  position: fixed;
  z-index: 20;
  bottom: 12px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  padding: 8px 14px;
  border-radius: 12px;
  /* Blur over the moving scene would be measured too. */
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  background: rgb(5 7 15 / 85%);
  font-size: var(--text-sm);
  translate: -50% 0;
}

.bench {
  position: fixed;
  z-index: 20;
  inset: 24px;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px 24px;
  overflow-y: auto;
  border-radius: var(--radius-lg);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--weight-medium);
}

.text {
  color: var(--text-2);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.fields,
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.actions {
  margin: var(--space-3) 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  color: var(--text-3);
  font-size: var(--text-xs);
}

.field.wide {
  flex: 1 1 220px;
}

.error {
  color: var(--warning);
  font-size: var(--text-sm);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.table th,
.table td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--divider);
  text-align: right;
}

.table th:first-child,
.table td:first-child {
  text-align: left;
}

.file {
  color: var(--text-2);
  font-size: var(--text-sm);
}
</style>
