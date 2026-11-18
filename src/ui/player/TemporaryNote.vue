<script setup lang="ts">
import { useRouter } from 'vue-router'

import { usePracticeStore } from '../stores/practiceStore'

/**
 * While a bookmark is loaded, player-side practice controls only make temporary changes
 * (brief decision 69). This says so, and links to the bookmark manager, where the bookmark
 * itself is edited. `defaults` is for controls that stay global while a bookmark is loaded (the
 * Practice tab's pre-roll, decision 68): it says the loaded bookmark has its own values.
 */
const props = withDefaults(defineProps<{ readonly kind?: 'temporary' | 'defaults' }>(), {
  kind: 'temporary',
})
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
  <p
    v-if="practice.bookmark && props.kind === 'defaults'"
    class="temporary-note"
    data-testid="defaults-note"
  >
    The defaults for Full song. {{ practice.bookmark.name }} has its own pre-roll ·
    <a href="#" class="link" data-testid="defaults-note-link" @click.prevent="openManager"
      >edit it in the Bookmark manager</a
    >
  </p>
  <p v-else-if="practice.bookmark" class="temporary-note" data-testid="temporary-note">
    Temporary for {{ practice.bookmark.name }} ·
    <a href="#" class="link" data-testid="temporary-note-link" @click.prevent="openManager"
      >edit it in the Bookmark manager</a
    >
  </p>
</template>

<style scoped>
.temporary-note {
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
