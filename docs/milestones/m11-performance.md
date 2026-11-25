# Milestone 11 — Performance on weak hardware

Added 2026-11-25. Follows 10.6. Branch per phase: `feat/m11-perf-<phase>`, from `main`.

> **Renumbering:** this becomes milestone 11. The old 11 (tablet, MIDI out, offline) becomes 12. The old 12 (Benchmark mode) is absorbed here as Phase 0, because nothing in this milestone can be judged without it. The parked items "Make CI e2e workable" and "Parse MIDI once" fold in too.

## Why

PianoMeister is a practice tool. It has to run smoothly on the laptop a student already owns, which is often:
- an old Intel integrated GPU;
- a Chromebook;
- a hand-me-down iPad;
- a PC with no working GPU driver at all, where the browser falls back to software rendering (SwiftShader, llvmpipe, Microsoft Basic Render Driver).

Today the app is built and tested on a capable desktop. The CI runs showed what happens without a GPU: software WebGL starved the main thread so badly that the e2e suite became unusable. That is roughly what a weak machine's user gets.

**Stutter in a practice app is worse than ugly.** Notes reach the keyboard late or unevenly, audio drifts from the picture, and the player loses trust in the timing. Smooth, steady timing comes first; visual richness second.

## Principles

1. **Measure first, then change.** Every phase starts and ends with the same benchmark, on the same reference machines, and the report shows before against after. No optimisation lands without a number that justifies it.
2. **Steady frames beat high frames.** A locked 30 fps feels better than a jittery 45–60. Judge by frame-time percentiles and dropped frames, not by average fps.
3. **Looks describe intent; quality decides what is drawn.** A look still says "Smoke fill, bloom on". On weak hardware the renderer may draw a cheaper equivalent, but it never rewrites the player's look, and it says when effects are reduced.
4. **Audio and timing never depend on the frame rate.** Sound is scheduled on the audio clock, ahead of time, and is not affected by a slow frame.
5. **Do no work when nothing changes.** A paused, idle or hidden player draws nothing.
6. **Every new setting has a reset**, an "Auto" default, and no surprises: quality never changes visibly in the middle of a phrase.

## Targets

Reference machines. The plan must confirm which real devices stand in for each tier; emulation is allowed for the CI floor.

| Tier | Example | Target while playing a dense song (Canon in D, long-demo) |
|---|---|---|
| **Strong** | desktop with a discrete GPU | 60 fps, p99 frame time < 20 ms, all effects |
| **Mainstream** | 2019+ laptop, Intel Iris / UHD 620, Apple M1 | 60 fps at the default quality, p95 < 17 ms |
| **Weak** | 2015–2018 laptop, Intel HD 520 / 4000-class, 4 GB RAM; iPad 6th gen; mid Chromebook | steady 30 fps or better at the automatic quality, p95 < 34 ms, < 1 % dropped frames |
| **Floor** | no GPU: Chrome with `--disable-gpu` or SwiftShader, CPU throttled 4× in DevTools | steady 30 fps at Minimal, at 1280×720, and the UI stays responsive (input-to-paint < 100 ms) |

Further targets:

- **Audio:** no audible glitch or drift on any tier while drawing at the tier's target.
- **Start-up:** first interaction (Home visible and usable) under 3 s on Weak, without waiting for sound samples. Opening a song from the Library under 1 s on Weak, sound samples excepted.
- **Memory:** under 400 MB of JavaScript heap plus GPU memory on Weak with long-demo loaded. No growth over a 30-minute listening session.

## Phase 0 — Measure (benchmark mode)

Build the instruments first. Nothing else starts until this phase is reviewed.

1. **Benchmark mode** (`#/bench`, also `npm run bench:render` headless):
   - Plays a fixed scenario: a fixed seed, fixed songs (Canon, Invention, long-demo), a fixed camera, the loop region, a crossfade, and a pause and resume.
   - Runs it under each built-in look and each quality level.
   - Records frame times (from `requestAnimationFrame` timestamps and, where available, `PerformanceObserver` long tasks and `long-animation-frame`), draw calls, triangles, programs, textures and geometries (`renderer.info`), JS heap, and audio-clock drift (scheduled against actual note start).
   - Outputs a JSON result plus a readable summary: median, p95 and p99 frame time, % of frames over budget, longest stall, draw calls, and heap at the start and end.
   - Results are stored locally and can be compared: "this run against the last run" and "against main".
