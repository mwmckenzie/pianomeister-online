# Review report — `feat/m9-visual-polish` (Milestone 9: Visual polish)

Spec: `docs/milestones/m9.md`. Plan and answers: `docs/milestones/m9-plan.md` (approved 2026-11-21, §9). Commits are local only (not pushed), as agreed.

## 2026-11-21 — Round 1: built, before the tuning session

### What was done

**Docs** — `docs/brief.md`: decisions 13, 19, 22, 39, 43, 47, 48, 50, 52, 54 extended; new 108–121 (process, selective bloom, quality presets, lines, fills, note light, names, cage renderer, pedal cage, now-line effects, key light, animation clock, settings v6, looks). The "Key and note visual behavior" effects section rewritten. `docs/roadmap.md`: 8 ✅, 9 in progress. `docs/milestones/m9-plan.md`: the approved plan.

**Core**

- Settings **v6** (`src/core/settings/`): sections `lines`, `noteStyle`, `names`, `pedal`, plus new keys in `highway` (vignette), `effects` (5 onset effects × size/count/lifetime/spread, sustain effect + knobs, pulse, sounding glow, breathing, key spill, key cone) and `render` (quality, bloom resolution, particle budget, shader detail, bloom strength/radius/threshold) — 89 new settings (66 → 153; the pedal band's two moved into the pedal cage). Registry `group` (sidebar subheadings) and `tabletDefault`; unit `ms`.
- Migration v5 → v6: the pedal band's colour and opacity become the pedal cage's fill; everything else keeps its key. `loadShortcuts` now accepts v5 and later — without that, bumping the version would have dropped everyone's shortcut overrides.
- **Device defaults** (`DeviceClass`, `defaultSettings(device)`, `defaultValue`, device-aware `isDefaultValue` / `changedCount` / `resetGroup`). The stored settings record `deviceClass` the first time; reset and "changed" use it.
- **Quality presets** (`QUALITY_PRESETS`, `applyQualityPreset`, `isQualityModified`): choosing a preset — by any path (row, reset icon, section reset) — writes its cost settings in `withSetting`.
- **Looks** (`src/core/looks/`): `LOOK_KEYS` (appearance only), `BUILT_IN_LOOKS` (Classic = the milestone 8 values, frozen), `captureLook`, `applyLook` (+ Undo values), `isLookModified`, `readLooks` (validated like stored settings), `nextLookName`.
- `noteLabel` (letter + ♯/♭, octave on C or on all).

**Engine**

- `RenderPipeline`: selective bloom — `SelectiveBloomPass` draws layer 1 (glow twins) into a half-float target at ¼ / ½ / full of the buffer, blurs it with three's `UnrealBloomPass`; `createMixPass` adds **only the blur** plus the vignette. No composer at all when nothing needs post-processing (Off + Classic = the m8 chain). `GpuTimer` (EXT_disjoint_timer_query_webgl2). `RenderInfo` gains bloom size/state and GPU ms.
- `GlowTwin`: a mesh's copy on the glow layer — same geometry and uniform objects, `#define GLOW_PASS`; emitters additive, occluders (keys, 3D heads) opaque with depth; instanced meshes share instance matrices.
- Clock uniforms: `uTime` (animation clock), `uTicksPerSecond` (measured, `songClock`), `uJumpTick`, `uReducedMotion`; `animTime()` in GLSL.
- `Highway`: lane lines split by boundary kind (`laneBoundaries`); borders and B/C (+E/F) octave lines as glowing lines; bar/beat glow; `NowLine` (thin = the m8 quad exactly, glowing, neon; colour White/Primary/Secondary/Custom/Pitch via an 1040-texel key-colour texture).
- Notes: `NOTE_FILL_GLSL` (solid, gradient, hot core, glass, neon, stripes, smoke; edge rim at constant world width; pulse; sounding glow), shared by `SustainLayer` (incl. flat heads) and `HeadLayer` (rim on block edges, no rim at the now-line cut); `noteGeometry` gains `aVelocity`; `NoteStyleUniforms` shared by all layers.
- `CageLayer` + `cageQuads` + `CageRegion`: tick × key-range regions, rounded borders in world units, fills from the same GLSL, open ends for joined regions, `setRegions()` for milestone 10. Replaces `PedalBands`.
- Particles: `ParticleSystem` (instanced quads, closed-form motion with drag and gravity, size curve, stretch, partial uploads), `ParticleRing`, `PARTICLE_KINDS`, `particleSpawns` (sparks keep the m8 numbers at factor 1), `NowLineEffects` (onsets, sustain rates, smoke pool), `HeldGlow` (the m8 glow). Replaces `Effects`.
- `Keyboard`: pulse on the overlay, glowing overlays on the glow layer, light spill from an 88×2 float light texture (taps by shader detail), light cones, names on the key tops; `NoteLabelAtlas`, `NoteNameLayer` (labels on the sustain behind the head, ≥ 10 CSS px).
- `Engine`: wires all of it; `setReducedMotion`, `setFixedAnimationTime`.

**UI**

- `LookPicker.vue` at the top of the playfield sidebar: pick (applies all, Undo toast), "Classic · modified", Save (saved looks only), Save as new… / Save current look… (inline name), Delete (Undo).
- `PlayfieldSidebar.vue`: sections Camera, Keyboard, Highway, **Lines & glow**, Notes, **Note style**, Effects, **Pedal & cages**, **Note names**, Render quality; subheadings from the registry; "Medium · modified" under Quality.
- `RenderReadout.vue`: bloom size (or "unavailable on this device") and GPU ms.
- `useReducedMotion` (setting + system, live) → engine; `?animTime=` pins the animation clock.
- `SettingRow` / `ToggleField`: toggles and selects honour a setting's `enabled()` (greyed out key light below the needed detail, bloom settings with bloom off).

### Decisions I made that weren't in the instructions

1. **Bloom adds only the halo.** three's selective-bloom example adds the glow layer itself too; that would double additive particles and change Classic with bloom running. Emissive elements keep their own brightness from the main pass.
2. **Lane, bar and beat colours keep their keys** and "Now-line effects" stays the effects' master switch, so v5 → v6 migrates only the pedal (simpler than the plan's mapping; brief 120 updated).
3. **Effect knobs per effect**, as m9.md asks ("Each: size, count, lifetime, spread") — 20 sliders for onsets, shown only while that effect is on; one set for the sustain effect.
4. **Smoke has its own pool** (a quarter of the budget): it blends normally and must not bloom; everything else shares the budget's ring.
5. **Shader detail gates key light**: Minimal = no spill, cones need Medium or High (the switches are greyed out otherwise).
6. **Note labels are elongated** along the note (2× the lane width, road-marking style); sized to the lane they were ~4 px tall at 45° and never passed the 10 px rule. Key-top labels are 0.9 × the key width and slightly elongated too.
7. **Delete a saved look** (with Undo) — m9.md had no way to remove one.
8. **Classic is frozen in code** (`BUILT_IN_LOOKS`), not derived from defaults, so tuning the defaults can't change it.
9. The **long demo** gained a dense opening (bars 1–24: ten-note chords per sixteenth, pedal down); 12,688 notes now. The m8 overview perf test reads the new count.
10. Under **reduced motion** the held glow is steady (it pulsed with a sine before).

