# Milestone 9.1 §B — slider ranges (proposal, awaiting approval)

Status: **proposed, not applied**. The registry is unchanged until these are approved (m9-1 §B.5).

## How the sheets were made

- `npm run test:visual -- -g range` (`e2e/ranges.spec.ts`): **98** numeric playfield settings (sidebar, minus the device-cost keys) and **10** pair grids, 108 sheets.
- **Static settings:** Pedal demo, paused on bar 2, `?animTime=3`, 1280×720, at the defaults plus whatever must be on for the setting to show. Examples: stripes fill for stripe knobs, the border for border knobs, one onset effect alone for its knobs. The spec now **fails** if a setting would be hidden, so it would have no effect, under its sheet's settings.
- **Values:** 7 per sheet: min, default, and 0.2/0.4/0.6/0.8/1 of the way to the max, snapped to the step. Spacing is log for perceptual settings (the old "scale" column) and linear otherwise.
- **Motion:** onset knobs, `minScale`/`maxScale` and sustain knobs use the long demo's dense chords; pulse uses the Pedal demo. Both are captured with `?capture=1`, a fixed step: onsets at t 0.15/0.5/1.2 s, sustain at 0.5/1.2/2.5 s, pulse at 0.05/0.15/0.4 s.
- **Budget:** the capture hook logs the peak live particles against the Medium budget (2048) and whether any were cut short.
- **Crops:** near 1:1 where each setting acts (keys, now line, border, grid, notes, particles, arrival). Whole-frame settings keep the full frame. The label under each frame is the value as the slider shows it, followed by the stored value in brackets.
- **Sheets:** `test-results/visual/ranges.zip` (outside git). Samples are in this folder (below).

**Reading the table:** values are **stored** values, as in the registry (mm settings are stored in key widths, ×23.5 for mm; percent settings are stored as 0–1). **Bold** marks a change. "scale" is the proposed slider scale. Where it reads `old→new`, the old value is the spacing the sheet used.

### camera

| key                     | old min..max / step | new min..max / step | default | scale | budget (Medium 2048) | why                                                                                                     |
| ----------------------- | ------------------- | ------------------- | ------- | ----- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| `camera.tiltDeg`        | 20..85 / 1          | **25..85 / 1**      | 45      | lin   |                      | 20° flattens far notes to specks; 25° still a dramatic low view; 85° top-down reads well                |
| `camera.distanceOffset` | -0.6..1 / 0.05      | -0.6..1 / 0.05      | 0       | lin   |                      | range fine: -0.6 is a deliberate close-up (~3 octaves), 1 a small whole-keyboard view                   |
| `camera.pan`            | -26..26 / 0.5       | -26..26 / 0.5       | 0       | lin   |                      | range fine: ±26 pushes half the keyboard off-screen at distance 0, but pan is meant for zoomed-in views |

### keyboard

| key                         | old min..max / step | new min..max / step | default  | scale | budget (Medium 2048) | why                                                                                                                 |
| --------------------------- | ------------------- | ------------------- | -------- | ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `keyboard.thickness`        | 0.2..1.2 / 0.01     | **0.2..1.2 / 0.05** | 0.6      | lin   |                      | range fine; only the front lip changes at the default camera, 0.01 (0.2 mm) steps are indistinguishable             |
| `keyboard.gap`              | 0..0.2 / 0.005      | **0..0.2 / 0.01**   | 0.06     | lin   |                      | 0 merges keys, 0.2 (4.7 mm) is wide but intentional; 0.005 steps indistinguishable                                  |
| `keyboard.blackLengthRatio` | 0.5..0.8 / 0.01     | 0.5..0.8 / 0.01     | 0.63     | lin   |                      | range fine: 50% stubby to 80% long, every step visible                                                              |
| `keyboard.blackHeight`      | 0..1.2 / 0.01       | **0..1.2 / 0.05**   | 0.510638 | lin   |                      | 0 flattens black keys; above ~0.7 changes little from above but matters at low tilt; 0.01 too fine                  |
| `keyboard.edgeSize`         | 0.005..0.12 / 0.005 | 0.005..0.12 / 0.005 | 0.04     | log   |                      | range fine: hairline bevel to a chunky 2.8 mm bevel                                                                 |
| `keyboard.pressDepthWhite`  | 0..1.2 / 0.01       | **0..1.2 / 0.05**   | 0.22     | lin   |                      | barely visible from the default camera (only the front lip moves); keep for low tilts; 0.01 too fine                |
| `keyboard.pressDepthBlack`  | 0..1.12 / 0.01      | **0..1.12 / 0.05**  | 0.3      | lin   |                      | no visible change from the default camera; keep for low tilts; 0.01 too fine                                        |
| `keyboard.pivotOffsetWhite` | 0..16 / 0.1         | **0..16 / 0.5**     | 0        | lin   |                      | no visible effect in a still frame (only shapes the press motion); can't judge the range here; 0.1 too fine         |
| `keyboard.pivotOffsetBlack` | 0..16 / 0.1         | **0..16 / 0.5**     | 8.04255  | lin   |                      | no visible effect in a still frame; can't judge here; 0.1 too fine (default isn't on a 0.5 step: keep or snap to 8) |

