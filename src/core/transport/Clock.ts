/** Monotonic time source in seconds. The browser uses AudioContext.currentTime; tests use a fake. */
export interface Clock {
  now(): number
}
