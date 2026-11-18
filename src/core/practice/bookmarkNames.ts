import type { LoopRange } from '../transport/LoopRange'
import type { Bookmark } from './Bookmark'
import type { MetronomeMode } from './MetronomeMode'
import { bookmarkSummary } from './bookmarkSummary'
import type { PracticeConfig } from './PracticeConfig'

/** "Bars 17–32", or "Bar 5" for a one-bar range. */
export function rangeLabel(range: LoopRange): string {
  return range.startBar === range.endBar
    ? `Bar ${range.startBar}`
    : `Bars ${range.startBar}–${range.endBar}`
}

/**
 * A bookmark's automatic name (brief decision 69): its full summary, every part named, e.g.
 * "Bars 1–4 · 100% · both hands · pre-roll 2".
 */
export function autoBookmarkName(config: PracticeConfig & { readonly loop: LoopRange }): string {
  return bookmarkSummary(config, config.loop.endBar, { allParts: true })
}

/** The name milestone 7's first builds gave a bookmark saved from a loop: "Bars 17–32". */
export function isLegacyAutoName(name: string): boolean {
  return /^Bars? \d+([–-]\d+)?$/.test(name.trim())
}

/** A bookmark as stored or imported before `autoName` and the metronome mode existed. */
type OlderBookmark = Omit<Bookmark, 'autoName' | 'config'> & {
  readonly autoName?: boolean
  readonly config: Omit<Bookmark['config'], 'metronomeMode'> & {
    readonly metronomeMode?: MetronomeMode
  }
}

/**
 * A stored or imported bookmark brought up to date: no metronome mode means off; one saved
 * before names could follow the settings is auto-named when its name is the old range label;
 * an auto-named one gets the name its settings give now.
 */
export function settleBookmark(bookmark: OlderBookmark): Bookmark {
  const config = { ...bookmark.config, metronomeMode: bookmark.config.metronomeMode ?? 'off' }
  const autoName = bookmark.autoName ?? isLegacyAutoName(bookmark.name)
  return {
    ...bookmark,
    config,
    autoName,
    name: autoName ? autoBookmarkName(config) : bookmark.name,
  }
}
