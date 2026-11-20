import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'pianomeister.ui'

interface UiState {
  sidebarOpen: boolean
  /** Expanded sections of the playfield sidebar. */
  sidebarSections: string[]
  /** The overview strip under the timeline (brief decision 105). */
  overviewOpen: boolean
  /** The loop editor's hand visibility toggles (view only, brief decision 106). */
  editorHands: { right: boolean; left: boolean }
}

const DEFAULTS: UiState = {
  sidebarOpen: false,
  sidebarSections: ['camera'],
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

function read(): UiState {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (typeof raw !== 'object' || raw === null) return { ...DEFAULTS }
    const r = raw as Partial<Record<keyof UiState, unknown>>
    return {
      sidebarOpen: typeof r.sidebarOpen === 'boolean' ? r.sidebarOpen : DEFAULTS.sidebarOpen,
      sidebarSections: Array.isArray(r.sidebarSections)
        ? r.sidebarSections.filter((s): s is string => typeof s === 'string')
        : [...DEFAULTS.sidebarSections],
      overviewOpen: typeof r.overviewOpen === 'boolean' ? r.overviewOpen : DEFAULTS.overviewOpen,
      editorHands: readHands(r.editorHands),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * UI state that should survive a reload but isn't a setting (no reset, decision 63): whether
 * the playfield sidebar is open and which of its sections are expanded, and whether the
 * overview strip is open, and which hands the loop editor shows.
 */
export const useUiStateStore = defineStore('uiState', () => {
  const initial = read()
  const sidebarOpen = ref(initial.sidebarOpen)
  const sidebarSections = ref<string[]>(initial.sidebarSections)
  const overviewOpen = ref(initial.overviewOpen)
  const editorHands = ref(initial.editorHands)

  watch(
    [sidebarOpen, sidebarSections, overviewOpen, editorHands],
    () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            sidebarOpen: sidebarOpen.value,
            sidebarSections: sidebarSections.value,
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

  return {
    sidebarOpen,
    sidebarSections,
    overviewOpen,
    editorHands,
    shortcutsOpen,
    settingsTabRequest,
  }
})
