<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { lookSwatch } from '@/core/looks/lookSwatch'
import { allLooks } from '@/core/looks/lookValues'
import type { Playlist } from '@/core/playlists/Playlist'
import { recentPlaylists } from '@/core/playlists/recentPlaylists'
import { resolvePlaylist } from '@/core/playlists/resolvePlaylist'

import AppIcon from '../components/AppIcon.vue'
import { formatTime } from '../format/formatTime'
import { usePlaylistActions } from '../playlists/usePlaylistActions'
import { useLibraryStore } from '../stores/libraryStore'
import { usePlaylistStore } from '../stores/playlistStore'
import { useSettingsStore } from '../stores/settingsStore'

/**
 * Welcome's "Listen" card (milestone 9.5 E, board QGWelcomePlaylists): up to three playlists,
 * the most recently played first, each with Play, and "All playlists". Hidden with none (Q8).
 */
const store = usePlaylistStore()
const library = useLibraryStore()
const settings = useSettingsStore()
const actions = usePlaylistActions()

const looks = computed(() => new Map(allLooks(settings.looks).map((l) => [l.id, l])))
const durations = computed(
  () => new Map(library.entries.map((e) => [e.songId, { durationSec: e.facts.durationSeconds }])),
)
const shown = computed(() =>
  recentPlaylists(store.playlists).map((p) => {
    const look = p.lookId === null ? undefined : looks.value.get(p.lookId)
    return {
      playlist: p,
      swatch: look === undefined ? 'transparent' : lookSwatch(look, settings.noteColourSets),
      meta: meta(p, look?.name ?? 'Current look'),
    }
  }),
)

function meta(p: Playlist, lookName: string): string {
  const { durationSec } = resolvePlaylist(p, durations.value, new Set(looks.value.keys()))
  const n = p.entries.length
  return `${n} ${n === 1 ? 'song' : 'songs'} · ${formatTime(durationSec)} · ${lookName}`
}

onMounted(() => {
  if (!store.loaded) void store.refresh()
  if (!library.loaded) void library.refresh()
})
</script>

<template>
  <section
    v-if="shown.length > 0"
    class="card glass"
    aria-labelledby="listen-heading"
    data-testid="listen-card"
  >
    <header class="head">
      <h2 id="listen-heading" class="section-caps">Listen</h2>
      <RouterLink :to="{ name: 'playlists' }" class="all" data-testid="listen-all">
        All playlists
      </RouterLink>
    </header>
    <div v-for="s in shown" :key="s.playlist.id" class="item" data-testid="listen-item">
      <span class="dot" :style="{ background: s.swatch }" />
      <span class="text">
        <span class="name" :title="s.playlist.name">{{ s.playlist.name }}</span>
        <span class="meta">{{ s.meta }}</span>
      </span>
      <button
        type="button"
        class="play"
        :aria-label="`Play ${s.playlist.name}`"
        :disabled="s.playlist.entries.length === 0"
        data-testid="listen-play"
        @click="actions.play(s.playlist.id)"
      >
        <AppIcon name="play" :size="16" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 300px;
  padding: 16px 20px;
  border-radius: 18px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head .section-caps {
  margin: 0;
}

.all {
  color: var(--primary);
  font-size: 13px;
  text-decoration: none;
}

.all:hover {
  text-decoration: underline;
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 999px;
}

.text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.name {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  overflow: hidden;
  color: var(--text-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.play {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
  background: transparent;
  color: var(--text-1);
  cursor: pointer;
}

.play:hover {
  border-color: var(--primary);
}

.play:disabled {
  opacity: 0.4;
  cursor: default;
}

/* At 720 px tall (board QGWelcomePlaylists) two fit under the calendar; the third shows above 800. */
@media (height < 800px) {
  .item:nth-of-type(n + 3) {
    display: none;
  }
}
</style>