### highway

| key                                | old min..max / step | new min..max / step | default | scale       | budget (Medium 2048) | why                                                                                                                                                                                                                               |
| ---------------------------------- | ------------------- | ------------------- | ------- | ----------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `highway.lookAheadBeats`           | 2..32 / 1           | **2..24 / 1**       | 8       | **lin→log** |                      | above ~24 beats heads shrink to 1–2 px and chords merge; 2→8 is the big perceptual change                                                                                                                                         |
| `highway.blackLaneShadingStrength` | 0..1 / 0.01         | **0..1 / 0.05**     | 0.22    | lin         |                      | invisible below ~0.15; 1.0 bold stripes but notes still read; 0.01 too fine                                                                                                                                                       |
| `highway.vignette`                 | 0..1 / 0.05         | 0..1 / 0.05         | 0.2     | lin         |                      | even 1.0 only darkens the corners slightly; the max is weak, not too strong (engine strength could go up) / pair grid: subtle on all three highway colours; 1 darkens corners and keyboard ends but never hides notes; range fine |
| `opacity.lane`                     | 0..1 / 0.01         | **0..1 / 0.05**     | 0.35    | lin         |                      | lane lines stay subtle even at 1.0; nothing clips; 0.01 too fine                                                                                                                                                                  |
| `opacity.bar`                      | 0..1 / 0.01         | **0..1 / 0.05**     | 0.6     | lin         |                      | range fine; 0.6→1.0 differ little; 0.01 too fine                                                                                                                                                                                  |
| `opacity.beat`                     | 0..1 / 0.01         | **0..0.6 / 0.05**   | 0.12    | lin         |                      | invisible below ~0.1; above ~0.6 beat lines look like bar lines and the bar/beat difference is lost                                                                                                                               |

### lines

