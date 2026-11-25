# Milestone 11 Phase 0 report: measure

## Round 0 — 2026-11-25: plan

**Done**

- Committed the brief; renumbered: performance is 11, "Tablet, MIDI out, offline" is 12, Benchmark mode is 11 Phase 0, "Parse MIDI once" is Phase 1 and "Make CI e2e workable" is Phase 5. The milestone numbers in the roadmap, the brief (decisions 33, 88), CLAUDE.md, two code comments and an `e2e.yml` comment follow. Older reports and specs keep their numbers.
- Wrote `docs/milestones/m11-plan.md` (answers to questions 1–6, the plan for the instruments). No app code changed, only two comments.

**How the answers were checked**

- The code was read. Draw calls were measured with a throwaway script outside the repo: production build, Chrome 158, RTX 4090, 1600 × 900, the transport state checked at each sample. A first run was discarded: it didn't check the state, and one quality reported a 1 px wide buffer, which didn't recur and wasn't explained.
- WebGL under `--disable-gpu` was checked with that script: SwiftShader, WebGL2 available, no GPU timer.
- Not measured: the audio block limits (read from the code), the hidden-tab playlist, the loop repeat's draw calls (milestone 9.2's numbers), and whether CPU throttling reaches SwiftShader. The plan says so for each.

**Decisions not in the instructions**

- Running the benchmark on the tablet through USB port forwarding and the production preview instead of `npm run dev -- --host` is proposed (plan Q1), not decided.

**Open questions**

- Seven, in plan §11.

**Checks**

- `npm run check`: exit 0, 933 unit tests (128 files). E2e not run: only two code comments changed.

**Review**

- [ ] Answer the questions in plan §11, or say "go" for the defaults.
- [ ] Approve the plan.

## Round 1 — 2026-11-25: instruments and the PC's baseline

Nothing was optimised. The baseline has the PC's runs only; the Gram, tablet and phone are **not measured yet**, so the order of Phases 1–4 is provisional.

### Built

- **Benchmark** (`#/bench`, About → Benchmark; `src/core/bench`, `src/ui/bench`, `BenchView.vue`): Smoke, Standard and Full suites, JSON download, history, compare.
- **`npm run bench:render`**: headless or real GPU, `--no-gpu`, `--throttle`, `--cores`, `--idle`, `--trace`, `--compare`; `bench-trace.mjs`, `bench-compare.mjs`, `measure-power.ps1`.
- **Perf overlay** (`?perf=1`, Ctrl+Alt+P), **GPU detection**, engine counters, unstored settings for the run.
- **CI** `bench` job, report only. `docs/performance.md`, brief decisions 130 and 131, CLAUDE.md, roadmap. `@bench` e2e tests; an expected-failure e2e test of the hidden-tab playlist.
- Summaries in `docs/perf/` (no raw frames).

### Deviations from the plan

- Traces use an unminified build instead of source maps. Cells last 5 s; two rounds only for normal and dense. An `idle` segment was added. The overlay's key can't be rebound. Start-up is three marks, no probe.
- Traces were taken on strong and weak-cpu only: none on the Floor. The 2-core Floor has smoke and idle only: its standard run passed the script's 60-minute limit and wasn't repeated.

### How far the runs can be trusted

| Run                           | Verdict                                                                                                                                                                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| strong (`404a505`)            | Steady, but at about 101 fps (screen rate measured as 9.6 ms), where the other runs had 120 Hz. Cause unknown. No cell fell below that rate, so it isn't the app's limit.                                                                                                         |
| strong, first run (`7270d6e`) | **Discarded.** From the sixth cell on, GPU time rose, to double in places (dense mostly 85–95 fps, worst 41). Not reproduced, cause unknown; no other benchmark run overlapped it. Its numbers (dense p95 8–20 ms, Inferno worst) are withdrawn.                                  |
| weak-cpu (`29ee97a`)          | Steady at 120 fps. It slows the page's main thread only and keeps the RTX 4090, so it says nothing about a weak GPU.                                                                                                                                                              |
| floor 4× (`29ee97a`)          | **Cells 8–51 and 73–83 of 84 are locked to multiples of 1008.3 ms**, which looks like Chrome's one-frame-a-second limit for a covered window or sleeping screen (not confirmed; the page never reported itself hidden). Left out below: 29 cells remain. The file keeps them all. |
| Floor, CPU throttle           | Doesn't reach software drawing: smoke on Canon is 917 ms with and without it.                                                                                                                                                                                                     |
| GPU ms, strong                | Dense cells ran at a steady 2805 MHz and compare with each other. In lighter cells the card lowered its clock (1635–2800 MHz): don't compare those.                                                                                                                               |
| Commits                       | The ids differ between runs, by docs and benchmark-script commits only (the first strong run also: same app code). The 2-core smoke was run with the affinity fix not yet committed.                                                                                              |

