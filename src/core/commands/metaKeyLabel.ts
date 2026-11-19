/**
 * How the Meta key is written on a platform (brief decision 87): ⌘ on macOS and iPadOS/iOS,
 * "Win" on Windows, "Meta" elsewhere. `platform` is what the browser reports
 * (`navigator.userAgentData.platform`, else `navigator.platform`).
 */
export function metaKeyLabel(platform: string): string {
  if (/mac|iphone|ipad|ipod|ios/i.test(platform)) return '⌘'
  if (/^win/i.test(platform)) return 'Win'
  return 'Meta'
}
