import { createRouter, createWebHashHistory } from 'vue-router'

import PlayerView from '../views/PlayerView.vue'

// Hash history: GitHub Pages can't rewrite deep links to index.html.
export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'player', component: PlayerView },
    // Developer tool, deliberately not linked from the player. Lazy so it stays out of the main bundle.
    { path: '/debug', name: 'debug', component: () => import('../views/DebugView.vue') },
  ],
})
