import { ref } from 'vue'

import type { ImportReport } from '@/data/ImportReport'

import { useLibraryStore } from '../stores/libraryStore'

/**
 * Library export (download a .zip) and import (from a chosen file), shared by the Library page
 * and Settings → Library & data. `busy` covers both; failures land in `error`.
 */
export function useLibraryBackup() {
  const store = useLibraryStore()
  const busy = ref(false)
  const error = ref('')

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    busy.value = true
    error.value = ''
    try {
      return await action()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      console.error('[library]', e)
      return null
    } finally {
      busy.value = false
    }
  }

  function exportLibrary(): Promise<void | null> {
    return run(async () => {
      const bytes = await store.exportArchive()
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/zip' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `pianomeister-library-${new Date().toISOString().slice(0, 10)}.zip`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    })
  }

  function importFile(file: File): Promise<ImportReport | null> {
    return run(async () => store.importArchive(new Uint8Array(await file.arrayBuffer())))
  }

  return { busy, error, run, exportLibrary, importFile }
}
