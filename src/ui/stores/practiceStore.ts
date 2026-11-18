import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { Bookmark } from '@/core/practice/Bookmark'
import { clampRange } from '@/core/practice/clampRange'
import { diffFromBookmark, sameRange } from '@/core/practice/diffFromBookmark'
import { fullSongId } from '@/core/practice/fullSongId'
import type { HandAudio } from '@/core/practice/HandAudio'
import type { MetronomeMode } from '@/core/practice/MetronomeMode'
import type { PracticeConfig } from '@/core/practice/PracticeConfig'
import type { PracticeField } from '@/core/practice/PracticeField'
import { fullSongConfig } from '@/core/practice/practiceDefaults'
import type { LoopRange } from '@/core/transport/LoopRange'
import type { PreRollMode } from '@/core/transport/PreRollMode'

import { useBookmarkStore } from './bookmarkStore'
import { useSettingsStore } from './settingsStore'

/** A loaded bookmark's temporary changes: only the fields that were touched. */
interface Temporary {
  loop?: LoopRange | null
  tempoPercent?: number
  right?: HandAudio
  left?: HandAudio
  preRollBeats?: number
  preRollMode?: PreRollMode
  metronomeMode?: MetronomeMode
}

/** What's loaded, for putting it back (Undo of "Save as bookmark"). */
export interface PracticeSnapshot {
  readonly songId: string | null
  readonly bookmarkId: string | null
  readonly temporary: Temporary
  readonly fullLoop: LoopRange | null
  readonly fullTempo: number
}

/**
 * What the player is practising (brief decisions 68–69): the loaded song and bookmark (none =
 * Full song) and the setup the transport and audio apply.
 *
 * With a bookmark loaded, every player-side change (loop, tempo, pre-roll, hand modes) is
 * temporary: it never reaches the bookmark or the settings and is dropped when anything else
 * loads. The metronome mode is part of the setup too (decision 61). With Full song loaded, hand modes and pre-roll are the device-wide settings, and the
 * loop and tempo are session state.
 *
 * Every committed loop change — the loop turned on or set, a revert, a bookmark loaded — bumps
 * `loopJump`; the player then moves the playhead to the loop start (brief decision 8). Turning
 * the loop off doesn't.
 */
