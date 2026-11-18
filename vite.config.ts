import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

// https://vite.dev/config/
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Served from https://<user>.github.io/pianomeister-online/ on GitHub Pages.
  base: '/pianomeister-online/',
  plugins: [vue(), vueDevTools()],
  server: {
    // Transform the lazily loaded screens and dialogs as soon as the dev server starts, so the
    // first click on them (and parallel e2e workers) never waits for on-demand compiling.
    warmup: {
      clientFiles: [
        './src/ui/picker/SongPicker.vue',
        './src/ui/settings/SettingsWindow.vue',
        './src/ui/views/LibraryView.vue',
        './src/ui/views/BookmarkManagerView.vue',
        './src/ui/library/ProfileCollisionDialog.vue',
      ],
    },
  },
  // Dev server: pre-bundle dependencies that are only imported lazily, so their first use
  // doesn't trigger a re-optimization and page reload mid-session.
  optimizeDeps: {
    include: [
      'three/addons/postprocessing/FXAAPass.js',
      'three/addons/postprocessing/SMAAPass.js',
      'fflate',
    ],
  },
  build: {
    // three.js alone is ~540 kB minified (~135 kB gzipped) and is one module; every other chunk
    // stays well under 500 kB. The limit sits just above three so new growth still warns.
    chunkSizeWarningLimit: 560,
    rolldownOptions: {
      output: {
        // Vendor chunks: libraries change less often than the app, so they stay cached across
        // deploys, and no single chunk carries everything.
        codeSplitting: {
          groups: [
            // FXAA and SMAA load on demand (RenderPipeline), so they stay out of this chunk.
            {
              name: 'three',
              test: /node_modules[\\/]three[\\/](?!examples[\\/]jsm[\\/](postprocessing|shaders)[\\/](FXAA|SMAA))/,
            },
            {
              name: 'vue',
              test: /node_modules[\\/](@vue|vue|vue-router|pinia|reka-ui|@floating-ui)[\\/]/,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