| key                  | old min..max / step | new min..max / step  | default | scale | budget (Medium 2048) | why                                                                                                                                              |
| -------------------- | ------------------- | -------------------- | ------- | ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lines.nowWidth`     | 0.02..0.4 / 0.01    | **0.02..0.3 / 0.01** | 0.08    | log   |                      | 0.02 barely there; 0.4 (9 mm) becomes a white band over the key tops; 0.3 stays intentional                                                      |
| `lines.nowGlow`      | 0..3 / 0.05         | 0..3 / 0.05          | 0.6     | log   |                      | range fine: 0 off, 3 a soft white haze above the keys without hiding notes                                                                       |
| `lines.bordersWidth` | 0.01..0.3 / 0.01    | 0.01..0.3 / 0.01     | 0.05    | log   |                      | range fine: hairline to a bold 7 mm rail, all intentional                                                                                        |
| `lines.bordersGlow`  | 0..3 / 0.05         | 0..3 / 0.05          | 0.3     | log   |                      | almost no visible glow even at 3 (at default width); max is weak rather than too strong; check engine scale                                      |
| `lines.octavesWidth` | 0.01..0.3 / 0.01    | 0.01..0.3 / 0.01     | 0.05    | log   |                      | range fine: 0.01 barely there, 0.3 bold glowing rails that are loud but notes still read                                                         |
| `lines.octavesGlow`  | 0..3 / 0.05         | 0..3 / 0.05          | 0.5     | log   |                      | range fine: 0 crisp to 3 a wide teal haze; low-end steps close together (log helps)                                                              |
| `lines.barGlow`      | 0..1 / 0.05         | **0..3 / 0.05**      | 0       | log   |                      | invisible below ~0.5; 1.0 only a faint haze; max too low, raise to 3 like the other glows                                                        |
| `lines.beatGlow`     | 0..1 / 0.05         | **0..3 / 0.05**      | 0       | log   |                      | no visible effect at any value with beat opacity at 0.12; glow seems to scale with the faint line; raise max and re-check with beat opacity ~0.4 |

### notes

| key                               | old min..max / step | new min..max / step | default  | scale | budget (Medium 2048) | why                                                                                                                                                           |
| --------------------------------- | ------------------- | ------------------- | -------- | ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notes.headHeight`                | 0.05..0.8 / 0.05    | 0.05..0.8 / 0.05    | 0.35     | lin   |                      | range fine as far as visible; at 45° tilt heads barely change across 1–19 mm in the notes crop; recheck with a lower tilt before trimming                     |
| `notes.blackLift`                 | 0..0.8 / 0.01       | 0..0.8 / 0.01       | 0.510638 | lin   |                      | Re-rendered with Manual mode and the notes crop: from the 45° camera the lift barely shows at any value. Range kept; needs a low-tilt sheet (open question 2) |
| `notes.shadowStrength`            | 0..1 / 0.01         | **0..1 / 0.05**     | 0.45     | lin   |                      | no visible difference 0–100% in this frame; step 0.01 indistinguishable → 0.05; check the shadow renders at all                                               |
| `notes.sustainCenterTransparency` | 0..1 / 0.05         | **0..0.85 / 0.05**  | 0.25     | lin   |                      | at 100% the sustain disappears and heads go dark/hollow; 80% is already ghostly                                                                               |
| `notes.sustainEdgeTransparency`   | 0..1 / 0.05         | 0..1 / 0.05         | 0.75     | lin   |                      | range fine; subtle but monotonic, 0 solid to 1 soft edges                                                                                                     |
| `keys.fadeBeats`                  | 0..4 / 0.25         | 0..4 / 0.25         | 1        | lin   |                      | range fine; 0 = no approach colour (intentional off), 2.5–4 look alike in a still but differ in time                                                          |
| `keys.maxApproachAlpha`           | 0..1 / 0.05         | **0.1..1 / 0.05**   | 0.7      | lin   |                      | 0 is invisible (nothing to see), 20% is barely there; 100% is strong but readable                                                                             |

### noteStyle

