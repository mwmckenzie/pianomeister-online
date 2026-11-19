<script setup lang="ts">
import { useRouter } from 'vue-router'

import { usePracticeStore } from '../stores/practiceStore'

/**
 * The Practice tab's pre-roll rows always edit the global defaults (brief decision 68): while a
 * bookmark is loaded this says so, and links to the bookmark manager, where it is edited.
 */
const practice = usePracticeStore()
const router = useRouter()
const emit = defineEmits<{ navigate: [] }>()

function openManager(): void {
  const b = practice.bookmark
  if (b === null) return
  emit('navigate')
  void router.push({ name: 'bookmarks', query: { song: b.songId, bookmark: b.id } })
}
</script>

<template>
  <p v-if="practice.bookmark" class="defaults-note" data-testid="defaults-note">
    The defaults for Full song. {{ practice.bookmark.name }} has its own pre-roll ·
    <a href="#" class="link" data-testid="defaults-note-link" @click.prevent="openManager"
      >edit it in the Bookmark manager</a
    >
  </p>
</template>

<style scoped>
.defaults-note {
  margin: 0;
  color: var(--text-3);
  font-size: var(--text-xs);
  line-height: 1.45;
}

.link {
  color: var(--primary);
  text-decoration: underline;
  text-decoration-color: rgb(var(--primary-rgb) / 45%);
  text-underline-offset: 2px;
}
</style>
