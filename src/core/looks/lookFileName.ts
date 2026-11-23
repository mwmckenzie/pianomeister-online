/** Characters file systems refuse in a name (path separators and reserved ones). */
const UNSAFE = /[\\/:*?"<>|]/g

/**
 * A look's export file name: `<name>.pmlook.json`, with unsafe characters and control codes
 * replaced.
 */
export function lookFileName(name: string): string {
  const printable = [...name].map((c) => (c.charCodeAt(0) < 32 ? '-' : c)).join('')
  const safe = printable.replace(UNSAFE, '-').trim()
  return `${safe === '' ? 'look' : safe}.pmlook.json`
}
