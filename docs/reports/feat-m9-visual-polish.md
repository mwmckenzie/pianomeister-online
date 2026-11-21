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
