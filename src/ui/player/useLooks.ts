import { computed } from 'vue'

import type { Look } from '@/core/looks/Look'
import { activeLook, allLooks, applyLook, isLookModified } from '@/core/looks/lookValues'
import { readLookFile } from '@/core/looks/readLookFile'
import { toLookFile } from '@/core/looks/toLookFile'

import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'

const ERRORS = {
  notLookFile: "That isn't a PianoMeister look file",
  newer: 'That look file is from a newer version of PianoMeister',
  empty: 'That look file has no looks in it',
} as const

/**
 * Look actions shared by the Look picker and the playfield sidebar's drop zone (brief decision
 * 121): apply a look with Undo, import looks (file, paste, drop) and export them.
 */
export function useLooks() {
  const settings = useSettingsStore()
  const toasts = useToastStore()

  const active = computed(() => activeLook(settings.looks))
  const modified = computed(() =>
    active.value === null
      ? false
      : isLookModified(settings.settings, active.value, settings.deviceClass),
  )

  /** Applies a look (every playfield setting, never device cost), with Undo. */
  function apply(id: string): void {
    const look = allLooks(settings.looks).find((l) => l.id === id)
    if (look === undefined) return
    const before = settings.looks
    const { settings: next, previous } = applyLook(settings.settings, look, settings.deviceClass)
    settings.replace(next)
    settings.setLooks({ ...settings.looks, active: look.id })
    toasts.showUndo(`Look "${look.name}" applied`, () => {
      settings.restore(previous)
      settings.setLooks(before)
    })
  }

  /**
   * Adds the looks in a `.pmlook.json` text to My looks, never applying one; the toast offers
   * Apply when it was exactly one. Anything unreadable changes nothing and says why.
   */
  function importText(text: string): void {
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      toasts.show(ERRORS.notLookFile, 'error')
      return
    }
    const result = readLookFile(raw, settings.looks.saved, () => crypto.randomUUID())
    if (!result.ok) {
      toasts.show(ERRORS[result.error], 'error')
      return
    }
    settings.setLooks({ ...settings.looks, saved: [...settings.looks.saved, ...result.looks] })
    const [only] = result.looks
    if (result.looks.length === 1 && only !== undefined) {
      toasts.showActions(`Imported look "${only.name}"`, [
        { label: 'Apply', run: () => apply(only.id) },
      ])
    } else {
      toasts.show(`Imported ${result.looks.length} looks`)
    }
  }

  async function importFile(file: File): Promise<void> {
    importText(await file.text())
  }

  /** Downloads looks as one `.pmlook.json` file (device cost is never written). */
  function exportLooks(looks: readonly Look[], fileName: string): void {
    const text = JSON.stringify(toLookFile(looks, settings.noteColourSets), null, 2)
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return { active, modified, apply, importText, importFile, exportLooks }
}