export const usePracticeStore = defineStore('practice', () => {
  const settings = useSettingsStore()
  const bookmarks = useBookmarkStore()

  const songId = ref<string | null>(null)
  const bookmarkId = ref<string | null>(null)
  /** The song's bar range, for clamping a bookmark saved before a meter override. */
  const bars = ref({ first: 1, last: 1 })
  const temporary = shallowRef<Temporary>({})
  /** Full song's session state. */
  const fullLoop = shallowRef<LoopRange | null>(null)
  const fullTempo = ref(100)
  /** Bumped by every committed loop change: the playhead goes to the loop start. */
  const loopJump = ref(0)

  /** The loaded bookmark as currently saved (edits in the manager show up here). */
  const bookmark = computed((): Bookmark | null =>
    bookmarkId.value === null ? null : (bookmarks.byId.get(bookmarkId.value) ?? null),
  )

  const entryId = computed(
    () => bookmark.value?.id ?? (songId.value === null ? null : fullSongId(songId.value)),
  )

  /** What the loaded entry saved: the bookmark's setup (clamped), or Full song's. */
  const saved = computed((): PracticeConfig => {
    const b = bookmark.value
    if (b === null) return fullSongConfig(settings.settings)
    return { ...b.config, loop: clampRange(b.config.loop, bars.value.first, bars.value.last) }
  })

  const current = computed((): PracticeConfig => {
    const b = bookmark.value
    if (b === null) {
      return {
        ...fullSongConfig(settings.settings),
        loop: fullLoop.value,
        tempoPercent: fullTempo.value,
      }
    }
    const t = temporary.value
    const base = saved.value
    return {
      loop: t.loop === undefined ? base.loop : t.loop,
      tempoPercent: t.tempoPercent ?? base.tempoPercent,
      handAudio: {
        right: t.right ?? base.handAudio.right,
        left: t.left ?? base.handAudio.left,
      },
      preRollBeats: t.preRollBeats ?? base.preRollBeats,
      preRollMode: t.preRollMode ?? base.preRollMode,
      metronomeMode: t.metronomeMode ?? base.metronomeMode,
    }
  })

  /** The loaded bookmark's temporary changes (empty for Full song). */
  const changed = computed((): readonly PracticeField[] =>
    bookmark.value === null ? [] : diffFromBookmark(saved.value, current.value),
  )

  /** Passes count only while the range is the saved one (brief decision 70). */
  const rangeMatchesSaved = computed(() => sameRange(current.value.loop, saved.value.loop))

  function isTemporary(field: PracticeField): boolean {
    return changed.value.includes(field)
  }

  /**
   * Loads a song with a bookmark or Full song (null). Temporary changes are dropped; Full song
   * starts with the whole song at 100%. A bookmark moves the playhead to its loop start, unless
   * `jump` is false (a bookmark just saved from what's playing).
   */
  function load(
    nextSongId: string,
    nextBookmarkId: string | null,
    range: { first: number; last: number },
    options: { readonly jump?: boolean } = {},
  ): void {
    songId.value = nextSongId
    bookmarkId.value = nextBookmarkId
    bars.value = range
    temporary.value = {}
    fullLoop.value = null
    fullTempo.value = 100
    if (nextBookmarkId !== null && options.jump !== false) loopJump.value++
  }

  function snapshot(): PracticeSnapshot {
    return {
      songId: songId.value,
      bookmarkId: bookmarkId.value,
      temporary: temporary.value,
      fullLoop: fullLoop.value,
      fullTempo: fullTempo.value,
    }
  }

  /** Puts back what a snapshot holds; the setup is the same, so nothing jumps. */
  function restore(saved: PracticeSnapshot): void {
    songId.value = saved.songId
    bookmarkId.value = saved.bookmarkId
    temporary.value = saved.temporary
    fullLoop.value = saved.fullLoop
    fullTempo.value = saved.fullTempo
  }

  /**
   * Set by an explicit "Load" elsewhere (library, bookmark manager): the player then loads
   * fresh even if it's the entry already loaded, so its temporary changes are dropped.
   */
  const freshLoadRequested = ref(false)

  function requestFreshLoad(): void {
    freshLoadRequested.value = true
  }

  /** Whether the next load must start fresh; asking clears the request. */
  function takeFreshLoad(): boolean {
    const fresh = freshLoadRequested.value
    freshLoadRequested.value = false
    return fresh
  }

  /** Nothing loaded (e.g. while switching profiles): the next load starts fresh. */
  function unload(): void {
    songId.value = null
    bookmarkId.value = null
    temporary.value = {}
  }

  function patch(change: Temporary): void {
    temporary.value = { ...temporary.value, ...change }
  }

  /** A committed loop change (not each step of a drag): on or changed jumps, off doesn't. */
  function setLoop(loop: LoopRange | null): void {
    if (bookmark.value === null) fullLoop.value = loop
    else patch({ loop })
    if (loop !== null) loopJump.value++
  }

  function setTempo(tempoPercent: number): void {
    if (bookmark.value === null) fullTempo.value = tempoPercent
    else patch({ tempoPercent })
  }

  function setHandAudio(hand: 'right' | 'left', mode: HandAudio): void {
    if (bookmark.value === null)
      settings.set(hand === 'right' ? 'audio.rightAudio' : 'audio.leftAudio', mode)
    else patch(hand === 'right' ? { right: mode } : { left: mode })
  }

  function setPreRollBeats(beats: number): void {
    if (bookmark.value === null) settings.set('practice.preRollBeats', beats)
    else patch({ preRollBeats: beats })
  }

  function setPreRollMode(mode: PreRollMode): void {
    if (bookmark.value === null) settings.set('practice.preRollMode', mode)
    else patch({ preRollMode: mode })
  }

  function setMetronomeMode(mode: MetronomeMode): void {
    if (bookmark.value === null) settings.set('audio.metronomeMode', mode)
    else patch({ metronomeMode: mode })
  }

  /** Drops one temporary change: back to the bookmark's saved value. */
  function revertField(field: PracticeField): void {
    const keys: Record<PracticeField, keyof Temporary> = {
      loop: 'loop',
      tempoPercent: 'tempoPercent',
      'handAudio.right': 'right',
      'handAudio.left': 'left',
      preRollBeats: 'preRollBeats',
      preRollMode: 'preRollMode',
      metronomeMode: 'metronomeMode',
    }
    const next = { ...temporary.value }
    delete next[keys[field]]
    temporary.value = next
    if (field === 'loop') loopJump.value++
  }

  /** "Revert to bookmark": drops every temporary change and goes to the bookmark's start. */
  function revert(): void {
    temporary.value = {}
    loopJump.value++
  }

  return {
    songId,
    bookmarkId,
    bars,
    loopJump,
    bookmark,
    entryId,
    saved,
    current,
    changed,
    rangeMatchesSaved,
    isTemporary,
    load,
    snapshot,
    restore,
    unload,
    requestFreshLoad,
    takeFreshLoad,
    setLoop,
    setTempo,
    setHandAudio,
    setPreRollBeats,
    setPreRollMode,
    setMetronomeMode,
    revertField,
    revert,
  }
})
