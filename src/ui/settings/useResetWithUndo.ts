import type { SettingGroup } from '@/core/settings/SettingGroup'

import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'

/**
 * Section, tab and sidebar resets: apply at once, then offer Undo in a toast for 6 seconds
 * (decision 51). Nothing changed means nothing to reset, and no toast.
 */
export function useResetWithUndo(): (group: SettingGroup, what: string) => void {
  const settings = useSettingsStore()
  const toasts = useToastStore()
  return (group, what) => {
    if (settings.changedCount(group) === 0) return
    const previous = settings.resetGroup(group)
    // Appearance and its Note colours also put the built-in colour sets back; own sets stay.
    const { overrides } = settings.noteColourSets
    const sets = settings.resetsColourSets(group)
    if (sets) settings.setColourSets({ ...settings.noteColourSets, overrides: {} })
    toasts.showUndo(`${what} reset to defaults`, () => {
      settings.restore(previous)
      if (sets) settings.setColourSets({ ...settings.noteColourSets, overrides })
    })
  }
}
