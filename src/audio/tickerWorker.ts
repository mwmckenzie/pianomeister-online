// Runs in a dedicated worker: worker timers keep firing at full rate in background tabs,
// where main-thread timers are throttled and requestAnimationFrame stops entirely.
let timer: ReturnType<typeof setInterval> | undefined

onmessage = (event: MessageEvent<{ readonly intervalMs: number }>) => {
  clearInterval(timer)
  timer = setInterval(() => postMessage('tick'), event.data.intervalMs)
}
