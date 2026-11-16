// Used only by build-song-manifest.mjs: @tonejs/midi is CommonJS, which Vite's module runner
// can't read named exports from, so the script aliases the package to this file.
import { createRequire } from 'node:module'

export const { Midi } = createRequire(import.meta.url)('@tonejs/midi')
