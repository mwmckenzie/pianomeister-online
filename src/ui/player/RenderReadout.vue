<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import type { RenderStatus } from './RenderStatus'

/** Internal resolution and frame time (decision 48), polled from the engine while shown. */
const props = defineProps<{ readonly renderStatus?: () => RenderStatus | null }>()

const text = ref('')
let poll = 0

function update(): void {
  const status = props.renderStatus?.() ?? null
  if (status === null) {
    text.value = ''
    return
  }
  const { info, frameMs } = status
  text.value =
    `${info.width} × ${info.height} px (pixel ratio ${info.pixelRatio.toFixed(2)}) · ` +
    `${frameMs.toFixed(2)} ms per frame (CPU)`
}

onMounted(() => {
  update()
  poll = window.setInterval(update, 500)
})
onBeforeUnmount(() => window.clearInterval(poll))
</script>

<template>
  <p class="readout" data-testid="render-readout" aria-live="off">{{ text }}</p>
</template>

<style scoped>
.readout {
  margin: var(--space-1) 0 var(--space-2);
  color: var(--text-3);
  font-size: var(--text-sm);
}
</style>
