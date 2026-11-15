type Handler<T> = (payload: T) => void

/** Minimal typed pub/sub. `M` maps event names to payload types. */
export class EventBus<M extends object> {
  private readonly handlers = new Map<keyof M, Set<Handler<never>>>()

  /** Returns an unsubscribe function. */
  on<K extends keyof M>(type: K, handler: Handler<M[K]>): () => void {
    let set = this.handlers.get(type)
    if (set === undefined) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler as Handler<never>)
    return () => this.off(type, handler)
  }

  off<K extends keyof M>(type: K, handler: Handler<M[K]>): void {
    this.handlers.get(type)?.delete(handler as Handler<never>)
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const set = this.handlers.get(type)
    if (set === undefined) return
    // Snapshot so handlers can unsubscribe (or subscribe) mid-emit without skipping others.
    for (const handler of Array.from(set)) {
      ;(handler as Handler<M[K]>)(payload)
    }
  }
}
