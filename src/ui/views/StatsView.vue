<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { bucketPractice } from '@/core/insights/bucketPractice'
import { bucketUnitFor } from '@/core/insights/bucketUnitFor'
import { headlineStats } from '@/core/insights/headlineStats'
import { heatmapWeeks } from '@/core/insights/heatmapWeeks'
import { playLogCsv } from '@/core/insights/playLogCsv'
import { practiceByDay } from '@/core/insights/practiceByDay'
import { practiceStreaks } from '@/core/insights/practiceStreaks'
import { rangeWindows } from '@/core/insights/rangeWindows'
import { recordsInWindow } from '@/core/insights/recordsInWindow'
import { shiftDayKey } from '@/core/insights/shiftDayKey'
import type { StatsRange } from '@/core/insights/StatsRange'
import { tempoProgress } from '@/core/insights/tempoProgress'
import { TIME_BANDS } from '@/core/insights/TIME_BANDS'
import { timeOfDayGrid } from '@/core/insights/timeOfDayGrid'
import { topPractice } from '@/core/insights/topPractice'
import { weekStartKey } from '@/core/insights/weekStartKey'
import { isFullSongId } from '@/core/practice/fullSongId'
import { formatPracticeTime } from '@/core/stats/formatPracticeTime'

import AppButton from '../components/AppButton.vue'
import AppIcon from '../components/AppIcon.vue'
import HomeLink from '../components/HomeLink.vue'
import SegmentedControl from '../components/SegmentedControl.vue'
import SelectField from '../components/SelectField.vue'
import BarChart from '../charts/BarChart.vue'
import ChartCard from '../charts/ChartCard.vue'
import HeatmapGrid from '../charts/HeatmapGrid.vue'
import TempoLine from '../charts/TempoLine.vue'
import TopBars from '../charts/TopBars.vue'
import WeekdayGrid from '../charts/WeekdayGrid.vue'
import { bigDuration } from '../format/bigDuration'
import { dayLabel } from '../format/dayLabel'
import { shortDayLabel } from '../format/shortDayLabel'
import { sceneSnapshot } from '../playback/sceneSnapshot'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useProfileStore } from '../stores/profileStore'
import HeadlineTile from '../stats/HeadlineTile.vue'
import { usePracticeDays } from '../stats/usePracticeDays'

/**
 * The stats page (docs/design/m7-7/source/QGStats, m7-7 decisions 14–23): for a rolling range
 * and one song or all, six headline numbers with their change, minutes per day / week / month,
 * top songs (or a song's bookmarks), the practice calendar, when you practise, and tempo
 * progress for a bookmark. Every chart has a tooltip and a table; Export CSV writes the records.
 * All computed from the play log, per active profile, in local calendar days.
 */
const profiles = useProfileStore()
const library = useLibraryStore()
const bookmarks = useBookmarkStore()
const { stats, today, weekStart } = usePracticeDays()

const RANGES = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '12m', label: '12 months' },
  { value: 'all', label: 'All' },
] as const
const PREVIOUS: Record<StatsRange, string> = {
  '7d': 'vs previous 7 days',
  '30d': 'vs previous 30 days',
  '12m': 'vs previous 12 months',
  all: '',
}
const ALL = '__all__'

const range = ref<StatsRange>('30d')
const songFilter = ref<string>(ALL)
const tempoBookmarkId = ref<string>('')

onMounted(() => {
  void bookmarks.refresh()
  if (!library.loaded) void library.refresh()
})

const songTitle = (songId: string) =>
  library.entries.find((e) => e.songId === songId)?.title ?? 'A removed song'

