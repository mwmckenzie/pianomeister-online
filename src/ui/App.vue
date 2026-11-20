<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { defineAsyncComponent, onBeforeUnmount, ref, watchEffect } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { commandForEvent } from '@/core/commands/shortcutBindings'

import ToastHost from './components/ToastHost.vue'
import { isTypingTarget } from './input/isTypingTarget'
import { keyCapture } from './input/keyCapture'
import { useImportStore } from './stores/importStore'
import { useSettingsStore } from './stores/settingsStore'
import { useUiStateStore } from './stores/uiStateStore'
import { applyTheme } from './theme/applyTheme'

const settings = useSettingsStore()
const imports = useImportStore()
// Only needed when a backup's profile collides with a local one.
const ProfileCollisionDialog = defineAsyncComponent(
  () => import('./library/ProfileCollisionDialog.vue'),
)
const ShortcutsSheet = defineAsyncComponent(() => import('./shortcuts/ShortcutsSheet.vue'))
const ui = useUiStateStore()
const route = useRoute()
const router = useRouter()

/**
 * Pages where the Everywhere keys work (decisions 86, 89): Show shortcuts, Home and Stats — not
 * while typing, recording a key, or with a dialog open.
 */
const APP_PAGES = new Set(['player', 'welcome', 'library', 'bookmarks', 'stats'])

function onKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || keyCapture.value || ui.shortcutsOpen) return
  if (!APP_PAGES.has(String(route.name)) || isTypingTarget(event.target)) return
  if (document.querySelector('[role="dialog"][data-state="open"]') !== null) return
  const command = commandForEvent(settings.bindings, 'app', event)
  if (command === 'showShortcuts') ui.shortcutsOpen = true
  else if (command === 'goHome') {
    if (route.name !== 'welcome') void router.push({ name: 'welcome' })
  } else if (command === 'openStats') {
    if (route.name !== 'stats') void router.push({ name: 'stats' })
  } else return
  event.preventDefault()
}

window.addEventListener('keydown', onKeyDown)
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))

// "Follow system" motion tracks prefers-reduced-motion live (decision 54).
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
const systemReduced = ref(reducedQuery.matches)
const onReducedChange = (event: MediaQueryListEvent) => (systemReduced.value = event.matches)
reducedQuery.addEventListener('change', onReducedChange)
onBeforeUnmount(() => reducedQuery.removeEventListener('change', onReducedChange))

watchEffect(() => applyTheme(settings.settings.appearance, systemReduced.value))
</script>

<template>
  <TooltipProvider :delay-duration="500" :skip-delay-duration="200">
    <RouterView />
    <ToastHost />
    <ProfileCollisionDialog v-if="imports.pending" />
    <ShortcutsSheet v-if="ui.shortcutsOpen" />
  </TooltipProvider>
</template>
