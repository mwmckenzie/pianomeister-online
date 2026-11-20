<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useSettingsStore } from '../stores/settingsStore'
import AppIcon from './AppIcon.vue'

/**
 * "Home" beside "‹ Player" in the Library, Bookmarks and Stats headers (m7-7 decision 2): the
 * Welcome screen; its tooltip names the key in effect.
 */
const settings = useSettingsStore()
const key = computed(() => settings.shortcutLabel('goHome'))
</script>

<template>
  <RouterLink
    :to="{ name: 'welcome' }"
    class="home-link"
    :title="key ? `Home (${key})` : 'Home'"
    data-testid="home-link"
  >
    <AppIcon name="home" :size="18" /> Home
  </RouterLink>
</template>

<style scoped>
.home-link {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px 0 10px;
  border-radius: var(--radius-md);
  background: var(--field);
  color: var(--text-1);
  font-size: var(--text-md);
  text-decoration: none;
}

.home-link:hover {
  background: var(--field-hover, rgb(255 255 255 / 10%));
}

.home-link:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-field);
}
</style>
