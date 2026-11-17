import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'pianomeister.ui'

interface UiState {
  sidebarOpen: boolean
  /** Expanded sections of the playfield sidebar. */
  sidebarSections: string[]
}

const DEFAULTS: UiState = { sidebarOpen: false, sidebarSections: ['camera'] }

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
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * UI state that should survive a reload but isn't a setting (no reset, decision 63): whether
 * the playfield sidebar is open and which of its sections are expanded.
 */
export const useUiStateStore = defineStore('uiState', () => {
  const initial = read()
  const sidebarOpen = ref(initial.sidebarOpen)
  const sidebarSections = ref<string[]>(initial.sidebarSections)

  watch(
    [sidebarOpen, sidebarSections],
    () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            sidebarOpen: sidebarOpen.value,
            sidebarSections: sidebarSections.value,
          }),
        )
      } catch {
        // Storage blocked: the state still applies for this session.
      }
    },
    { deep: true },
  )

  return { sidebarOpen, sidebarSections }
})
