/** A repeating callback that keeps firing in background tabs (unlike requestAnimationFrame). */
export interface Ticker {
  start(onTick: () => void): void
  stop(): void
}
