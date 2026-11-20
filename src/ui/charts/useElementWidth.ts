import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/** An element's content width, kept current: charts lay out in real pixels, not a stretched viewBox. */
export function useElementWidth(element: Ref<HTMLElement | null>, fallback: number): Ref<number> {
  const width = ref(fallback)
  let observer: ResizeObserver | null = null
  onMounted(() => {
    const el = element.value
    if (el === null) return
    width.value = el.clientWidth || fallback
    observer = new ResizeObserver(() => (width.value = el.clientWidth || fallback))
    observer.observe(el)
  })
  onBeforeUnmount(() => observer?.disconnect())
  return width
}
