const SAMPLES = 120

interface TimerExtension {
  readonly TIME_ELAPSED_EXT: number
  readonly GPU_DISJOINT_EXT: number
}

/**
 * GPU time per frame from EXT_disjoint_timer_query_webgl2, where the browser offers it (perf
 * runs and the render readout, brief decision 48). Results arrive a few frames late, so
 * queries are polled; a disjoint event (GPU reset, power state) drops pending ones.
 */
export class GpuTimer {
  private readonly ext: TimerExtension | null
  private readonly pending: WebGLQuery[] = []
  private readonly samples: number[] = []
  private active: WebGLQuery | null = null

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null
  }

  get available(): boolean {
    return this.ext !== null
  }

  begin(): void {
    if (this.ext === null || this.active !== null || this.pending.length > 8) return
    const query = this.gl.createQuery()
    if (query === null) return
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query)
    this.active = query
  }

  end(): void {
    if (this.ext === null || this.active === null) return
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
    this.pending.push(this.active)
    this.active = null
    this.poll()
  }

  /** Mean GPU milliseconds per frame over the last samples, or null when unmeasured. */
  averageMs(): number | null {
    if (this.samples.length === 0) return null
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length
  }

  dispose(): void {
    for (const query of this.pending) this.gl.deleteQuery(query)
    this.pending.length = 0
  }

  private poll(): void {
    const ext = this.ext
    if (ext === null) return
    if (this.gl.getParameter(ext.GPU_DISJOINT_EXT)) {
      for (const query of this.pending) this.gl.deleteQuery(query)
      this.pending.length = 0
      return
    }
    while (this.pending.length > 0) {
      const query = this.pending[0] as WebGLQuery
      if (!this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE)) break
      const ns = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) as number
      this.gl.deleteQuery(query)
      this.pending.shift()
      this.samples.push(ns / 1e6)
      if (this.samples.length > SAMPLES) this.samples.shift()
    }
  }
}
