import { onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { homeCheckDelay } from '@/core/stats/homeCheckDelay'
import { shouldOpenHome } from '@/core/stats/shouldOpenHome'

import { useProfileStore } from '../stores/profileStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useStatsStore } from '../stores/statsStore'
import { useUiStateStore } from '../stores/uiStateStore'

const STORAGE_KEY = 'pianomeister.homeAutoOpen'
/** Pages Home may replace; the debug page is left alone. */
const APP_PAGES = new Set(['player', 'welcome', 'editor', 'library', 'bookmarks', 'playlists', 'stats'])
/** Longer than setTimeout can wait (≈24.8 days): checked on focus instead. */
const MAX_DELAY = 2 ** 31 - 1

function readOpened(): Record<string, number> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return typeof raw === 'object' && raw !== null ? (raw as Record<string, number>) : {}
  } catch {
    return {}
  }
}

/**
 * "Open Home when a new session starts" (milestone 9.2 D): on load, refresh, refocus, and by
 * itself when the session gap passes while the app is open and idle, the app switches to Home —
 * once per new session (the stats' session rule, shouldOpenHome). It never interrupts: not while
 * playing, with unsaved work (a bookmark draft) or in the loop editor; then it waits for the next
 * new session. Plain menus, dialogs and the settings window are closed first. Paused entirely
 * while tracking is suspended.
 */
export function useHomeOnNewSession(): void {
  const router = useRouter()
  const route = useRoute()
  const settings = useSettingsStore()
  const stats = useStatsStore()
  const profiles = useProfileStore()
  const ui = useUiStateStore()
  let timer: ReturnType<typeof setTimeout> | undefined

  const enabled = () => settings.settings.appearance.homeOnNewSession && !stats.trackingSuspended

  function check(): void {
    if (!enabled() || !stats.lastEndKnown || stats.playbackActive) return arm()
    const now = Date.now()
    const opened = readOpened()
    const lastAutoOpen = opened[profiles.activeId] ?? null
    const lastPlaybackEnd = stats.lastPlaybackEnd
    if (!shouldOpenHome({ now, lastPlaybackEnd, lastAutoOpen, gapMs: stats.gapMs })) return arm()
    // Handled for this session either way: if it may not interrupt now, it waits for the next.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...opened, [profiles.activeId]: now }))
    const page = String(route.name)
    const busy = ui.unsavedWork.size > 0 || page === 'editor' || !APP_PAGES.has(page)
    if (!busy) {
      ui.closeOverlays++
      ui.shortcutsOpen = false
      if (page !== 'welcome') void router.push({ name: 'welcome' })
    }
    arm()
  }

  /** The idle timer: a check when the gap since the last playback passes. */
  function arm(): void {
    clearTimeout(timer)
    timer = undefined
    if (!enabled() || stats.playbackActive) return
    const delay = homeCheckDelay(Date.now(), stats.lastPlaybackEnd, stats.gapMs)
    if (delay === null || delay > MAX_DELAY) return
    timer = setTimeout(check, delay)
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') check()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', check)
  // Load (once the last playback is known), a new profile, the setting turned on: check now.
  watch(
    () =>
      [
        stats.lastEndKnown,
        profiles.activeId,
        settings.settings.appearance.homeOnNewSession,
        stats.trackingSuspended,
      ] as const,
    check,
    { immediate: true },
  )
  // Playback starting or ending, or another gap: re-arm the idle timer.
  watch(() => [stats.playbackActive, stats.lastPlaybackEnd, stats.gapMs] as const, arm)
  onBeforeUnmount(() => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', check)
  })
}
