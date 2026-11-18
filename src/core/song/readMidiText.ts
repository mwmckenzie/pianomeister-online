import type { MidiText } from './MidiText'
import { scanChannelEvents } from './scanChannelEvents'

const TEXT = 0x01
const COPYRIGHT = 0x02
const TRACK_NAME = 0x03

const utf8 = new TextDecoder('utf-8', { fatal: true })

/** MIDI text has no declared encoding: UTF-8 when it decodes as such, else Latin-1 ("©"). */
function decode(data: Uint8Array): string {
  let text: string
  try {
    text = utf8.decode(data)
  } catch {
    text = String.fromCharCode(...data)
  }
  // Some writers pad with NULs or line breaks: control characters become spaces.
  return Array.from(text, (c) => (c.charCodeAt(0) < 0x20 ? ' ' : c))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Reads a Standard MIDI File's name, text and copyright meta events (@tonejs/midi drops copyright). */
export function readMidiText(bytes: Uint8Array): MidiText {
  let sequenceName: string | null = null
  const texts: string[] = []
  const copyrights: string[] = []
  scanChannelEvents(
    bytes,
    () => undefined,
    (track, type, data) => {
      const text = decode(data)
      if (text === '') return
      if (type === TRACK_NAME && track === 0) sequenceName ??= text
      else if (type === TEXT) texts.push(text)
      else if (type === COPYRIGHT) copyrights.push(text)
    },
  )
  return { sequenceName: sequenceName ?? '', texts, copyrights }
}
