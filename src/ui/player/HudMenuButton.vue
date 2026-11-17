<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import type { IconName } from '../components/IconName'

/**
 * One of the app icons in the HUD's left column (decision 60): grey and dim at rest; on hover or
 * keyboard focus it turns white and shows its name and shortcut as plain text beside it (no
 * tooltip box). `active` (e.g. the playfield panel is open) shows it in the primary colour.
 */
withDefaults(
  defineProps<{
    readonly icon: IconName
    readonly label: string
    readonly shortcut: string
    readonly active?: boolean
  }>(),
  { active: false },
)
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="hud-menu-button"
    :class="{ active }"
    :aria-label="`${label} (${shortcut})`"
    :aria-pressed="active ? 'true' : undefined"
    @click="$emit('click')"
  >
    <span class="icon"><AppIcon :name="icon" :size="20" /></span>
    <span class="name" aria-hidden="true"
      >{{ label }}<span class="key">{{ shortcut }}</span></span
    >
  </button>
</template>

<style scoped>
.hud-menu-button {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 8px 0 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgb(200 206 220 / 40%);
  cursor: pointer;
  filter: grayscale(1) var(--icon-shadow-hud);
  transition:
    color var(--dur-fast),
    filter var(--dur-fast);
}

.icon {
  display: grid;
  place-items: center;
  width: 24px;
}

.name {
  color: var(--text-1);
  font-size: var(--text-sm);
  white-space: nowrap;
  text-shadow: var(--text-shadow-hud);
  opacity: 0;
  transition: opacity var(--dur-fast);
}

.key {
  margin-left: 8px;
  color: var(--text-4);
}

.hud-menu-button:hover,
.hud-menu-button:focus-visible {
  color: var(--text-strong);
  filter: var(--icon-shadow-hud);
}

.hud-menu-button:focus-visible {
  box-shadow: none;
  outline: 1px solid rgb(var(--primary-rgb) / 70%);
  outline-offset: 2px;
}

.hud-menu-button:hover .name,
.hud-menu-button:focus-visible .name {
  opacity: 1;
}

.active {
  color: var(--primary);
  filter: var(--icon-shadow-hud);
}
</style>