### Against the targets

| Tier                                | Result                                                                                                                     | Target                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Strong**                          | Screen rate held in every cell, p99 about 10.5 ms                                                                          | 60 fps, p99 < 20 ms: **met**              |
| **Weak CPU** (4×, strong GPU)       | 120 fps, p95 8.4 ms. Crossfade: longest frame 58–75 ms, long tasks 62–76 ms                                                | frame target met **here**; GPU not tested |
| **Floor** (no GPU, 1280 × 720)      | Valid cells: Canon 1.3–1.7 s a frame (0.9 s in smoke), Invention 0.8–0.9 s, long-demo 4.2–6.1 s. 2 cores: 2.3 s and 12.9 s | 33 ms: **missed**, by about 25× to 400×   |
| **Mainstream, Weak, tablet, phone** | not measured                                                                                                               |                                           |

- **Start-up** (first paint / song opened / samples loaded, ms): strong 660 / 623 / 2552; weak-cpu 1256 / 1491 / 4143; floor 1512 / 1918 / 6712.
- **Memory:** JS heap at most 81 MB (strong and weak-cpu), render targets about 157 MB (an estimate). Geometry buffers aren't counted. The 30-minute growth check isn't done.
- **Audio:** strong and weak-cpu: nothing late or missing. The smallest margin is 1.3 ms, in pause/resume only (one pause/resume cell each); elsewhere 52 ms or more. On the Floor most valid cells hand some notes over late (390, up to 60 ms), so scheduling 100 ms ahead doesn't survive frames of a second. Its "missing" counts and drift are **not reliable** at that frame rate.
- **Motion against the audio clock** (median of the cells' p95): 3.3 ms strong, 8.4 ms weak-cpu. That is up to a whole frame: the audio clock advances unevenly against the frames. Whether it can be seen isn't known. Phase 4.
- **Overlay's own cost** (headed, Canon playing, three on/off pairs): 16–38 ms of main thread per second, on 278.
- **Input-to-paint** (the Floor's 100 ms target) isn't measured.

### Where the time goes (10 s of Canon, Study)

|          | Main thread busy | script | style + layout | paint | GC    |
| -------- | ---------------- | ------ | -------------- | ----- | ----- |
| strong   | 16 %             | 9.5 %  | 2.1 %          | 2.3 % | 0.1 % |
| weak-cpu | 76 %             | 47 %   | 10 %           | 10 %  | 0.1 % |

GC isn't a problem. The GPU thread shows 95–99 % busy wall time, part of which is waiting for the display, so that isn't its load. Per frame at Study Medium: engine about 0.6 ms (2.3–3.6 at 4×), HUD 0.24 ms (0.8–1.1 at 4×).

### The 10 costliest things

| #   | What                                                                                                                     | Evidence                                                                                 | How sure   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------- |
| 1   | **The whole song drawn every frame**, bevelled heads, no culling: 4.7 M triangles (Canon), 37 M (long-demo, 25 M at Off) | counters; Floor frame time rises with it (1.7 M → 0.8 s, 4.7 M → 1.3 s, 25–37 M → 4–6 s) | high       |
| 2   | **Drawing while paused** (below)                                                                                         | idle runs                                                                                | high       |
| 3   | **Script per frame**                                                                                                     | 47 % of the main thread at 4×                                                            | high       |
| 4   | **Style, layout and paint** from the HUD, every frame                                                                    | 20 % of the main thread at 4×                                                            | high       |
| 5   | **4× MSAA**                                                                                                              | without it 5.1 ms against 8.5 ms GPU (−40 %); one cell, RTX 4090                         | medium     |
| 6   | **Glow** (Low and up)                                                                                                    | +1.0 ms GPU over Off (7.2 → 8.2) and +12 M triangles, dense                              | medium     |
| 7   | **Cages and pedal areas**                                                                                                | −0.9 ms GPU without them; one cell                                                       | low–medium |
| 8   | **Crossfade**                                                                                                            | long tasks 62–76 ms at 4×, 50 ms on strong                                               | high       |
| 9   | **Opening a song, loading samples**                                                                                      | 1.5 s and 4.1 s at 4×                                                                    | high       |
| 10  | **Note names, vignette, effects, pixel ratio**                                                                           | all within 0.5 ms of "everything": noise                                                 | low        |

Item 1 is the likely cause on the Floor, but the runs don't separate it from pixel cost. A culling test in Phase 2 settles it.

### Looks and fills (dense, Medium, RTX 4090, GPU ms)

Looks 7.8 (Mist) to 8.6 (Study); fills 8.8–9.0, Solid included. **No ranking can be drawn from this GPU:** the spread is about the noise. The Gram and the tablet decide.

### While paused (ranked by itself)

The engine and HUD draw every frame while paused. Main thread ms per second · GPU process, % of a core:

|                | playing     | paused          | Home (frozen) | blank page |
| -------------- | ----------- | --------------- | ------------- | ---------- |
| strong         | 199 · 84 %  | **114 · 74 %**  | 38 · 1.5 %    | 4 · 0 %    |
| weak-cpu       | 800 · 82 %  | **503 · 75 %**  | 169 · 1.5 %   | 10 · 0 %   |
| Floor, 2 cores | 989 · 183 % | **679 · 127 %** | 46 · 2.4 %    | 0 · 0 %    |

Paused costs 57–69 % of playing's main thread and 70–91 % of its GPU process. Home shows how little it could be. **First among the cheap wins.** Its CPU and power on the Gram on battery are **not measured yet**.

### Hidden tab

Confirmed in plain Chrome: hidden 13.5 s before a song's end, playback stops and stays stopped; hidden 5 s before, the next song plays. First Phase 1 item in the roadmap.

### Provisional order

1. **Phase 1:** hidden-tab playlist; draw nothing while paused; HUD at 10–15 Hz; song opening; protected-zone fixes; parse MIDI once.
2. **Phase 2:** cull to the visible window, plainer heads; then MSAA and glow by level.
3. **Phase 3:** levels. Minimal can't reach 30 fps on the Floor unless Phase 2 cuts its frame time 25-fold or more: be ready to change that target.
4. **Phase 4:** audio under long frames, crossfade long tasks, motion error.

The discarded run shows one run isn't enough: repeat before judging a change.

### Known issues

- `measure-power.ps1` has **never been run**: a command was refused by the permission check and I didn't work around it. Two other batch commands were refused, and I ran their steps separately without the parts that likely caused it.
- Nothing flags the Floor's 1 s lock clearly ("refresh rate changed" and "few frames" only).
- The bench page and its results haven't been looked at on a narrow screen. At 768 px the song picker's middle column is squashed (not new).
- Protected-zone items not seen on screen: small dialogs, tempo, loop and profile popovers, the panel's other menus, the overview strip.

### Checks

- `npm run check`: exit 0, 961 unit tests (129 files). The production build passes (run by the e2e command).
- `npm run test:e2e:affected`: 187 passed (chromium and polish projects, 4.1 min), one of them the hidden-tab test, marked as an expected failure. The full suite was not run.
- Looked at on screen: the benchmark page, the overlay, and the player with its windows at 1440 × 900, 1024 × 768 and 768 × 1024.

### Review

- [ ] Run the benchmark on the Gram (mains, then battery), the tablet and the phone, and send the JSON files.
- [ ] Run `measure-power.ps1` on the Gram on battery: playing, paused, Home, blank.
- [ ] Accept or change the provisional order once those are in.
