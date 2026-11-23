# Milestone 9.1 §B — slider ranges (final)

Status: **approved 2026-11-22 and applied** to `SETTINGS_REGISTRY`, with the review's changes (round 2 below). Stored settings, imported looks and backups are clamped into these ranges on the way in (`trimmedRanges.spec.ts`); the defaults and every built-in look sit inside them.

## Round 2 (after the review)

- **Kept wider than proposed (review):** look-ahead stays 2–32 (log); note text size stays 10–18; key label size 9–16. Camera-dependent ranges can't be capped from the 45° view alone, since looks include the camera; checked from 25° and 85° (sheets `*.tilt-25`, `*.tilt-85`).
- **Engine strengths raised before section C (review Q3, Q4):**
  - **Line glow** (borders, octaves, bar and beat lines): the glow layer now emits the line's **hue at full brightness** plus a soft aura, so the glow slider sets the strength and the colour only the hue. Before, the dark default line colours gave the bloom almost nothing. Beat glow wasn't a bug: it was the dark colour × a thin line.
  - **Vignette:** the falloff starts nearer the centre and reaches full strength in the corners.
  - **Embers:** about 3× bigger, with white-hot cores cooling to the note colour, so they read against their own sustain (they were ~2 px and the sustain's colour).
  - **Glitter:** 7 big white-hot flecks per onset instead of 14 small dim ones, with a slower fade. Half the particles, so the budget no longer binds.
- **Low-camera pass (review Q2):** 25° tilt, keys mid-press on the fixed step (a press takes 0.04 s; frames at 0.017 s and 0.034 s), the cone in motion with a crop on the keys. Results are the **Round 2** rows.
- **Size at softest above Size at loudest (Q1):** clamped in the engine (`velocityScaleBounds`); the stored value stays as set, and the slider shows "Limited by Size at loudest".
- **Black pivot default (Q5):** 8.04 → 8. Classic's pinned 8.04 → 8 too (the press looks the same).
- **Log sliders:** `scale: 'log'` in the registry; the slider maps position ↔ value (`logSlider.ts`, 200 positions) and keeps a **0 stop** at the left where the range starts at 0. Arrow keys never stall where several positions snap to one step.

## How the sheets were made

- `npm run test:visual -- -g range` (`e2e/ranges.spec.ts`): **98** numeric playfield settings (sidebar, minus the device-cost keys) and **10** pair grids, 108 sheets.
- **Static settings:** Pedal demo, paused on bar 2, `?animTime=3`, 1280×720, at the defaults plus whatever must be on for the setting to show. Examples: stripes fill for stripe knobs, the border for border knobs, one onset effect alone for its knobs. The spec **fails** if a setting would be hidden or disabled (so inert) under its sheet's settings.
- **Values:** 7 per sheet: min, default, and 0.2/0.4/0.6/0.8/1 of the way to the max, snapped to the step. Spacing follows the slider: log where the registry says `scale: 'log'`.
- **Motion:** onset knobs, `minScale`/`maxScale` and sustain knobs use the long demo's dense chords; pulse uses the Pedal demo. Both are captured with `?capture=1`, a fixed step: onsets at t 0.15/0.5/1.2 s, sustain at 0.5/1.2/2.5 s, pulse at 0.05/0.15/0.4 s.
- **Budget:** the capture hook logs the peak live particles against the Medium budget (2048) and whether any were cut short.
- **Crops:** near 1:1 where each setting acts (keys, now line, border, grid, notes, particles, arrival). Whole-frame settings keep the full frame. The label under each frame is the value as the slider shows it, followed by the stored value in brackets.
- **Sheets:** `test-results/visual/ranges.zip` (outside git). Samples are in this folder (below).

**Reading the table:** values are **stored** values, as in the registry (mm settings are stored in key widths, ×23.5 for mm; percent settings are stored as 0–1). **Bold** marks a changed range and a log slider. "budget" is the peak live particles of the last render (round 2 for glitter and sustain).

## Final table

### camera

| key                     | old min..max / step | final min..max / step | default | slider | budget (Medium 2048, last render) | why                                                                                   |
| ----------------------- | ------------------- | --------------------- | ------- | ------ | --------------------------------- | ------------------------------------------------------------------------------------- |
| `camera.tiltDeg`        | 20..85 / 1          | **25..85 / 1**        | 45      | lin    |                                   |                                                                                       |
| `camera.distanceOffset` | -0.6..1 / 0.05      | -0.6..1 / 0.05        | 0       | lin    |                                   | range fine: -0.6 is a deliberate close-up (~3 octaves), 1 a small whole-keyboard view |
| `camera.pan`            | -26..26 / 0.5       | -26..26 / 0.5         | 0       | lin    |                                   |                                                                                       |

### keyboard

| key                         | old min..max / step | final min..max / step | default  | slider  | budget (Medium 2048, last render) | why                                                                                                                                                                                     |
| --------------------------- | ------------------- | --------------------- | -------- | ------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keyboard.thickness`        | 0.2..1.2 / 0.01     | **0.2..1.2 / 0.05**   | 0.6      | lin     |                                   |                                                                                                                                                                                         |
| `keyboard.gap`              | 0..0.2 / 0.005      | **0..0.2 / 0.01**     | 0.06     | lin     |                                   |                                                                                                                                                                                         |
| `keyboard.blackLengthRatio` | 0.5..0.8 / 0.01     | 0.5..0.8 / 0.01       | 0.63     | lin     |                                   | range fine: 50% stubby to 80% long, every step visible                                                                                                                                  |
| `keyboard.blackHeight`      | 0..1.2 / 0.01       | **0..1.2 / 0.05**     | 0.510638 | lin     |                                   |                                                                                                                                                                                         |
| `keyboard.edgeSize`         | 0.005..0.12 / 0.005 | 0.005..0.12 / 0.005   | 0.04     | **log** |                                   |                                                                                                                                                                                         |
| `keyboard.pressDepthWhite`  | 0..1.2 / 0.01       | **0..1.2 / 0.05**     | 0.22     | lin     |                                   | **Round 2:** Low-camera pass: the front edge drops visibly from ~12 mm; 0 = colour only, intentional. The slider is also capped at the key thickness.                                   |
| `keyboard.pressDepthBlack`  | 0..1.12 / 0.01      | **0..1.12 / 0.05**    | 0.3      | lin     |                                   | **Round 2:** Not re-judged (9.2 reworks black keys); step 0.05 as proposed.                                                                                                             |
| `keyboard.pivotOffsetWhite` | 0..16 / 0.1         | **0..8 / 0.5**        | 0        | lin     |                                   | **Round 2:** Low-camera pass: same as the black pivot; 0–8.                                                                                                                             |
| `keyboard.pivotOffsetBlack` | 0..16 / 0.1         | **0..8 / 0.5**        | 8        | lin     |                                   | **Round 2:** Low-camera pass: no visible difference mid-press at any value past about one key length (the press is ~5 mm); 0–8 keeps the real range. Default snapped 8.04 → 8 (review). |

### highway

| key                                | old min..max / step | final min..max / step | default | slider  | budget (Medium 2048, last render) | why                                                                                                                                                           |
| ---------------------------------- | ------------------- | --------------------- | ------- | ------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `highway.lookAheadBeats`           | 2..32 / 1           | 2..32 / 1             | 8       | **log** |                                   | **Round 2:** Kept 2–32 (review): from 85° even 32 beats reads, from 25° it is compressed but usable; looks hold the camera. Log.                              |
| `highway.blackLaneShadingStrength` | 0..1 / 0.01         | **0..1 / 0.05**       | 0.22    | lin     |                                   | invisible below ~0.15; 1.0 bold stripes but notes still read; 0.01 too fine                                                                                   |
| `highway.vignette`                 | 0..1 / 0.05         | 0..1 / 0.05           | 0.2     | lin     |                                   | **Round 2:** Engine fix: the falloff starts nearer the centre and reaches full strength in the corners; 1 now darkens the keyboard ends strongly. Range kept. |
| `opacity.lane`                     | 0..1 / 0.01         | **0..1 / 0.05**       | 0.35    | lin     |                                   |                                                                                                                                                               |
| `opacity.bar`                      | 0..1 / 0.01         | **0..1 / 0.05**       | 0.6     | lin     |                                   |                                                                                                                                                               |
| `opacity.beat`                     | 0..1 / 0.01         | **0..0.6 / 0.05**     | 0.12    | lin     |                                   |                                                                                                                                                               |

### lines

| key                  | old min..max / step | final min..max / step | default | slider  | budget (Medium 2048, last render) | why                                                                                                                                                                               |
| -------------------- | ------------------- | --------------------- | ------- | ------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lines.nowWidth`     | 0.02..0.4 / 0.01    | **0.02..0.3 / 0.01**  | 0.08    | **log** |                                   |                                                                                                                                                                                   |
| `lines.nowGlow`      | 0..3 / 0.05         | 0..3 / 0.05           | 0.6     | **log** |                                   |                                                                                                                                                                                   |
| `lines.bordersWidth` | 0.01..0.3 / 0.01    | 0.01..0.3 / 0.01      | 0.05    | **log** |                                   | range fine: hairline to a bold 7 mm rail, all intentional                                                                                                                         |
| `lines.bordersGlow`  | 0..3 / 0.05         | 0..3 / 0.05           | 0.3     | **log** |                                   | **Round 2:** Engine fix: glow is now the line hue at full brightness plus a soft aura. Visible from ~0.6, a clear halo at 3. Range kept.                                          |
| `lines.octavesWidth` | 0.01..0.3 / 0.01    | 0.01..0.3 / 0.01      | 0.05    | **log** |                                   | range fine: 0.01 barely there, 0.3 bold glowing rails that are loud but notes still read                                                                                          |
| `lines.octavesGlow`  | 0..3 / 0.05         | 0..3 / 0.05           | 0.5     | **log** |                                   | **Round 2:** Same engine fix (shared shader): stronger at the same value; 3 is a loud teal wash that still reads. Range kept.                                                     |
| `lines.barGlow`      | 0..1 / 0.05         | **0..3 / 0.05**       | 0       | **log** |                                   | **Round 2:** Engine fix: visible from 0.25, a strong band at 3. 0–3.                                                                                                              |
| `lines.beatGlow`     | 0..1 / 0.05         | **0..2 / 0.05**       | 0       | **log** |                                   | **Round 2:** Not a bug: the glow was the dark beat colour × a thin line, too little for the bloom. With the engine fix it shows from ~0.6; 3 washes the highway in bands, so 0–2. |

### notes

| key                               | old min..max / step | final min..max / step | default  | slider | budget (Medium 2048, last render) | why                                                                                                                                                                                                       |
| --------------------------------- | ------------------- | --------------------- | -------- | ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notes.headHeight`                | 0.05..0.8 / 0.05    | **0.1..0.8 / 0.05**   | 0.35     | lin    |                                   | **Round 2:** Low-camera pass: 1.2 mm is a flat sliver (3D heads off does that); 19 mm is boxy but still reads. 0.1–0.8.                                                                                   |
| `notes.blackLift`                 | 0..0.8 / 0.01       | 0..0.8 / 0.01         | 0.510638 | lin    |                                   | **Round 2:** Not re-judged (9.2 removes it).                                                                                                                                                              |
| `notes.shadowStrength`            | 0..1 / 0.01         | **0..1 / 0.05**       | 0.45     | lin    |                                   | **Round 2:** Low-camera pass: no visible difference at any value: a black shadow on the near-black default highway (#070B16) has nothing to darken. Range kept; 9.2 puts black notes back on the highway. |
| `notes.sustainCenterTransparency` | 0..1 / 0.05         | **0..0.85 / 0.05**    | 0.25     | lin    |                                   | at 100% the sustain disappears and heads go dark/hollow; 80% is already ghostly                                                                                                                           |
| `notes.sustainEdgeTransparency`   | 0..1 / 0.05         | 0..1 / 0.05           | 0.75     | lin    |                                   |                                                                                                                                                                                                           |
| `keys.fadeBeats`                  | 0..4 / 0.25         | 0..4 / 0.25           | 1        | lin    |                                   |                                                                                                                                                                                                           |
| `keys.maxApproachAlpha`           | 0..1 / 0.05         | **0.1..1 / 0.05**     | 0.7      | lin    |                                   |                                                                                                                                                                                                           |

### noteStyle

| key                               | old min..max / step | final min..max / step | default | slider  | budget (Medium 2048, last render) | why                                                                                                  |
| --------------------------------- | ------------------- | --------------------- | ------- | ------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `noteStyle.gradientEnd`           | 0..1 / 0.05         | **0..0.8 / 0.05**     | 0.35    | lin     |                                   |                                                                                                      |
| `noteStyle.headStripeAOpacity`    | 0..1 / 0.05         | 0..1 / 0.05           | 1       | lin     |                                   |                                                                                                      |
| `noteStyle.headStripeBOpacity`    | 0..1 / 0.05         | 0..1 / 0.05           | 1       | lin     |                                   |                                                                                                      |
| `noteStyle.headStripeWidth`       | 0.05..3 / 0.05      | **0.05..1 / 0.05**    | 0.35    | **log** |                                   |                                                                                                      |
| `noteStyle.headStripeBalance`     | 0.2..0.8 / 0.05     | 0.2..0.8 / 0.05       | 0.5     | lin     |                                   |                                                                                                      |
| `noteStyle.headStripeAngle`       | -75..75 / 5         | -75..75 / 5           | 45      | lin     |                                   |                                                                                                      |
| `noteStyle.sustainStripeAOpacity` | 0..1 / 0.05         | 0..1 / 0.05           | 1       | lin     |                                   | range fine; 0 = high-contrast stripes, about 60% nearly solid, 1 shows stripes again (A vs B colour) |
| `noteStyle.sustainStripeBOpacity` | 0..1 / 0.05         | 0..1 / 0.05           | 1       | lin     |                                   | range fine; 0 bold, 40–60% subtle, 1 clear                                                           |
| `noteStyle.sustainStripeWidth`    | 0.05..3 / 0.05      | **0.1..1.5 / 0.05**   | 0.35    | **log** |                                   |                                                                                                      |
| `noteStyle.sustainStripeBalance`  | 0.2..0.8 / 0.05     | 0.2..0.8 / 0.05       | 0.5     | lin     |                                   |                                                                                                      |
| `noteStyle.sustainStripeAngle`    | -75..75 / 5         | -75..75 / 5           | 45      | lin     |                                   |                                                                                                      |
| `noteStyle.edgeWidth`             | 0.01..0.2 / 0.005   | **0.02..0.2 / 0.005** | 0.04    | **log** |                                   |                                                                                                      |
| `noteStyle.edgeIntensity`         | 0..3 / 0.05         | **0.1..3 / 0.05**     | 0.5     | **log** |                                   |                                                                                                      |

### names

| key                | old min..max / step | final min..max / step | default | slider | budget (Medium 2048, last render) | why                                                                                                                                                  |
| ------------------ | ------------------- | --------------------- | ------- | ------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `names.textSize`   | 10..18 / 1          | 10..18 / 1            | 12      | lin    |                                   | **Round 2:** Kept 10–18 (review): large labels are an accessibility need; at 85° 18 px reads without collisions; overlap avoidance handles the rest. |
| `names.shadow`     | 0..1 / 0.05         | **0..1 / 0.1**        | 0.6     | lin    |                                   |                                                                                                                                                      |
| `names.showWithin` | 0.1..1 / 0.05       | 0.1..1 / 0.05         | 0.6     | lin    |                                   | range fine; 10% labels only the nearest notes, 100% labels all of them                                                                               |
| `names.fadeLength` | 0..0.3 / 0.01       | **0..0.3 / 0.02**     | 0.15    | lin    |                                   | neighbours at 0.01 identical → 0.02; log with min 0 is awkward, make it linear; 0.3 still looks intentional                                          |
| `names.offset`     | -1..1 / 0.05        | -1..1 / 0.05          | 0       | lin    |                                   |                                                                                                                                                      |
| `names.height`     | 0..24 / 1           | **0..18 / 1**         | 6       | lin    |                                   |                                                                                                                                                      |
| `names.keySize`    | 8..16 / 1           | **9..16 / 1**         | 11      | lin    |                                   | **Round 2:** 9–16 (review): 8 px sharps are unreadable; 16 px reads at 25° and 85°.                                                                  |

### cages

| key                    | old min..max / step | final min..max / step | default | slider  | budget (Medium 2048, last render) | why                                                                                                                  |
| ---------------------- | ------------------- | --------------------- | ------- | ------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `pedal.fillOpacity`    | 0..1 / 0.01         | **0..0.8 / 0.05**     | 0.22    | lin     |                                   |                                                                                                                      |
| `pedal.borderWidth`    | 0.01..0.4 / 0.01    | **0.02..0.4 / 0.01**  | 0.06    | **log** |                                   |                                                                                                                      |
| `pedal.borderGlow`     | 0..3 / 0.05         | 0..3 / 0.05           | 0.3     | **log** |                                   |                                                                                                                      |
| `pedal.cornerRadius`   | 0..2 / 0.05         | 0..2 / 0.05           | 0       | **log** |                                   |                                                                                                                      |
| `pedal.stripeAOpacity` | 0..1 / 0.05         | 0..1 / 0.05           | 1       | lin     |                                   | range fine: steady ramp 0 → full stripes                                                                             |
| `pedal.stripeBOpacity` | 0..1 / 0.05         | 0..1 / 0.05           | 1       | lin     |                                   | range fine, but with the default dark stripe-B colour all 7 frames look alike: only matters when B is a light colour |
| `pedal.stripeWidth`    | 0.05..3 / 0.05      | **0.4..3 / 0.05**     | 1       | **log** |                                   |                                                                                                                      |
| `pedal.stripeBalance`  | 0.2..0.8 / 0.05     | 0.2..0.8 / 0.05       | 0.5     | lin     |                                   |                                                                                                                      |
| `pedal.stripeAngle`    | -75..75 / 5         | -75..75 / 5           | 45      | lin     |                                   |                                                                                                                      |

### effects

| key                             | old min..max / step | final min..max / step | default | slider  | budget (Medium 2048, last render) | why                                                                                                                                                                    |
| ------------------------------- | ------------------- | --------------------- | ------- | ------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `effects.minScale`              | 0.2..3 / 0.05       | **0.2..2 / 0.05**     | 0.6     | **log** | peak 631                          |                                                                                                                                                                        |
| `effects.maxScale`              | 0.2..3 / 0.05       | **0.5..3 / 0.05**     | 1.7     | **log** | peak 815                          |                                                                                                                                                                        |
| `effects.sparksSize`            | 0.2..3 / 0.05       | **0.35..2.5 / 0.05**  | 1       | **log** | peak 487                          |                                                                                                                                                                        |
| `effects.sparksCount`           | 0.2..3 / 0.05       | **0.35..3 / 0.05**    | 1       | **log** | peak 1476                         |                                                                                                                                                                        |
| `effects.sparksLifetime`        | 0.2..3 / 0.05       | **0.35..3 / 0.05**    | 1       | **log** | peak 1106                         |                                                                                                                                                                        |
| `effects.sparksSpread`          | 0..3 / 0.05         | 0..3 / 0.05           | 1       | lin     | peak 487                          |                                                                                                                                                                        |
| `effects.scalingSparksSize`     | 0.2..3 / 0.05       | **0.3..1.5 / 0.05**   | 1       | **log** | peak 414                          |                                                                                                                                                                        |
| `effects.scalingSparksCount`    | 0.2..3 / 0.05       | **0.2..2 / 0.05**     | 1       | **log** | peak 1200                         |                                                                                                                                                                        |
| `effects.scalingSparksLifetime` | 0.2..3 / 0.05       | **0.2..2 / 0.05**     | 1       | **log** | peak 926                          | 0.2 visible as a flash; 3 holds a white blob over the keys through t 1.2                                                                                               |
| `effects.scalingSparksSpread`   | 0..3 / 0.05         | 0..3 / 0.05           | 1       | lin     | peak 414                          |                                                                                                                                                                        |
| `effects.flameSize`             | 0.2..3 / 0.05       | **0.3..1.75 / 0.05**  | 1       | **log** | peak 358                          |                                                                                                                                                                        |
| `effects.flameCount`            | 0.2..3 / 0.05       | **0.2..2 / 0.05**     | 1       | **log** | peak 1026                         |                                                                                                                                                                        |
| `effects.flameLifetime`         | 0.2..3 / 0.05       | **0.2..2 / 0.05**     | 1       | **log** | peak 881                          |                                                                                                                                                                        |
| `effects.flameSpread`           | 0..3 / 0.05         | **0..2 / 0.05**       | 1       | lin     | peak 358                          |                                                                                                                                                                        |
| `effects.explosionSize`         | 0.2..3 / 0.05       | **0.4..3 / 0.05**     | 1       | **log** | peak 694                          |                                                                                                                                                                        |
| `effects.explosionCount`        | 0.2..3 / 0.05       | **0.3..2.5 / 0.05**   | 1       | **log** | peak 1953, evicts at 3            |                                                                                                                                                                        |
| `effects.explosionLifetime`     | 0.2..3 / 0.05       | **0.25..3 / 0.05**    | 1       | **log** | peak 1565                         |                                                                                                                                                                        |
| `effects.explosionSpread`       | 0..3 / 0.05         | 0..3 / 0.05           | 1       | lin     | peak 694                          |                                                                                                                                                                        |
| `effects.glitterSize`           | 0.2..3 / 0.05       | **0.5..3 / 0.05**     | 1       | **log** | peak 719                          | **Round 2:** Engine fix: 7 big white-hot flecks per onset instead of 14 small dim ones. Range kept.                                                                    |
| `effects.glitterCount`          | 0.2..3 / 0.05       | **0.35..2 / 0.05**    | 1       | **log** | peak 1790, evicts at 2.5          | **Round 2:** After the glitter fix: 1.7 peaks at 1246 of 2048 with nothing cut short; 2.5 peaks at 1790 but onset bursts briefly fill the pool (62 cut short). 0.35–2. |
| `effects.glitterLifetime`       | 0.2..3 / 0.05       | **0.4..2.5 / 0.05**   | 1       | **log** | peak 1045                         | **Round 2:** After the glitter fix: 1.5 peaks at 978. Up to 2.5.                                                                                                       |
| `effects.glitterSpread`         | 0..3 / 0.05         | 0..3 / 0.05           | 1       | lin     | peak 719                          |                                                                                                                                                                        |
| `effects.sustainSize`           | 0.2..3 / 0.05       | **0.35..1.5 / 0.05**  | 1       | **log** | peak 112                          | **Round 2:** Engine fix: embers are 3× bigger with white-hot cores (they were ~2 px and the note colour). Now visible at the default; 0.35 faint, 1.5 loud. 0.35–1.5.  |
| `effects.sustainCount`          | 0.2..3 / 0.05       | **0.35..3 / 0.05**    | 1       | **log** | peak 324                          | **Round 2:** After the ember fix: nothing at 0.2, faint from 0.35, dense at 3 (324 live, no eviction). 0.35–3.                                                         |
| `effects.sustainLifetime`       | 0.2..3 / 0.05       | **0.35..2.5 / 0.05**  | 1       | **log** | peak 223                          | **Round 2:** After the ember fix: barely there below 0.35; at 3 they clump into blobs. 0.35–2.5.                                                                       |
| `effects.sustainSpread`         | 0..3 / 0.05         | 0..3 / 0.05           | 1       | lin     | peak 112                          | **Round 2:** Not re-judged after the ember fix (spread only scatters them); linear, kept.                                                                              |
| `effects.pulseAmount`           | 0..2 / 0.05         | **0.15..1.5 / 0.05**  | 0.5     | **log** | peak 0                            |                                                                                                                                                                        |
| `effects.pulseDecayMs`          | 40..1000 / 10       | **100..1000 / 10**    | 200     | **log** | peak 0                            |                                                                                                                                                                        |
| `effects.soundingGlowAmount`    | 0..1 / 0.05         | 0..1 / 0.05           | 0.3     | lin     |                                   |                                                                                                                                                                        |
| `effects.keySpillStrength`      | 0..1 / 0.05         | 0..1 / 0.05           | 0.25    | lin     |                                   |                                                                                                                                                                        |
| `effects.keySpillSpread`        | 0.5..4 / 0.25       | **0.75..4 / 0.25**    | 1.5     | **log** |                                   |                                                                                                                                                                        |
| `effects.keyConeStrength`       | 0..1 / 0.05         | **0..1 / 0.1**        | 0.4     | lin     |                                   | **Round 2:** Low-camera pass, in motion: a pink wash on the keys around a held note, from faint (20%) to strong (100%). Range kept, step 0.1.                          |
| `effects.keyConeSpread`         | 0.25..3 / 0.05      | 0.25..3 / 0.05        | 1       | **log** |                                   | **Round 2:** Low-camera pass, in motion: 0.25 a tight glow, 3 reaches about two keys either side. Range kept, log.                                                     |

### render

| key                     | old min..max / step | final min..max / step | default | slider  | budget (Medium 2048, last render) | why                                                                                                        |
| ----------------------- | ------------------- | --------------------- | ------- | ------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `render.bloomStrength`  | 0..3 / 0.05         | 0..3 / 0.05           | 0.8     | **log** |                                   |                                                                                                            |
| `render.bloomRadius`    | 0..1 / 0.05         | **0..1 / 0.1**        | 0.4     | lin     |                                   |                                                                                                            |
| `render.bloomThreshold` | 0..1 / 0.01         | **0..0.4 / 0.02**     | 0.1     | lin     |                                   | pair grid: at ≥0.33 bloom is gone at every strength, so 0.4–1 is dead travel; 0.01 steps indistinguishable |

## Steps made coarser (neighbouring values looked identical)

| key                                                                                                  | old step | new step                                    |
| ---------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------- |
| `keyboard.thickness`, `keyboard.blackHeight`, `keyboard.pressDepthWhite`, `keyboard.pressDepthBlack` | 0.01     | 0.05                                        |
| `keyboard.gap`                                                                                       | 0.005    | 0.01                                        |
| `keyboard.pivotOffsetWhite`, `keyboard.pivotOffsetBlack`                                             | 0.1      | 0.5 (range now 0–8; black default 8.04 → 8) |
| `highway.blackLaneShadingStrength`, `opacity.lane`, `opacity.bar`, `opacity.beat`                    | 0.01     | 0.05                                        |
| `notes.shadowStrength`, `pedal.fillOpacity`                                                          | 0.01     | 0.05                                        |
| `render.bloomThreshold`                                                                              | 0.01     | 0.02                                        |
| `render.bloomRadius`, `effects.keyConeStrength`, `names.shadow`                                      | 0.05     | 0.1                                         |
| `names.fadeLength`                                                                                   | 0.01     | 0.02                                        |

Every 0.05 step on the log effect sliders is fine.

## Particle budget at Medium (2048)

- Only explosion count truncates on its own: at 3 (peak 1953, evicting); its max is 2.5.
- Glitter truncated from 1.75 before round 2. With half the particles, count 2.5 still cuts 62 short in onset bursts (per-frame peak 1790), so count goes to 2 and lifetime to 2.5 (peak 1045, none cut).
- The pair grids show count × lifetime together. They don't log particle counts, so where combined values truncate is only inferred:
  - Glitter (round 2) halved its load: count × lifetime up to about 1.7 × 1.7 stays under the budget; 2.5 × 2.5 will be cut short.
  - Flame and scaling sparks white out the keys from about 1.2 × 1.2. That is glow piling up, not the budget, so a "medium" look should stay at or below 1 × 1 on those two.
  - Sparks and explosion stay readable even at 3 × 3.
- Sustain embers peak at 324 live particles (count 3), so the budget isn't a concern there.
- Section C looks should keep flame and scaling sparks near 1 × 1 (count × lifetime) for "medium".

## Pair grids

- **Bloom strength × threshold:** the only loud cell is strength 3 at threshold 0, a magenta haze, and notes still read. From threshold ≈ 0.33 bloom is gone at every strength, hence the new threshold max of 0.4.
- **Bloom strength × radius:** radius shows only at strength 3, and only slightly.
- **Edge width × intensity:** width 0.01 shows nothing at any intensity. 0.2 × 3 is a loud neon halo but still reads, so the width max stays 0.2. The separate width sheet alone suggested 0.15.
- **Vignette × highway colour (dark, default, light):** subtle on all three. At 1 it darkens corners and keyboard ends but never hides notes.
- **Count × lifetime (each onset effect, and sustain):** see the budget notes above.

## Log sliders with a zero

Settings with min 0 where 0 means off (the glows, `cornerRadius`, bloom strength) keep a **0 stop at the far left**, then run log from the first step to the max. `edgeIntensity` and `pulseAmount` have their own switches, so they start at 0.1 and 0.15 instead. Spread knobs and `names.fadeLength` are linear: 0 is an ordinary value for them, not off.

## Open points

- **Shadow strength** has no visible effect on the default dark highway (see its row). Not a range problem; 9.2 puts black notes back on the highway, which decides the shadow's future.
- **Pivot offsets** show no visible difference at the default press depth; 0–8 is a realism range, not a visual one.
- **Octave glow** is stronger at the same value after the line-glow fix (shared shader). Classic has octaves off, so it doesn't change; looks with octaves on and a high glow will look brighter.

## Samples (JPEG; all sheets: `npm run test:visual -- -g range`)

Round 2:

| sheet                                                                        | what it shows                                             |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| [`effects.sustainSize`](effects.sustainSize.jpg)                             | embers after the fix: visible at the default, loud at 1.5 |
| [`effects.sustainLifetime`](effects.sustainLifetime.jpg)                     | embers clumping at 3 (max now 2.5)                        |
| [`effects.glitterCount`](effects.glitterCount.jpg)                           | glitter after the fix: white flecks, half the particles   |
| [`lines.beatGlow`](lines.beatGlow.jpg)                                       | beat glow working; bands at 3 (max now 2)                 |
| [`lines.barGlow`](lines.barGlow.jpg)                                         | bar glow from 0.25 to a strong band at 3                  |
| [`lines.bordersGlow`](lines.bordersGlow.jpg)                                 | the border halo with the new glow                         |
| [`highway.vignette`](highway.vignette.jpg)                                   | the stronger vignette                                     |
| [`notes.headHeight.tilt-25`](notes.headHeight.tilt-25.jpg)                   | low camera: flat at 1.2 mm, boxy at 19 mm                 |
| [`notes.shadowStrength.tilt-25`](notes.shadowStrength.tilt-25.jpg)           | low camera: no visible shadow on the dark highway         |
| [`keyboard.pressDepthWhite.tilt-25`](keyboard.pressDepthWhite.tilt-25.jpg)   | low camera, mid-press                                     |
| [`keyboard.pivotOffsetWhite.tilt-25`](keyboard.pivotOffsetWhite.tilt-25.jpg) | low camera, mid-press: no visible difference              |
| [`effects.keyConeStrength.tilt-25`](effects.keyConeStrength.tilt-25.jpg)     | low camera, in motion                                     |
| [`highway.lookAheadBeats.tilt-85`](highway.lookAheadBeats.tilt-85.jpg)       | 32 beats reads from above                                 |
| [`names.textSize.tilt-85`](names.textSize.tilt-85.jpg)                       | 18 px labels from above                                   |

Round 1 (proposal):

| sheet                                                          | what it shows                                     |
| -------------------------------------------------------------- | ------------------------------------------------- |
| [`lines.nowWidth`](lines.nowWidth.jpg)                         | the now line at 9 mm becomes a band over the keys |
| [`noteStyle.edgeWidth`](noteStyle.edgeWidth.jpg)               | the low end is invisible                          |
| [`effects.flameSize`](effects.flameSize.jpg)                   | a motion sheet; whites out at 3                   |
| [`bloom-strength-x-threshold`](bloom-strength-x-threshold.jpg) | a pair grid; threshold dead above 0.33            |