2. **Perf overlay:** a toggle (`?perf=1` or a hidden key) showing fps, a frame-time graph, draw calls, the quality level and the GPU string.
3. **GPU detection:** read `WEBGL_debug_renderer_info` where allowed, and classify software renderers (SwiftShader, llvmpipe, Basic Render, "Google SwiftShader" under ANGLE) and known weak integrated GPUs. Also record `hardwareConcurrency`, `deviceMemory`, the screen size × device pixel ratio, and whether WebGL2 is available.
4. **A baseline report** on every reference tier, including the Floor emulation:
   - where the time goes (main-thread JS, GPU, layout and style, garbage collection), from a Chrome performance trace of 10 s of playback;
   - the 10 most expensive things, ranked;
   - which looks and fills cost the most.

   **This report decides the order of Phases 1–4.** The lists below are the likely suspects, not a fixed plan.
5. **CI:** one headless benchmark run per PR on the GPU-less runner, at Minimal, compared against main. Report only, not gating, until the numbers are steady.

How to emulate the Floor locally (put this in the docs):

```powershell
# Chrome without a GPU
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-gpu --user-data-dir="$env:TEMP\pm-nogpu" http://localhost:5173
# then DevTools → Performance → CPU: 4× slowdown
```

## Phase 1 — Stop wasted work (cheap wins, every tier)

Likely suspects to audit and fix:

- **Render on demand:** draw only while playing, scrolling, animating or editing. Paused and idle means no frames (keep one redraw on change). A hidden tab or a Settings page covering the playfield means no frames.
- **Frame pacing:** an optional cap at 30 fps, frame-aligned and steady, not `setTimeout` jitter. Interpolate positions from the transport time, so motion stays smooth at 30.
- **Device pixel ratio:** cap the render scale (Auto: at most 1.5 on Mainstream, 1.0 on Weak and below). The UI stays crisp, because it's HTML; only the WebGL canvas scales.
- **Vue and reactivity:** check that Three.js objects are `markRaw` and that nothing reactive is touched per frame. HUD, timeline and counters update at 10–15 Hz, not every frame. No deep watchers on note arrays.
- **Allocations per frame:** no new vectors, matrices, arrays or closures in the render loop, so garbage collection doesn't stall. Check with the allocation timeline.
- **Layout thrash:** no DOM reads after writes in the frame loop (label positions, HUD measurements).
- **Startup:**
  - lazy-load routes (Review hands, Stats, the loop editor, Settings);
  - load sound samples after first paint;
  - open Dexie without blocking the first render;
  - code-split Three.js add-ons used only by some fills.
- **Parse MIDI once** (roadmap item): drop the second parse with @tonejs/midi.

Exit: the benchmark shows the paused and idle CPU near zero, and fewer dropped frames on Weak. Report before and after.

## Phase 2 — Draw less, more cheaply (the renderer)

Audit first, then likely changes:

- **Draw calls:**
  - notes, sustains, heads and glow twins as instanced meshes, or merged per layer, with per-instance colour and loop dimming as attributes;
  - one draw per layer instead of one per note or per loop repeat. The loop repeats and the "Next repeat" ghosts are known multipliers;
  - keyboard keys as one instanced mesh.
- **Culling:** build or upload only the notes inside the visible time window plus a margin, sliding forward with the transport. No per-frame work for notes off screen.
- **Bloom and post-processing:** the selective bloom with GlowTwin is likely the biggest GPU cost on weak GPUs. Options:
  - half- or quarter-resolution bloom with fewer mip levels;
  - a cheap fake glow (an additive sprite or soft quad per note) in lower tiers;
  - none at Minimal.
- **Fill shaders:** give each expensive fill (Smoke, Crystal, Bubbles, Liquid, Neon, Hot core) a **cheap fallback** that keeps its look in spirit:
  - Smoke → Gradient with a soft edge;
  - Bubbles → Gradient with a few static dots;
  - Liquid → Gradient with a moving highlight;
  - Crystal → Gradient with a facet texture.

  Precompile programs at load (`renderer.compile`), so the first appearance of a fill doesn't stutter.
- **Stencil and passes:** the CageLayer, NoteMask and label overlay each add passes. Measure them; merge where possible. Drop the stencil at Minimal and draw cages as plain translucent quads behind the notes.
- **Labels:** render note names from one pre-built atlas (SDF or bitmap) as instanced quads, not one texture or one DOM element per label.
- **Overdraw:** check translucent layers stacked over the whole highway (backgrounds, vignettes, fog). Prefer one composited background.
- **Context loss:** handle `webglcontextlost` and `webglcontextrestored`, and recover without a reload. Weak GPUs lose context more often.
- **WebGL1 fallback** only if Phase 0 finds real target devices without WebGL2. Otherwise WebGL2 only.

Exit: the draw calls and GPU frame time on the benchmark scenario are well down on Weak and Floor; numbers in the report.

## Phase 3 — Quality levels and the automatic governor

**Levels.** Names to confirm in the plan. Each lower level adds to the cuts above it.

