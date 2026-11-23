# Report: chore/e2e-hardening (E2e hardening and the testing policy)

Roadmap item "E2e hardening" (standalone), then the testing policy (2026-11-24): tags, affected runs locally, the full suite in CI.

## Round 1 — 2026-11-24

### Hardening: test fixes (tests and test helpers; one minimal app change)

| Spec                                                              | Pattern                                                                                                                                                | Fix                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loopJump.spec.ts` (`enter`, used by `:259` and others)           | Read the bar while playback ran: "played briefly, then paused" could land the pause a few bars in under load (the 9.1 and 9.2 failure read 42 for 40). | A paused `enter` parks the playhead back on the chosen bar (a seek while paused) and waits for `N:1` and `paused` before any check.                                                                                                                            |
| `listKeys.spec.ts` (loop nudge key)                               | Waited on the settings window's close animation under a fake clock (the 9.1 failure).                                                                  | The key binding is seeded in storage as the Shortcuts tab would store it (binding it in the UI is `shortcuts.spec`'s job), then a reload: no window, no animation.                                                                                             |
| `welcome.spec.ts` (highlights rotate)                             | Advanced the clock 8 s once, assuming the rotator was ready (the 9.1 failure).                                                                         | Waits for 2+ highlights, moves the pointer away and blurs focus (hover and focus hold the rotation), then advances the clock.                                                                                                                                  |
| `visualPolish.spec.ts` (animated fills ×2, paused frame settles)  | Fixed sleeps (1.5 s, 3 s) to let fades settle.                                                                                                         | `stableFrame` polls until two consecutive frames match within the stillness tolerance, and fails clearly if the scene never settles (it used to return an unsettled frame silently). The short sleeps that _are_ the test ("time passes, nothing moves") stay. |
| `shortcuts.spec.ts:210`, `shortcutsLayout.spec.ts:70` (`?` sheet) | The sheet's lazy chunk queued behind ~230 sample downloads, so the first `?` waited over 5 s under load.                                               | **Minimal app change** (`App.vue`): the shortcuts sheet's chunk is requested on app start, as PlayerView already does for the picker and settings. No behaviour change, only earlier loading.                                                                  |
| All (`playwright.config.ts`)                                      | Song and chunk loads under parallel load sometimes took over the 5 s expect timeout (run 4: 4 tests, none touched by this branch).                     | Expect timeout 10 s, a safety net only; every wait is on a state, so passing tests aren't slowed.                                                                                                                                                              |

Checked and left as they are:

- `loopBounds.spec.ts`: reads right after a poll while playing. It's weak (the second poll can pass before the click lands) but safe.
- `loopJump.spec.ts:128` (≥ 30 mid-drag) holds while playing.
- `visualPolish` "seeking while paused" keeps its 1 s: that wait is the test.

### Full local runs (chromium + polish, `--retries=0`) before the policy change

| Run | Result               | Duration | Notes                                                                                                                                                                                        |
| --- | -------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 176 passed, 2 failed | 6.7 min  | `shortcuts.spec.ts:210`, `shortcutsLayout.spec.ts:70`: the `?` sheet's lazy chunk (fixed above).                                                                                             |
| 2   | 178 passed           | 7.0 min  |                                                                                                                                                                                              |
| 3   | 178 passed           | 6.9 min  | After the chunk prefetch.                                                                                                                                                                    |
| 4   | 174 passed, 4 failed | 4.8 min  | Song loads over 5 s: `listKeys.spec.ts:144`, `loopEditor.spec.ts:133`, `picker.spec.ts:10`, `profiles.spec.ts:96`. None touched by this branch; expect timeout raised to 10 s.               |
| 5   | 178 passed           | 5.6 min  |                                                                                                                                                                                              |
| 6   | 175 passed, 3 failed | 6.0 min  | `net::ERR_NETWORK_CHANGED` in the log: the machine's network changed mid-run (`profiles.spec.ts:96`, `player.spec.ts:72` startup loads, `welcome.spec.ts:45` console errors). Environmental. |
| 7–8 | stopped              | —        | The policy changed: no more full local runs.                                                                                                                                                 |

Runs 2 and 3 were green back to back (before the expect-timeout change), and so was run 5. The touched specs alone passed 3× each (156 runs, `--repeat-each=3`) before the full runs.

### Testing policy (in `CLAUDE.md`, Testing)

- **Unit:** `npm run test:unit:changed` (`vitest run --changed origin/main`) while working; `npm run check` once before a PR.
- **Tags:** every functional test title starts with its area tag:
  - `@player`, `@library`, `@bookmarks`, `@looks`, `@loop`, `@welcome`, `@stats`, `@settings`, `@shortcuts` (178 tests, none untagged).
  - **17 `@smoke` tests**, one or two per area plus the two smoke-spec tests: **24.6 s** locally (`npm run test:e2e:smoke`).
- **`npm run test:e2e:affected`** (`scripts/e2e-affected.mjs`):
  - It takes the files changed against `origin/main` (committed, staged, unstaged, untracked) and maps source folders to tags. A changed spec brings its own tags.
  - It builds, then runs chromium + polish with `--grep "(@smoke|<tags>)"`.
  - `-- --dry` lists the files and tags; other arguments go to Playwright.
  - Shared code (components, theme, `App.vue`) maps to `@smoke` only: CI covers the rest.
- **CI** (`.github/workflows/e2e.yml`): on pull requests to main (every push to the branch re-runs it).
  - Four shards of the chromium + polish projects on the production build, 2 workers each, 1 retry.
  - A report job merges the shards into one HTML report (artifact) and writes a summary (`scripts/e2e-summary.mjs`): totals, duration, and failed and flaky tests by name.
  - A test that passes on its retry is flaky: listed, but the job passes.
  - The visual, perf, range and sheet projects are not in CI.
- **Config:**
  - In CI: `retries` 1 (was 2), `workers` 2 (was 1), reporters blob + github + list.
  - `npm run test:e2e` now runs both projects (it used to skip polish), and is only for when you ask.
- **Line endings:** `App.vue` is CRLF in the working copy and LF in the repository (`eol=lf`); its diff is only the intended prefetch lines.

### Results

- `npm run check`: 765 unit tests pass. `npm run build` passes.
- `npm run test:e2e:smoke`: 17 passed (24.6 s).
- The full suite runs in CI on the PR; its duration and flaky tests are added below once it has run.

### Decisions not in the instructions

- One area tag per spec file; `@smoke` on top for the chosen tests.
- The tag lives in the test title, Playwright's title tags, so the existing `--grep` and the `@visual`/`@perf` project filters keep working.
- `@playlists` comes with 9.5.
- The map in `e2e-affected.mjs` is by path prefix (longest wins); stores map to their area by file name.

### Manual review checklist

- `npm run test:e2e:affected -- --dry` on a branch that touches one area lists `@smoke` plus that area.
- The PR's E2E job: four shards and a report job whose summary lists any flaky tests.
- `CLAUDE.md` → Testing reads as the policy you asked for.
