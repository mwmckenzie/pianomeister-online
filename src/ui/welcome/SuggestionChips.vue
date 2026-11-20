<script setup lang="ts">
import { inject } from 'vue'

import type { Suggestion } from '@/core/insights/Suggestion'
import { formatAddedAt } from '@/core/library/formatAddedAt'

import AppIcon from '../components/AppIcon.vue'
import { playerActionsKey } from '../player/playerActionsKey'

/**
 * "Maybe next" (QGWelcomeA, m7-7 decision 10): up to two chips — a resting bookmark ("12 days
 * ago") and a song never played. A click loads it and opens the player.
 */
defineProps<{ readonly suggestions: readonly Suggestion[]; readonly now: number }>()
const player = inject(playerActionsKey)

function ago(at: number, now: number): string {
  const text = formatAddedAt(at, now)
  return text.endsWith(' days') ? `${text} ago` : text
}
</script>

<template>
  <div v-if="suggestions.length > 0" class="suggestions" data-testid="suggestions">
    <span class="section-caps cap">Maybe next</span>
    <template v-for="s in suggestions" :key="s.kind">
      <button
        v-if="s.kind === 'bookmark'"
        type="button"
        class="chip"
        data-testid="suggestion"
        @click="player?.play(s.bookmark.songId, s.bookmark.id)"
      >
        <AppIcon name="bookmark" :size="14" class="mark" />
        <span class="label">{{ s.bookmark.name }} · {{ s.songTitle }} ·</span>
        <span class="dim">{{ ago(s.lastPlayedAt, now) }}</span>
      </button>
      <button
        v-else
        type="button"
        class="chip"
        data-testid="suggestion"
        @click="player?.play(s.songId, null)"
      >
        <AppIcon name="song" :size="18" />
        <span class="label">{{ s.title }} ·</span>
        <span class="dim">never played</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  text-shadow: 0 1px 10px rgb(0 0 0 / 85%);
}

.cap {
  align-self: center;
  margin-right: 4px;
}

.chip {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  height: 34px;
  padding: 0 14px;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 999px;
  background: rgb(18 24 44 / 35%);
  color: var(--text-soft, #c9d2e8);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.chip:hover {
  border-color: rgb(255 255 255 / 24%);
  color: var(--text-1);
}

.chip:focus-visible {
  outline: 2px solid var(--text-strong);
  outline-offset: 2px;
}

.mark {
  flex-shrink: 0;
  color: var(--secondary);
}

.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dim {
  flex-shrink: 0;
  color: var(--text-3);
}
</style>
