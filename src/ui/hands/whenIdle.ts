/** Resolves when the browser is idle (Safari has no requestIdleCallback: at its next turn). */
export function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof globalThis.requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve())
    } else {
      setTimeout(resolve, 0)
    }
  })
}
