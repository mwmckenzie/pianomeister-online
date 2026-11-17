import { defineStore } from 'pinia'
import { ref } from 'vue'

/** How long an Undo toast stays (brief decision 51). */
export const UNDO_MS = 6000
const MESSAGE_MS = 5000

export interface ToastItem {
  readonly id: number
  readonly message: string
  readonly kind: 'info' | 'error' | 'undo'
  readonly duration: number
  /** Runs Undo; present on undo toasts only. */
  readonly undo?: () => void
}

/**
 * Toast queue. Only one Undo is on offer at a time: a new reset replaces a visible Undo toast,
 * so Undo always restores the most recent reset and never an older one.
 */
export const useToastStore = defineStore('toasts', () => {
  const toasts = ref<ToastItem[]>([])
  let nextId = 1

  function show(message: string, kind: 'info' | 'error' = 'info'): number {
    const id = nextId++
    toasts.value = [...toasts.value, { id, message, kind, duration: MESSAGE_MS }]
    return id
  }

  function showUndo(message: string, undo: () => void): number {
    const id = nextId++
    let done = false
    const once = () => {
      if (done) return
      done = true
      undo()
      dismiss(id)
    }
    toasts.value = [
      ...toasts.value.filter((t) => t.kind !== 'undo'),
      { id, message, kind: 'undo', duration: UNDO_MS, undo: once },
    ]
    return id
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, show, showUndo, dismiss }
})
