# Milestone 11, Phase 0 plan: measure

Brief: `docs/milestones/m11-performance.md`. Branch: `feat/m11-perf-measure`. This phase builds instruments and a baseline. Nothing is optimised, and no existing behaviour changes while they are off.

## 1. What the code says (brief questions 2–6)

### Q1. Devices (your answer, with what each can show)

| Run            | Device                                  | Measures              | Caveat                                                                                                                                                                                                    |
| -------------- | --------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strong`       | Main PC (RTX 4090), Chrome              | upper bound           | Its screen ran at 120 Hz here, so a run must record the refresh rate (§3.3).                                                                                                                              |
| `mainstream`   | LG Gram 2023 (Iris Xe), mains           | the Mainstream tier   | High DPI: the buffer is up to 4× the CSS pixels (max pixel ratio 2).                                                                                                                                      |
| `weak-battery` | LG Gram, battery, Best power efficiency | the Weak tier         | A 2023 chip is faster than the HD 520 in the brief. Chrome's Energy Saver can cap at 30 fps on battery: turn it off, the run flags a 30 fps cap.                                                          |
| `weak-cpu`     | Main PC, DevTools 4× CPU                | main-thread cost only | The throttle doesn't slow the GPU, so it says nothing about GPU cost. Reported as "CPU-limited", not as the Weak tier.                                                                                    |
| `floor`        | Main PC, `--disable-gpu`, 4× CPU        | software WebGL        | I expect the throttle to miss SwiftShader, which draws in Chrome's GPU process on a 20-thread CPU, so the Floor would look too good. I check this first, and compare with Chrome limited to 2 cores (Q4). |
| `tablet`       | Galaxy Tab S7, Chrome                   | tablet                | Use USB port forwarding, not the LAN address (below).                                                                                                                                                     |
| `phone`        | Find X9 Ultra                           | smoke check           | Smoke suite only.                                                                                                                                                                                         |

**Two changes to how you reach the tablet:**

- **Forward the port over USB and open `http://localhost:4173` on the tablet** (chrome://inspect → Port forwarding). Over a plain `http://192.168…` address the browser withholds `crypto.subtle` and `crypto.randomUUID`. We use both, to open uploaded files and to create bookmarks, looks and play records.
- **Measure the production build** (`npm run build`, then `npm run preview`), not `npm run dev`: the dev server runs Vue's development build and loads every module separately. The result records which build it was, and a dev run is marked as not comparable. `npm run dev` is fine for trying the page.

### Q2. The render loop today

- **Three independent loops** while the player is open: the engine's (`Engine.loop`), the HUD's (`PlayerView.updateHud`) and, with its own page open, others such as the colour preview. All `requestAnimationFrame`.
- **Continuous.** The engine draws every frame playing, paused or stopped (measured, Q3). It stops only under Welcome and the loop editor (`setFrozen`) and in hidden tabs. An open Settings window or song picker does not stop it.
- **The HUD loop never stops** while the player is mounted, frozen or not, and assigns a new `hud` object to a Vue ref every frame with an opened song.
- **Passes per frame**, in order, at the default quality with MSAA:
  1. the glow scene, into a half-float target (skipped at Off);
  2. bloom: bright pass, blur down the mips (two passes each), composite;
  3. the main scene into a 4× MSAA target: stencil masks (only while a cage shows), cages, notes, keyboard, effects;
  4. mix (bloom, vignette) or copy to the canvas;
  5. note-name labels, straight onto the canvas.

  With anti-aliasing, bloom and vignette all off, steps 1, 2 and 4 go and the scene draws straight to the canvas.

- **Per frame on the CPU:** key states (a binary search per key), a label overlap pass that allocates arrays and a JSON string (only with names on notes and Avoid overlaps on), particle spawns, uniforms.
- **No culling:** each note layer is one instanced draw of the whole song; the vertex shader collapses notes outside the window. Draw calls stay flat; vertex work grows with the song.
- **Context loss:** no handler in the app code.
- **Looks easing across a playlist seam** call `engine.applySettings` every frame for the length of the fade.

### Q3. Draw calls, Canon in D

Throwaway script, production build, Chrome 158, RTX 4090, 1600 × 900, pixel ratio 1, MSAA. 24 samples over 6 s in each state, with the transport state checked at every sample. Every count was constant.

| Quality | Study: stopped | playing | paused | Classic (all three) |
| ------- | -------------- | ------- | ------ | ------------------- |
| Off     | 28             | 28      | 28     | 21                  |
| Low     | 48             | 48      | 48     | 34                  |
| Medium  | 50             | 50      | 50     | 36                  |
| High    | 52             | 52      | 52     | 38                  |

