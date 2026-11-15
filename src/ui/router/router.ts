import { createRouter, createWebHashHistory } from 'vue-router'

import HomeView from '../views/HomeView.vue'

// Hash history: GitHub Pages can't rewrite deep links to index.html.
export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    // Developer tool, deliberately not linked from the home page. Lazy so it stays out of the main bundle.
    { path: '/debug', name: 'debug', component: () => import('../views/DebugView.vue') },
  ],
})
