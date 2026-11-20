import { ref, watch, type Ref } from 'vue'

/**
 * An element's content box in CSS px, kept current (resize, the playfield panel, zoom). It
 * follows the element as it comes and goes (a `v-if` waiting for the song, say).
 */
export function useElementSize(
  element: Ref<HTMLElement | null>,
): Ref<{ readonly width: number; readonly height: number }> {
  const size = ref({ width: 0, height: 0 })
  const read = (el: HTMLElement) => {
    const width = el.clientWidth
    const height = el.clientHeight
    if (width !== size.value.width || height !== size.value.height) size.value = { width, height }
  }
  watch(
    element,
    (el, _, onCleanup) => {
      if (el === null) return
      read(el)
      const observer = new ResizeObserver(() => read(el))
      observer.observe(el)
      onCleanup(() => observer.disconnect())
    },
    { immediate: true, flush: 'post' },
  )
  return size
}
