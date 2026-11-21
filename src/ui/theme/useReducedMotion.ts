import { computed, type ComputedRef, onBeforeUnmount, ref } from 'vue'

import { useSettingsStore } from '../stores/settingsStore'

/**
 * Reduced motion in effect (brief decision 54): the Motion setting, or the system preference
 * while it is "Follow system", tracked live.
 */
export function useReducedMotion(): ComputedRef<boolean> {
  const settings = useSettingsStore()
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  const system = ref(query.matches)
  const onChange = (event: MediaQueryListEvent) => (system.value = event.matches)
  query.addEventListener('change', onChange)
  onBeforeUnmount(() => query.removeEventListener('change', onChange))
  return computed(() => {
    const motion = settings.settings.appearance.motion
    return motion === 'reduced' || (motion === 'system' && system.value)
  })
}
