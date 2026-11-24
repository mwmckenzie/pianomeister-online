import { ref } from 'vue'

import { applyColourSetMerge } from '@/core/color/mergeColourSets'
import { formatImportSummary } from '@/core/library/formatImportSummary'
import type { ImportReport } from '@/data/ImportReport'

import { useImportStore } from '../stores/importStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'

/**
 * Library export (download a .zip) and import (from a chosen file), shared by the Library page
 * and Settings → Library & data. `busy` covers both; failures land in `error`.
 */
export function useLibraryBackup() {
  const store = useLibraryStore()
  const imports = useImportStore()
  const toasts = useToastStore()
  const settings = useSettingsStore()
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
      const bytes = await store.exportArchive(settings.noteColourSets)
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/zip' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `pianomeister-library-${new Date().toISOString().slice(0, 10)}.zip`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    })
  }

  /**
   * Imports a backup; colliding profiles are asked about first (brief decision 75). Null when
   * the import failed or was cancelled (then nothing was written).
   */
  function importFile(file: File): Promise<ImportReport | null> {
    return run(async () => {
      const report = await imports.run(new Uint8Array(await file.arrayBuffer()))
      if (report === null) return report
      // Saved looks from the backup were written to the database: show them in the picker.
      if (report.looksAdded > 0) await settings.reloadLooks()
      const { colourSets } = report
      if (colourSets.added.length > 0 || Object.keys(colourSets.overrides).length > 0) {
        settings.setColourSets(applyColourSetMerge(settings.noteColourSets, colourSets))
      }
      const parts = [
        formatImportSummary(report.profiles),
        report.looksAdded === 0
          ? ''
          : `added ${report.looksAdded} ${report.looksAdded === 1 ? 'look' : 'looks'}`,
        colourSets.added.length === 0
          ? ''
          : `added ${colourSets.added.length} colour ${colourSets.added.length === 1 ? 'set' : 'sets'}`,
      ].filter((part) => part !== '')
      if (parts.length > 0) toasts.show(`Imported: ${parts.join('; ')}.`)
      return report
    })
  }

  return { busy, error, run, exportLibrary, importFile }
}
