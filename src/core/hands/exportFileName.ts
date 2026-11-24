/** "Title (hands).mid", without characters file systems refuse. */
export function exportFileName(title: string): string {
  const safe = Array.from(title, (c) =>
    c.charCodeAt(0) < 0x20 || '\\/:*?"<>|'.includes(c) ? '-' : c,
  )
    .join('')
    .trim()
  return `${safe === '' ? 'Song' : safe} (hands).mid`
}
