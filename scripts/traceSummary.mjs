// Sums up a Chrome trace: where the page's main thread and the GPU process spent their time, and
// the functions that cost most. Reads what DevTools and bench:render save.

const KINDS = [
  ['garbage collection', /^(MinorGC|MajorGC|V8\.GC|BlinkGC|GCEvent|V8\.StackGuard)/],
  [
    'script',
    /^(FunctionCall|EvaluateScript|FireAnimationFrame|TimerFire|EventDispatch|RunMicrotasks|v8\.|V8\.|XHR|FireIdleCallback|HandlePostMessage|ProfileCall)/,
  ],
  [
    'style and layout',
    /^(UpdateLayoutTree|Layout|RecalculateStyles|InvalidateLayout|ParseAuthorStyleSheet|IntersectionObserver|HitTest)/,
  ],
  [
    'paint and compositing',
    /^(PrePaint|Paint|Layerize|Commit|UpdateLayer|CompositeLayers|RasterTask|Decode|ImageDecode)/,
  ],
]

const kindOf = (name) => KINDS.find(([, pattern]) => pattern.test(name))?.[0] ?? null

/** Self time by kind on one thread: nested events count for themselves, unnamed ones for their parent. */
function selfTimes(events) {
  const sorted = events
    .filter((e) => e.ph === 'X' && e.dur > 0)
    .sort((a, b) => a.ts - b.ts || b.dur - a.dur)
  const totals = {}
  const stack = []
  const add = (kind, us) => (totals[kind] = (totals[kind] ?? 0) + us)
  let busy = 0
  let busyUntil = -Infinity
  for (const e of sorted) {
    while (stack.length > 0 && stack.at(-1).end <= e.ts) stack.pop()
    const parent = stack.at(-1)
    const kind = kindOf(e.name) ?? parent?.kind ?? 'other'
    const end = parent === undefined ? e.ts + e.dur : Math.min(parent.end, e.ts + e.dur)
    const dur = end - e.ts
    add(kind, dur)
    if (parent !== undefined) add(parent.kind, -dur)
    stack.push({ end, kind })
    if (end > busyUntil) {
      busy += end - Math.max(e.ts, busyUntil)
      busyUntil = end
    }
  }
  return { totals, busy }
}

/** Self time per function from the CPU profile's samples. */
function functions(events, pid) {
  const self = new Map()
  const profiles = new Map()
  for (const e of events) {
    if (e.name !== 'ProfileChunk' || e.pid !== pid) continue
    const p = profiles.get(e.id) ?? { nodes: new Map() }
    profiles.set(e.id, p)
    const data = e.args?.data
    for (const n of data?.cpuProfile?.nodes ?? []) p.nodes.set(n.id, n.callFrame)
    const samples = data?.cpuProfile?.samples ?? []
    samples.forEach((id, i) => {
      const frame = p.nodes.get(id)
      if (frame === undefined) return
      const name = frame.functionName || '(anonymous)'
      if (['(idle)', '(root)', '(program)'].includes(name)) return
      const file = (frame.url ?? '').split('/').pop().split('?')[0]
      const key = file === '' ? name : `${name} (${file}:${frame.lineNumber})`
      self.set(key, (self.get(key) ?? 0) + Math.max(0, data.timeDeltas?.[i] ?? 0))
    })
  }
  return [...self].sort((a, b) => b[1] - a[1])
}

export function traceSummary(trace) {
  const events = Array.isArray(trace) ? trace : trace.traceEvents
  const names = new Map()
  for (const e of events) {
    if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name)
  }
  const threads = new Map()
  for (const e of events) {
    const key = e.pid + ':' + e.tid
    if (!threads.has(key)) threads.set(key, [])
    threads.get(key).push(e)
  }
  const complete = events.filter((e) => e.ph === 'X' && e.ts > 0)
  let from = Infinity
  let to = 0
  for (const e of complete) {
    from = Math.min(from, e.ts)
    to = Math.max(to, e.ts + e.dur)
  }
  const span = Math.max(1, to - from)
  const line = (label, us) =>
    `${label.padEnd(26)} ${(us / 1000).toFixed(0).padStart(7)} ms  ${((us / span) * 100).toFixed(1).padStart(5)} %`
  const rows = [...threads]
    .map(([key, list]) => ({ key, name: names.get(key) ?? key, ...selfTimes(list) }))
    .sort((a, b) => b.busy - a.busy)
  const main = rows.find((r) => r.name === 'CrRendererMain')
  const out = [`${(span / 1e6).toFixed(1)} s traced`, '', 'Busiest threads (wall time in tasks):']
  for (const r of rows.slice(0, 8)) out.push(line(r.name, r.busy))
  if (main !== undefined) {
    out.push('', 'Main thread by kind (self time):')
    for (const [kind, us] of Object.entries(main.totals).sort((a, b) => b[1] - a[1])) {
      out.push(line(kind, us))
    }
    const top = functions(events, Number(main.key.split(':')[0]))
    if (top.length > 0) {
      out.push('', 'Functions by self time (sampled):')
      for (const [name, us] of top.slice(0, 25)) out.push(line('', us).trim() + `  ${name}`)
    }
  }
  return out.join('\n')
}
