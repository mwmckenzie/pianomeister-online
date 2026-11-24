// npm run test:e2e:affected — the e2e tests for what this branch changed: @smoke plus the area
// tags of every file changed against main (committed, staged, unstaged and untracked). Builds,
// then runs the chromium and polish projects on the production preview. The full suite runs in
// CI (.github/workflows/e2e.yml), never locally unless asked (CLAUDE.md, Testing).
//
//   npm run test:e2e:affected                 build + run
//   npm run test:e2e:affected -- --dry        print the files and tags only
//   npm run test:e2e:affected -- --last-failed   extra arguments go to Playwright

import { execSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * Source paths → e2e area tags (longest prefix wins). Shared code that every area uses maps to
 * @smoke only: the full suite in CI covers it.
 */
const AREA_MAP = [
  ['src/core/transport', ['@loop', '@player']],
  ['src/core/practice', ['@loop', '@bookmarks']],
  ['src/core/stats', ['@stats', '@welcome']],
  ['src/core/insights', ['@stats', '@welcome']],
  ['src/core/library', ['@library', '@hands']],
  ['src/core/looks', ['@looks']],
  ['src/core/color', ['@looks']],
  ['src/core/commands', ['@shortcuts']],
  ['src/core/settings', ['@settings', '@looks']],
  ['src/core/profiles', ['@settings']],
  ['src/core/song', ['@player', '@hands']],
  ['src/core/timing', ['@player', '@loop']],
  ['src/audio', ['@player']],
  ['src/engine', ['@player', '@looks']],
  ['src/data', ['@library', '@bookmarks', '@stats']],
  ['src/ui/overview', ['@loop']],
  ['src/ui/views/LoopEditorView.vue', ['@loop']],
  ['src/ui/library', ['@library', '@bookmarks']],
  ['src/ui/picker', ['@library']],
  ['src/ui/views/LibraryView.vue', ['@library']],
  ['src/ui/views/BookmarkManagerView.vue', ['@bookmarks']],
  ['src/ui/stats', ['@stats']],
  ['src/ui/views/StatsView.vue', ['@stats']],
  ['src/ui/welcome', ['@welcome']],
  ['src/ui/views/WelcomeView.vue', ['@welcome']],
  ['src/ui/router', ['@welcome', '@player']],
  ['src/ui/shortcuts', ['@shortcuts']],
  ['src/ui/settings', ['@settings']],
  ['src/ui/player', ['@player', '@looks']],
  ['src/ui/playback', ['@player', '@stats']],
  ['src/ui/views/PlayerView.vue', ['@player', '@loop']],
  ['src/ui/stores/libraryStore', ['@library', '@hands', '@playlists']],
  ['src/ui/stores/bookmarkStore', ['@bookmarks']],
  ['src/ui/stores/statsStore', ['@stats']],
  ['src/ui/stores/practiceStore', ['@loop', '@bookmarks']],
  ['src/ui/stores/settingsStore', ['@settings', '@looks']],
  ['src/ui/stores/profileStore', ['@settings']],
  ['src/ui/stores/uiStateStore', ['@player']],
  ['src/core/cages', ['@cages']],
  ['src/core/hands', ['@hands', '@cages', '@player']],
  ['src/core/midi', ['@hands', '@player']],
  ['src/engine/cages', ['@cages', '@looks']],
  ['src/engine/model/handCageRegions', ['@cages']],
  ['src/engine/model/cageQuads', ['@cages', '@looks']],
  ['src/core/playlists', ['@playlists']],
  ['src/ui/playlists', ['@playlists', '@library']],
  ['src/ui/views/PlaylistsView.vue', ['@playlists']],
  ['src/ui/stores/playlistStore', ['@playlists']],
  ['src/ui/stores/listeningStore', ['@playlists']],
  ['src/ui/playback/ListeningController', ['@playlists']],
  ['src/ui/player/ListeningHud.vue', ['@playlists']],
  ['src/ui/welcome/ListenCard.vue', ['@playlists', '@welcome']],
  ['src/ui/views/ReviewHandsView.vue', ['@hands']],
  ['src/ui/hands', ['@hands', '@library']],
  ['src/ui/components/HandsSection.vue', ['@hands', '@library']],
  ['src/ui/components/SongDetailsPanel.vue', ['@hands', '@library']],
  ['src/ui/components/SongRow.vue', ['@library']],
  ['src/data/Library', ['@hands', '@library', '@bookmarks', '@stats']],
  ['src/data/PianoMeisterDb', ['@library', '@bookmarks', '@stats', '@hands', '@playlists']],
  ['src/data/HandDetails', ['@hands']],
  ['src/data/StoredDetection', ['@hands']],
  ['src/data/StoredHandAssignment', ['@hands', '@library']],
  ['src/data/Playlists', ['@playlists']],
  ['public/songs', ['@library']],
]

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
}

function changedFiles() {
  const base = git('merge-base HEAD origin/main')[0] ?? 'origin/main'
  return [
    ...new Set([
      ...git(`diff --name-only ${base}`),
      ...git('ls-files --others --exclude-standard'),
    ]),
  ]
}

/** A changed spec runs its own tags (read from its test titles). */
function specTags(file) {
  try {
    const text = readFileSync(file, 'utf8')
    const heads = [...text.matchAll(/test\(\s*['"`]((?:@[a-z]+ )+)/g)].map((m) => m[1] ?? '')
    return [...new Set(heads.join(' ').split(' '))].filter(
      (t) => t !== '' && t !== '@visual' && t !== '@perf',
    )
  } catch {
    return []
  }
}

function tagsFor(file) {
  if (/^e2e\/.+\.spec\.ts$/.test(file)) return specTags(file)
  let best = null
  for (const [prefix, tags] of AREA_MAP) {
    if (file.startsWith(prefix) && (best === null || prefix.length > best[0].length)) {
      best = [prefix, tags]
    }
  }
  return best?.[1] ?? []
}

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const extra = args.filter((a) => a !== '--dry')

const files = changedFiles()
const tags = new Set(['@smoke'])
for (const file of files) for (const tag of tagsFor(file)) tags.add(tag)
const grep = `(${[...tags].map((t) => `${t}\\b`).join('|')})`

console.log(`Changed files: ${files.length}`)
console.log(`Tags: ${[...tags].join(' ')}`)
if (dry) process.exit(0)

const build = spawnSync('npm', ['run', 'build-only'], { stdio: 'inherit', shell: true })
if (build.status !== 0) process.exit(build.status ?? 1)
const run = spawnSync(
  'npx',
  ['playwright', 'test', '--project=chromium', '--project=polish', `--grep="${grep}"`, ...extra],
  { stdio: 'inherit', shell: true },
)
process.exit(run.status ?? 1)
