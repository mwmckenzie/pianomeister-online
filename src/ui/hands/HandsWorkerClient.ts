import type { CachedHands } from '@/core/hands/CachedHands'
import type { DetectedHands } from '@/core/hands/DetectedHands'
import type { HandSettings } from '@/core/hands/HandSettings'

import type { HandsReply, HandsRequest } from './HandsWorkerMessage'

interface Waiting {
  readonly request: HandsRequest
  readonly resolve: (result: DetectedHands | CachedHands) => void
  readonly reject: (error: Error) => void
}

/** Runs hand detection and splits in a worker, started on first use; without one, here. */
export class HandsWorkerClient {
  private worker: Worker | null = null
  private failed = false
  private nextId = 1
  private readonly waiting = new Map<number, Waiting>()

  detect(bytes: Uint8Array, algorithm: string): Promise<DetectedHands> {
    return this.ask({ kind: 'detect', bytes, algorithm }) as Promise<DetectedHands>
  }

  resolve(bytes: Uint8Array, settings: HandSettings): Promise<CachedHands> {
    return this.ask({ kind: 'resolve', bytes, settings }) as Promise<CachedHands>
  }

  private ask(request: HandsRequest): Promise<DetectedHands | CachedHands> {
    return new Promise((resolve, reject) => {
      const job: Waiting = { request, resolve, reject }
      const worker = this.start()
      if (worker === null) {
        void this.runHere(job)
        return
      }
      const id = this.nextId++
      this.waiting.set(id, job)
      worker.postMessage({ id, ...request })
    })
  }

  private start(): Worker | null {
    if (this.worker !== null || this.failed) return this.worker
    try {
      const worker = new Worker(new URL('./handsWorker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<HandsReply>) => this.settle(event.data)
      // The worker itself couldn't load or run: do its work here instead.
      worker.onerror = () => this.giveUp()
      this.worker = worker
    } catch {
      this.failed = true
    }
    return this.worker
  }

  private settle(reply: HandsReply): void {
    const job = this.waiting.get(reply.id)
    this.waiting.delete(reply.id)
    if ('error' in reply) job?.reject(new Error(reply.error))
    else job?.resolve(reply.result)
  }

  private giveUp(): void {
    this.failed = true
    this.worker?.terminate()
    this.worker = null
    const jobs = [...this.waiting.values()]
    this.waiting.clear()
    for (const job of jobs) void this.runHere(job)
  }

  private async runHere({ request, resolve, reject }: Waiting): Promise<void> {
    try {
      const { answerHandsRequest } = await import('./answerHandsRequest')
      resolve(answerHandsRequest(request))
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  }
}