- **Paused and stopped cost the same as playing:** the engine drew 93–120 frames a second in every state. The frame rates in these runs varied for reasons I haven't found, so I don't compare presets with them.
- **The draw-call count is already modest.** Notes and keys are instanced. "One draw per note" (Phase 2) isn't what we have, so the suspects move to pixels (MSAA, bloom, fill shaders, overdraw) and vertices. The baseline decides.
- **Loops are the multiplier:** milestone 9.2 measured about 11 extra calls per visible repeat at Off and 15 at Medium, worst case 223. Not measured again here.
- **Labels, vignette, effects:** not varied here; the benchmark does.

### Q4. Is audio scheduled ahead?

**Yes, but from the main thread, with 100 ms in hand.** Read from the code, not yet measured:

- A worker ticks every 25 ms; the main thread then hands Web Audio everything due in the next 100 ms at exact audio-clock times (`AudioScheduler`). **Loop wraps** are included (`segmentsBetween`).
- **A block of B ms** (counted from the last tick): up to 100 ms is harmless. From 100 to 150 ms, notes play late. Over 150 ms, notes more than 50 ms old are dropped (`STALE_SEC`), the rest play late. Phase 4's 200 ms test would therefore fail today.
- **Crossfade:** both songs sit on one timeline, so their notes go through the same scheduler, and the gain curves are scheduled on the audio clock. But preparing the next song (10 s before the fade), arming the fade, moving to the next song and ending the list all run from the HUD's `requestAnimationFrame`. A slow frame only delays them, a **hidden tab stops them**: playlists in a background tab look likely to stop at the end of the prepared song. To be confirmed by the benchmark's hidden-tab check, and fixed in Phase 4.
- **The picture** reads the audio clock each frame (`audibleTick`), not frame deltas, as Phase 4 wants. `currentTime` advances in steps, coarser on some devices, which can look like judder at a perfect frame rate. The benchmark measures it (§3.3).
- Particles, label fades and key animation do use frame deltas. They are decoration.

### Q5. Existing settings that overlap

All of the cost settings are device-wide and never part of a look (`COST_KEYS`).

| Setting today                                              | Maps to                                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `render.quality` Off / Low / Medium / High (Low on tablet) | `perf.quality`. Closest: High → Ultra, Medium → High, Low → Balanced, Off → Minimal. Lite is new.  |
| `render.bloomResolution` off / ¼ / ½ / full                | the levels' bloom row                                                                              |
| `render.particleBudget` 512–4096                           | not in the brief's level table; each level needs one                                               |
| `render.shaderDetail` minimal–high                         | today's only fill-cost control (noise octaves, key light); the fallback fills extend it            |
| `render.scaleAuto`, `scale`, `maxPixelRatio` (cap 2)       | `perf.renderScale`                                                                                 |
| `render.antialias` (default MSAA)                          | not in the brief's table; 4× MSAA is a likely cost on integrated GPUs, so the levels should set it |
| `appearance.motion` (Menu animations)                      | overlaps `perf.reduceMotion`; it already drives the engine's reduced motion                        |
| `effects.*`, `highway.lookAheadBeats`, `highway.vignette`  | look settings: levels may draw less, never change them                                             |
| Frame rate                                                 | nothing today                                                                                      |

For Phase 3: keep one set of keys rather than `render.*` beside `perf.*`. Off must stay reachable, as "exactly the pre-milestone-9 pipeline" is decision 110.

### Q6. Costs that can't go down without a visible change

| Feature                             | Why                                      | Options                                                       |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| Bloom                               | the halo is the blur                     | ¼ resolution, sprite glow, none                               |
| Procedural fills (Smoke, Liquid, …) | animated noise per pixel                 | fewer octaves, baked noise texture, static fallback           |
| Translucent notes over cages        | the stencil masks redraw each note layer | plain quads behind (tints notes); opaque notes at low levels  |
| Edge smoothness                     | 4× MSAA                                  | FXAA, line anti-aliasing only, none                           |
| Render scale below the screen       | fewer pixels is softer                   | 1.0 with sharper lines; labels already draw in their own pass |
| Particles                           | overdraw of additive sprites             | smaller budget, shorter life, fewer kinds                     |
| Loop "Next repeat" ghosts           | each repeat draws the layers again       | instance the repeats (no visible change), or fewer repeats    |
| Long look-ahead                     | more notes on screen                     | none without changing what the player set; leave alone        |

Candidates with no visible change (culling, render on demand, HUD rate, instanced repeats) go first in Phases 1 and 2.

## 2. Architecture