| Level | What changes |
|---|---|
| **Ultra** | everything, full-resolution bloom, render scale up to the device pixel ratio |
| **High** | half-resolution bloom, render scale ≤ 1.5 |
| **Balanced** | quarter-resolution bloom, cheap fallbacks for the heaviest fills (Smoke, Liquid, Crystal, Bubbles), render scale ≤ 1.25 |
| **Lite** | fake glow instead of bloom, all fills use fallbacks, no shadows or reflections, render scale 1.0, 30 fps cap |
| **Minimal** | no glow, solid and gradient fills only, cages as plain quads, render scale 0.75–1.0, 30 fps cap, reduced camera motion |

**Auto (the default):**

- **Starting level:** from GPU detection and a 2-second probe on first start. The probe renders the benchmark scene off screen while Home is shown. A software renderer starts at Minimal, and a known weak integrated GPU at Lite.
  - The result is stored per device (local storage, not synced in backups), and the probe runs again after a browser update changes the GPU string.
- **Runtime governor:**
  - watches the rolling p90 frame time over 3 s of playback;
  - after sustained misses (p90 over budget for 3 s), steps down one level, at the next pause, loop restart, song change or crossfade seam, and never in the middle of a phrase;
  - steps back up only after 30 s comfortably under budget, and only when stopped;
  - never steps more than one level at a time, and never above the player's setting.
- **When effects are reduced,** a small, unobtrusive indicator appears in the HUD ("Effects reduced for smooth playback"). Clicking it opens the setting. It shows once per session, not every time.

**Settings** (new group "Performance", Settings → Appearance or its own tab; all app settings per device, each with reset):

| Key | Label | Default | Options |
|---|---|---|---|
| `perf.quality` | Graphics quality | Auto | Auto, Ultra, High, Balanced, Lite, Minimal |
| `perf.frameCap` | Frame rate | Auto | Auto, 60, 30 |
| `perf.renderScale` | Render resolution | Auto | Auto, 100 %, 75 %, 50 % |
| `perf.autoAdjust` | Lower quality automatically when playback stutters | on | on/off |
| `perf.reduceMotion` | Reduce motion | follows the system | on/off |

Looks are untouched. A look editor preview shows the look at the current quality, with a note when the look's effects are reduced at this level.

Exit: on each reference tier, Auto lands on a level that meets that tier's target in the benchmark, and the governor never flaps (no more than one change per song in the benchmark scenario).

## Phase 4 — Timing safety under load

- **Audio is scheduled ahead of time** on the audio clock. A long frame must never delay a note. Measure drift in the benchmark with the main thread deliberately blocked (a 200 ms busy loop every 2 s) and confirm notes still sound on time.
- **The visual position comes from the audio clock** each frame, not from accumulated frame deltas, so a dropped frame skips ahead instead of lagging behind.
- **Heavy work off the main thread:** detection is already in a worker. Move song preparation too (`buildTimeline`, cage computation, bar maps) if Phase 0 shows it blocking the song open on Weak.
- **Long tasks over 50 ms during playback:** none, apart from GC, which should be rare after Phase 1. Song changes in a playlist must not stall the crossfade.

Exit: the blocked-main-thread test shows no audible timing error; no long tasks during playback in the benchmark on Weak.

## Phase 5 — CI and regression guard

- With Minimal and render on demand, the e2e suite should run on the GPU-less CI runners again. Revisit the parked "Make CI e2e workable" item: `workers: 1` if still needed, Minimal forced via a test flag, browser cache.
- **A performance budget check** in CI: the headless benchmark at Minimal on the runner, against a stored baseline with a tolerance (for example 15 % on p95 frame time and draw calls). Report only first, then gating once steady.
- **Documentation:** a "Performance" section in CLAUDE.md, covering how to run the benchmark, the budgets, the rule that new visual features need a fallback per quality level, and the instruction to run the benchmark before and after any renderer change.

## Out of scope

- A native rebuild, or a switch to WebGPU. WebGPU can be evaluated later as a High/Ultra renderer once support on older devices is broad. This milestone makes WebGL2 fast.
- A Canvas 2D renderer. Considered: Minimal on WebGL2 is expected to beat it, even under SwiftShader. Revisit only if Phase 0 says otherwise.
- New visual features.

## Deliverables per phase

Each phase is its own PR, with:
- its benchmark before and after on the reference tiers;
- a short report section (what changed, the numbers, what's left);
- manual checks for the player on a weak machine (the Floor emulation counts).

## Questions for the plan (Phase 0)

1. Which real devices are available for Mainstream and Weak? (Matt to list what he has; the Floor is emulated.)
2. What does the current render loop look like: one `requestAnimationFrame`, continuous rendering, the passes per frame?
3. The draw-call count for Canon in D at the Study look today, playing and paused.
4. Is audio already scheduled ahead of time on the audio clock everywhere, including the crossfade and loop repeat?
5. Which settings already exist that overlap (frame rate, look-ahead, effects toggles), and how do they map onto the quality levels?
6. Any feature whose cost can't be reduced without changing how it looks? List it, with options.
