import { createRouter, createWebHashHistory, START_LOCATION } from 'vue-router'

import { useSettingsStore } from '../stores/settingsStore'
import EmptyRoute from '../views/EmptyRoute.vue'
import PlayerView from '../views/PlayerView.vue'

/**
 * Opened at the site root (no hash: a bookmark, the home-screen icon), the app starts on the
 * "Start on" page (m7-7 decision 1). An explicit `#/` link — or a reload of the player — stays on
 * the player.
 */
const openedAtRoot = window.location.hash === '' || window.location.hash === '#'

// Hash history: GitHub Pages can't rewrite deep links to index.html.
export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      // The player stays mounted under Welcome: its scene is Welcome's backdrop, loaded and
      // paused where you left off, so Resume is instant (m7-7 decision 12).
      path: '/',
      component: PlayerView,
      children: [
        { path: '', name: 'player', component: EmptyRoute },
        // Lazy: Welcome's cards and charts aren't needed to play.
        { path: 'welcome', name: 'welcome', component: () => import('../views/WelcomeView.vue') },
        // The loop editor keeps the player playing underneath (brief decision 106).
        { path: 'editor', name: 'editor', component: () => import('../views/LoopEditorView.vue') },
      ],
    },
    // Lazy: the library UI isn't needed to play.
    { path: '/library', name: 'library', component: () => import('../views/LibraryView.vue') },
    {
      path: '/bookmarks',
      name: 'bookmarks',
      component: () => import('../views/BookmarkManagerView.vue'),
    },
    { path: '/stats', name: 'stats', component: () => import('../views/StatsView.vue') },
    // Developer tool, deliberately not linked from the player. Lazy so it stays out of the main bundle.
    { path: '/debug', name: 'debug', component: () => import('../views/DebugView.vue') },
  ],
})

router.beforeEach((to, from) => {
  if (from !== START_LOCATION || to.name !== 'player' || !openedAtRoot) return true
  return useSettingsStore().settings.appearance.startOn === 'welcome' ? { name: 'welcome' } : true
})
