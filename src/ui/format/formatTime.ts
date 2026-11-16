/** m:ss, with a leading minus for negative times (pre-roll). */
export function formatTime(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const whole = Math.floor(Math.abs(seconds))
  return `${sign}${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
