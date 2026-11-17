<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '../components/AppButton.vue'
import { formatStorage } from '../format/formatStorage'
import { summariseImport } from '../format/summariseUploads'
import { useLibraryBackup } from '../library/useLibraryBackup'
import { useLibraryStore } from '../stores/libraryStore'

/** Storage status and library backup; the library itself is a page of its own. */
const router = useRouter()
const store = useLibraryStore()
const backup = useLibraryBackup()
const importInput = useTemplateRef<HTMLInputElement>('importInput')
const message = ref('')

const storageLine = computed(() => formatStorage(store.storage))

async function onImportChosen(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file === undefined) return
  const report = await backup.importFile(file)
  message.value = report === null ? '' : summariseImport(report)
}

onMounted(() => void store.refreshStorage())
</script>

<template>
  <section class="block" aria-label="Library">
    <h3 class="section-caps">Library</h3>
    <p class="text">
      Bundled songs and your uploads, with titles, tags, hand channels and meter overrides.
    </p>
    <AppButton data-testid="settings-open-library" @click="router.push({ name: 'library' })">
      Open library
    </AppButton>
  </section>
  <section class="block" aria-label="Backup">
    <h3 class="section-caps">Backup</h3>
    <p class="text">
      Export saves your uploads and song edits in one .zip; import adds them on this or another
      device.
    </p>
    <div class="row">
      <AppButton :disabled="backup.busy.value" @click="backup.exportLibrary()">Export</AppButton>
      <AppButton :disabled="backup.busy.value" @click="importInput?.click()">Import</AppButton>
      <input
        ref="importInput"
        type="file"
        accept=".zip,application/zip"
        hidden
        @change="onImportChosen"
      />
    </div>
    <p v-if="message" class="text" role="status">{{ message }}</p>
    <p v-if="backup.error.value" class="error" role="alert">{{ backup.error.value }}</p>
  </section>
  <section class="block" aria-label="Storage">
    <h3 class="section-caps">Storage</h3>
    <p class="text" data-testid="settings-storage">{{ storageLine }}</p>
  </section>
</template>

<style scoped>
.block {
  padding: var(--space-2) 0 var(--space-6);
}

.text {
  margin: var(--space-2) 0 var(--space-3);
  color: var(--text-2);
}

.row {
  display: flex;
  gap: var(--space-2);
}

.error {
  color: var(--danger);
}
</style>
