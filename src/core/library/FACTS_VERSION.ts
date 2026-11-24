/**
 * Version of the SongFacts shape. Bump it whenever SongFacts gains or changes a field: uploads
 * stored with an older (or no) version are recomputed in the background on the next library
 * load, and the bundled manifest must be regenerated (`npm run songs:manifest`).
 *
 * 1: tempo range (bpmMin/bpmMax), per-channel note stats, meter summary.
 * 2: notes come from the raw events (milestone 10.5): files with notes never released, or with a
 *    program change inside a note, count more notes.
 */
export const FACTS_VERSION = 2
