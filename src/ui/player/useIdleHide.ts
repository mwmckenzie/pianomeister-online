import { onBeforeUnmount, onMounted, readonly, ref, watch, type Ref } from 'vue'

const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const

/**
 * Hides the player's controls after `delayMs()` without pointer, keyboard or touch activity,
 * for as long as `canHide()` holds (playing, nothing open, pointer not over the controls); any
 * activity shows them again. A null delay never hides (decision 64).
 */
export function useIdleHide(
  delayMs: () => number | null,
  canHide: () => boolean,
): Readonly<Ref<boolean>> {
  const hidden = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  function schedule(): void {
    clearTimeout(timer)
    timer = undefined
    const delay = delayMs()
    if (delay === null || !canHide()) return
    timer = setTimeout(() => {
      if (canHide()) hidden.value = true
    }, delay)
  }

  function onActivity(): void {
    hidden.value = false
    schedule()
  }

  watch([delayMs, canHide], () => {
    if (delayMs() === null || !canHide()) hidden.value = false
    schedule()
  })

  onMounted(() => {
    for (const type of ACTIVITY) window.addEventListener(type, onActivity, { passive: true })
    schedule()
  })

  onBeforeUnmount(() => {
    for (const type of ACTIVITY) window.removeEventListener(type, onActivity)
    clearTimeout(timer)
  })

  return readonly(hidden)
}
