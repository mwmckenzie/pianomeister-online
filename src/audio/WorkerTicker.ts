import type { Ticker } from './Ticker'

/** Ticks from a Web Worker so scheduling survives background tabs; falls back to setInterval. */
export class WorkerTicker implements Ticker {
  private worker: Worker | null = null
  private timer: ReturnType<typeof setInterval> | undefined

  constructor(private readonly intervalMs = 25) {}

  start(onTick: () => void): void {
    this.stop()
    try {
      this.worker = new Worker(new URL('./tickerWorker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = () => onTick()
      this.worker.postMessage({ intervalMs: this.intervalMs })
    } catch {
      this.worker = null
      this.timer = setInterval(onTick, this.intervalMs)
    }
  }

  stop(): void {
    this.worker?.terminate()
    this.worker = null
    clearInterval(this.timer)
    this.timer = undefined
  }
}
