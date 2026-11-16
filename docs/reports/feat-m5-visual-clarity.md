# Review report — `feat/m5-visual-clarity` (Milestone 5: visual clarity)

Plan: `docs/milestones/m5.md`, approved with one change: the black key height stays at the real
12 mm (0.51), and the manual black lift defaults to 0.51 too. Nothing is committed yet beyond
your plan commit; this report is committed with the work (see the last section).

---

## 2026-11-16 — Round 1: milestone 5 built

### What was done

| Area              | Files                                                                                                                                 | Change                                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs              | `docs/brief.md`, `docs/roadmap.md`                                                                                                    | Milestones renumbered (5 Visual clarity … 11 Tablet, MIDI out, offline) with a pointer to the roadmap; old milestone numbers in decisions 23, 27, 33, 37 updated; decisions **39–49** added; roadmap: milestone 5 in progress, key edge profile added.                             |
| Settings v2       | `src/core/settings/*`                                                                                                                 | New sections `keyboard` and `render`, new keys in `highway`, `notes`, `effects`; ranges; `SETTING_CHOICES` for enum settings; `loadSettings` **migrates** v1 instead of discarding it (v1 values kept, new keys get defaults; unknown newer versions still fall back to defaults). |
| Pure render model | `src/engine/model/keyBodies.ts`, `blackLaneLift.ts`, `velocityScale.ts`, `keyPress.ts`, `KeyStates.ts`, `noteInstances.ts`            | Key bodies inside fixed lanes; black-lane lift; velocity → effect scale; press animation curve; velocity on note instances and key states.                                                                                                                                         |
| Geometry          | `src/engine/geometry/`                                                                                                                | A size-independent bevel template (`buildBevelTemplate`) and `beveledBox`: none / chamfer / rounded edges whose bevel keeps its world size however the box is stretched.                                                                                                           |
| Keys              | `src/engine/Keyboard.ts`, `src/engine/sceneLight.ts`                                                                                  | Two instanced meshes with a lit shader (one key light + ambient + soft specular); pitch overlay on the key top, moving with the key; keys pivot at their back edge; rebuilt only when keyboard settings change.                                                                    |
| Notes             | `src/engine/notes/` (replaces `NoteLayer.ts`)                                                                                         | `SustainLayer` (flat sustains, black lanes lifted), `HeadLayer` (3D lit heads, rounded edges), `ContactShadow` (soft quads under black-lane notes).                                                                                                                                |
| Highway           | `src/engine/Highway.ts`                                                                                                               | Darker black-key lanes; thin lines anti-aliased in the shader; now line and guides moved to custom shaders.                                                                                                                                                                        |
| Effects           | `src/engine/Effects.ts`                                                                                                               | Spark count/size and held-glow size follow velocity; effects sit on the configured key tops.                                                                                                                                                                                       |
| Rendering         | `src/engine/RenderPipeline.ts`, `src/engine/Engine.ts`                                                                                | Render scale / max pixel ratio / anti-aliasing (off, MSAA 4×, FXAA, SMAA) switchable at runtime; drawing buffer follows device-pixel-ratio changes.                                                                                                                                |
| UI                | `src/ui/components/SettingsPanel.vue`, `SettingSlider.vue`, `settingsStore.ts`, `PlayerView.vue`                                      | New sections Keyboard (with "Reset to grand piano"), Notes, Effects, Render quality (with a live readout of internal resolution and frame time); black-lane shading under Highway & keys.                                                                                          |
| Tests             | specs next to the code; `e2e/player.spec.ts`, `e2e/visual-review.spec.ts`, `e2e/perf.spec.ts`; `playwright.config.ts`, `package.json` | New `perf` Playwright project and `npm run test:perf`.                                                                                                                                                                                                                             |
| Fixture           | `scripts/make-clarity-demo.mjs`, `test-fixtures/midi/clarity-demo.mid`                                                                | Our own synthetic piece: sharp/natural neighbours together, short and long notes, a repeated key, a velocity ramp.                                                                                                                                                                 |
| Lint              | `eslint.config.ts`                                                                                                                    | `playwright/expect-expect` knows the visual spec's `shoot` helper asserts.                                                                                                                                                                                                         |

