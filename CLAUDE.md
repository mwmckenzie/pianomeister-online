# PianoMeister Online

Browser-based piano practice visualizer: MIDI songs scroll down a perspective note highway toward a full 88-key 3D keyboard, with sampled piano sound (or Web MIDI out) and bar-based practice tools. Static site deployed to GitHub Pages. Targets desktop and tablet (iPad included).

**Read `docs/brief.md` before planning any feature.** It is the source of truth for scope, decisions, data model, visual behavior, and milestones. If a request conflicts with the brief, say so before writing code.

## Commands

- `npm run dev` — dev server (served under `/pianomeister-online/`)
- `npm run check` — type-check + lint + unit tests. **Must pass before any task is called done.**
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build locally
- `npm run test:unit` — Vitest (watch mode); `npx vitest run` for a single pass
- `npm run test:unit:changed` — Vitest on the tests related to files changed against main (`npx vitest related <files> --run` for specific files)
- `npm run test:e2e:affected` — builds, then runs the e2e `@smoke` set plus the area tags of every file changed against main (`-- --dry` lists them; other arguments go to Playwright, e.g. `-- --last-failed`). The local e2e command during a milestone.
- `npm run test:e2e:smoke` — the `@smoke` set only (~17 main-path tests)
- `npm run test:e2e` — the full functional suite (chromium + polish) against the production preview. **Only when asked;** the full suite runs in CI.
- `npm run test:e2e:dev` — Playwright against the dev server (5173, reused if running) for quick checks. Expect flakes in full runs: on the dev server the ~230 sample downloads saturate HTTP/1.1's six connections and lazy chunks queue behind them.
- `npm run test:visual` / `npm run test:perf` — visual review shots / frame timings, also against the production preview. Only when a milestone asks; never in CI.
- `npm run bench:hands -- <folder>` — scores the hand-split methods on a **local** folder of MIDI files with tracks named right/left (`--algos=beam,chord`, `--params=<JSON>`). Never commit those files; not part of `check`.
- `npm run bench:render` — the benchmark (`#/bench`) in a browser of its own, on a production build; options and other devices in `docs/performance.md`. Not part of `check`.
- `npm run songs:manifest` — regenerate `public/songs/manifest.json` after adding/changing bundled songs (then fill in title/composer/tags)

## Testing

Keep local test time small; the full e2e suite runs in CI.

1. **Unit tests.** While working, run only the related tests (`npm run test:unit:changed`, or `npx vitest related <files> --run`). Run the full `npm run check` once, before a PR (and whenever you call a task done).
2. **E2e tags.** Every functional spec test carries an area tag at the start of its title:
   - Areas: `@player`, `@library`, `@bookmarks`, `@looks`, `@loop`, `@welcome`, `@stats`, `@settings`, `@shortcuts`, `@playlists`, `@cages`, `@hands`, `@colours`, `@bench`; others as areas arrive.
   - About 15 main-path tests also carry `@smoke` (a minute or two).
   - New specs and tests get a tag. When a new source folder appears, add it to the map in `scripts/e2e-affected.mjs`.
3. **During a milestone,** run only `npm run test:e2e:affected` locally. Never the full suite locally unless asked.
4. **Failures:**
   - Re-run only the failures: `npx playwright test --last-failed`.
   - Suspected flakes: `--last-failed --repeat-each=3`.
   - Fix them or name them in the report. Never re-run the whole suite to confirm.
5. **CI:** the `check` job (`.github/workflows/ci.yml`: type-check, lint, unit tests, build) runs on every pull request and is the required check. The full e2e suite (`.github/workflows/e2e.yml`) runs **on manual trigger only** until CI e2e is workable (roadmap, milestone 11 Phase 5):
   - On the production build, sharded across 4 runners, with 1 retry.
   - A test that passes on its retry is listed as flaky in the job summary and doesn't fail the job.
   - The visual, perf, range and sheet projects never run in CI or automatically, only when a milestone asks.
6. **Before opening a PR:** `npm run check` and `npm run test:e2e:affected`. **After pushing:** read CI with `gh pr checks <n>` and fix real failures.
7. **Waits:** wait on state (an element gone, an attribute set, a still frame), never on a fixed sleep for an animation or timer. The expect timeout (10 s) is a safety net for loads under parallel load, not a reason to wait.

## Stack

Vite, Vue 3 (`<script setup>` + Composition API), TypeScript (strict), Pinia, Vue Router (hash history), Three.js, Vitest, Playwright. Later milestones add `@tonejs/midi`, `smplr`, WEBMIDI.js, Dexie. Do not add other dependencies without asking.

## Architecture rules

```
src/
  core/     pure TS: song model, MIDI import, bar map, transport, practice config, stats
  audio/    sampler output, MIDI out, per-hand routing
  engine/   Three.js scene: highway, notes, keyboard, effects
  data/     Dexie database + repositories
  ui/       Vue components, views, Pinia stores, router
```

- `core/` has **no** imports from Vue, Three.js, the DOM, or Web Audio. It must be unit-testable in Node.
- The **audio clock is the master timeline**. The engine reads the transport's song position each frame; it never drives timing.
- The engine is **not reactive**: no Vue refs/reactive around Three.js objects. Vue talks to the engine through a small imperative API (e.g. `engine.setSong()`, `engine.dispose()`).
- Note events flow through one event bus (note on/off); audio, MIDI out, and visuals subscribe. Keep this seam — MIDI input will plug in later.
- All seek/loop/pre-roll math is in bars and beats via the bar map, never raw seconds in UI code.
- Dispose Three.js geometries, materials, and textures when they are replaced or unmounted.

## Code conventions

- One exported type, class, or component per file. File name matches the export.
- Vue components and classes: `PascalCase.vue` / `PascalCase.ts`. Function/utility modules: `camelCase.ts`.
- Named exports only (no default exports, except where Vue/Vite require them).
- No `any`. Prefer `readonly` data and pure functions in `core/`.
- Tests sit next to the code: `foo.ts` → `foo.spec.ts`.
- Comments explain _why_, not _what_.

## Working rules

- For anything touching more than one file: plan first, then implement.
- Every `core/` change ships with unit tests.
- A note's hand comes only from `handOf(note)` (`src/core/hands`); nothing reads channels for hands (the debug page excepted).
- When detection or a split method gives different results, bump `DETECTOR_VERSION` (`src/core/hands/DETECTOR_VERSION.ts`): detections are then computed again in the background. The player's roles and flips stay.
- Whenever `SongFacts` gains or changes a field, bump `FACTS_VERSION` (`src/core/library/FACTS_VERSION.ts`) and run `npm run songs:manifest`. Stored uploads with older facts are then recomputed in the background on the next load; never rely on a Dexie upgrade to refresh facts.
- Definition of done: `npm run check` passes, `npm run build` passes, and for UI/visual changes you have viewed the result.
- Small, focused commits with conventional prefixes (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- Never edit `dist/`, `.idea/`, or lockfiles by hand.
- When a decision isn't covered by the brief, ask rather than guess, and propose an update to `docs/brief.md`.

## Reports

Whenever you stop for my review (after a plan is approved and built, after a fix, or when you're blocked), write or update a Markdown report at `docs/reports/<branch-name>.md` before replying, with `/` in the branch name replaced by `-` (e.g. `feat/m4-library` → `docs/reports/feat-m4-library.md`). Include:

- what was done and what changed (files/areas),
- decisions you made that weren't in the instructions,
- test and check results (pass/fail, counts, perf numbers),
- known issues and open questions,
- a short manual review checklist for me.

Keep earlier sections and append a dated section for each review round. Commit it with the work on the branch.
