import { createRouter, createWebHashHistory } from 'vue-router'

import PlayerView from '../views/PlayerView.vue'

// Hash history: GitHub Pages can't rewrite deep links to index.html.
export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'player', component: PlayerView },
    // Lazy: the library UI isn't needed to play.
    { path: '/library', name: 'library', component: () => import('../views/LibraryView.vue') },
    // Developer tool, deliberately not linked from the player. Lazy so it stays out of the main bundle.
    { path: '/debug', name: 'debug', component: () => import('../views/DebugView.vue') },
  ],
})
