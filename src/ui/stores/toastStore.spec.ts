import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToastStore } from './toastStore'

beforeEach(() => setActivePinia(createPinia()))

describe('toast store', () => {
  it('replaces a visible Undo toast with the new one; Undo restores only the latest reset', () => {
    const toasts = useToastStore()
    const first = vi.fn<() => void>()
    const second = vi.fn<() => void>()
    toasts.show('Saved')
    toasts.showUndo('Camera reset', first)
    toasts.showUndo('Keyboard reset', second)
    expect(toasts.toasts.map((t) => t.message)).toEqual(['Saved', 'Keyboard reset'])
    toasts.toasts.find((t) => t.kind === 'undo')?.undo?.()
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    expect(toasts.toasts.map((t) => t.message)).toEqual(['Saved'])
  })

  it('runs an Undo at most once', () => {
    const toasts = useToastStore()
    const undo = vi.fn<() => void>()
    toasts.showUndo('Audio reset', undo)
    const action = toasts.toasts[0]?.undo
    action?.()
    action?.()
    expect(undo).toHaveBeenCalledOnce()
  })

  it('keeps Undo toasts for 6 seconds', () => {
    const toasts = useToastStore()
    toasts.showUndo('Notes reset', () => undefined)
    expect(toasts.toasts[0]?.duration).toBe(6000)
  })
})