### Cause of the soft / grainy look

Measured on the milestone 4 build before changing anything (`npm run test:perf`, diagnostics):

1. **Soft:** the drawing buffer was sized only when the canvas's CSS size changed. When the
   device pixel ratio changes on its own — browser zoom, or moving the window to a monitor with
   another scale — the buffer stayed at the old resolution and the browser stretched it.
   Measured: after a switch to DPR 1.5 the buffer stayed **1600 × 900** where **2400 × 1350**
   was needed. Fixed: the engine compares the DPR every frame (cheap) and observes the canvas's
   device-pixel box; the same check now reports 2400 × 1350.
2. **Grainy:** lane lines (0.03 wide) and beat/bar lines become thinner than a pixel toward the
   far end of the highway. MSAA was already on (4 samples, measured), but MSAA cannot draw a
   line thinner than its samples, so the lines broke up into dashes and shimmered while
   scrolling. Fixed in the shaders: lines are drawn on wider quads and cut to their true width
   with a one-pixel soft edge; a line thinner than a pixel fades instead of breaking up.
3. **Defaults:** MSAA 4× stays the default, now on a multisampled render target so it can be
   switched with FXAA/SMAA/off at runtime. Render scale "auto" (= device pixel ratio), capped at
   2 as before.

### Decisions not in the instructions

- **Black key height 12 mm (0.51)** and manual lift 0.51 (your change); "Reset to grand piano"
  restores real proportions. Black key length 63% of white = 94.5 mm (a real grand: 95 mm).
- **The gap applies between white keys only;** black keys keep their lane width (nothing
  touches them at their height). Lanes never move; tested for gaps 0–0.2.
