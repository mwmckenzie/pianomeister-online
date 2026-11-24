import type { LibraryEntry } from '../library/LibraryEntry'

/** A library entry for list-operation tests; override only what the test cares about. */
export function makeEntry(
  fields: Partial<LibraryEntry> & { readonly title: string },
): LibraryEntry {
  const facts = {
    durationSeconds: 60,
    durationTicks: 57600,
    ppq: 480,
    bars: 30,
    timeSignatures: ['4/4'],
    bpm: 120,
  }
  return {
    songId: fields.title,
    source: 'bundled',
    fileName: `${fields.title}.mid`,
    composer: '',
    tags: [],
    original: { title: fields.title, composer: '', tags: [] },
    edited: false,
    facts,
    override: null,
    bars: 30,
    timeSignature: '4/4',
    hands: { source: 'default', confidence: null, summary: null },
    addedAt: null,
    ...fields,
  }
}
