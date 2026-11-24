/** A channel's colour in the Review page's reference lane: 16 well-spread hues. */
export function channelColor(channel: number): string {
  return `hsl(${(210 + channel * 137.5) % 360} 60% 65%)`
}