| key                               | old min..max / step | new min..max / step   | default | scale | budget (Medium 2048) | why                                                                                                                                                                                                                                                                               |
| --------------------------------- | ------------------- | --------------------- | ------- | ----- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `noteStyle.gradientEnd`           | 0..1 / 0.05         | **0..0.8 / 0.05**     | 0.35    | lin   |                      | 0.8 and 1 look like a flat fill (no gradient left); 0 is a strong dark fade, intentional                                                                                                                                                                                          |
| `noteStyle.headStripeAOpacity`    | 0..1 / 0.05         | 0..1 / 0.05           | 1       | lin   |                      | range fine; heads are ~20 px in this view, so differences are subtle but 0 and 1 are both intentional                                                                                                                                                                             |
| `noteStyle.headStripeBOpacity`    | 0..1 / 0.05         | 0..1 / 0.05           | 1       | lin   |                      | range fine; same as A                                                                                                                                                                                                                                                             |
| `noteStyle.headStripeWidth`       | 0.05..3 / 0.05      | **0.05..1 / 0.05**    | 0.35    | log   |                      | above ~1 (24 mm) a head holds one stripe at most and looks plain; 1.2 mm stripes still resolve                                                                                                                                                                                    |
| `noteStyle.headStripeBalance`     | 0.2..0.8 / 0.05     | 0.2..0.8 / 0.05       | 0.5     | lin   |                      | range fine; geometric, heads too small to judge finer                                                                                                                                                                                                                             |
| `noteStyle.headStripeAngle`       | -75..75 / 5         | -75..75 / 5           | 45      | lin   |                      | range fine; geometric                                                                                                                                                                                                                                                             |
| `noteStyle.sustainStripeAOpacity` | 0..1 / 0.05         | 0..1 / 0.05           | 1       | lin   |                      | range fine; 0 = high-contrast stripes, about 60% nearly solid, 1 shows stripes again (A vs B colour)                                                                                                                                                                              |
| `noteStyle.sustainStripeBOpacity` | 0..1 / 0.05         | 0..1 / 0.05           | 1       | lin   |                      | range fine; 0 bold, 40–60% subtle, 1 clear                                                                                                                                                                                                                                        |
| `noteStyle.sustainStripeWidth`    | 0.05..3 / 0.05      | **0.1..1.5 / 0.05**   | 0.35    | log   |                      | 0.05 (1.2 mm) aliases into a shimmer on far sustains; at 3 (71 mm) the sustain shows one band and looks solid                                                                                                                                                                     |
| `noteStyle.sustainStripeBalance`  | 0.2..0.8 / 0.05     | 0.2..0.8 / 0.05       | 0.5     | lin   |                      | range fine; both ends clearly thin/thick stripes                                                                                                                                                                                                                                  |
| `noteStyle.sustainStripeAngle`    | -75..75 / 5         | -75..75 / 5           | 45      | lin   |                      | range fine; ±75 gives long streaks, intentional                                                                                                                                                                                                                                   |
| `noteStyle.edgeWidth`             | 0.01..0.2 / 0.005   | **0.02..0.2 / 0.005** | 0.04    | log   |                      | 0.01–0.035 look identical; at 0.2 the edge washes the note fill pale / pair grid: 0.01 invisible at any intensity; 0.2 × 3 is a loud neon halo, still readable, so keep 0.2                                                                                                       |
| `noteStyle.edgeIntensity`         | 0..3 / 0.05         | **0.1..3 / 0.05**     | 0.5     | log   |                      | 0–0.25 hardly differ (edge glow is a toggle, so 0 isn't needed as off; log needs min > 0); 3 is a loud halo but notes stay readable / pair grid: 0.05 and 0.2 look the same at every width (edge glow already has an on/off toggle, so 0 is redundant); 3 is loud but intentional |

### names

| key                | old min..max / step | new min..max / step | default | scale       | budget (Medium 2048) | why                                                                                                                   |
| ------------------ | ------------------- | ------------------- | ------- | ----------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `names.textSize`   | 10..18 / 1          | **10..16 / 1**      | 12      | **log→lin** |                      | at 16–18 px labels collide and several are culled (C4, A, E vanish); 10 px still readable; range too narrow for log   |
| `names.shadow`     | 0..1 / 0.05         | **0..1 / 0.1**      | 0.6     | lin         |                      | no visible difference at this scale on the dark highway; step 0.05 → 0.1; only matters on light colours               |
| `names.showWithin` | 0.1..1 / 0.05       | 0.1..1 / 0.05       | 0.6     | lin         |                      | range fine; 10% labels only the nearest notes, 100% labels all of them                                                |
| `names.fadeLength` | 0..0.3 / 0.01       | **0..0.3 / 0.02**   | 0.15    | **log→lin** |                      | neighbours at 0.01 identical → 0.02; log with min 0 is awkward, make it linear; 0.3 still looks intentional           |
| `names.offset`     | -1..1 / 0.05        | -1..1 / 0.05        | 0       | lin         |                      | range fine; -1 puts the label under the head (partly hidden), +1 slides it onto the sustain, both deliberate          |
| `names.height`     | 0..24 / 1           | **0..18 / 1**       | 6       | lin         |                      | at 24 px labels float near the next note up and become ambiguous; 0 sits on the head, still readable                  |
| `names.keySize`    | 8..16 / 1           | **9..14 / 1**       | 11      | **log→lin** |                      | 8 px black-key sharps are unreadable; at 16 the black-key labels (F♯ G♯ A♯) run into each other; narrow range, so lin |

### cages

| key                    | old min..max / step | new min..max / step  | default | scale | budget (Medium 2048) | why                                                                                                                                                  |
| ---------------------- | ------------------- | -------------------- | ------- | ----- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pedal.fillOpacity`    | 0..1 / 0.01         | **0..0.8 / 0.05**    | 0.22    | lin   |                      | 0 = border-only is a valid look; above ~0.8 the cage greys out the whole highway (notes still readable, but grid lost); 0.01 steps indistinguishable |
| `pedal.borderWidth`    | 0.01..0.4 / 0.01    | **0.02..0.4 / 0.01** | 0.06    | log   |                      | 0.01 is invisible at full frame; 0.4 (9 mm) is a heavy frame but intentional; log slider                                                             |
| `pedal.borderGlow`     | 0..3 / 0.05         | 0..3 / 0.05          | 0.3     | log   |                      | range fine: 0–0.6 near-identical (glow only on a thin border), 3 gives a clear halo without washing out; log slider puts resolution at the low end   |
| `pedal.cornerRadius`   | 0..2 / 0.05         | 0..2 / 0.05          | 0       | log   |                      | range fine: visible from ~0.2 (5 mm), 2 (47 mm) is round but tidy; log needs a 0 stop (log from 0.05)                                                |
| `pedal.stripeAOpacity` | 0..1 / 0.05         | 0..1 / 0.05          | 1       | lin   |                      | range fine: steady ramp 0 → full stripes                                                                                                             |
| `pedal.stripeBOpacity` | 0..1 / 0.05         | 0..1 / 0.05          | 1       | lin   |                      | range fine, but with the default dark stripe-B colour all 7 frames look alike: only matters when B is a light colour                                 |
| `pedal.stripeWidth`    | 0.05..3 / 0.05      | **0.4..3 / 0.05**    | 1       | log   |                      | below ~0.4 (10 mm) the stripes alias into moiré at 1280×720; 3 = big bold bands, still intentional                                                   |
| `pedal.stripeBalance`  | 0.2..0.8 / 0.05     | 0.2..0.8 / 0.05      | 0.5     | lin   |                      | range fine: thin to thick, ends both read as stripes                                                                                                 |
| `pedal.stripeAngle`    | -75..75 / 5         | -75..75 / 5          | 45      | lin   |                      | range fine: ±75 near-vertical, ±15 near-horizontal both read                                                                                         |

### effects

| key                             | old min..max / step | new min..max / step  | default | scale       | budget (Medium 2048)      | why                                                                                                                                                                                   |
| ------------------------------- | ------------------- | -------------------- | ------- | ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `effects.minScale`              | 0.2..3 / 0.05       | **0.2..2 / 0.05**    | 0.6     | log         | peak 750, none            | 0.2–0.35 read alike but are the quiet end; above ~2 soft notes already bloom like loud ones, and min>max inverts dynamics. Guard min≤max (clamp in the engine or link the sliders)    |
| `effects.maxScale`              | 0.2..3 / 0.05       | **0.5..3 / 0.05**    | 1.7     | log         | peak 815, none            | ≤0.6 the onsets nearly vanish and sit below the min-scale default (inverted); 3 = large white blooms on the keys, loud but intentional                                                |
| `effects.sparksSize`            | 0.2..3 / 0.05       | **0.35..2.5 / 0.05** | 1       | log         | peak 487, none            | 0.2 invisible; 3 bright white blobs cover the keys at every moment, 2.5 is loud but still reads as sparks                                                                             |
| `effects.sparksCount`           | 0.2..3 / 0.05       | **0.35..3 / 0.05**   | 1       | log         | peak 1476, none           | 0.2 indistinguishable from off; 3 dense but intentional (peak 1476 live, no eviction)                                                                                                 |
| `effects.sparksLifetime`        | 0.2..3 / 0.05       | **0.35..3 / 0.05**   | 1       | log         | peak 1106, none           | 0.2 gone before t 0.15; 3 lingers into t 1.2 nicely, no eviction (peak 1106)                                                                                                          |
| `effects.sparksSpread`          | 0..3 / 0.05         | **0..3 / 0.05**      | 1       | **log→lin** | peak 487, none            | range fine: 0 is a tight column (valid look), 3 scatters wide but stays intentional; lin because 0 can't be log                                                                       |
| `effects.scalingSparksSize`     | 0.2..3 / 0.05       | **0.3..1.5 / 0.05**  | 1       | log         | peak 414, none            | 0.2 barely there; from 1.75 the loud chord blows out to white over keys and notes, 3 is a whiteout                                                                                    |
| `effects.scalingSparksCount`    | 0.2..3 / 0.05       | **0.2..2 / 0.05**    | 1       | log         | peak 1200, none           | 0.2 already visible (scales with velocity); 3 whites out the chord, 1.75 loud, 2 as headroom                                                                                          |
| `effects.scalingSparksLifetime` | 0.2..3 / 0.05       | **0.2..2 / 0.05**    | 1       | log         | peak 926, none            | 0.2 visible as a flash; 3 holds a white blob over the keys through t 1.2                                                                                                              |
| `effects.scalingSparksSpread`   | 0..3 / 0.05         | **0..3 / 0.05**      | 1       | **log→lin** | peak 414, none            | range fine; little visible change below 1.3 because the bloom core dominates; lin because 0 can't be log                                                                              |
| `effects.flameSize`             | 0.2..3 / 0.05       | **0.3..1.75 / 0.05** | 1       | log         | peak 358, none            | 0.2 barely visible; 1.75 loud but keys still read; 3 whites out the whole lower third                                                                                                 |
| `effects.flameCount`            | 0.2..3 / 0.05       | **0.2..2 / 0.05**    | 1       | log         | peak 1026, none           | 0.2 visible small flames; 3 near-whiteout on chords; no eviction (peak 1026)                                                                                                          |
| `effects.flameLifetime`         | 0.2..3 / 0.05       | **0.2..2 / 0.05**    | 1       | log         | peak 881, none            | 0.2 visible; 3 keeps white glare over the keys at t 1.2                                                                                                                               |
| `effects.flameSpread`           | 0..3 / 0.05         | **0..2 / 0.05**      | 1       | **log→lin** | peak 358, none            | almost no visible difference across 0..3 (bloom core dominates); 2 keeps the slider short; lin because 0 can't be log                                                                 |
| `effects.explosionSize`         | 0.2..3 / 0.05       | **0.4..3 / 0.05**    | 1       | log         | peak 694, none            | 0.2 and 0.35 invisible, 0.6 faint rings; 3 big rings and white core, loud but rings still read                                                                                        |
| `effects.explosionCount`        | 0.2..3 / 0.05       | **0.3..2.5 / 0.05**  | 1       | log         | peak 1953, evicts at 3    | budget evicts at 3 (peak 1953 of 2048); visible change is modest across the range; 0.2 ≈ 0.35                                                                                         |
| `effects.explosionLifetime`     | 0.2..3 / 0.05       | **0.25..3 / 0.05**   | 1       | log         | peak 1565, none           | 0.2 a quick ring only; 3 lingers through t 1.2, loud but intentional (peak 1565)                                                                                                      |
| `effects.explosionSpread`       | 0..3 / 0.05         | **0..3 / 0.05**      | 1       | **log→lin** | peak 694, none            | range fine: 3 throws particles wide and thin; lin because 0 can't be log                                                                                                              |
| `effects.glitterSize`           | 0.2..3 / 0.05       | **0.5..3 / 0.05**    | 1       | log         | peak 1429, none           | 0.2–0.6 invisible at this distance; even 3 is modest (could go higher); keep 3 to stay in family                                                                                      |
| `effects.glitterCount`          | 0.2..3 / 0.05       | **0.35..1.5 / 0.05** | 1       | log         | peak 2048, evicts at 1.75 | budget evicts at 1.75 (hits 2048); visually weak at every value — glitter spends particles for little effect                                                                          |
| `effects.glitterLifetime`       | 0.2..3 / 0.05       | **0.4..1.5 / 0.05**  | 1       | log         | peak 2048, evicts at 1.75 | budget evicts at 1.75; 0.2 and 0.35 gone before t 0.15                                                                                                                                |
| `effects.glitterSpread`         | 0..3 / 0.05         | **0..3 / 0.05**      | 1       | **log→lin** | peak 1429, none           | range fine; subtle throughout; lin because 0 can't be log                                                                                                                             |
| `effects.sustainSize`           | 0.2..3 / 0.05       | 0.2..3 / 0.05        | 1       | log         | peak 112, none            | range kept provisionally: embers are barely visible at every value in the long-demo crop, so the sheet can't find the ends (see note)                                                 |
| `effects.sustainCount`          | 0.2..3 / 0.05       | 0.2..3 / 0.05        | 1       | log         | peak 324, none            | range kept provisionally: same as size; budget not a concern (≤16% of 2048)                                                                                                           |
| `effects.sustainLifetime`       | 0.2..3 / 0.05       | 0.2..3 / 0.05        | 1       | log         | peak 223, none            | range kept provisionally: only 3× shows a few specks at t 2.5 s                                                                                                                       |
| `effects.sustainSpread`         | 0..3 / 0.05         | 0..3 / 0.05          | 1       | **log→lin** | peak 112, none            | range kept provisionally: no visible difference across the sheet                                                                                                                      |
| `effects.pulseAmount`           | 0..2 / 0.05         | **0.15..1.5 / 0.05** | 0.5     | log         | peak 0, none              | 0 and 0.1 match no pulse (pulse has its own on/off); 2 turns the arriving keys and heads solid white at t 0.05 s; 0.95 is already loud                                                |
| `effects.pulseDecayMs`          | 40..1000 / 10       | **100..1000 / 10**   | 200     | log         | peak 0, none              | 40 and 80 ms decay before the first captured frame (looks the same as no pulse); 140 is the first visible; 1000 still glowing at 0.4 s, a long but intentional tail                   |
| `effects.soundingGlowAmount`    | 0..1 / 0.05         | 0..1 / 0.05          | 0.3     | lin         |                           | range fine: 0.2 faint, 1 strong magenta but keys/notes readable                                                                                                                       |
| `effects.keySpillStrength`      | 0..1 / 0.05         | 0..1 / 0.05          | 0.25    | lin         |                           | range fine: 0.2 faint, 1 lights neighbours clearly without washing the keyboard                                                                                                       |
| `effects.keySpillSpread`        | 0.5..4 / 0.25       | **0.75..4 / 0.25**   | 1.5     | log         |                           | 0.5 spill barely leaves the key (looks like spill off); 4 reaches ~3 keys, still fine                                                                                                 |
| `effects.keyConeStrength`       | 0..1 / 0.05         | **0..1 / 0.1**       | 0.4     | lin         |                           | CAN'T JUDGE: cone almost invisible in this still crop (faint tint on pressed black key from ~0.6); keep range, step 0.1; recapture in motion or a crop above the keys before trimming |
| `effects.keyConeSpread`         | 0.25..3 / 0.05      | 0.25..3 / 0.05       | 1       | log         |                           | CAN'T JUDGE: no visible change across 0.25–3 in this frame; keep until recaptured                                                                                                     |

### render

| key                     | old min..max / step | new min..max / step | default | scale | budget (Medium 2048) | why                                                                                                                                                                               |
| ----------------------- | ------------------- | ------------------- | ------- | ----- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render.bloomStrength`  | 0..3 / 0.05         | 0..3 / 0.05         | 0.8     | log   |                      | range fine: 0–0.25 indistinguishable from off at threshold 0.1; 3 with threshold 0 is loud magenta haze over the keys but notes stay readable (pair grid); keep 3 as the loud end |
| `render.bloomRadius`    | 0..1 / 0.05         | **0..1 / 0.1**      | 0.4     | lin   |                      | barely visible at default strength; pair grid shows a difference only at strength 3; keep the range, step 0.1 (0.05 neighbours identical)                                         |
| `render.bloomThreshold` | 0..1 / 0.01         | **0..0.4 / 0.02**   | 0.1     | lin   |                      | pair grid: at ≥0.33 bloom is gone at every strength, so 0.4–1 is dead travel; 0.01 steps indistinguishable                                                                        |

## Steps made coarser (neighbouring values looked identical)

| key                                                                                                  | old step | new step                                     |
| ---------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------- |
| `keyboard.thickness`, `keyboard.blackHeight`, `keyboard.pressDepthWhite`, `keyboard.pressDepthBlack` | 0.01     | 0.05                                         |
| `keyboard.gap`                                                                                       | 0.005    | 0.01                                         |
| `keyboard.pivotOffsetWhite`, `keyboard.pivotOffsetBlack`                                             | 0.1      | 0.5 (black default 8.04 → snap to 8, see Q5) |
| `highway.blackLaneShadingStrength`, `opacity.lane`, `opacity.bar`, `opacity.beat`                    | 0.01     | 0.05                                         |
| `notes.shadowStrength`, `pedal.fillOpacity`                                                          | 0.01     | 0.05                                         |
| `render.bloomThreshold`                                                                              | 0.01     | 0.02                                         |
| `render.bloomRadius`, `effects.keyConeStrength`, `names.shadow`                                      | 0.05     | 0.1                                          |
| `names.fadeLength`                                                                                   | 0.01     | 0.02                                         |

Every 0.05 step on the log effect sliders is fine.

## Particle budget at Medium (2048)

- Only three settings truncate on their own:
  - `effects.explosionCount` at 3 (peak 1953, evicting).
  - `effects.glitterCount` and `effects.glitterLifetime` at 1.75 (full at 2048).
  - The proposed maximums stop below these (2.5, 1.5 and 1.5).
- The pair grids show count × lifetime together. They don't log particle counts, so where combined values truncate is only inferred:
  - Glitter from about 1.2 × 1.2 upward will be cut short.
  - Flame and scaling sparks white out the keys from about 1.2 × 1.2. That is glow piling up, not the budget, so a "medium" look should stay at or below 1 × 1 on those two.
  - Sparks and explosion stay readable even at 3 × 3.
- Sustain embers peak at 324 live particles (count 3), so the budget isn't a concern there.

## Pair grids

- **Bloom strength × threshold:** the only loud cell is strength 3 at threshold 0, a magenta haze, and notes still read. From threshold ≈ 0.33 bloom is gone at every strength, hence the new threshold max of 0.4.
- **Bloom strength × radius:** radius shows only at strength 3, and only slightly.
- **Edge width × intensity:** width 0.01 shows nothing at any intensity. 0.2 × 3 is a loud neon halo but still reads, so the width max stays 0.2. The separate width sheet alone suggested 0.15.
- **Vignette × highway colour (dark, default, light):** subtle on all three. At 1 it darkens corners and keyboard ends but never hides notes.
- **Count × lifetime (each onset effect, and sustain):** see the budget notes above.

## Log sliders with a zero

Many of the log-proposed settings have min 0, where 0 means off: the glows, `edgeIntensity`, `pulseAmount` (now 0.15), `cornerRadius`. Proposal: a log slider keeps a **0 stop at the far left**, then runs log from the first step to the max. Spread knobs and `names.fadeLength` change to linear instead, because 0 is an ordinary value for them, not off.

## Open questions

1. **`effects.minScale` > `effects.maxScale`** inverts the dynamics (soft notes bigger than loud ones). Clamp `min ≤ max` in the engine, or link the two sliders? I suggest clamping in the engine (`min = Math.min(min, max)`), so stored values stay as set.
2. **Settings the default camera can't judge.** The 45° tilt looks down on the keys, so vertical changes hardly show. Ranges are kept for:
   - head height, black-lane lift, shadow strength;
   - press depth (white and black), pivot offsets (these only shape the press motion);
   - key cone strength and spread.

   I'd add a second pass for these: a low-tilt view (25°), with the keys captured mid-press via the fixed step. Do it before approval, or accept the ranges as they are?

3. **Sustain embers barely show at any value.** 112–324 particles are live, but each ember is 0.10–0.16 key widths, rises at about 1 unit/s and takes its note's colour, so on the dense chords it blends into the sustains. This looks like engine tuning (size or brightness), not a range problem. The sustain ranges are kept provisionally. Tune the embers in section C, or now?
4. **Weak at the max (engine strength, not range):**
   - borders glow (3× barely glows) and vignette (1 only darkens the corners);
   - bar line glow, invisible below 0.5 and faint at 1, so its max is proposed at 3;
   - beat line glow, with no effect at any value. It probably scales with the faint default beat line (opacity 0.12), but it may be a bug; I'll check it with beat opacity ≈ 0.4;
   - glitter, weak at every value yet the first effect to fill the budget.

   Should I raise these strengths in the engine now (a visual change to existing looks), or leave them for the tuning session?

5. **The black-key pivot default** (8.04, i.e. 189 mm) sits off a 0.5 step: snap it to 8, or keep step 0.1?
6. **`names.textSize`/`names.keySize`:** at 16 px and up, labels collide and get culled. The proposal caps them at 16 and 14.

## Samples

| sheet                                                          | why it's here                                     |
| -------------------------------------------------------------- | ------------------------------------------------- |
| [`highway.lookAheadBeats`](highway.lookAheadBeats.jpg)         | look-ahead max 32 → 24 beats                      |
| [`lines.nowWidth`](lines.nowWidth.jpg)                         | the now line at 9 mm becomes a band over the keys |
| [`noteStyle.edgeWidth`](noteStyle.edgeWidth.jpg)               | the low end is invisible                          |
| [`effects.flameSize`](effects.flameSize.jpg)                   | a motion sheet; whites out at 3                   |
| [`effects.glitterCount`](effects.glitterCount.jpg)             | the budget truncates at 1.75                      |
| [`bloom-strength-x-threshold`](bloom-strength-x-threshold.jpg) | a pair grid; threshold dead above 0.33            |
