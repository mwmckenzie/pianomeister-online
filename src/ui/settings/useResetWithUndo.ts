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
    toasts.showUndo(`${what} reset to defaults`, () => settings.restore(previous))
  }
}
