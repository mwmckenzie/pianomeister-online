import { onBeforeUnmount, watch } from 'vue'

/**
 * Listens to key presses on the whole window while `active` is true. Dialogs with lists (the
 * song picker, the settings window) use it so their keys work wherever focus is (brief decision
 * 91), including on the page body after a click on something that can't take focus.
 */
export function useWindowKeys(active: () => boolean, handler: (event: KeyboardEvent) => void) {
  const stop = () => window.removeEventListener('keydown', handler)
  watch(
    active,
    (on) => {
      stop()
      if (on) window.addEventListener('keydown', handler)
    },
    { immediate: true },
  )
  onBeforeUnmount(stop)
}
