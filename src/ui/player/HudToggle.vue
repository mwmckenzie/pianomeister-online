<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import type { IconName } from '../components/IconName'

/**
 * A toggle icon in the HUD's right column (loop, tempo): dim grey when off, in its colour with
 * a soft glow when on. No background. Attributes (aria-label, data-testid, popover trigger
 * wiring) go to the button.
 */
withDefaults(
  defineProps<{
    readonly icon: IconName
    readonly on: boolean
    readonly tone?: 'primary' | 'secondary'
  }>(),
  { tone: 'primary' },
)
</script>

<template>
  <button type="button" class="hud-toggle" :class="[tone, { on }]">
    <AppIcon :name="icon" :size="20" />
  </button>
</template>

<style scoped>
.hud-toggle {
  display: grid;
  place-items: center;
  width: 28px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgb(200 206 220 / 40%);
  cursor: pointer;
  filter: var(--icon-shadow-hud);
  transition: color var(--dur-fast);
}

.hud-toggle:hover {
  color: var(--text-strong);
}

.hud-toggle:focus-visible {
  box-shadow: none;
  outline: 1px solid rgb(var(--primary-rgb) / 70%);
}

.on.primary {
  color: var(--primary);
  filter: drop-shadow(0 0 6px rgb(var(--primary-rgb) / 55%));
}

.on.secondary {
  color: var(--secondary);
  filter: drop-shadow(0 0 6px rgb(var(--secondary-rgb) / 55%));
}
</style>