### Results

- `npm run check`: pass (626 unit tests, 90 files). `npm run build`: pass.
- **"Off = today"**: the milestone 8 build (`main`, built in a temporary worktree) and this branch with Classic + Off, same paused frame, canvas only — **pixel-identical** for the Minuet and the Pedal demo at 1280×720 and 1024×768 (headless Chromium; now-line effects off on both sides because the m8 held glow pulses with wall-clock time).
- **E2e**, full suite on the preview, `--retries=0`: **159/159** on the third run. New: `e2e/visualPolish.spec.ts` (12 tests: every control of the six new or extended sidebar sections worked once without console errors, scene changes, presets and "modified", looks, note names, full vs reduced motion). Two settings tests now expect v6. The two earlier full runs each had unrelated timing failures under parallel load (run 1: bookmark toast, list keys, Loop editor menu item; run 2: a shortcut tooltip, the count-in HUD) — different tests each time, each passing 3/3 alone; the same load flakiness as m8's known issue 2. Bloom now runs by default (Medium), which adds software-rendering work in headless runs.
- **Visual** (`m9 ` block, headed, `test-results/visual/m9-*.png`): **30/30** — at 1280×720: `classic-off`, `defaults`, `effects-off`, `fill-{solid,gradient,hotCore,glass,neon,stripes,smoke}`, `now-{thin,glowing,neon}`, `now-neon-pitch`, `lines-octaves-borders`, `pedal-{default,border-stripes,smoke}`, `names-{notes,keys,both}`, `key-light`, `quality-{off,low,medium,high}`; at 1024×768: `defaults`, `now-neon-pitch`, `names-both`, `quality-high`. Frame: Pedal demo paused on bar 2 (chord sounding, pedal down), `?animTime=3`.
- **Perf** (`npm run test:perf` project, headed Chromium, RTX 4090 at 120 Hz, 1600×900; 10 s of playback each; engine CPU per frame, frame interval, GPU time from the timer query):

  | Run                                      | Off     | Low     | Medium  | High    |
  | ---------------------------------------- | ------- | ------- | ------- | ------- |
  | Canon, default look — CPU / frame        | 0.37 ms | 0.49 ms | 0.47 ms | 0.46 ms |
  | Canon — frame interval                   | 8.33 ms | 8.33 ms | 8.33 ms | 8.33 ms |
  | Canon — GPU                              | 3.00 ms | 3.95 ms | 3.94 ms | 3.91 ms |
  | Dense chords + stress look — CPU / frame | 0.36 ms | 0.48 ms | 0.47 ms | 0.47 ms |
  | Dense chords — frame interval            | 8.33 ms | 8.33 ms | 8.33 ms | 8.33 ms |
  | Dense chords — GPU                       | 4.88 ms | 3.05 ms | 3.10 ms | 4.42 ms |

  Dense chords = the long demo's new opening (ten-note chords on every sixteenth, pedal down) with every onset effect, embers, pulse, sounding glow, spill and cones. m8 reference: Canon 0.27–0.34 ms CPU.
  - **Against the plan's budget:** no dropped frames at any preset, High included (✓). High CPU ≤ 1.0 ms (✓, 0.47). Off: +0.03–0.1 ms over m8 (✓). **Low: +0.15–0.2 ms over m8 — over the "+0.1 ms" budget**; the cost is the glow pass's second scene traversal and the twins' per-frame sync, the same for Low, Medium and High (resolution only changes GPU work).
  - **GPU times aren't a clean cost comparison here:** the card clocks down under light load, so the cheapest runs can read slowest (dense Off 4.9 ms vs Low 3.1 ms). Within each song the bloom presets cost about +0.9 ms over Off on Canon. A fixed-clock or tablet measurement is needed for real numbers (milestone 11).
  - The m8 overview perf test (strip closed, long demo) now reads 0.75 ms CPU per frame: more notes (12,688) and the Medium defaults.

