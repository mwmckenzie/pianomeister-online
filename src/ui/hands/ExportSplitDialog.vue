<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'

import type { HandExportOptions } from '@/core/hands/applyHandAssignment'
import { exportFileName } from '@/core/hands/exportFileName'
import { exportWarnings } from '@/core/hands/exportWarnings'
import type { HandDetails } from '@/data/HandDetails'

import AppButton from '../components/AppButton.vue'
import AppDialog from '../components/AppDialog.vue'
import SegmentedControl from '../components/SegmentedControl.vue'
import SelectField from '../components/SelectField.vue'
import { useLibraryStore } from '../stores/libraryStore'

/** Export with hands split: a copy of the song's MIDI file, each hand on its own channel. */
const props = defineProps<{ readonly songId: string }>()
const open = defineModel<boolean>('open', { required: true })
const store = useLibraryStore()

const LAYOUTS = [
  { value: 'inPlace', label: 'Same tracks' },
  { value: 'twoTracks', label: 'Two tracks' },
] as const
const CHANNELS = Array.from({ length: 16 }, (_, i) => ({ value: String(i), label: String(i) }))

const layout = ref<HandExportOptions['layout']>('inPlace')
const right = ref('0')
const left = ref('1')
const details = shallowRef<HandDetails | null>(null)
const busy = ref(false)
const error = ref('')

const title = computed(() => store.entries.find((e) => e.songId === props.songId)?.title ?? '')
const options = computed((): HandExportOptions => ({
  layout: layout.value,
  rightChannel: Number(right.value),
  leftChannel: Number(left.value),
}))
const warnings = computed(() =>
  details.value === null
    ? []
    : exportWarnings(details.value.voices, details.value.settings.roles, options.value),
)
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

watch(
  open,
  async (isOpen) => {
    if (!isOpen) return
    error.value = ''
    details.value = null
    try {
      details.value = await store.handDetails(props.songId)
    } catch (e) {
      error.value = message(e)
    }
  },
  { immediate: true },
)

async function exportFile(): Promise<void> {
  busy.value = true
  error.value = ''
  try {
    const bytes = await store.exportHands(props.songId, options.value)
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'audio/midi' }))
    const link = document.createElement('a')
    link.href = url
    link.download = exportFileName(title.value)
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    open.value = false
  } catch (e) {
    error.value = `Couldn't export: ${message(e)}`
    console.error("[hands] Couldn't export:", e)
  }
  busy.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    title="Export with hands split"
    :description="`A copy of ${title} with each hand on its own channel`"
    show-title
    width="460px"
    data-testid="export-split-dialog"
  >
    <div class="fields">
      <div class="field">
        <span>Layout</span>
        <SegmentedControl
          v-model="layout"
          :options="LAYOUTS"
          label="Layout"
          data-testid="export-layout"
        />
      </div>
      <p class="note">
        {{
          layout === 'inPlace'
            ? 'Notes stay in their tracks.'
            : 'The hands move to new tracks, “Right Hand” and “Left Hand”.'
        }}
      </p>
      <div class="field">
        <span>Right channel</span>
        <SelectField
          v-model="right"
          class="compact"
          :options="CHANNELS"
          label="Right channel"
          data-testid="export-right"
        />
      </div>
      <div class="field">
        <span>Left channel</span>
        <SelectField
          v-model="left"
          class="compact"
          :options="CHANNELS"
          label="Left channel"
          data-testid="export-left"
        />
      </div>
      <p v-for="w in warnings" :key="w" class="warning" data-testid="export-warning">{{ w }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p class="note">The stored song isn't changed.</p>
    </div>
    <template #footer>
      <AppButton @click="open = false">Cancel</AppButton>
      <AppButton
        variant="primary"
        :disabled="busy || !details"
        data-testid="export-split-confirm"
        @click="exportFile"
      >
        Export
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--text-2);
}

.note,
.warning,
.error {
  margin: 0;
  font-size: var(--text-sm);
}

.note {
  color: var(--text-3);
}

.warning {
  color: var(--warning);
}

.error {
  color: var(--danger);
}
</style>
