<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { onBeforeUnmount, ref, watchEffect } from 'vue'
import { RouterView } from 'vue-router'

import ToastHost from './components/ToastHost.vue'
import { useSettingsStore } from './stores/settingsStore'
import { applyTheme } from './theme/applyTheme'

const settings = useSettingsStore()

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
  </TooltipProvider>
</template>
