export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

/** Checks what can be checked before reading the file. Returns the rejection reason, or null. */
export function validateUpload(file: {
  readonly name: string
  readonly size: number
}): string | null {
  if (!/\.midi?$/i.test(file.name)) return 'not a MIDI file (.mid or .midi)'
  if (file.size > MAX_UPLOAD_BYTES) return 'larger than 2 MB'
  if (file.size === 0) return 'empty file'
  return null
}