### Known issues and open questions

1. **Defaults are provisional** — tuning session next (glow amounts, line widths, dark colours, built-in looks 2–5).
2. **iPad**: the perf budget is measured on an RTX 4090. Low and Medium must be checked on a real iPad (milestone 11 at the latest); half-float render targets are needed for bloom there (the readout says "bloom unavailable" if not).
3. Headless (software) Chromium logs "GPU stall due to ReadPixels" driver _warnings_ with bloom on; no errors, not seen headed.
4. The **pulse** converts ticks to seconds with the measured playback rate; while paused a pulse holds its look (frozen mid-flash) — fine for screenshots, worth a look in the session.
5. Note labels on notes are only readable near the keyboard at the default look-ahead (8); lower look-ahead or zoom shows more.
6. A disabled toggle/select doesn't say _why_ (it's greyed out). A hint ("needs shader detail Medium") could follow.
7. **Low is ~0.1 ms of CPU per frame over its budget** (see Perf). Options: accept it (0.5 ms of an 8.3 ms frame), or cut the glow pass's CPU cost — draw the twins from their own small scene instead of traversing the whole scene with a layer mask, and sync twins only when settings change. Your call.

### Manual review checklist

- [ ] Look picker: Classic, then tweak → "Classic · modified"; Save as new…; reload; Delete + Undo.
- [ ] Render quality: Off / Low / Medium / High — readout (bloom size, GPU ms); tweak the budget → "· modified".
- [ ] Lines & glow: neon now line in Pitch colour; borders and octave lines (with E/F) glowing.
- [ ] Note style: every fill on heads and sustains (3D heads on and off); edge glow width/intensity.
- [ ] Effects while playing: each onset effect, each sustain effect, pulse, sounding glow (+ breathing), key spill and cones (Medium/High).
- [ ] Pedal & cages on the Pedal demo: fills, border, glow, corner rounding.
- [ ] Note names: notes / keys / both, sharps/flats, octave on C vs all.
- [ ] Motion → Reduced: no flicker/drift/smoke motion, onsets become still flashes.
- [ ] 1024×768 and the Ember theme (primary/secondary line colours follow the menu colours).

## 2026-11-21 — Round 2: your six items

### What was done

1. **Low's CPU cost** (`fdd0c92`, `f0d74cf`)
   - Glow twins now live in a **small glow scene of their own** (`Engine.glowScene`). The bloom pass draws only that scene; there's no second walk of the main scene with a layer mask, and `GLOW_LAYER` is gone.
   - Twins copy their source's world matrix, visibility (ancestors included), order, depth state and geometry **only when settings, the song or the pass chain change** (`Engine.syncGlow`). A per-frame boolean check catches the FXAA/SMAA chain arriving asynchronously. Per-frame changes still reach the twins through what they share: uniforms, the keys' instance matrices, and particle buffers.
   - That alone doesn't separate Low from High: with the same draw calls, their CPU work differs only in GPU-side resolution. So the bloom blur is now `BloomChain` (UnrealBloomPass's blur, re-implemented), whose **mip count follows bloom resolution**: 5 mips at full, 4 at ½, 3 at ¼.
     - The dropped mips are the sharpest ones. A ½-size glow target's first mip has the same on-screen size as full's second, so **every preset blurs at the same on-screen scales**.
     - High is **pixel-identical** to Round 1 (checked: 1 pixel off by 1/255 at 1024×768). Medium and Low lose only the widest, faintest haze they used to have.
     - Low runs 4 fewer full-screen passes than High, Medium 2 fewer. The unused blend back onto the glow target is gone at every preset.
   - New: **draw calls per frame** in `RenderInfo` and the settings readout. They're exact, unlike timings near the browser's ~0.1 ms timer resolution.