/** Songs with any practice, for the filter. */
const songOptions = computed(() => {
  const played = new Set(stats.records.map((r) => r.songId))
  return [
    { value: ALL, label: 'All songs' },
    ...[...played]
      .map((songId) => ({ value: songId, label: songTitle(songId) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ]
})

const records = computed(() =>
  songFilter.value === ALL
    ? stats.records
    : stats.records.filter((r) => r.songId === songFilter.value),
)
const byDay = computed(() => practiceByDay(records.value))
const firstDay = computed(() => {
  const keys = [...byDay.value.keys()].sort()
  return keys[0] ?? null
})
const windows = computed(() => rangeWindows(range.value, today.value, firstDay.value))
const current = computed(() => headlineStats(records.value, byDay.value, windows.value.current))
const previous = computed(() =>
  windows.value.previous === null
    ? null
    : headlineStats(records.value, byDay.value, windows.value.previous),
)
const inWindow = computed(() => recordsInWindow(records.value, windows.value.current))
const empty = computed(() => current.value.playedMs <= 0)

function change(now: number, before: number, percent: boolean): { note: string; up: boolean } {
  if (previous.value === null || before <= 0) return { note: '', up: false }
  const diff = percent ? Math.round(((now - before) / before) * 100) : now - before
  const sign = diff > 0 ? '+' : ''
  return {
    note: `${sign}${diff}${percent ? '%' : ''} ${PREVIOUS[range.value]}`,
    up: diff > 0,
  }
}

const headlines = computed(() => {
  const c = current.value
  const p = previous.value
  const time = bigDuration(c.playedMs)
  const average = bigDuration(c.averageSessionMs)
  const allDays = new Set([...byDay.value].filter(([, ms]) => ms > 0).map(([k]) => k))
  const streakNow = practiceStreaks(allDays, today.value).current
  return [
    {
      label: 'Practice time',
      value: time.value,
      unit: time.unit,
      ...change(c.playedMs, p?.playedMs ?? 0, true),
    },
    {
      label: 'Sessions',
      value: String(c.sessions),
      unit: '',
      ...change(c.sessions, p?.sessions ?? 0, false),
    },
    { label: 'Average session', value: average.value, unit: average.unit, note: '', up: false },
    {
      label: 'Days practised',
      value: String(c.daysPractised),
      unit: `of ${c.days}`,
      note: '',
      up: false,
    },
    { label: 'Plays', value: String(c.plays), unit: '', ...change(c.plays, p?.plays ?? 0, false) },
    {
      label: 'Longest streak',
      value: String(c.longestStreak),
      unit: c.longestStreak === 1 ? 'day' : 'days',
      note: streakNow > 0 ? `current ${streakNow}` : '',
      up: streakNow > 0,
    },
  ]
})

// Minutes per day, week or month.
const unit = computed(() => bucketUnitFor(windows.value.current))
const buckets = computed(() =>
  bucketPractice(byDay.value, windows.value.current, unit.value, weekStart),
)
const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
function bucketLabel(key: string): string {
  if (unit.value === 'day') return dayLabel(key)
  if (unit.value === 'week') return `Week of ${shortDayLabel(key)}`
  return MONTH.format(Date.parse(key))
}
const bars = computed(() => {
  const list = buckets.value
  const n = list.length
  // A few labels along the axis: the first, two in between, and the current one.
  const labelled = new Set(
    n <= 7 ? list.map((_, i) => i) : [0, Math.round(n / 3), Math.round((2 * n) / 3)],
  )
  const lastLabel =
    unit.value === 'day' ? 'Today' : unit.value === 'week' ? 'This week' : 'This month'
  return list.map((b, i) => ({
    key: b.key,
    value: b.ms / 60_000,
    label: bucketLabel(b.key),
    valueText: b.ms > 0 ? formatPracticeTime(b.ms) : 'No practice',
    current: b.current,
    axis:
      i === n - 1
        ? lastLabel
        : labelled.has(i)
          ? n <= 7
            ? dayLabel(b.key).slice(0, 3)
            : unit.value === 'month'
              ? MONTH.format(Date.parse(b.key))
              : shortDayLabel(b.key)
          : undefined,
  }))
})
const chartTitle = computed(() =>
  unit.value === 'day'
    ? 'Minutes per day'
    : unit.value === 'week'
      ? 'Minutes per week'
      : 'Minutes per month',
)

// Top songs, or one song's bookmarks, Full song and other setups.
const bookmarkName = (id: string) => bookmarks.byId.get(id)?.name ?? null
const top = computed(() => {
  if (songFilter.value === ALL) {
    return topPractice(inWindow.value, (r) => r.songId)
      .slice(0, 6)
      .map((t) => ({
        key: t.key,
        name: songTitle(t.key),
        ms: t.ms,
        valueText: formatPracticeTime(t.ms),
      }))
  }
  return topPractice(inWindow.value, (r) => r.bookmarkId)
    .slice(0, 6)
    .map((t) => ({
      key: t.key ?? 'other',
      name:
        t.key === null
          ? 'Other setups'
          : isFullSongId(t.key)
            ? 'Full song'
            : (bookmarkName(t.key) ?? 'Deleted bookmark'),
      ms: t.ms,
      valueText: formatPracticeTime(t.ms),
      muted: t.key === null,
    }))
})

// The calendar: 6 months, or 12 for the long ranges.
const calendarWeeks = computed(() => (range.value === '12m' || range.value === 'all' ? 52 : 26))
const calendar = computed(() =>
  heatmapWeeks(byDay.value, today.value, calendarWeeks.value, weekStart),
)
const calendarDays = computed(() =>
  calendar.value
    .flat()
    .filter((d) => d.ms > 0)
    .reverse(),
)

const weekdayGrid = computed(() => timeOfDayGrid(inWindow.value))
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Tempo progress for a bookmark (any setup with its range).
const tempoBookmarks = computed(() =>
  bookmarks.bookmarks
    .filter((b) => songFilter.value === ALL || b.songId === songFilter.value)
    .filter((b) => stats.records.some((r) => r.bookmarkId === b.id))
    .map((b) => ({ value: b.id, label: b.name, bookmark: b })),
)
const tempoBookmark = computed(
  () =>
    tempoBookmarks.value.find((b) => b.value === tempoBookmarkId.value)?.bookmark ??
    tempoBookmarks.value[0]?.bookmark ??
    null,
)
/** From the window's start, but at least 12 weeks back, so a short range still shows a trend. */
const tempoFrom = computed(() => {
  const twelveWeeks = shiftDayKey(weekStartKey(today.value, weekStart), -7 * 11)
  return windows.value.current.from < twelveWeeks ? windows.value.current.from : twelveWeeks
})
const tempoPoints = computed(() => {
  const b = tempoBookmark.value
  return b === null
    ? []
    : tempoProgress(stats.records, b.songId, b.config.loop, tempoFrom.value, weekStart)
})

/** The records of the range and filter, as CSV (m7-7 decision 22). */
function exportCsv(): void {
  const csv = playLogCsv(inWindow.value, { songTitle, bookmarkName })
  const slug =
    profiles.active.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'profile'
  const label = { '7d': '7-days', '30d': '30-days', '12m': '12-months', all: 'all' }[range.value]
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `pianomeister-${slug}-${label}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const backdrop = computed(() =>
  sceneSnapshot.value === null ? undefined : { backgroundImage: `url(${sceneSnapshot.value})` },
)
</script>

<template>
  <main class="stats-page" data-testid="stats-page">
    <div class="backdrop" :class="{ snapshot: backdrop !== undefined }" :style="backdrop" />
    <div class="page">
      <header class="top">
        <RouterLink :to="{ name: 'player' }" class="back" data-testid="back-to-player">
          <AppIcon name="chevronLeft" :size="18" /> Player
        </RouterLink>
        <HomeLink />
        <h1 class="title" data-testid="stats-title">Stats · {{ profiles.active.name }}</h1>
        <SegmentedControl
          v-model="range"
          :options="RANGES"
          label="Range"
          data-testid="stats-range"
        />
        <SelectField
          v-model="songFilter"
          :options="songOptions"
          label="Song"
          data-testid="stats-song"
        />
        <span class="spacer" />
        <AppButton :disabled="inWindow.length === 0" data-testid="export-csv" @click="exportCsv">
          Export CSV
        </AppButton>
      </header>

      <div class="headlines">
        <HeadlineTile
          v-for="h in headlines"
          :key="h.label"
          :label="h.label"
          :value="h.value"
          :unit="h.unit"
          :note="h.note"
          :up="h.up"
          :data-label="h.label"
        />
      </div>

      <div class="row two">
        <ChartCard :title="chartTitle" data-testid="minutes-card">
          <template #aside
            ><span class="today-key" aria-hidden="true" />{{
              unit === 'day' ? 'today' : unit === 'week' ? 'this week' : 'this month'
            }}</template
          >
          <BarChart
            :bars="bars"
            :height="150"
            grid
            :label="`${chartTitle}, ${RANGES.find((r) => r.value === range)?.label}`"
          />
          <template #table>
            <table>
              <thead>
                <tr>
                  <th>{{ unit === 'day' ? 'Day' : unit === 'week' ? 'Week' : 'Month' }}</th>
                  <th class="num">Practice</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in buckets" :key="b.key">
                  <td>{{ bucketLabel(b.key) }}</td>
                  <td class="num">{{ b.ms > 0 ? formatPracticeTime(b.ms) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </ChartCard>

        <ChartCard
          :title="songFilter === ALL ? 'Top songs' : 'Top bookmarks'"
          data-testid="top-card"
        >
          <template #aside>by time</template>
          <TopBars v-if="top.length > 0" :rows="top" />
          <p v-else class="empty">No practice in this range yet.</p>
          <template #table>
            <table>
              <thead>
                <tr>
                  <th>{{ songFilter === ALL ? 'Song' : 'Bookmark' }}</th>
                  <th class="num">Practice</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in top" :key="t.key">
                  <td>{{ t.name }}</td>
                  <td class="num">{{ t.valueText }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </ChartCard>
      </div>

      <div class="row three">
        <ChartCard
          :title="calendarWeeks === 52 ? 'Last 12 months' : 'Last 6 months'"
          data-testid="calendar-card"
        >
          <HeatmapGrid
            :weeks="calendar"
            :cell="11"
            :gap="3"
            fit
            :label="`Practice calendar, last ${calendarWeeks} weeks`"
          />
          <template #table>
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th class="num">Practice</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in calendarDays" :key="d.key">
                  <td>{{ dayLabel(d.key) }}</td>
                  <td class="num">{{ formatPracticeTime(d.ms) }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </ChartCard>

        <ChartCard title="When you practise" data-testid="when-card">
          <WeekdayGrid :grid="weekdayGrid" :week-start="weekStart" />
          <template #table>
            <table>
              <thead>
                <tr>
                  <th />
                  <th v-for="band in TIME_BANDS" :key="band.id" class="num">{{ band.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="i in 7" :key="i">
                  <td>{{ WEEKDAY_NAMES[(weekStart + i - 1) % 7] }}</td>
                  <td v-for="(ms, b) in weekdayGrid[(weekStart + i - 1) % 7]" :key="b" class="num">
                    {{ ms > 0 ? formatPracticeTime(ms) : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </ChartCard>

        <ChartCard title="Tempo progress" data-testid="tempo-card">
          <template v-if="tempoBookmarks.length > 0" #aside>
            <AppIcon name="bookmark" :size="14" class="tempo-icon" />
            <SelectField
              :model-value="tempoBookmark?.id ?? ''"
              :options="tempoBookmarks"
              label="Bookmark"
              class="tempo-select"
              data-testid="tempo-bookmark"
              @update:model-value="tempoBookmarkId = $event"
            />
          </template>
          <TempoLine
            v-if="tempoPoints.length >= 2 && tempoBookmark"
            :points="tempoPoints"
            :label="`${tempoBookmark.name} tempo per week`"
          />
          <p v-else class="empty" data-testid="tempo-empty">
            {{
              tempoBookmark
                ? 'Practise this bookmark in a few different weeks to see its tempo over time.'
                : 'Practise a bookmark to see its tempo over time.'
            }}
          </p>
          <template v-if="tempoPoints.length > 0" #table>
            <table>
              <thead>
                <tr>
                  <th>Week</th>
                  <th class="num">Highest tempo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in tempoPoints" :key="p.week">
                  <td>Week of {{ shortDayLabel(p.week) }}</td>
                  <td class="num">{{ p.tempo }}%</td>
                </tr>
              </tbody>
            </table>
          </template>
        </ChartCard>
      </div>
      <p v-if="empty" class="empty-note" data-testid="stats-empty">
        No practice {{ range === 'all' ? 'yet' : 'in this range' }}. Play a song and it shows up
        here.
      </p>
    </div>
  </main>
</template>

<style scoped>
/* Sizes and spacing from QGStats (1280 × 720). */
.stats-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--bg);
  color: var(--text-1);
}

.backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 50% 110%, rgb(40 70 140 / 25%), transparent 60%),
    linear-gradient(180deg, #05070f, #0a0f1e);
}

.backdrop.snapshot {
  inset: -32px;
  background-position: center;
  background-size: cover;
  filter: blur(12px);
}

.backdrop::after {
  position: absolute;
  inset: 0;
  background: rgb(5 7 15 / 78%);
  content: '';
}

.page {
  position: absolute;
  inset: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-x: hidden;
  overflow-y: auto;
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px 0 10px;
  border-radius: 12px;
  background: rgb(255 255 255 / 6%);
  color: var(--text-1);
  font-size: 14px;
  text-decoration: none;
}

.title {
  margin: 0 8px 0 4px;
  font-size: 20px;
  font-weight: var(--weight-medium);
  white-space: nowrap;
}

.spacer {
  flex: 1;
}

.headlines {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.row {
  display: grid;
  gap: 10px;
  min-height: 0;
}

.row.two {
  grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr);
}

.row.three {
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr) minmax(0, 1.1fr);
}

/* The "today" key: a swatch in the primary colour (whatever the theme), not a colour name. */
.today-key {
  width: 9px;
  height: 9px;
  margin-right: 5px;
  border-radius: 2px;
  background: var(--primary);
}

/* The page scrolls; its rows keep their height instead of shrinking into it. */
.page > * {
  flex-shrink: 0;
}

.tempo-icon {
  flex-shrink: 0;
  margin-right: 4px;
  color: var(--secondary);
}

.tempo-select {
  max-width: 180px;
}

.empty,
.empty-note {
  margin: 0;
  color: var(--text-3);
  font-size: var(--text-sm);
}

.empty-note {
  text-align: center;
}

@media (width < 1100px) {
  .headlines {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .row.three {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .row.three > :last-child {
    grid-column: 1 / -1;
  }
}
</style>