- **3D head edge radius fixed at 0.06**, shrinking only on heads shorter than that (at most 40%
  of the head's smallest side) — never stretched.
- **Chamfer = a single flat 45° cut**, made by normalising the bevel direction by L1 instead of
  L2 (three's `RoundedBoxGeometry` with one segment gives two facets, not a chamfer).
- **One display-space pipeline:** every material is a custom shader writing display-space
  colour, and the renderer's output colour space is set to linear so three converts nothing.
  Colours and blending look as before, on the canvas and in render targets alike, and the
  anti-aliasing mode switches without recreating the WebGL context. The linear/HDR pipeline
  bloom will need stays with milestone 9.
- **Low black lift draws on top:** when black-lane notes float below the white heads' tops
  (manual lift), they skip the depth test and draw over the white notes instead of
  intersecting and z-fighting, so black-lane heads always win (decision 39).
- **Repeated notes re-strike:** a new onset on a key that is still down lifts it to half and
  presses again.
- **Velocity also scales the spark count** (8 × scale, at least 1).
- **Render scale:** "auto" = device pixel ratio; otherwise 0.5–2 × CSS pixels; both capped by
  max pixel ratio.
- **A bar-line position counts as on the line:** positions come from float seconds (3839.9999
  instead of 3840), which showed notes ending at the bar line as still sounding and pressed.
  `KeyStates` now allows 0.001 tick at boundaries.
- **Metadata saves are queued** in the song details panel (milestone 4 code): the preview-build
  e2e run exposed a race where saving the composer right after the title sent the old title
  back. Each save now builds its fields from the latest stored entry when it runs.

### Results

- `npm run check`: **pass** — type-check, lint (0 warnings), **259 unit tests** in 41 files.
- `npm run build`: **pass** — main chunk **964 kB** (was 866 kB; +98 kB is mostly the
  post-processing passes and SMAA's lookup textures). Size warning as before; deferred to
  milestone 6 as agreed.
- `npm run test:e2e`: **17/17** on the dev server and **17/17** on the `CI=1` preview build (no
  retries); the whole suite 3× in a row: **51/51**.
- `npm run test:visual`: **31/31**.
- **Performance** (Canon, 20 s, headed Chromium, 1600 × 900, DPR 1, RTX 4090 at 120 Hz;
  engine CPU time per frame, averaged; GPU time isn't measured, but the frame interval shows
  whether the GPU keeps up):

  | Run                       | Internal resolution | Anti-aliasing           | CPU per frame | Frame interval    |
  | ------------------------- | ------------------- | ----------------------- | ------------- | ----------------- |
  | Before (milestone 4 code) | 1600 × 900          | canvas MSAA 4×          | 0.41 ms       | 8.37 ms (120 fps) |
  | After, defaults           | 1600 × 900          | MSAA 4× (render target) | 0.32 ms       | 8.36 ms (120 fps) |
  | After, highest quality    | 3200 × 1800         | SMAA                    | 0.43 ms       | 8.33 ms (120 fps) |

### Screenshots

In `test-results/visual/` (regenerate with `npm run test:visual`; Playwright empties
`test-results` at the start of every run). Zoomed = distance offset −0.4.

| File                                                                             | Shows                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `m5-minuet-zoomed-tilt30/45/70.png`                                              | Minuet, bar 5, defaults, three tilts                    |
| `m5-clarity-zoomed-tilt30/45/70.png`                                             | Clarity demo, bar 1 (sharp/natural pairs), defaults     |
| `m5-heads-flat.png` / `m5-heads-3d.png`                                          | Flat vs 3D heads (short 32nds and a long cluster)       |
| `m5-lift-shadow-off.png` / `-on.png`                                             | Black-lane lift and contact shadow off vs on            |
| `m5-lane-shading-off.png` / `-on.png`                                            | Black-key lane shading off vs on                        |
| `m5-keys-pressed-animate-off.png` / `-on.png`                                    | Final chord: keys up vs pressed                         |
| `m5-bevel-lookahead-2-beats.png` / `-32-beats.png`                               | Long vs very short heads: bevels keep their size        |
| `m5-gap-0.png` / `m5-gap-0.15.png`                                               | Lanes unchanged by the gap; notes meet key centres      |
| `m5-edges-none/chamfer/rounded.png`                                              | Key edge profiles, close-up (tilt 30, offset −0.6)      |
| `m5-render-off/msaa/fxaa/smaa.png`                                               | Same view as the "before" shot, each anti-aliasing mode |
| `m5-render-after-dpr-1.5.png`                                                    | After a DPR change: rendered at 2400 × 1350, sharp      |
| `minuet-bar5-tilt-45(-guides).png`, `pedal-demo-bar2.png`, `library-details.png` | Milestone 3/4 views, for regressions                    |
| `settings-panel.png`                                                             | The new settings sections and render readout            |

"Before" shots from the milestone 4 renderer (same views; outside the repo):
`C:\Users\Matt\AppData\Local\Temp\claude\d164e9e2460ef4cd\ea5a1524-51c9-47dc-a59f-58fb60e49c33\scratchpad\m5-baseline\render-before-zoomed-45.png`,
`...\m5-baseline\render-before-zoomed-45-dpr15.png` (soft after the DPR change) and
`...\m5-baseline\render-before-default-45.png`.

What I checked in them: lanes meet key centres at every tilt and at gap 0.15; lifted black-lane
notes meet the black key tops at the now line; bevels look the same on long and short heads;
chamfer highlights are visible on key edges but subtle; with lift and shadow off, black-lane
heads still draw over white-lane heads; far lane lines fade smoothly instead of breaking up.

### Bugs found and fixed while building

- 3D heads that had already passed left zero-depth coloured "walls" standing at the now line —
  heads with no visible length now collapse.
- Notes ending exactly at a bar line showed as sounding when stopped on that bar (float ticks).
- Black-lane heads z-fought with white-lane heads at a low manual lift.
- Metadata save race in the details panel (see decisions).
- A geometry test that passed without checking anything (its filter selected no vertices); it
  now asserts it found the vertices.

### Known issues and open questions

- **Key press is subtle at the defaults:** 0.22 at the front edge is about 2° on a white key;
  at tilt 45 the drop is a few pixels. More visible at low tilts or a larger depth.
- **Contact shadow is subtle on the dark highway;** it mostly shows on neighbouring white notes.
  45% was your sketch default; easy to raise.
- **DPR changes** are detected by a per-frame check: Chromium's emulated DPR change (used in the
  tests) fires neither `ResizeObserver` nor `matchMedia`, so I couldn't rely on events.
- **Performance is CPU-side and on a fast desktop;** tablets are milestone 11.
- **Bundle size** 964 kB, deferred to milestone 6 (the FXAA/SMAA passes could be loaded on
  demand then).
- Not tested on Safari / iPad.
- The 3D head edge radius isn't a setting (only rounded on/off), as m5 specified.

### Manual review checklist

- [ ] Play the Canon: heads are 3D blocks, black-lane notes float over their neighbours and
      meet the black key tops; keys dip while their notes sound; sparks are bigger on loud notes.
- [ ] Settings → Keyboard: change gap, black length/height, edges (square / chamfer / rounded);
      lanes stay aligned; "Reset to grand piano" restores everything.
- [ ] Settings → Notes: toggle 3D heads, rounded edges, lift mode (manual 0 → black heads still
      on top), shadow and its strength.
- [ ] Settings → Render quality: switch Off / MSAA / FXAA / SMAA and render scale; the readout
      shows the resolution and frame time.
- [ ] Zoom the browser (Ctrl +/−) or move the window to another monitor: the image stays sharp.
- [ ] Reload: all settings kept; older settings from milestone 4 were migrated (camera kept).

---

## 2026-11-16 — Round 2: key presses per key type, black-key limits

Round 1 was reviewed; round 2 asked for separate white/black press settings with a pivot behind
the key, and hard limits so black keys never float or sink into the white keys.

### What changed

| Area | Files | Change |
| --- | --- | --- |
| Settings (still v2) | `src/core/settings/PlayerSettings.ts`, `DEFAULT_SETTINGS.ts`, `SETTING_RANGES.ts`, `loadSettings.ts` | `pressDepth` replaced by `pressDepthWhite` (**0.22**) and `pressDepthBlack` (**0.30**); new `pivotOffsetWhite` (**0**) and `pivotOffsetBlack` (**2 × the black key's visible length ≈ 8.04**), range 0–16. Loading applies the cross-setting limits. The v1 → v2 migration is unchanged. |
| Limits | `src/core/settings/constrainKeyboard.ts` (new) | Black key height ≤ key thickness (the body's height), so a raised black key always reaches down to the white keys; black press depth ≤ black height − 0.08 (≈2 mm), lowered with the black height; white press depth ≤ key thickness, so a pressed front never drops below the keyboard's bottom. |
| Geometry | `src/engine/model/keyBodies.ts`, `KeyBody.ts`, `keyPress.ts`, `pressedKeyTop.ts` (new), `blackLaneLift.ts`, `src/engine/Keyboard.ts` | Key bodies are built from the limited settings (whatever they're given) and carry their own press depth and pivot. The press rotates about a pivot `pivotOffset` behind the visible back edge, at the key top's height, by the angle that drops the front edge by exactly the depth. Press curve, re-strike dip and depth semantics unchanged. |
| UI | `src/ui/components/SettingsPanel.vue`, `src/ui/stores/settingsStore.ts` | White/black press depth and pivot sliders; slider maxima follow the limits (black height ≤ thickness, black depth ≤ height − 0.08, white depth ≤ thickness), and the store clamps values as you edit (lowering the black keys lowers their depth). |
| Brief | `docs/brief.md` | Decisions 44 (dimensions + limits) and 46 (per-type press depth and pivot, balance-rail rationale) updated. |
| Tests | `constrainKeyboard.spec.ts`, `pressedKeyTop.spec.ts` (new), `keyPress.spec.ts`, `loadSettings.spec.ts`, `e2e/player.spec.ts`, `e2e/visual-review.spec.ts` | See results. |

### Decisions not in the instructions

- **Pivot height:** the pivot sits at the key top's height (only its distance behind the key is
  configurable). With that, a pressed key's back edge moves a hair *away* from the player — under
  the highway edge — and never forward, so no gap can open at the play line.
- **The limits live in one pure function** (`constrainKeyboard`) used by settings loading, the
  settings store while editing, the slider maxima, the key geometry and the black-lane lift, so
  they can't disagree.
- **Limit values are rounded to 1e-9**, so e.g. 0.25 − 0.08 is 0.17 rather than 0.16999…, which
  a 0.01-step slider would otherwise snap down to 0.16.
- **The default black pivot is a fixed number** (≈8.04, twice the default visible length); it
  doesn't follow later changes to the black key length.

### What the defaults do

- White keys: pivot at the back edge (unchanged look); front drops 0.22.
- Black keys: front drops 0.30, back drops 0.20 (2/3 of the front) — nearly level, tilted about
  1.4°; the top stays 0.21 above the white tops at the front.

### Results

- `npm run check`: **pass** — type-check, lint (0 warnings), **271 unit tests** in 43 files.
- `npm run build`: **pass** (same chunk-size warning, deferred to milestone 6).
- `npm run test:e2e`: **18/18** on the dev server and **18/18** on the `CI=1` preview build (no
  retries). New: lowering the black keys clamps the black press depth (slider value and maximum),
  the black height can't exceed the thickness, and both persist across a reload.
- `npm run test:visual`: **37/37**.
- Unit tests prove, over a grid of thickness, black height, depth and pivot (0–16): the front
  drops exactly the depth; a pressed black key's lowest top point stays ≥ 0.08 above the white
  tops (or at its own height if that is lower); the back never moves toward the player; a white
  key's front stays above the keyboard bottom; black key bodies never float.

### New screenshots

| File | Shows |
| --- | --- |
| `m5-press-tilt30-default.png`, `m5-press-tilt45-default.png` | Final chord close-up (offset −0.6): C#, D#, F# pressed at the default 0.30 next to pressed C, E, G |
| `m5-press-tilt30-black-max-depth.png`, `m5-press-tilt45-black-max-depth.png` | Black keys at the deepest allowed press (0.43) |
| `m5-press-tilt30-black-max-height.png`, `m5-press-tilt45-black-max-height.png` | Black keys at their maximum height (0.6 = the thickness), pressed at their maximum (0.52) |

What I checked: pressed black keys sit visibly lower than their neighbours but always clearly
above the white key tops (their side faces stay visible above the whites); nothing intersects or
sinks; no gap opens where the keys meet the play line. At the maximum depth the lifted black-lane
note at the play line floats a little above the pressed key's back edge (by the back drop, about
0.29) — expected with the key down.

### Known issues and open questions

- At the default depths the press is still subtle at tilt 45 (a few pixels); it reads better at
  tilt 30.
- Everything from round 1 still applies (bundle size → milestone 6, no Safari/iPad test).

### Manual review checklist

- [ ] Play the clarity demo's last bar (or any chord with sharps): black keys drop nearly level,
      white keys tilt from the play line; no black key ever reaches the white tops.
- [ ] Settings → Keyboard: drag "Black key height" down — "Black key press depth" follows its
      new maximum; drag thickness down — the black height follows.
- [ ] Try the pivot sliders (0 = hinged at the play line, 16 = almost level) for both key types.

---

## 2026-11-16 — Round 2 approved

Round 2 was approved with no further changes. The work is committed in focused commits on
`feat/m5-visual-clarity`, pushed, and opened as a pull request. Carried forward: the bundle-size
warning (milestone 6) and a Safari/iPad check.
