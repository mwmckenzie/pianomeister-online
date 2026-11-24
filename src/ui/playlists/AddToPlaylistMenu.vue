<script setup lang="ts">
import { onMounted, ref } from 'vue'

import AppButton from '../components/AppButton.vue'
import AppPopover from '../components/AppPopover.vue'
import { usePlaylistStore } from '../stores/playlistStore'
import { usePlaylistActions } from './usePlaylistActions'

/**
 * "Add to playlist…" (milestone 9.5 B6), in the Library's song actions and the song picker: the
 * profile's playlists, then "New playlist…" (makes one holding the song and opens it).
 */
const props = defineProps<{ readonly songId: string }>()
const emit = defineEmits<{ done: [] }>()
const store = usePlaylistStore()
const actions = usePlaylistActions()
const open = ref(false)

onMounted(() => {
  if (!store.loaded) void store.refresh()
})

async function add(playlistId: string): Promise<void> {
  open.value = false
  await actions.addSong(playlistId, props.songId)
  emit('done')
}

async function create(): Promise<void> {
  open.value = false
  emit('done')
  await actions.createWithSong(props.songId)
}
</script>

<template>
  <AppPopover v-model:open="open" side="top" align="start" label="Add to playlist">
    <template #trigger>
      <AppButton data-testid="add-to-playlist">Add to playlist…</AppButton>
    </template>
    <div class="menu" role="menu" data-testid="add-to-playlist-menu">
      <button
        v-for="p in store.playlists"
        :key="p.id"
        type="button"
        role="menuitem"
        data-testid="add-to-playlist-item"
        @click="add(p.id)"
      >
        {{ p.name }}
      </button>
      <hr v-if="store.playlists.length > 0" />
      <button type="button" role="menuitem" data-testid="add-to-playlist-new" @click="create">
        New playlist…
      </button>
    </div>
  </AppPopover>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 200px;
  max-height: 300px;
  padding: 6px;
  overflow-y: auto;
}

.menu button {
  overflow: hidden;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.menu button:hover,
.menu button:focus-visible {
  outline: none;
  background: rgb(var(--primary-rgb) / 18%);
}

hr {
  width: 100%;
  margin: 4px 0;
  border: 0;
  border-top: 1px solid var(--divider);
}
</style>
