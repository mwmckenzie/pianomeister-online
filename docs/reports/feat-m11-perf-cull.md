# Milestone 11 Phase 1a report: cull, render on demand, hidden tab

## Round 0: plan (2026-11-25)

- Wrote `docs/milestones/m11-phase1a-plan.md`. No app code changed. Device runs are postponed, as asked.
- Branched from `feat/m11-perf-measure`; Phase 0 isn't merged (my choice).
- How it was checked: the engine, the note layers and Three's attribute code were read. Nothing was prototyped or measured. No tests were run: only documents changed.
- Open questions: three, at the end of the plan.

**Review**

- [ ] Approve the plan or change it; answer the questions or take the defaults.

## Round 1: culling built, fast loop run (2026-11-25)

**Status: item 1 is built; the recorded fast loop did not pass (one pixel case), and the CPU cost per frame rose. Nothing about note-head detail was done.** Full validation, the Floor and the affected e2e tests have not been run.

### Built

- `NoteSpans` (which notes are in a tick window, with a running maximum of ends, padded by a bucket of 8) and `InstanceWindow` (geometries that share the song's buffers and start further in). Sustains, heads, ridges, black outline, note names, masks, glow twins and every loop repeat use them. `Engine` picks the window each frame after the uniforms.
- Margins: a beat and at least one bucket on both sides; labels also by how far they sit from their notes.
- Capture mode starts truly afresh (particles, key presses, held glow, tick rate). Test seams: `cull`, a broken near or far edge, counters.
- The rule for perf work (CLAUDE.md, `docs/performance.md`), `npm run perf:fast`, the `pixels` and `exact` projects, the `dense-short.mid` fixture. A benchmark cell on software WebGL is 10 frames (built; **not run yet**).

### Deviations from the plan

- One buffer per attribute, as before, instead of one interleaved buffer per layer. Same idea, smaller change.
- Buckets of 8 notes, not 16.
- The pixel test is the two-tier version you asked for. The long cases exist behind `PERF_FULL=1` and were not run in this form. They cover Canon only, at several views; dense chords and crossfades are in the fast loop.
- The comparison with the Phase 0 build's screenshots wasn't done. The uncut path in the same build stands in; its counts equal Phase 0's.

### Counters (Study)

| Position           | Triangles, Off         | Triangles, Medium      | Instances      | Draw calls, Medium |
| ------------------ | ---------------------- | ---------------------- | -------------- | ------------------ |
| Canon, bar 1       | 3,111,771 → 115,829    | 4,680,507 → 185,451    | 5,601 → 211    | 52 → 52            |
| Canon, bar 20      | 3,111,771 → 215,299    | 4,680,507 → 334,691    | 5,601 → 400    | 52 → 52            |
| Canon, bar 60      | 3,111,771 → 246,435    | 4,680,507 → 381,411    | 5,601 → 432    | 52 → 52            |
| Canon, bar 100     | 3,111,771 → 106,041    | 4,680,507 → 170,771    | 5,601 → 182    | 52 → 52            |
| long-demo, bar 4   | 24,757,681 → 1,450,721 | 37,160,015 → 2,187,935 | 38,832 → 2,400 | 53 → 53            |
| long-demo, bar 24  | 24,757,681 → 623,777   | 37,160,015 → 947,151   | 38,832 → 992   | 53 → 53            |
| long-demo, bar 100 | 24,757,681 → 311,713   | 37,160,015 → 478,911   | 38,832 → 456   | 53 → 44            |
| long-demo, bar 300 | 24,757,681 → 311,713   | 37,160,015 → 478,911   | 38,832 → 456   | 53 → 44            |

### Pixels

**Software WebGL:** two frames of Canon (Study, longest look-ahead): noise 0, culled 0; broken near 52,384 px, broken far 61,650 px. Exact, as required.

**GPU (RTX 4090, 640 × 360).** Each moment is drawn culled (the first frame there), then uncut once, then uncut three more times for the noise, without time passing. Tolerance: the noise's largest pixel count + 24, and the larger of its largest level and 1.

- **Same-frame noise without culling is not 1 level.** Seen over the repeats: up to 57 px, level usually 1–2, up to 6, once 30 (on 4 px). It is sporadic, and in some sessions there is none at all. Anti-aliasing is one source: earlier redraws with it off didn't differ (0 of 1,280). With it off, comparing separate runs still differed by single pixels, which is not a same-frame measurement.
- **Recorded fast loop: 6 of 7 GPU tests passed, 1 failed.** Crossfade, Study, first frame: culled 26 px, level 5, noise 26 px, level 1 (allowed: 50 px, level 1). I didn't loosen the rule.
- Three full repeats of the finished version before it passed 7 of 7. Earlier versions of the test had failures from my own mistakes (below).
- **Probe of the crossfade moments:** 60 uncut, 60 culled, again 60 and 60, at four positions: 0 px difference in all 960. So culling shows no steady difference there. It doesn't explain the failure, and the probe didn't repeat the failing condition (the first frame after a capture starts, against redraws without time passing). Noise from three redraws may be too small a sample. **Open.**
- **Can it fail?** Broken edges change 48,000–78,000 px at level 188–249 on the GPU: far outside the noise.

Mistakes found on the way: the "Canon" software runs reported in chat used the default song (408 notes), so that claim is withdrawn; the first broken near edge was hidden by the padding and the drones.

### Smoke benchmark (Study, Medium, 120 Hz, window in front)

Frame rate: 120 fps before and after everywhere, so frame time is limited by the screen. CPU is the engine's ms per frame.

| Cell             | CPU before (runs)      | CPU after (runs) | Change |
| ---------------- | ---------------------- | ---------------- | ------ |
| strong, normal   | 0.61, 0.65             | 0.64, 0.74       | +10 %  |
| strong, dense    | 0.52, 0.54             | 0.63, 0.68       | +23 %  |
| strong, idle     | 0.41, 0.44             | 0.47, 0.48       | +11 %  |
| weak-cpu, normal | 3.24, 3.33, 3.46, 3.15 | 3.60, 3.46, 3.40 | +6 %   |
| weak-cpu, dense  | 2.55, 2.50, 2.72, 2.34 | 3.88, 3.40, 3.34 | +40 %  |
| weak-cpu, idle   | 2.06, 2.06, 2.22, 1.72 | 2.61, 2.26, 2.11 | +15 %  |

- **The CPU cost rose in every cell.** About 0.1 ms on strong and 1 ms at 4× for dense. That is the CPU time on this PC only; I haven't traced it. A likely cause is the geometry swaps (new vertex setup each time the window moves a bucket, and dense music moves it often), but that is a guess.
- **GPU time is not comparable here:** it moved between 5.7 and 8.3 ms with no pattern, because the card changes its clock. Dense: 7.9 → 6.0–7.6 ms.
- Triangles in the benchmark: dense 37.1 M → 2.2 M, normal 4.7 M → 0.45 M.
- One weak-cpu "after" run (the second) is left out: HUD time doubled too and frame rate fell to 69–78, so something else was using the PC. Its file is kept. The other runs had dropped frames once each on dense (before: 116 and 114 fps; after: 118.8).
- The RTX 4090 isn't vertex-bound, so a big gain would only show on a weak GPU or the Floor. **No frame-time gain has been shown yet.**

### Checks

`npm run check`: exit 0, 965 unit tests. Fast loop: 2.1 min, with the one failure above. Builds pass.

### Process

A check on leftover browser processes (after I stopped the long run) was refused; I didn't look for another way and ended nothing. They ended by themselves.

### For you to decide

1. The CPU rise: trace and fix it before anything else? I recommend yes, before the PR and before any level-of-detail decision.
2. The GPU noise rule: keep it and treat a failure as a reason to look, or take more redraws for the noise (e.g. 20) so it is measured better? I recommend more redraws, and drawing the uncut first frame as well so the first frame is compared with a first frame.
3. The Floor: one smoke run at 10 frames a cell, now or at full validation? It is the only run here likely to show the gain.

**Review**

- [ ] Decide 1–3.
- [ ] Look at Canon and long-demo while playing, seeking and looping: no note appears or vanishes.

## Round 2: the CPU rise, sturdier noise, the Floor (2026-11-25)

**Status: the Floor gains 7.6× to 11.5×; the last fast loop passes in full; the CPU target is not reliably met.** Not run: the long pixel cases, the standard suite, the affected e2e tests.

### The cause, and the choice

Traced with a harness that plays the dense bars of long-demo in capture mode (600 frames a sample, the first 61 not counted), counting GL calls:

| Build                                           | Vertex arrays created per frame | Attribute setups per frame | Engine CPU at 4×, dense (that session) |
| ----------------------------------------------- | ------------------------------- | -------------------------- | -------------------------------------- |
| `main`                                          | not counted                     | not counted                | 1.9–2.25 ms                            |
| culling off (round 1)                           | 0                               | 0.1                        | 2.2–2.3 ms                             |
| round 1's culling                               | 1.0                             | 6.8                        | 3.1–3.2 ms                             |
| A: geometry per start bucket, count in place    | 0.5                             | 3.4                        | 1.69 ms                                |
| **B: one refilled geometry per layer** (chosen) | **0**                           | **0**                      | 1.67–1.76 ms                           |

Yes: each window change made three.js set up new vertex arrays. In linear playback every window is new, so caching alone can't help. A and B timed alike; B creates nothing and adds about 0.3 uploads a frame. A label change must be re-uploaded in the frame it happens (`refresh`).

A first attempt to trace B had in fact measured A (an edit script had failed); the GL counts gave it away. One run of A was void: something else was using the PC.

### CPU against the target (engine ms per frame, `main` with only the 10-frame cap → culled)

Round b3: four interleaved pairs, the final product code (the commit's own unit-test file was then fixed).

| Cell            | Before | After | Change | Runs overlap |
| --------------- | ------ | ----- | ------ | ------------ |
| strong, Canon   | 0.602  | 0.601 | 0 %    | yes          |
| strong, dense   | 0.497  | 0.568 | +14 %  | no           |
| strong, idle    | 0.402  | 0.409 | +2 %   | yes          |
| weak-cpu, Canon | 2.80   | 2.97  | +6 %   | no           |
| weak-cpu, dense | 2.16   | 2.62  | +21 %  | no           |
| weak-cpu, idle  | 1.62   | 1.81  | +11 %  | no           |

- **Round b2, three pairs, one commit earlier, disagrees:** dense −4 % (strong) and −16 % (weak-cpu), Canon +8 % and +7 %, idle +2 % and +6 %. Round 1 of strong's "before" is left out of that (HUD time doubled too). The same `main` build measured 2.85 ms on weak-cpu dense in b2 and 2.16 in b3: sessions differ by more than the effect.
- **The HUD, which didn't change, rose as well** in b3 (weak-cpu Canon 0.87 → 0.97, dense 0.76 → 0.81; idle −2 %), so part of the rise may be the machine. It doesn't explain the rest.
- **Harness, last commit:** +0.02–0.03 ms at 1× and about +0.33 ms at 4×, the same moving or standing still. A fixed cost per frame, not the refill. GL calls per frame equal those with culling off (0.3 more uploads while moving).
- **Profile of still frames at 4×, both builds:** 2.5 % more sampled time in total, spread thinly (`refresh` 11 ms of 3,800, three's `update` +31, its `getBindingState` +17; Vue functions differ as much). Mean frame times overlapped in that session (1.71–2.30 against 1.75–2.32 ms). **No cause found.**
- A last change, four comparisons instead of searches when nothing moved, didn't visibly lower it.

So: vertex setup is fixed; the target "at or below" holds for strong Canon and roughly strong idle, not for dense or weak-cpu in b3.

### The Floor (no GPU, 1280 × 720, CPU 4×, smoke at Off, about 10 frames a cell, two runs each)

| Cell      | Median before   | Median after | Faster |
| --------- | --------------- | ------------ | ------ |
| Canon     | 892, 900 ms     | 117, 117 ms  | 7.6×   |
| long-demo | 5,700, 5,750 ms | 500, 500 ms  | 11.5×  |
| idle      | 867, 883 ms     | 117, 117 ms  | 7.5×   |

No run locked to 1 s. The target is 33 ms: Canon is still 3.5× off, long-demo 15×. Late audio handovers: Canon 4 → 0 in both runs; dense 33 and 32 → 70 and 21 (the cell is much shorter now, so counts don't compare). With 11 frames percentiles are rough. Measured one commit before the last (`bb94413`).

This also answers part of Phase 0's open point: frame time falls with the triangles, so vertices were most of the Floor's cost. What is left (117 ms) isn't split yet.

### Pixels

- **Noise:** 20 redraws, each a fresh first frame (a fresh start, one frame at the position before, then this one), compared with another uncut first frame. Seen over the repeats of this version: up to 30 px, level usually 1–2, up to 5.
- **The stricter test caught a real bug in B:** labels reached the GPU one frame late after a jump (up to 22,000 px). Fixed. The two-frame software case didn't notice it, so it is a weaker guard than the GPU cases.
- **Can it fail?** Broken edges: 22,000–65,000 px at level 233 and above on the GPU; 15,299 and 9,109 px on software WebGL.
- **Runs after that fix:** six GPU runs: five pass 7 of 7. One failed (Canon, Study, 16 px, level 2, while 20 redraws showed no noise, so 1 level was allowed). Then 1,620 uncut and 1,620 culled first frames at nine Canon positions: 4 uncut and 1 culled differed from the reference, none by more than one level or 24 px. That points to rare noise, but level 2 wasn't reproduced.
- The **last fast loop** (final product code): 7 of 7, exact case exact, 1.1 min without the benchmark.

### Process

A commit (`an unchanged window costs four comparisons`) went in although `check` had failed on a lint rule in its test: my command didn't stop on it. Fixed in the next commit; `check` now passes (971 unit tests). Not pushed.

### For you to decide

1. **CPU:** accept it as it is, or give me one more session on it? I'd accept: at most 0.07 ms on strong and 0.5 ms at 4×, with triangles down 10 to 78 times. But it misses the target you set.
2. **Item 2 (no drawing while paused)** next, as planned? It removes the idle cost altogether.
3. **Note-head detail** is untouched, as you asked. The Floor's remaining 117 ms would need splitting first (pixels against vertices).

**Review**

- [ ] Decide 1 and 2.
- [ ] Look at Canon and long-demo while playing, seeking and looping: no note or label appears or vanishes.

## Round 3: nothing drawn at rest, the hidden tab, the Floor split (2026-11-25)

**Status: items 2 and 3 are built; the fast loop passes; the Floor split says note heads. No detail work was done.** Nothing pushed.

**CPU decision (item 1):** the rise is accepted. Sessions differ by more than the effect (round 2), so the target is neither shown to be met nor clearly missed.

### Item 2: draw nothing at rest

- The engine asks for a frame only while playing or while something moves (particles, held glow, keys and their pulses, note pulses, labels fading in, a position just changed), and once per change: settings, colours, seek, loop, song, seam, size, device-pixel ratio, font, late-loaded anti-aliasing, reduced motion, tab shown, WebGL context restored. The frozen scene (Home, editor) uses the same path.
- Waking has no time step. At rest, finished pulses are marked as long over, so a longer decay set later can't bring them back.
- The HUD runs while playing or while a listening look eases in; otherwise one step per transport event, song, settings or listening change.
- The benchmark forces drawing (its idle cell still measures a frame). The perf overlay shows "idle".
- `setPlaying` now follows the transport's event, not the HUD's next frame.

Cost per second (`--idle`, Canon, Medium/auto quality, two interleaved pairs, both runs shown; before = `cc96905`):

| State                    | strong before | strong after | CPU 4× before | CPU 4× after |
| ------------------------ | ------------- | ------------ | ------------- | ------------ |
| Paused, main thread      | 102, 83 ms    | 3, 3 ms      | 366, 326 ms   | 8, 6 ms      |
| Paused, GPU process      | 115, 64 %     | 0.7, 0.7 %   | 113, 63 %     | 0.3, 0.4 %   |
| Paused, renderer process | 14.9, 12.7 %  | 4.3, 3.5 %   | (throttled)   | (throttled)  |
| Home, main thread        | 49, 54 ms     | 2, 2 ms      | 100, 98 ms    | 4, 3 ms      |
| Playing, main thread     | 170, 143 ms   | 146, 142 ms  | 617, 591 ms   | 584, 597 ms  |

Paused is within 1 to 4 ms of Home. Home got cheaper too: the HUD's loop ran behind it. At 4× the throttle itself keeps the renderer process at 100 %, so that column says nothing. The browser process is at 1.3–1.7 % paused against 0.2–0.5 % on Home (not looked into).

### Item 3: hidden-tab playlist

- `ListeningController.advance()` (seams, next song, fade, end) runs after each scheduler tick (worker, 25 ms); `frame()` keeps the look's easing and the HUD clock.
- The expected-failure mark is gone and the test passes. **Its last step also had to change:** it waited for a position past the first song's end, but the timeline restarts at 0 once that song is over, so it could never have passed. It now waits for the second song alone on the timeline, playing on.
- Hidden is simulated in the test (no animation frames). **Not checked by hand in plain Chrome**, as the plan said.

### Tests

- New `e2e/idle.spec.ts`, five tests; run twice, 10 of 10. Hidden-tab test: passes. `visualPolish` paused-frame tests, unchanged: 3 of 3. `npm run check` passes: 974 unit tests (3 new).
- **Can they fail?** Six deliberate breaks, each caught: ticks not driving listening, engine never resting, HUD never resting, resting too early, stale timestamp kept (**first not caught**; the test now adds up the engine's time steps), seek not waking.
- The settled frame equals a frame drawn 1.5 s later, byte for byte (GPU, particles look).
- Fast loop, 2.2 min: pixels 7 of 7, exact case exact, smoke ran. Engine CPU this run (median, ms): strong 0.56 / 0.56 / 0.42 (Canon / dense / idle), weak-cpu 2.91 / 2.86 / 1.93.
- **Not tested:** device-pixel-ratio change, WebGL context restored, late-loaded anti-aliasing, a look change on its own (it takes the settings path), real hidden tabs.
- **Not run:** long pixel cases, standard suite, full Floor, affected e2e.

### The Floor split (smoke at Off, no GPU, 1280 × 720, CPU 4×, window in front, about 10 frames)

Mean frame time, three interleaved rounds (range of the three means):

| Variant                              | Canon          | dense      | idle       | Canon triangles |
| ------------------------------------ | -------------- | ---------- | ---------- | --------------- |
| As is                                | **116–117 ms** | 498–505 ms | 114–116 ms | 278 k           |
| (a) Render scale 50 % (640 × 360)    | **121–123 ms** | 547–548 ms | 111–115 ms | 278 k           |
| (b) Box heads                        | **40–42 ms**   | 79–82 ms   | 38–39 ms   | 17 k            |
| (a) and (b) together (not asked for) | 27–28 ms       | 55–57 ms   | 25 ms      | 17 k            |

- **Not pixel-bound:** a quarter of the pixels saves nothing (Canon 4 % slower).
- **Heads matter:** boxes take Canon 2.8× and dense 6.3× down. About 75 of Canon's 117 ms are the rounded heads.
- Once heads are boxes, pixels count: about 14 ms more on Canon at half scale. Target 33 ms: boxes alone miss it on Canon (about 41), and need a little more.
- Boxes are the floor of what detail can win; a cheaper rounded head lands in between. Off also draws the same heads as High today.
- How: no debug flag in the code. The app's own "rounded heads" setting off already swaps 972 triangles for 12; both variants were settings patched into the benchmark for the run, then restored.

### For you to decide

1. **Note-head detail:** the split says yes, it's the Floor's main cost. My recommendation is a cheaper rounded head (fewer bevel segments) with distance, after its own plan and a look at how visible it is.
2. **Pull request:** open one for Phase 1a now (after the full validation), or after head detail?

**Review**

- [ ] Pause during sparks and smoke: they finish, then nothing moves. Seek, change a look, resize and zoom while paused: the scene follows.
- [ ] Playlist with the tab hidden across a song's end, in plain Chrome.
- [ ] Decide 1 and 2.

## Round 4: full validation (2026-11-26)

**Status: full validation passes, after one test-time fix.** Run on `873922e` with the window in front; paused once while the PC was in use, then resumed.

| Step                                                      | Result                                                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                           | passes (974 unit tests), 18 s                                                                                               |
| `npm run test:e2e:affected` (chromium + polish)           | 161 passed, 3.7 min (the PC was in use for its last minutes)                                                                |
| Long pixel cases, GPU (`pixels`, `PERF_FULL=1`)           | 15 of 15, 1.1 min; culled 0 px everywhere; noise at most 12 px, level 2 (classic, steepest tilt)                            |
| Long pixel cases, software WebGL (`exact`, `PERF_FULL=1`) | 9 of 9 after the fix below; every case noise 0 px and culled 0 px; 1.4 h + 1.2 h                                            |
| Floor smoke, twice (no GPU, 1280 × 720, CPU 4×)           | Canon median 116.7 / 116.6 ms, dense 492 / 508 ms, idle 116.6 ms: the same as round 3's "as is"                             |
| Standard suite, strong (RTX 4090, 1600 × 900)             | 84 cells, all at the screen's rate (median 9.8–10.0 ms), worst dropped 0.2 %, no long tasks; engine median 0.60 ms          |
| Standard suite, weak-cpu (CPU 4×)                         | 84 cells, all at the screen's rate, worst dropped 2.2 %; engine median 2.10 ms (max 2.70); Phase 0 (`29ee97a`): 2.40 (3.70) |

**The fix:** four software-WebGL cases (both looks, flattest and steepest tilt, at the longest look-ahead) hit their 15-minute limit with no difference found; one had finished its comparison just as time ran out. These views cost seconds per frame on SwiftShader, and each of 15 frames is redrawn 20 times. The limit is now 60 minutes (`e2e/culling.spec.ts`); the four were rerun alone and passed, about 18 minutes each. No product code changed since round 3.

**Not done:** the Floor target (33 ms) is still missed (Canon 117 ms); note-head detail is next, on its own branch, plan first. Still not checked: device-pixel-ratio change, WebGL context restored, late-loaded anti-aliasing, a real hidden tab in plain Chrome.

**Review**

- [ ] The round 3 checklist (pause during sparks, playlist in a hidden tab in plain Chrome).
- [ ] The pull request.