2. **Paused frames settle** (`72afdaf`)
   - `Engine.setPlaying()` comes from the player's transport state.
   - While paused:
     - note pulses keep fading in wall-clock time (`uPausedFor`), and key pulses already did;
     - particles in flight finish on the wall clock;
     - looping animation stops: it now runs on `uLoopTime`, which advances only while playing (flicker, smoke, stripe drift, breathing, the held glow's pulse);
     - held keys stop spawning sustain particles.
   - Then the frame holds still: an e2e test checks two frames 0.5 s apart, 3 s after pausing, are byte-identical.
   - **Seeking while paused never starts a pulse:** `songClock` treats any move while not playing as a jump. On resume, notes up to the paused position don't pulse again.
   - `?animTime=` pins both clocks and shows paused pulses as already settled, so the visual shots stay deterministic.
3. **Disabled controls say why** (`2087e1f`)
   - Registry entries with `enabled()` carry a `disabledHint`, shown under the greyed-out control: "Needs shader detail Low or higher" (key spill), "Needs shader detail Medium or High" (cones), "Needs bloom (quality Low or higher)" (bloom strength, radius, threshold), and "Needs “Hide controls when idle”" (the idle delay).
   - A registry unit test requires a hint wherever there's a rule.
4. **Long demo:** already test-only (`test-fixtures/midi/`, uploaded by the perf tests; the bundled songs are in `public/songs/`), so left as is.
5. **E2e at quality Off** (`427e00a`)
   - The functional Playwright project starts with stored settings at render quality Off, via `storageState` in `playwright.config.ts`. This is a test fixture only; app defaults are unchanged.
   - `visualPolish.spec.ts` moved to its own `polish` project at the default quality. The visual shots and perf runs seed their own settings.
   - The two migration tests that seed old stored settings opt out with `EMPTY_STORAGE`.
6. **Copy look** (`3fad576`)
   - The picker has a "Copy look" button. It writes the current look to the clipboard in the `.pmlook.json` format from `m9-1.md` §A: `{format: "pianomeister-look", version: 6, looks: [{id, name, createdAt, settings}]}`, with settings nested by section like stored settings.
   - Core: `LookFile`, `LookFileEntry`, `toLookFile` (+ spec).
   - An unchanged look keeps its id and name. A changed one, or none picked, gets a new UUID and "⟨Name⟩ (modified)" / "My look", so pasting it later can't clash with the original.

Docs: brief decisions 109, 110, 113, 119 and 121 updated; `docs/milestones/m9-1.md` committed as written.

### Decisions I made that weren't in the instructions

1. **Bloom mips follow bloom resolution** (above). It was the one honest way to make Low cheaper on the CPU than High: everything else they draw is the same. It also makes the halo's reach the same at every preset. Before, ¼ resolution reached further than full.
2. **The loop clock stops while paused**, along with the pulses settling. "The frame holds still" needs flicker, smoke and breathing to stop too; they resume where they were.
3. **`createdAt` in a copied look is the copy time.** Looks don't store a creation time yet (milestone 9.1 adds it).
4. **Frame comparisons that only check "nothing animates"** (reduced motion, seek while paused) allow a 1/255 difference. Keys still easing into their pressed state change the odd pixel by one level for about 1.5 s; a pulse or flicker changes whole notes. "Settles, then holds still" stays an exact comparison.
5. **No sub-bar seek exists in the UI** (bar steps are ≥ 3 quarter notes in our songs, which were already jumps). So the e2e seek test checks the end-to-end path, and the new rule is covered by the `songClock` unit test.

### Results

- `npm run check`: pass (631 unit tests). `npm run build`: pass.
- **E2e**, full functional suite (`chromium` + `polish` projects), production preview, `--retries=0`: **162/162**.
  - An earlier run of this round had 161/162: the reduced-motion exact-frame test failed on 1/255 pixels (decision 4 above).
  - One run had 136 failures, all `ERR_CONNECTION_REFUSED`. The stale preview server I was reusing died mid-run; re-run with Playwright's own server.
- **Visual** (`m9` block, headed): **30/30**. Pixel comparison with the Round 1 build:
  - High (1280×720) is identical, and High at 1024×768 has 1 pixel off by 1.
  - Off differs only in the HUD (a samples-loading line), not the scene.
  - Medium and Low differ by at most 33/255 and 188/255, mostly in the wide haze. Low by eye: same picture, slightly less wide haze.
- **Perf**, RTX 4090 at 120 Hz, 1600×900, headed. Every preset holds 8.33 ms frames.
  - **Per-preset runs** (as in Round 1, one page per preset, 10 s each), CPU per frame:

    | Run                        | Off     | Low     | Medium  | High    |
    | -------------------------- | ------- | ------- | ------- | ------- |
    | Canon, default look        | 0.43 ms | 0.48 ms | 0.49 ms | 0.51 ms |
    | Dense chords + stress look | 0.44 ms | 0.53 ms | 0.51 ms | 0.51 ms |

    Off itself read 0.37 ms in Round 1 with no change on its path: run-to-run drift is ~±0.06 ms.

  - **Interleaved runs** (new test): the four presets cycle 3 times in one page, so drift hits all of them alike. Medians, with draw calls per frame (exact):

    | Run                                        | Off     | Low     | Medium  | High    |
    | ------------------------------------------ | ------- | ------- | ------- | ------- |
    | Canon — draw calls / frame                 | **17**  | **34**  | **36**  | **38**  |
    | Canon — CPU / frame (median of 3)          | 0.37 ms | 0.45 ms | 0.43 ms | 0.43 ms |
    | Dense + stress — draw calls / frame        | **17**  | **34**  | **38**  | **40**  |
    | Dense + stress — CPU / frame (median of 3) | 0.43 ms | 0.46 ms | 0.42 ms | 0.46 ms |

    Dense uses 2 more calls at Medium/High because key cones are on there.

  - **Low's CPU against High's:** structurally, Low now does less CPU work than High: 34 draw calls against 38–40, 4–6 fewer. The timings can't show that difference.
    - The gap is a few draw calls, a few tens of µs. Chrome's `performance.now()` here is coarsened to ~0.1 ms, and the spread between rounds of the _same_ preset is 0.03–0.15 ms.
    - So I can't honestly claim a measured Low < High in ms. What is true and exact: fewer passes and draw calls at Low, and the bloom part of Low's extra cost over Off went down (Canon, interleaved: Low − Off = +0.08 ms, inside the plan's +0.1 ms; Round 1: +0.12).
    - A precise ms comparison needs a profiler trace or the iPad, where the CPU is slower and the gap scales up.
  - GPU times are still not a cost comparison on this card: it clocks down under light load, so cheaper presets can read slower.

### Known issues and open questions

1. **Defaults are provisional.** As agreed in `m9-1.md` §D, the tuning session moves to the end of 9.1.
2. **iPad:** Low and Medium must still be checked on a real iPad (milestone 11 at the latest). That is also where Low's CPU advantage should show in milliseconds.
3. **Low < High in CPU is shown by draw calls, not by timings** (see Perf). If you want a millisecond number, I can add a debug-only CPU benchmark (N frames rendered back-to-back into a tiny canvas, so the GPU never limits it). Your call.
4. Round 1 issues 4 (pulse frozen mid-flash while paused) and 6 (no hint on disabled controls) are fixed by items 2 and 3; issue 7 is item 1.
5. The functional e2e suite now runs at quality Off, so bloom paths are exercised only by the `polish` project, the visual shots and perf.

### Manual review checklist (Round 2)

- [ ] Play with Hot core / Smoke fills, embers and pulse on, then pause: the pulses and particles finish, then nothing moves.
- [ ] Paused, step bars with ← / →: no note or key flashes.
- [ ] Resume after a pause: notes already under the now line don't flash again.
- [ ] Render quality Off: the bloom sliders say "Needs bloom (quality Low or higher)". Shader detail Minimal: spill and cone hints.
- [ ] Settings → Appearance with "Hide controls when idle" off: the delay row explains itself.
- [ ] Look picker → Copy look, paste into a text editor: a `pianomeister-look` file. Change something and copy again: the name ends "(modified)" and the id differs.
- [ ] Readout: draw calls change with the preset (Off 17 → High 38 on Canon).
- [ ] Low vs High side by side: the halo looks the same size.

## 2026-11-21 — Round 3: accordion, note names, fills, stripes

Contact sheets (JPEG, committed): `docs/design/m9/round3/`. Full-size PNGs are regenerated by `npm run test:visual -- -g sheet` into `test-results/visual/sheets/`.

| Sheet                                | What it shows                                                                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `names-pedal.jpg`, `names-dense.jpg` | Note names: facing camera (default), flat, each text colour, each anchor, overlaps on/off, show within 100 %, 18 px + glow, Both. Pedal demo bar 2 and the long demo's dense chords, 1280×720 cropped 1:1 |
| `fills.jpg`                          | Every fill, edge glow off, 3D heads on/off × quality Off/Medium                                                                                                                                           |
| `fills-transparency.jpg`             | Every fill at 0 / 25 / 50 / 75 / 90 % transparency                                                                                                                                                        |
| `fills-compare.jpg`                  | Hot core, Glass, Outline, Neon side by side                                                                                                                                                               |
| `stripes-pedal.jpg`                  | Pedal cage stripes, 3 widths × 2 angles, near and far; cage at 100 % (stripes and solid)                                                                                                                  |
| `stripes-notes.jpg`                  | Stripes on heads and on sustains at 3 widths; A/B opacity 100/100, 100/0, 50/50                                                                                                                           |

### What was done

**A. The sidebar is an accordion** (`575edf6`)

- One section is open at a time, and clicking the open header closes it. None is open by default.
- When one section replaces another, the old one closes instantly and the new one fades in at full height, so nothing below it moves. Its header then scrolls to the top: smoothly, or instantly under reduced motion.
- The open section is remembered as UI state. An older stored list migrates to its first entry.
- The look picker sits above the scroll area.
- Headers keep Space and Enter. Before, the player's global Space (play/pause) took Space even on a focused header.
- E2e: open A then B leaves A closed with B's header at the top; reload keeps B open; clicking B closes everything. Keyboard toggling is tested too.
- It is the only collapsible sidebar, so the "same behaviour elsewhere" rule is covered by the shared `AppAccordion`.

**B. Note names reworked** (`7f2933a`, brief decision 114 rewritten)

- **Facing camera** (default): an upright billboard at a constant size on screen, raised above the note.
- **Flat on note:** lies on the note, no longer stretched, and as wide on screen as a facing label.
- **Font and atlas:** Inter Tight semibold, from an atlas holding the text (red channel) and a blurred halo (green). Colour and shadow are applied in the shader, with no box.
- **New settings, all in the Note names section and in looks:**
  - Label style, Text size (10–18 px), Text colour (Auto / Note / White / Dark)
  - Text shadow (0–100 %), Show within (10–100 %), Fade length (0–30 %)
  - Anchor (Ahead / On / Behind; short notes fall back from Behind to On)
  - Offset along note (±1 lane width), Height above note (0–24 px)
  - Avoid overlaps, Label glow (Off / Subtle)
- **Fades:**
  - Distance is a ramp with no hard cut.
  - A flat label projecting under ~8 px is fully transparent.
  - Labels fade out over the last 5 % of the look-ahead before the now line. With Both, the key-top label takes over there.
- **Key-top labels:** same font. Neutral while the key rests (dark on white keys, light on black), tinted toward the note colour while held.
- **Avoid overlaps:** each frame, the labels in range on both lane colours are projected to screen rectangles, nearest first. The farther of two overlapping labels fades out over 0.15 s, instantly under reduced motion. The logic is `hiddenByOverlap`, with unit tests.
- **Disabled rows:** the note-label rows stay visible, greyed out with a hint ("Needs note names on notes (Notes or Both)"), while names are Off or Keys. Height also needs Facing camera.

**C. Fills** (`1e9c142`, definitions in brief decision 112)

- **Hot core:** a filled body; a white-hot centre band, a warm tint, deep saturated edges; hottest at the head.
- **Glass:** a tinted block, fairly solid at 0 %; a soft wide diagonal sheen and a thin smooth rim; lighter top face on 3D heads.
- **Outline:** the old Neon, renamed and migrated.
- **Neon (new):** a tube inset inside the edge with a near-white core, and a dim coloured haze inside, on the glow scene. Flicker is optional (default off) and stops while paused and under reduced motion.
- **Smoke:** wisps drifting toward the tail.
- **Edge settings:** with Outline or Neon on both heads and sustains, Edge glow, width and intensity are greyed out with "Outline and Neon draw their own edge". Those fills ignore the rim anyway.
- **Transparency:**
  - Glow and every additive part (rim, sounding, pulse, emission) now scale with the note's opacity. This is what made 0 % look like 50 % before.
  - Each fill can keep part of its opacity whatever the setting: Hot core's band keeps 60 %, Outline's border and Neon's tube 30 %.
  - Every fill, Glass included, follows both transparency settings.
  - The sheet shows an even response, so the slider mapping stays linear (decision 3).

**D. Stripes** (`1e9c142`)

- **Per-use groups** for Head fill, Sustain fill and the Pedal cage, shown only while that fill is Stripes. Milestone 10's hand cages can reuse `StripeStyle` and `writeStripes`.
  - A and B colours: notes use Note colour / Darker / Custom; the cage uses custom colours, default #FAC400 / #141414.
  - A and B opacity, width (mm), balance (20–80 %), angle (−75° to 75°, default 45°), drift.
  - Notes default to 0.35 width, the pedal to 1.0, about 3× wider than before.
- **Antialiasing:** coverage is box-filtered over the pixel's footprint (`fwidth`), and blends into the A/B average as a stripe pair drops under ~4 px. No moiré or shimmer on the sheet at any width or distance.
- **Draw order:** notes now mark the stencil buffer before the cages (`NoteMask`, 4 draw calls while a cage is shown), and cages skip those pixels. A translucent note shows the highway, never the cage fill: see the 100 % cells on the stripes sheet. Lines still draw over the cage.
- **Settings v7:**
  - Old `neon` becomes `outline` in settings and in saved looks (looks are migrated through the same steps).
  - The shared stripe width and drift move into all three groups, except that the pedal takes the old width only if it had been changed from 0.35, so its new default applies otherwise.
  - Unit tests cover all of it.

**Also fixed**

- **The held glow flickered** every other frame on a held note: it decayed past its target and snapped back (`fix(engine)`). The pulse had hidden it while playing; paused frames showed it.
- **Segmented choices ignored disabled rules:** only toggles and selects honoured them.
- **One e2e test was wrong after round 2:** "Animated fills move with full motion" checked a stopped player, where looping animation now stops. It is now "animated fills hold still while stopped".
- **Still-frame checks** now count pixels changed by more than 4/255 (fewer than 50; animation changes thousands).

### Decisions I made that weren't in the instructions

1. **Settings v7**, so a stored `neon` can mean the old fill (migrated to Outline) or the new one. v6 only ever existed on this branch, so main users go 5 → 6 → 7 in one load.
2. **Edge settings grey out only when both fills draw their own edge.** With one, the edge glow still applies to the other.
3. **Transparency stays linear.** With glow scaled by opacity, 0 → 25 → 50 → 75 → 90 % already steps evenly (sheet). A perceptual curve made the low end too flat. Heads stay opaque, since the settings are "Sustain transparency".
4. **Stencil mask rather than reordering.** Reordering would put the cage over the bar and lane lines; the mask keeps lines over the cage and the cage out from under notes.
5. **Text size is used by both label styles.** A flat label is as wide on screen as a facing one, so the setting means the same thing.
6. **Text shadow also applies to key-top labels.** It sits in the "On notes" group, but it is the one shared look setting.
7. **Ties in Avoid overlaps:** labels at the same tick are ordered white lane first. In dense chords the black-lane label of a tie tends to give way (open question 2).
8. **Sheets committed as JPEGs** (2.6 MB in all); the PNGs (11.6 MB) are regenerated locally.

### Results

- `npm run check`: pass (638 unit tests). `npm run build`: pass.
- **E2e**, full functional suite (`chromium` + `polish`), production preview, `--retries=0`: **163/163**.
  - Earlier runs this round:
    - 158/163: one real failure (a test still picked "Stripes", now "Diagonal stripes") and four load-timing failures, each passing alone.
    - 163/163 again after the held-glow fix.
  - The stillness tests also passed 20/20 run 5× in a row (sequentially). Run 5× in parallel, they time out waiting for samples (load, not frames).
- **Visual:** the m9 block plus the contact sheets: **41/41**.

### Known issues and open questions

1. **Defaults are provisional**, including every new names, fill and stripe value. Tuning stays at the end of 9.1.
2. **Avoid overlaps with ties:** in dense chords, black-lane labels mostly give way to white ones at the same tick (sheet `names-dense`). Alternatives:
   - prefer the higher or lower pitch;
   - alternate;
   - keep the label of the note whose head is larger on screen.
3. **Hints repeat on every greyed row** when names are Off (eleven rows). A single section-level hint would be quieter, if you prefer.
4. **Avoid overlaps costs a little CPU per frame** while names are on notes: a projection per label in range, dozens at most. Not measured on the iPad yet (milestone 11).
5. **Head stripes** are hard to judge in the Pedal demo because heads are short (sheet row 1). They follow the same filter as sustains.

### Manual review checklist (Round 3)

- [ ] Sidebar: open Camera, then Effects. Camera closes and Effects' header sits at the top with no jump. Reload: Effects is open. Click it: everything closes. Tab to a header: Enter and Space toggle it.
- [ ] Note names → Notes, at defaults: upright labels the same size near and far, fading in with distance and out just before the keys. Try Flat, each colour, each anchor, Height, Glow Subtle.
- [ ] Note names → Both: labels hand over to the key tops. Held keys' labels take the note colour.
- [ ] A dense passage with Avoid overlaps on and off.
- [ ] Note names → Off: the label rows are greyed out with hints.
- [ ] Note style: cycle every fill on heads and sustains (3D heads on and off). Hot core, Glass, Outline and Neon are each obvious at a glance. Neon flicker on, then pause: it stops.
- [ ] Sustain transparency 0 → 90 %: an even change with every fill.
- [ ] Outline or Neon on both fills: the edge rows grey out with the hint.
- [ ] Pedal & cages → Fill: Diagonal stripes on the Pedal demo. Try width, angle, balance, opacity A/B, with no shimmer far away. Fill opacity 100 %: notes keep their own colours.
- [ ] Head and sustain stripes, each with its own group.

## 2026-11-21 — Round 4: labels that never blink or jump; section-level hints

### What was done

**Avoid overlaps, reworked** (`de062b5`, brief decision 114)

- **Stack slots from the music.** Once per song, `labelStackSlots` finds notes that start at the same tick in neighbouring lanes: lane centres under ~1 white-key width apart, covering white–white, white–black and black–black neighbours. In pitch order, each takes the lowest slot no neighbour holds.
  - A slot lifts a facing label by one label height + 2 px; a flat label moves one label depth along the note.
  - Slots are a per-note attribute that never changes, so a label never moves while on screen.
  - Slots apply while Avoid overlaps is on.
- **One-way placement** (`placeLabels`), nearest first:
  - A label entering range shows unless it overlaps a shown one (2 px clearance).
  - A hidden label fades in (0.15 s, instantly under reduced motion) only once it clears every shown label by 4 px.
  - A shown label stays shown until its handover fade at the now line. Nothing ever fades out because of an overlap.
- **Seeks and layout changes:** a seek, or a change to label style, size, anchor, offset, height, range or head shape, places every label afresh, at once, with no fades. The engine skips an overlap-pass frame number, so every label counts as new.
- The old `hiddenByOverlap` is gone.
- **Test hook:** `pianomeisterLabels()` (only with `?stats=1`, like the other debug hooks) lists each placed label's state, rendered visibility and slot.

**Section-level hints** (`a260e88`)

- When 3 or more visible rows in a section are greyed out for the same reason, that reason shows once at the top of the section and the rows are greyed out without repeating it. Fewer than 3 keep their per-row hints.
- Rows report their reason to the section they're in (provide/inject). `sharedHints` in core holds the rule, with unit tests.
- Rows outside a section, such as the loop popover, keep per-row hints.
- With note names Off, the Note names section shows two lines, "Needs note names on" and "Needs note names on notes (Notes or Both)", because those are two different reasons. With quality Off, Render quality shows "Needs bloom (quality Low or higher)" once.

### Decisions I made that weren't in the instructions

1. **"Adjacent lanes"** means lane centres under 1.05 white-key widths apart. That covers every neighbouring pair, including E–F and B–C, and C♯–D♯. C–E and wider stay unstacked; if their labels still overlap far away, the one-way hiding handles them.
2. **Stack slots are on only with Avoid overlaps.** With it off, labels sit side by side as before (see the "avoid overlaps off" cell on the stacked sheet).
3. **Two clearances.** A new label needs 2 px and a hidden one needs 4 px to show. That way a label can never hover on the boundary and flip.
4. **Shown labels may overlap later.** This would only happen if notes converged, which doesn't happen on the highway as notes approach. The one-way rule wins over the overlap rule.

### Results

- `npm run check`: pass (650 unit tests, +12: stack slots, one-way placement including a boundary-hover case, shared hints). `npm run build`: pass.
- **New e2e tests:**
  - Each one plays for 5 s and compares the label snapshot frame by frame. A failure is a shown label hiding, a label's visibility dropping, or a slot changing.
    - On the long demo's ten-note chords, which do have hidden labels.
    - On the Clarity demo's neighbouring-lane chords, which do have stacked labels.
  - A paused seek, three times: every label is fully in or out on the first frame.
  - All pass.
  - Note: none of the long demo's chords have neighbouring lanes, so it exercises hiding, not stacking. That is why the Clarity demo is the stacking case.
- **E2e, full functional suite** (`chromium` + `polish`, production preview, `--retries=0`), three runs:
  - 162/166, 164/166, 165/166.
  - Each run failed a different test (listKeys, loopEditor, loopJump, overview, library, longNames, a player count-in). None of them involve note names or hints.
  - Each failing test passed when rerun alone.
  - The failures are click and load timeouts under parallel load, the same environmental flake as before. Nothing failed twice.
- **Visual:** names sheets regenerated (3/3). New `docs/design/m9/round3/names-stacked.jpg` (Clarity demo: A♯/B stack by default, side by side with Avoid overlaps off). `names-dense.jpg` and `names-pedal.jpg` refreshed.

### Known issues and open questions

1. The full suite is green per test but not in one run: one or two timing flakes per run in unrelated specs. If you want a single green run before the PR, I can look at the shared load (likely sample downloads plus three workers) as its own task.
2. The Note names section shows two hint lines with names Off, as noted above. If you'd rather it show only the root cause ("Needs note names on") when both apply, that's a small change.

### Manual review checklist (Round 4)

- [ ] Upload `test-fixtures/midi/clarity-demo.mid`, names on Notes: the neighbouring labels stack (one lifted) and stay put as they approach. Avoid overlaps off: they sit side by side.
- [ ] Long demo, names on Notes, play: labels appear at the far end, and a few fill in as notes spread apart. None ever disappears before the now line.
- [ ] Seek with Next bar, playing or paused: labels are simply there, with no wave of fades.
- [ ] Note names → Off: the section's top says why, once (two lines), and the rows are greyed without per-row hints. Render quality → Off: "Needs bloom…" once at the top.
- [ ] A section with only one or two greyed rows (e.g. Player controls with auto-hide off) still shows the hint under the row.
