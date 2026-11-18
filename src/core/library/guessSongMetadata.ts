import type { MidiText } from '../song/MidiText'
import { KNOWN_COMPOSERS } from './KNOWN_COMPOSERS'
import type { SongMetaFields } from './SongMetaFields'

/** Lower case without accents, so "Dvořák" matches "dvorak". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function words(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== '')
}

/** Track names that name an instrument or a tool, not the piece. */
const GENERIC =
  /^(?:track|piano|grand piano|acoustic grand piano|acoustic grand|acoustic piano|untitled|sequence|seq|midi|song|instrument|staff|unnamed|new song|melody|right hand|left hand|rh|lh|tempo track|conductor|tempo)?\s*\d*$/

function isGeneric(name: string): boolean {
  const folded = fold(name)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return GENERIC.test(folded)
}

const CATALOGUE_SPELLING: Record<string, string> = {
  bwv: 'BWV',
  hwv: 'HWV',
  kv: 'KV',
  hob: 'Hob.',
  woo: 'WoO',
}

/** "bwv 779" → "BWV 779", "No.8" → "No. 8", "op10" → "Op. 10"; one space between words. */
function tidy(text: string): string {
  return text
    .replace(
      /\b(bwv|hwv|kv|hob|woo)\.?\s*(\d+)/gi,
      (_, cat: string, n: string) => `${CATALOGUE_SPELLING[cat.toLowerCase()] ?? cat} ${n}`,
    )
    .replace(/\bop(?:us)?\.?\s*(\d+)/gi, 'Op. $1')
    .replace(/\b(?:no|nr)\.?\s*(\d+)/gi, 'No. $1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The file name as a title: no extension, separators as spaces, no "TwoHands" or "(c)name". */
function titleFromFileName(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '')
  return tidy(
    stem
      .replace(/\(c\).*$/i, '')
      .replace(/©.*$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b(?:two|four|both)\s?hands?\b/gi, ' '),
  )
}

interface ComposerMatch {
  readonly composer: string
  /** The word that named the composer (dropped from the title); null for a catalogue prefix. */
  readonly word: string | null
}

/**
 * Finds a composer named in the texts: first one already in the library (by surname, so its
 * spelling is kept), then a well-known one by name or catalogue prefix ("BWV" → Bach).
 */
function findComposer(
  texts: readonly string[],
  libraryComposers: readonly string[],
): ComposerMatch | null {
  const found = texts.flatMap(words)
  const bySurname = new Map<string, string>()
  for (const composer of libraryComposers) {
    // "Christian Petzold (attrib. J.S. Bach)" is Petzold's.
    const surname = words(composer.replace(/\(.*?\)/g, ' ')).slice(-1)[0]
    if (surname !== undefined && surname.length >= 3 && !bySurname.has(surname))
      bySurname.set(surname, composer)
  }
  for (const word of found) {
    const composer = bySurname.get(word)
    if (composer !== undefined) return { composer, word }
  }
  for (const word of found) {
    for (const known of KNOWN_COMPOSERS) {
      const named = known.names.some((n) => fold(n) === word)
      const catalogue = known.catalogues?.some((c) => new RegExp(`^${c}\\d*$`).test(word))
      if (!named && catalogue !== true) continue
      // The library's spelling of the same composer wins ("J.S. Bach" over "J. S. Bach").
      const ours = known.names.map((n) => bySurname.get(fold(n))).find((c) => c !== undefined)
      return { composer: ours ?? known.name, word: named ? word : null }
    }
  }
  return null
}

/** Who made the file rather than the music: "Sequenced by X" isn't a composer. */
const NOT_COMPOSER =
  /\b(?:sequenced|arranged|transcribed|edited|created|made|generated|recorded|converted|performed|played|encoded)\s+by\b/i

/** "Composer: X", "Composed by X", "Music by X" or "… by X" in a text event. */
function statedComposer(texts: readonly string[]): string | null {
  for (const text of texts) {
    if (NOT_COMPOSER.test(text)) continue
    const match =
      /^(?:composer|composed by|music by)\s*:?\s*(.+)$/i.exec(text) ?? /\bby\s+(.+)$/i.exec(text)
    const name = match?.[1]?.replace(/[.,;]+$/, '').trim()
    if (name !== undefined && name !== '') return name
  }
  return null
}

/** "Copyright © 1999 by Jane Doe. All rights reserved" → "Jane Doe". */
function copyrightHolder(copyrights: readonly string[]): string | null {
  for (const text of copyrights) {
    const name = text
      .replace(/all rights reserved\.?/i, '')
      .replace(/copyright|\(c\)|©/gi, ' ')
      .replace(/\b(?:1[89]|20)\d\d(?:\s*[-–]\s*\d{2,4})?\b/g, ' ')
      .replace(/^\W*by\b/i, ' ')
      .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '')
      .replace(/\s+/g, ' ')
    if (name !== '') return name
  }
  return null
}

/** Drops the composer's name from the start or end of a title ("Clair de Lune Debussy"). */
function withoutComposer(title: string, word: string | null): string {
  if (word === null) return title
  const parts = title.split(' ')
  const isName = (part: string | undefined) => part !== undefined && words(part).join(' ') === word
  const isSeparator = (part: string | undefined) => part !== undefined && /^[-–:,]$/.test(part)
  if (isName(parts[0])) {
    parts.shift()
    if (isSeparator(parts[0])) parts.shift()
  } else if (isName(parts[parts.length - 1])) {
    parts.pop()
    if (isSeparator(parts[parts.length - 1])) parts.pop()
  }
  const rest = parts.join(' ').replace(/^[-–:,\s]+|[-–:,\s]+$/g, '')
  return rest === '' ? title : rest
}

/**
 * A best guess at a MIDI file's title and composer (brief decision 79).
 *
 * Title: the sequence name unless it's generic ("Track 1", "Piano"), else the tidied file name.
 * Composer: a "Composer: X" / "by X" text event; else a composer named in the texts, sequence
 * name or file name (the library's composers first, then well-known ones); else the copyright
 * holder; else empty. Copyright comes after the name match because it often names whoever
 * sequenced the file, not the composer.
 */
export function guessSongMetadata(
  source: { readonly fileName: string; readonly text: MidiText },
  libraryComposers: readonly string[] = [],
): Pick<SongMetaFields, 'title' | 'composer'> {
  const { fileName, text } = source
  const sequenceName = isGeneric(text.sequenceName) ? '' : tidy(text.sequenceName)
  const title = sequenceName === '' ? titleFromFileName(fileName) : sequenceName

  const stated = statedComposer(text.texts)
  const match = findComposer(
    stated === null ? [...text.texts, text.sequenceName, fileName] : [stated],
    libraryComposers,
  )
  const composer = match?.composer ?? stated ?? copyrightHolder(text.copyrights) ?? ''
  const cleanTitle = withoutComposer(title, match?.word ?? null)
  return {
    title: cleanTitle === '' ? fileName.replace(/\.[^.]+$/, '') : cleanTitle,
    composer,
  }
}
