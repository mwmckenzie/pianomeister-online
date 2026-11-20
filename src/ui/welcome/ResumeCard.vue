<script setup lang="ts">
import { computed, inject, nextTick, onMounted, shallowRef, useTemplateRef } from 'vue'

import { bookmarkSummary } from '@/core/practice/bookmarkSummary'
import { clampRange } from '@/core/practice/clampRange'
import { fullSongId } from '@/core/practice/fullSongId'
import { formatPracticeTime } from '@/core/stats/formatPracticeTime'
import type { LastOpened } from '@/data/LastOpened'

import AppIcon from '../components/AppIcon.vue'
import { lastPlayedPhrase } from '../format/lastPlayedPhrase'
import { playerActionsKey } from '../player/playerActionsKey'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useStatsStore } from '../stores/statsStore'

/**
 * "Pick up where you left off" (QGWelcomeA, m7-7 decision 6): the profile's last loaded entry
 * with its song, the bookmark line, its range with a marker where playback stopped, and when it
 * was last played. Resume (focused on arrival; Enter) goes back to the player, which is already
 * there, paused. With no history it offers the first bundled song.
 */
const library = useLibraryStore()
const bookmarks = useBookmarkStore()
const stats = useStatsStore()
const settings = useSettingsStore()
const player = inject(playerActionsKey)
const resumeButton = useTemplateRef<HTMLButtonElement>('resumeButton')

const last = shallowRef<LastOpened | null>(null)
const ready = shallowRef(false)

onMounted(async () => {
  last.value = await library.lastOpened()
  if (!library.loaded) await library.refresh()
  ready.value = true
  await nextTick()
  resumeButton.value?.focus()
})

const song = computed(() =>
  last.value === null
    ? null
    : (library.entries.find((e) => e.songId === last.value?.songId) ?? null),
)
const bookmark = computed(() =>
  last.value?.bookmarkId == null ? null : (bookmarks.byId.get(last.value.bookmarkId) ?? null),
)
const entryId = computed(() =>
  song.value === null ? null : (bookmark.value?.id ?? fullSongId(song.value.songId)),
)
/** The first bundled song, for a profile with nothing to resume. */
const firstSong = computed(
  () => library.entries.find((e) => e.source === 'bundled') ?? library.entries[0] ?? null,
)
/**
 * No history yet (nothing ever played): the card offers a song to start with — the one the
 * player has loaded (the first bundled song on a first run).
 */
const fresh = computed(() => stats.records.length === 0)
const startSong = computed(() => song.value ?? firstSong.value)

const bars = computed(() => Math.max(1, song.value?.bars ?? 1))
const range = computed(() => {
  const b = bookmark.value
  return b === null ? { startBar: 1, endBar: bars.value } : clampRange(b.config.loop, 1, bars.value)
})
const entryLine = computed(() => {
  const b = bookmark.value
  if (b === null) return 'Full song'
  if (b.autoName) return b.name
  return `${b.name} · ${bookmarkSummary({ ...b.config, loop: range.value }, bars.value, { alwaysHands: true })}`
})
const marker = computed(() => {
  const bar = last.value?.bar
  return bar === undefined ? null : Math.min(1, Math.max(0, (bar - 1) / bars.value))
})
const details = computed(() => {
  const id = entryId.value
  if (id === null) return ''
  const totals = stats.entry(id)
  const parts = [
    totals.lastPlayedAt === null
      ? 'Not played yet'
      : `Last played ${lastPlayedPhrase(totals.lastPlayedAt, stats.now)}`,
  ]
  if (last.value?.bar !== undefined) parts.push(`stopped at bar ${last.value.bar}`)
  if (totals.plays > 0) parts.push(totals.plays === 1 ? '1 play' : `${totals.plays} plays`)
  if (totals.playedMs > 0) parts.push(formatPracticeTime(totals.playedMs))
  return parts.join(' · ')
})
const enterKey = computed(() => settings.shortcutLabel('listOpen'))

/** Resume: the player has this entry loaded and paused; with none, start the first song. */
function resume(): void {
  if (song.value !== null) player?.resume()
  else if (startSong.value !== null) void player?.play(startSong.value.songId, null)
}

defineExpose({ resume })
</script>

<template>
  <section class="resume glass" aria-labelledby="resume-heading" data-testid="resume-card">
    <h2 id="resume-heading" class="section-caps cap">
      {{ song && !fresh ? 'Pick up where you left off' : 'Start practising' }}
    </h2>
    <template v-if="song && !fresh">
      <div>
        <p class="title" :title="song.title" data-testid="resume-title">{{ song.title }}</p>
        <p v-if="song.composer" class="composer" :title="song.composer">{{ song.composer }}</p>
        <p class="entry" :title="entryLine" data-testid="resume-entry">
          <AppIcon name="bookmark" :size="14" class="entry-icon" />
          <span>{{ entryLine }}</span>
        </p>
      </div>
      <div class="range" aria-hidden="true">
        <span
          class="span"
          :class="{ full: bookmark === null }"
          :style="{
            left: `${((range.startBar - 1) / bars) * 100}%`,
            width: `${((range.endBar - range.startBar + 1) / bars) * 100}%`,
          }"
        />
        <span
          v-if="marker !== null"
          class="marker"
          :style="{ left: `${marker * 100}%` }"
          data-testid="resume-marker"
        />
      </div>
      <p class="details" data-testid="resume-details">{{ details }}</p>
    </template>
    <p v-else-if="ready && startSong" class="details" data-testid="resume-empty">
      Nothing played yet. Start with {{ startSong.title }}, or choose any song.
    </p>
    <div class="actions">
      <button
        ref="resumeButton"
        type="button"
        class="primary"
        data-testid="resume"
        :disabled="!ready"
        @click="resume"
      >
        <AppIcon name="play" :size="22" />
        {{ !fresh || !startSong ? 'Resume' : `Start with ${startSong.title}` }}
      </button>
      <button
        type="button"
        class="secondary"
        data-testid="choose-another"
        @click="player?.choose()"
      >
        Choose another…
      </button>
      <span v-if="enterKey" class="hint">{{ enterKey }} to {{ fresh ? 'start' : 'resume' }}</span>
    </div>
  </section>
</template>

<style scoped>
.resume {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 520px;
  max-width: 100%;
  padding: 22px 24px;
  border-radius: 18px;
}

.cap {
  margin: 0;
}

p {
  margin: 0;
}

.title {
  overflow: hidden;
  font-size: 24px;
  font-weight: var(--weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer {
  overflow: hidden;
  margin-top: 2px;
  color: var(--text-2);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-top: 8px;
  color: var(--secondary);
  font-size: 14px;
}

.entry span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-icon {
  flex-shrink: 0;
}

.range {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: rgb(255 255 255 / 10%);
}

.span {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 3px;
  background: var(--secondary);
}

.span.full {
  background: rgb(var(--secondary-rgb) / 45%);
}

.marker {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 12px;
  border-radius: 1px;
  background: var(--text-strong);
}

.details {
  color: var(--text-2);
  font-size: 13px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.primary {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 20px 0 16px;
  border: 0;
  border-radius: 12px;
  background: var(--primary);
  color: var(--on-primary);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.primary:focus-visible {
  outline: 2px solid var(--text-strong);
  outline-offset: 2px;
}

.secondary {
  height: 44px;
  padding: 0 16px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 12px;
  background: transparent;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.secondary:hover {
  background: var(--field);
}

.hint {
  margin-left: auto;
  color: var(--text-3);
  font-size: 12px;
}
</style>
