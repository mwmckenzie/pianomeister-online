# Milestone 9 plan: visual polish

Approved 2026-11-21 with the answers in §9.

## 1. Where m9.md conflicts with the current engine

| #   | m9.md asks for                                        | Current engine                                                                                                                       | Proposal                                                                                                                                                                               |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Selective bloom (d1)                                  | The brief's "Key and note visual behavior" says "rather than full-screen bloom". `Effects.ts` was built around that rule.            | Replace the rule with "bloom optional, selective, preset-controlled".                                                                                                                  |
| C2  | A bloom threshold and glow intensity (d1, d3)         | Every material writes display-space colour into an 8-bit target (`UnsignedByteType`, linear output). Nothing can be brighter than 1. | Keep the main pass as it is. Emissive output goes to a separate half-float glow target, where values above 1 are allowed, and the threshold acts on that target only (§3).             |
| C3  | Flicker, breathing, smoke, scrolling stripes (d6, d8) | Shaders only know `uTick`, the song position. Paused means frozen.                                                                   | Add `uTime`: wall-clock seconds from the rAF timestamp, so `page.clock` fixes it for the visual shots. It stops while the engine is frozen (Welcome, editor) and under reduced motion. |
| C4  | Note-on pulse with a decay in ms (d7)                 | Note instances have no velocity attribute. The shader can't turn ticks into ms.                                                      | Add `aVelocity`, plus a `uTicksPerSecond` uniform measured from the transport each frame (smoothed). The pulse is computed in the shader, with no per-note CPU work.                   |
| C5  | Pulse after seeks                                     | Brief 9: a jump doesn't retrigger held notes. A tick-based pulse would flash notes that started just before the jump target.         | Add a `uJumpTick` uniform. Only notes starting after the last jump pulse. This matches the existing spark rule (`MAX_SPARK_JUMP_QUARTERS`).                                            |
| C6  | Glass / Neon (hollow) on heads (d6)                   | 3D heads are convex blocks that write depth and cull back faces. They are transparent only for the haze.                             | Glass: a translucent body that still writes depth. You see the front faces only, with no inner faces. Neon on 3D heads: a dark translucent body with a bright rim, not truly hollow.   |
| C7  | Head fill styles                                      | With 3D heads off, heads are drawn by `SustainLayer`, not `HeadLayer`.                                                               | Put the fill styles in one shared GLSL chunk (`NOTE_FILL_GLSL`) used by both layers, so flat heads get them too.                                                                       |
| C8  | Note names on notes (d9)                              | A head is 1/64 note long (brief 19): about 0.3 world units at the default look-ahead. A letter almost never fits on it.              | Draw the name on the note's sustain, right behind the head, at lane width. It shows when the projected label is at least 10 px tall. ⚠ Q3.                                             |
| C9  | Reduced motion in the scene (d16)                     | The engine doesn't know about motion. Brief 54 covers menus only.                                                                    | Add an `engine.setReducedMotion(bool)` method. `App.vue` already resolves "Follow system".                                                                                             |
| C10 | Low by default on tablets (d2)                        | The registry has one static default per setting, and reset always goes back to it.                                                   | Add device defaults: `render.quality` defaults to `low` on a touch + small-screen device. Reset and "modified" use the device default. This needs a new brief decision.                |
| C11 | Primary/secondary colours for scene lines (d3)        | Brief 52 says the Appearance colours are "UI colours only (never the note palette)".                                                 | Allowed for lines and cages. Never for notes.                                                                                                                                          |
| C12 | Perf "within the frame budget"                        | `stats()` measures CPU time only. Bloom cost is on the GPU.                                                                          | Add GPU timing via `EXT_disjoint_timer_query_webgl2` under `?stats=1`, where available. Otherwise fall back to the frame interval.                                                     |
| C13 | Glow must haze out like everything else               | Every layer fades through `hazeAlpha`.                                                                                               | Glow twins use the same `TIME_GLSL` haze, so far-away glow doesn't pop.                                                                                                                |
| C14 | Process                                               | CLAUDE.md asks for small commits and a committed report. m9.md says "stop … before committing".                                      | Follow m9.md: build on the branch uncommitted, report at the review, and commit in focused chunks after sign-off (unless you'd rather have commits as I go).                           |

## 2. Brief decisions to change

| Decision                       | Change                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **13** Pedal shading           | Becomes a **pedal cage** on the cage renderer: full width while the pedal is down, with border and fill options. Today's subtle desaturated band stays as the default style.          |
| **22** Scene defaults          | Very dark background and highway, an optional vignette, plus the new line colours and widths. Provisional values now, final values after the tuning session.                          |
| **19** Notes                   | Sustains get fill styles. **Solid** = today's translucent gradient across the lane, and the centre/edge transparencies apply to every sustain style. Adds edge glow and sustain glow. |
| **39** 3D heads                | Head fill styles, edge glow at a constant world width (like the bevel), and how Glass/Neon work on blocks (C6).                                                                       |
| **43** Simple lighting         | Drop "no post-processing". Add key light: spill onto neighbouring keys and an optional light cone.                                                                                    |
| **47** Velocity-scaled effects | Covers every onset and sustain effect and the note-on pulse.                                                                                                                          |
| **48** Render quality          | Adds the **Off / Low / Medium / High** presets, bloom strength, radius and threshold, the device default (C10) and GPU time in the readout.                                           |
| **50** Sidebar sections        | Camera, Keyboard, Highway, **Lines & glow, Note style, Effects, Pedal & cages, Note names**, Render quality, with the **Look** picker on top.                                         |
| **52** Menu colours            | Primary and secondary may also colour scene lines and cages (C11).                                                                                                                    |
| **54** Motion                  | Reduced also covers the scene: no flicker, breathing, scrolling or noise animation, and effects become short fades.                                                                   |
| **63 / 88** Settings storage   | **Schema v6** (migration in §6). Looks are stored device-wide beside the settings: `{ version, settings, shortcuts, looks }`.                                                         |
| "Key and note visual behavior" | Effects section: the new onset and sustain lists, and the performance rule rewritten around the particle budget and selective bloom.                                                  |
| New, from 108 on               | Selective bloom, quality presets, glowing lines, note fill styles, pulse, sustain glow, note names, the cage renderer, now-line effects, key light, particle budget, Looks.           |

## 3. Bloom: selective, via layers and glow twins

**Recommendation:** render a separate glow pass from **layer 1** into its own target. Each emissive mesh gets a **glow twin**: the same geometry, a glow-only material built from the same shader source with `#define GLOW_PASS`, and the same uniform objects. That pass is blurred with three's `UnrealBloomPass` and added to the main frame. This follows three's own `unreal_bloom_selective` example (a `bloomComposer` with `renderToScreen = false`, then a mix pass). Instead of the example's per-frame material swapping, which walks the scene every frame, the twins stay on the glow layer permanently.

- **What goes on the glow layer:** now line, borders, octave lines, optionally glowing bar and beat lines, note edge rims, sounding and pulsing note fills, emissive fill styles, cage borders, lit key overlays, the light cone and additive particles.
- **What stays off it:** the highway surface, unlit keys, smoke, and the non-emissive part of every note.
- **Occlusion inside the glow pass:** the key and head twins output black wherever they don't emit, and they write depth. Glow behind a key or block is therefore hidden without sharing the MSAA depth buffer, and the glow pass can run at a lower resolution.
- **Bloom-on pass chain:**
  - **Glow:** `RenderPass` (layer 1, cleared to black, half-float target with no MSAA, sized by the preset) → `UnrealBloomPass` (strength, radius, threshold).
  - **Main:** `RenderPass` (layer 0, MSAA as today) → mix pass (base + bloom, plus the vignette) → FXAA/SMAA or a plain copy.
  - Half float falls back to 8-bit where `EXT_color_buffer_half_float` is missing (iPad check).
- **Off is today's pipeline, exactly.** The twins are hidden and no extra passes run. A visual shot locks this in.
- **Alternatives rejected:**
  - Multiple render targets in one scene pass: every material would have to move to GLSL3, and MSAA with multiple targets is fragile in three.
  - A threshold on the whole frame: the colour pipeline is display-space and 8-bit (C2), so this can't single out emissive elements.

**Quality presets** control **cost** only. They are a choice that writes the cost settings; tweaking one afterwards shows "Medium · modified".

|                 | Off                          | Low                    | Medium              | High                |
| --------------- | ---------------------------- | ---------------------- | ------------------- | ------------------- |
| Bloom           | none (today's)               | glow target ¼ res      | ½ res               | full res            |
| Particle budget | 512 (today's)                | 1 024                  | 2 048               | 4 096               |
| Shader detail   | 1 noise octave, no key spill | 1 octave, spill ±1 key | 2 octaves, ±2, cone | 3 octaves, ±3, cone |

Bloom strength, radius and threshold are **appearance** settings. They belong to Looks, not to the presets: presets are the device's cost, looks are what it looks like.

## 4. Particle system changes

`Effects.ts` becomes `ParticleSystem` + `NowLineEffects`:

- **One ring-buffer pool of camera-facing instanced quads**, replacing `Points`, so flames can stretch along their velocity.
- **Motion computed on the GPU without stored state.** Each particle stores its spawn data: position, velocity, spawn time, lifetime, size, kind, colour and seed. The vertex shader computes position, size and alpha from `uTime`, with gravity and drag in closed form.
  - The CPU writes only the newly spawned slots each frame (`addUpdateRange`) and never loops over live particles. Today's code loops over 512 sparks and uploads every attribute every frame.
  - "Oldest go first" falls out of the ring buffer (d16).
- **Kinds as rows of uniform arrays:** size curve, alpha curve, gravity, drag, stretch and colour shift toward white or dark.
  - Onsets: sparks, scaling sparks, flame burst, explosion (a ring quad plus debris), glitter (twinkles, but not under reduced motion).
  - While a note is held: embers, small flames, smoke. These spawn from per-key rate accumulators scaled by velocity. Today's held glow stays as its own 88-slot layer.
- **Two draws:** additive (also drawn as a glow twin) and normal-blended for smoke, which doesn't bloom.
- **Reduced motion:** onsets become a single in-place flash that fades, and held notes get a steady glow.

**Performance budget**, measured on this machine (RTX 4090, 120 Hz) at 1600×900, DPR 1:

- **Engine CPU per frame** (today 0.27–0.34 ms on Canon):
  - Off / Low: at most 0.1 ms above today.
  - High: at most 1.0 ms on Canon and on a new dense-chord section in the 340-bar fixture (10-note chords in 16ths at 160 bpm, pedal down).
- **Particle uploads:** at most 64 KB per frame.
- **GPU per frame** (timer query), over Off: Low +0.5 ms or less, Medium +1.5 ms or less, High +3 ms or less.
- **No dropped frames:** High keeps the frame interval at vsync (8.33 ms).

## 5. Lines, notes, cages, key light, names

- **Lines:**
  - Lane lines split by kind into normal, outer borders, B/C octave lines and E/F lines. Each kind gets its own style and glow twin.
  - The now line becomes its own `NowLine` mesh with styles thin, glowing and neon.
  - "Gradient" becomes the colour option **Pitch (keys underneath)**: an 88-texel colour texture, where black keys win over their x range.
  - Colour options for every line: White / Primary / Secondary / **Custom** (keeps today's pickers) / Pitch (now line only).
- **Note fills:** Solid, Gradient (along the note), Hot core, Glass, Neon, Stripes (fixed to the note, optional drift) and Smoke.
  - All patterns are computed in each note's own lane and world-length coordinates, never screen-aligned.
  - Edge rims are a constant world width and antialiased with `fwidth`, the same as `lineCoverage`.
- **Cages:**
  - The renderer, `CageLayer`, takes regions `{ startTick, endTick, lowMidi | null, highMidi | null, openStart?, openEnd? }` and a `CageStyle` (border: width, colour, glow, corner radius; fill: style, colour, opacity).
  - Each region is drawn as one instanced quad with a rounded-rectangle shape in world units. It is clipped at the now line, and no border is drawn at the clip.
  - `setRegions()` rebuilds only the instance buffer, so milestone 10 can use one layer per hand with per-bar regions. The `openStart/End` flags let consecutive bars join without a border line between them.
  - The pedal becomes one `CageLayer` (merged spans, as now).
- **Key light:** the key shader samples a per-key light texture: spill over ±N keys, with a falloff over world distance. The light cone is an additive quad on the key top that moves with the press.
- **Note names:**
  - The formatting is pure code in `core/notes/noteName.ts` (sharps or flats, octave on every C or on all notes), with unit tests.
  - The engine draws the labels from a glyph atlas made with a canvas at startup: light text with a dark outline, mipmapped.
  - "Under the keys" = near the front edge of the key tops, moving with the press.

## 6. Settings and Looks

- **New settings and sidebar sections** as listed in §2 (roughly 80 new settings, all in the registry, so reset icons and section dots come for free). The `render` settings add `quality`, `bloomScale`, `particleBudget` and `shaderDetail`.
- **Schema v6 migration:**
  - `colors.pedal` and `opacity.pedal` → the pedal cage's fill colour and opacity.
  - `colors.lane / bar / beat` → those lines' custom colour, with the colour choice set to Custom.
  - `effects.enabled: false` → onset effect and sustain effect both set to none.
  - Velocity scaling settings are kept.
- **Looks:**
  - A look holds every **appearance** setting: highway colours, lines and glow, note style, effects, pedal and cages, note names, and bloom strength/radius/threshold.
  - It leaves out camera, keyboard dimensions, look-ahead and every render-cost setting.
  - The logic lives in `core/looks/`: save, apply, the modified check, and Undo through the existing `useResetWithUndo`.
  - "Classic" = exactly today's look, with every new effect off. The provisional defaults are close to Classic with a subtle glow.

## 7. Build order (on `feat/m9-visual-polish`)

1. Core: the settings v6 schema, migration and registry; note names; the preset and look logic; the particle budget and spawn math; cage region → highway quad math. All with tests.
2. Engine foundation: `uTime`, `uTicksPerSecond`, `uJumpTick`, `aVelocity`, glow twins, the bloom pipeline and mix pass with vignette, and the GPU timer.
3. Lines and the now line, then note fills, rims, pulse and sustain glow.
4. `CageLayer`, with the pedal moved onto it.
5. The particle system and now-line effects, then key light.
6. Note names.
7. Sidebar sections, the Look picker, preset UI and the readout.
8. Tests (m9.md's list, plus an "Off = today" pixel baseline), perf runs per preset, and the report. Then stop for review and the tuning session.

## 8. Questions before starting

- **Q1.** Is the split "presets = cost, Looks = appearance" right? Specifically: bloom strength/radius/threshold go in Looks, not presets.
- **Q2.** Does Off really mean today's pipeline exactly, so effects keep today's 512-particle budget?
- **Q3.** Note names on notes: draw them on the sustain right behind the head (C8), or only on heads with a large look-ahead?
- **Q4.** Stripes "scroll with the music": is drifting along the note right? The stripes already move with the note itself.
- **Q5.** Should Looks be device-wide and stored beside the settings? (Assumed yes, per d18.)
- **Q6.** Tablet detection = `(pointer: coarse)` and a short screen side of 1024 px or less. OK?
- **Q7.** Commits as I go, or uncommitted until your review (C14)?

## 9. Answers (approved 2026-11-21)

- **Q1:** Yes — presets = cost, Looks = appearance; bloom strength/radius/threshold are in Looks.
- **Q2:** Yes — Off is today's pipeline exactly, including the 512-particle budget; keep the "Off = today" pixel baseline shot.
- **Q3:** Names on the sustain right behind the head, shown at ≥ 10 px projected height. Notes too short for a label show none.
- **Q4:** Stripes are fixed to the note; drift is an option, default off.
- **Q5:** Yes — Looks are device-wide, stored beside the settings.
- **Q6:** `(pointer: coarse)` and a short screen side ≤ 1024 px. Record which device default applied, so reset and "modified" are per device.
- **Q7:** Commit as we go (focused local commits, not pushed). Still stop for review and the tuning session before pushing.
- **Also:** the perf budget is measured on an RTX 4090; the report notes that Low/Medium must be checked on a real iPad (milestone 11 at the latest).
