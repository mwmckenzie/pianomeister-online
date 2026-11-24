import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import type { NoteColourSetId } from '@/core/settings/NoteColourSetId'

const STORAGE_KEY = 'pianomeister.ui'

interface UiState {
  sidebarOpen: boolean
  /** The playfield sidebar's open section (one at a time), or none. */
  sidebarSection: string | null
  /** The overview strip under the timeline (brief decision 105). */
  overviewOpen: boolean
  /** The loop editor's hand visibility toggles (view only, brief decision 106). */
  editorHands: { right: boolean; left: boolean }
}

const DEFAULTS: UiState = {
  sidebarOpen: false,
  sidebarSection: null,
  overviewOpen: false,
  editorHands: { right: true, left: true },
}

function readHands(raw: unknown): UiState['editorHands'] {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULTS.editorHands }
  const r = raw as Partial<Record<'right' | 'left', unknown>>
  return {
    right: typeof r.right === 'boolean' ? r.right : true,
    left: typeof r.left === 'boolean' ? r.left : true,
  }
}

/** The open section; state stored before the one-open accordion kept a list: its first. */
function readSection(section: unknown, oldList: unknown): string | null {
  if (typeof section === 'string') return section
  if (section === null) return null
  if (Array.isArray(oldList)) return oldList.find((s): s is string => typeof s === 'string') ?? null
  return DEFAULTS.sidebarSection
}

function read(): UiState {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (typeof raw !== 'object' || raw === null) return { ...DEFAULTS }
    const r = raw as Partial<Record<keyof UiState | 'sidebarSections', unknown>>
    return {
      sidebarOpen: typeof r.sidebarOpen === 'boolean' ? r.sidebarOpen : DEFAULTS.sidebarOpen,
      sidebarSection: readSection(r.sidebarSection, r.sidebarSections),
      overviewOpen: typeof r.overviewOpen === 'boolean' ? r.overviewOpen : DEFAULTS.overviewOpen,
      editorHands: readHands(r.editorHands),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * UI state that should survive a reload but isn't a setting (no reset, decision 63): whether
 * the playfield sidebar is open and which of its sections is expanded, and whether the
 * overview strip is open, and which hands the loop editor shows.
 */
export const useUiStateStore = defineStore('uiState', () => {
  const initial = read()
  const sidebarOpen = ref(initial.sidebarOpen)
  const sidebarSection = ref<string | null>(initial.sidebarSection)
  const overviewOpen = ref(initial.overviewOpen)
  const editorHands = ref(initial.editorHands)

  watch(
    [sidebarOpen, sidebarSection, overviewOpen, editorHands],
    () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            sidebarOpen: sidebarOpen.value,
            sidebarSection: sidebarSection.value,
            overviewOpen: overviewOpen.value,
            editorHands: editorHands.value,
          }),
        )
      } catch {
        // Storage blocked: the state still applies for this session.
      }
    },
    { deep: true },
  )

  /** The keyboard shortcuts cheat sheet (decision 89); not kept across reloads. */
  const shortcutsOpen = ref(false)
  /** A settings tab to open when the player next can (e.g. "Change shortcuts…" elsewhere). */
  const settingsTabRequest = ref<string | null>(null)
  /** The colour set to edit when Settings opens on Appearance ("Edit colours…"). */
  const colourSetRequest = ref<NoteColourSetId | null>(null)
  /**
   * Unsaved work open now (a bookmark draft, …), by name: Home on a new session waits for the
   * next one instead of interrupting it (milestone 9.2 D).
   */
  const unsavedWork = ref<ReadonlySet<string>>(new Set())
  function setUnsaved(name: string, on: boolean): void {
    const next = new Set(unsavedWork.value)
    if (on) next.add(name)
    else next.delete(name)
    unsavedWork.value = next
  }
  /** Bumped to close plain menus, dialogs and the settings window (before Home opens). */
  const closeOverlays = ref(0)

  return {
    sidebarOpen,
    sidebarSection,
    overviewOpen,
    editorHands,
    shortcutsOpen,
    settingsTabRequest,
    colourSetRequest,
    unsavedWork,
    setUnsaved,
    closeOverlays,
  }
})
