# PianoMeister Online

Browser-based piano practice visualizer: MIDI songs scroll down a perspective note highway toward a full 88-key 3D keyboard, with sampled piano sound (or Web MIDI out) and bar-based practice tools. Static site deployed to GitHub Pages. Targets desktop and tablet (iPad included).

**Read `docs/brief.md` before planning any feature.** It is the source of truth for scope, decisions, data model, visual behavior, and milestones. If a request conflicts with the brief, say so before writing code.

## Commands

- `npm run dev` — dev server (served under `/pianomeister-online/`)
- `npm run check` — type-check + lint + unit tests. **Must pass before any task is called done.**
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build locally
- `npm run test:unit` — Vitest (watch mode); `npx vitest run` for a single pass
- `npm run test:e2e` — Playwright against the production preview (builds first, then serves `dist/` on port 4173), the same server `CI=1` uses. Use this to call e2e green.
- `npm run test:e2e:dev` — Playwright against the dev server (5173, reused if running) for quick checks. Expect flakes in full runs: on the dev server the ~230 sample downloads saturate HTTP/1.1's six connections and lazy chunks queue behind them.
- `npm run test:visual` / `npm run test:perf` — visual review shots / frame timings, also against the production preview
- `npm run songs:manifest` — regenerate `public/songs/manifest.json` after adding/changing bundled songs (then fill in title/composer/tags)

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
