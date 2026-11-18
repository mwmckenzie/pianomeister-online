<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import type { IconName } from '../components/IconName'

/**
 * A toggle icon in the HUD's right column (loop, tempo, save bookmark): dim grey when off, in
 * its colour with a soft glow when on. No background. Attributes (aria-label, data-testid,
 * popover trigger wiring) go to the button. With a `hint`, hover or keyboard focus shows it and
 * the shortcut as plain text to its left, like the app menu's names (decision 60).
 */
withDefaults(
  defineProps<{
    readonly icon: IconName
    readonly on: boolean
    readonly tone?: 'primary' | 'secondary'
    readonly hint?: string
    readonly shortcut?: string
  }>(),
  { tone: 'primary', hint: undefined, shortcut: undefined },
)
</script>

<template>
  <button type="button" class="hud-toggle" :class="[tone, { on }]">
    <span v-if="hint" class="hint" aria-hidden="true"
      >{{ hint }}<span v-if="shortcut" class="key">{{ shortcut }}</span></span
    >
    <AppIcon :name="icon" :size="20" />
  </button>
</template>

<style scoped>
.hud-toggle {
  position: relative;
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

.hint {
  position: absolute;
  top: 50%;
  right: calc(100% + 6px);
  color: var(--text-1);
  font-size: var(--text-sm);
  white-space: nowrap;
  text-shadow: var(--text-shadow-hud);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur-fast);
  translate: 0 -50%;
}

.key {
  margin-left: 8px;
  color: var(--text-4);
}

.hud-toggle:hover .hint,
.hud-toggle:focus-visible .hint {
  opacity: 1;
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