```
src/core/bench/    pure: scenario and result types, percentiles, summary, comparison,
                   GPU classification, schema validation; unit-tested
src/ui/bench/      recorder (frames, long tasks, audio), runner, BenchPage, PerfOverlay, device info
scripts/bench-render.mjs, scripts/bench-trace.mjs
```

- **The real player, not a copy.** `#/bench` is a lazy child route of the player, like Welcome, so HUD, Vue, audio and engine cost what they cost in use. It reaches the player through a small `BenchHost` interface (open song bytes, apply settings, seek, loop, play, pause, listen, engine info).
- **Nothing of yours changes.** Settings go on as a temporary overlay and come back at the end, also after Cancel, an error or a reload. Play tracking is suspended; songs open from memory, never saved to the library; last song and position are put back. Covered by e2e.
- **Off means off:** the recorder and overlay are separate lazy chunks; the engine gains only read-only counters (programs, triangles, geometries, textures) and a per-frame callback that is null by default. `renderer.info` already counts them.
- **Songs:** Canon and Invention from `public/songs`; `long-demo.mid` (103 kB) as a lazy asset, as the debug page does with its fixture.
- **New tag** `@bench`; `e2e-affected` map entries.

## 3. Benchmark mode

### 3.1 Scenario

One **cell** = look × quality × song segment. Each has 2 s warm-up (programs compile; recorded separately as "first frames", not mixed in) then the measured time. Seeded particles (the capture-mode generator), fixed viewport where possible, fixed camera (the default one, over the look's), tempo 100 %, reduced motion off, output muted through the existing mute.

| Segment       | Song and place                                         | Shows                               |
| ------------- | ------------------------------------------------------ | ----------------------------------- |
| `dense`       | long-demo, bars 1–24, 10 s                             | the stress case                     |
| `normal`      | Canon, dense middle, 10 s                              | the usual case                      |
| `light`       | Invention, 5 s                                         | a floor for the app itself          |
| `loop`        | Canon, one-bar loop, maximum look-ahead, 8 s           | repeats, wraps                      |
| `crossfade`   | Canon's end into Invention, 2 s fade, look change, 8 s | the seam, look easing               |
| `pauseResume` | Canon: 3 s play, 3 s pause, 3 s play                   | paused frames and CPU, resume stall |

### 3.2 Suites

The full product (14 looks × 4 levels × 6 segments) would run for nearly an hour, so there are three suites, shown with their estimated time:

| Suite        | Runs                                                                                                                         | About  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Smoke**    | Study at the current quality, `normal` and `dense` (phone, CI)                                                               | 30 s   |
| **Standard** | Study, Classic and the 2 costliest looks × 4 levels × `normal` and `dense`, plus every other segment for Study at each level | 10 min |
| **Full**     | all 14 looks × 4 levels × `dense`, then Standard                                                                             | 25 min |

- The two costly looks are picked from my first Full run on the Iris Xe or tablet, then fixed. Until then: Inferno and Crystal (a guess).
- Plus two **cost probes** in Full: one look with each fill in turn, and each expensive feature switched off in turn (bloom, MSAA, cages, labels, vignette, particles). That gives "which fills cost the most" and a ranking on devices without a trace.
- Levels are interleaved over 2 rounds, so heat and clock drift hit all alike; a round-to-round spread over 10 % marks the cell "noisy".
- On the Floor a cell ends early when it has 60 frames or 30 s.
- **It stops and says so** when the tab is hidden or the window resized: that cell is discarded and repeated.

### 3.3 What is recorded, per cell

- **Frames:** every rAF interval; median, p95, p99, longest; share over 16.7 and over 33.3 ms; **dropped frames**: intervals over 1.5 × the frame budget, where the budget is the screen's measured refresh interval (median of 1 s of empty frames before the run) or 16.7 ms, whichever is longer. A 120 Hz screen is then judged at 60.
- **Work:** engine CPU per frame, HUD time per frame, GPU time where the timer query exists (not under `--disable-gpu`, where it was missing).
- **Scheduling:** long tasks and long animation frames (where supported; Safari has neither), with script names and time.
- **Renderer:** draw calls, triangles, programs, textures, geometries, points; buffer size.
- **Memory:** `performance.memory` (Chrome only, coarse) at start and end, and an **estimate** of render-target memory from their sizes. Browsers don't expose GPU memory, so the 400 MB target can only be estimated.
- **Audio:** per note, the margin between the moment it was handed over and its time (negative = late); notes expected against notes handed over (missing = dropped); context time against wall clock (drift); outputLatency. "Actual note start" isn't observable from a page: a note handed over in time starts on time by Web Audio's contract.
- **Motion:** the error between song-position steps and frame intervals (the judder in Q4).
- **Extra checks, once per run:** hidden tab (headless only), start-up (navigation to first interaction, to song opened, to samples loaded) and a paused-idle 10 s.

### 3.4 Result

JSON, `schema: "pianomeister-bench"`, `version: 1`, validated when read:

- **`run`:** id, time, suite, app version and commit, production or dev build, a **label you type** (defaulting from the table in Q1), notes (power, throttling);
- **`device`:** §5;
- **`cells[]`:** the numbers above, raw frame intervals rounded to 0.01 ms (so any percentile can be recomputed);
- **`summary`**, **`flags`** (30 fps cap, noisy, dev build, hidden, changed refresh rate).

Kept in localStorage as summaries only (last 20) and without raw frames, so quota isn't an issue; the full JSON is downloaded.

### 3.5 The page

Suite and label → Start (a click, so audio can start) → progress, remaining time, Cancel (Esc) → results: a table per quality, worst cells first, pass or fail per tier target. Buttons: **Download JSON**, **Copy summary**, **Compare with…** (the last run, one from history, or a JSON file). "Against main" is a file compare in `bench:render` (§6). Comparison says "different device" or "different build" instead of giving a misleading delta, and shows a change only above the noise.

**Running it yourself:** `#/bench`, choose the suite, type the label, Start, Download. Send me the files; `node scripts/bench-compare.mjs a.json b.json …` prints them side by side, all devices. File name: `bench-<label>-<date>.json`. On Android the download lands in Downloads (pull it with chrome://inspect or USB). A `docs/performance.md` holds the steps per device, with the Floor commands.

## 4. Perf overlay

`?perf=1` or Ctrl+Alt+P (checked against the shortcut registry, not user-bindable). A corner canvas, drawn at 4 Hz so it barely disturbs what it measures: fps, p95 over 3 s, a 120-frame graph with 16.7 and 33.3 lines, engine / HUD / GPU ms, draw calls and triangles, quality, buffer size and ratio, GPU string and class, audio margin. It doesn't take pointer events and is `aria-hidden`. Its own cost is shown in the report (bench with and without). Off during benchmark runs.

## 5. GPU detection

`src/core/bench/classifyGpu.ts`: renderer string → `software` / `weak` / `mainstream` / `strong` / `unknown`, with the matched rule:

- **software:** SwiftShader, llvmpipe, softpipe, Microsoft Basic Render, "Software". Confirmed here: `--disable-gpu` in Chrome 158 still gives WebGL2 through "ANGLE (Google, Vulkan … SwiftShader Device (Subzero))".
- **weak:** Intel HD (through 6xx), UHD 6xx, Mali-4xx/T, Adreno 3xx–5xx, PowerVR, Apple A-series before A12 where named. **mainstream:** Iris Xe / Iris Plus, Vega and Radeon integrated, Adreno 6xx, recent Mali-G, Apple M. **strong:** GeForce GTX/RTX, Radeon RX, desktop Arc (A and B series). The rest is `unknown`, never guessed strong.
- Masked strings ("Apple GPU", Firefox's generalised names) give `unknown` or a family, with a note.
- Also: WebGL2 available, max texture size, timer query, half-float targets, cores, device memory (Chrome only, capped), screen × ratio, refresh rate, user agent, reduced motion.

The probe uses the player's own context, so detection creates none. Unit-tested on a table of real strings (those I measured; the LG Gram's and Tab S7's join when your first files arrive). **It decides nothing in Phase 0;** the app only shows and records it.

Privacy: everything stays on the device until you download it. The file has the GPU string and user agent, nothing about your library or profile.

## 6. Headless: `npm run bench:render`

`node scripts/bench-render.mjs` drives `#/bench?auto=1` in Playwright against the production preview (built first) and saves JSON under `test-results/bench/`.

| Option                          | Does                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| `--suite=smoke\|standard\|full` | default smoke                                                        |
| `--gpu`                         | headed Chrome with the real GPU; default is headless SwiftShader     |
| `--throttle=4`                  | CPU throttle over CDP (main thread only)                             |
| `--cores=2`                     | limits Chrome's cores (Windows affinity / `taskset`), if Q4 says yes |
| `--trace`                       | a 10 s Chrome trace of Canon playing                                 |
| `--compare=<file>`              | prints the difference                                                |

- The bundled headless Chromium uses SwiftShader (confirmed), so the GPU-less runner path can be tried locally.
- `scripts/bench-trace.mjs <trace.json>` reads a trace, from `--trace` or saved by you from DevTools or chrome://inspect, and totals main thread JS, style and layout, paint and compositing, garbage collection, GPU task time, and the top functions (with source maps). No new dependency.
- The numbers from this path are **not** a tier result; they compare one commit against another on the same machine.

## 7. Baseline report and CI

- **Baseline:** `docs/reports/feat-m11-perf-measure.md` plus `docs/perf/baseline-<label>.json` (summaries, no raw frames). I run `strong`, `weak-cpu` and `floor` on your PC (headed Chrome on the real display; tell me if you would rather run them). You run the Gram twice, the tablet and the phone, and one trace each on the Gram and tablet if you can. The report has: numbers per tier against the targets, time split from the traces, the 10 costliest things ranked with how sure I am of each, looks and fills ranked, and a proposed order for Phases 1–4.
- **No averages across devices,** and where your files are missing the report says "not measured".
- **CI:** a `bench` job in `ci.yml`, separate from `check`, `continue-on-error`, never required: builds the PR and `main`, runs Smoke on each in turn on the same runner at Off (today's nearest to Minimal), 1280 × 720, and writes both and the difference to the job summary. Same runner, interleaved, because runners differ more than commits do. `main` has no benchmark until this PR is merged, so the first job shows the PR only. `timeout-minutes: 15`.

## 8. Build order

1. `core/bench`: types, statistics, schema, GPU classes, compare. Unit tests.
2. Engine counters and the frame callback; audio margin recorder. Unit tests; no timing change (draw calls compared before and after).
3. `BenchHost`, the overlay of settings, restoring. E2e: nothing changes after a run, Cancel or reload.
4. Runner and segments; the page; result, history, compare, download.
5. Perf overlay.
6. `bench:render`, `bench-trace`, `bench-compare`.
7. `docs/performance.md`, the CI job, a CLAUDE.md command list, the brief (a new decision), roadmap.
8. Baseline runs on your PC; report; **stop for you to run the devices**; then the ranked report.

Tests: unit for all of `core/bench`; about 6 `@bench` e2e (Smoke run to a valid file, Cancel restores, reload restores, hidden tab discards, overlay toggles, compare). They check structure, never timings. `npm run check` and `test:e2e:affected` before review.

## 9. Not in Phase 0

Any optimisation, quality levels, the governor, the probe, new settings, context-loss handling, and any fix for what the benchmark finds. Findings go into the report, including the hidden-tab playlist and the HUD loop.

## 10. Risks

- **Measuring changes the thing measured:** the recorder preallocates its arrays and costs one callback per frame; checked by running with it on and off.
- **Frame intervals are vsync-quantised:** at 60 Hz a p95 under 17 ms fails with a little timer jitter (Q2 below).
- **Shared state in `PlayerView`:** it is large, and the crossfade runs through `ListeningController`, which takes playlists from the database. If an in-memory playlist can't be passed cleanly, I will stop and show you the options rather than write to your database.
- **The Standard suite is long on the Floor.** Cells end early; the estimate on the page will be rough there.

## 11. Questions

1. **Tablet access:** USB port forwarding with the production preview instead of `npm run dev -- --host`? Default: yes.
2. **Frame targets:** read "p95 < 17 ms" as "at most 5 % of frames over 18 ms at 60 Hz", to leave room for timer jitter? Likewise 35 ms for 34 (the Strong tier's 20 ms stays). Default: yes; both numbers are shown.
3. **Levels:** benchmark today's Off / Low / Medium / High, since Ultra–Minimal don't exist until Phase 3? Default: yes.
4. **Floor and cores:** if the 4× throttle misses SwiftShader as I expect, also run the Floor with Chrome limited to 2 cores, and treat that as the Floor? Default: yes, both reported.
5. **Weak:** accept the Gram on battery as the stand-in, knowing that it is faster than an HD 520? An older laptop or a cheap Chromebook would make the tier real. Default: accept, and say so in the report.
6. **Where the page is linked:** only `#/bench` and a small link in Settings → About? The old roadmap notes wanted it under Settings; a hidden page is safer until it's tuned. Default: About link.
7. **Baseline files in the repo:** summaries only under `docs/perf/`? Default: yes.

## 12. Approved (2026-11-25)

Q1–Q7: all defaults. Two additions:

- **Hidden-tab playlist:** confirming it is an explicit Phase 0 check, an e2e that plays a playlist across a seam with the page hidden. If confirmed, it is the first item for Phase 1: a correctness bug, not only performance.
- **Paused cost:** the baseline report ranks "while paused" (engine and HUD drawing every frame) separately, with the CPU and power it costs on the Gram on battery.
