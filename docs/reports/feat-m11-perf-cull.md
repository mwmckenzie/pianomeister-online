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
