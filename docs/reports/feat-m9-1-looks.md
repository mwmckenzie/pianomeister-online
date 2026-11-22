# Review report — `feat/m9-1-looks` (Milestone 9.1: Looks v2, range trimming, built-in looks)

Spec: `docs/milestones/m9-1.md`. Plan: `docs/milestones/m9-1-plan.md`. Commits are local only (not pushed), as agreed.

## 2026-11-22 — Plan, before building

### What was done

- Created branch `feat/m9-1-looks` from `main` (milestone 9 merged).
- Roadmap: 9 ✅; 9.1 added between 9 and 9.5, marked in progress.
- Wrote `docs/milestones/m9-1-plan.md`, covering:
  - where the spec meets today's code;
  - the plans for sections A, B and C;
  - the 9.5 overlay design;
  - brief changes and the build order;
  - five questions.

No code changed.

### Decisions I made that weren't in the instructions (proposed in the plan)

- The active look id stays in localStorage with the settings; saved looks move to Dexie v6 (plan S6).
- Existing `look:…` ids are kept; new looks get UUIDs (plan S4).
- Classic pins every key explicitly, so default changes can't move it.
- Range sheets for motion use a new test-only fixed-step capture hook (`?capture=1`). The hook also reports particle counts against the budget.

### Results

No code changes yet. Not run: `npm run check`, `npm run build`.

### Open questions

See plan §8. In short:

1. Resolution settings count as cost?
2. Built-ins reset the camera?
3. Backup collision rules for looks?
4. Range sheets as a zip outside git?
5. Export a modified look as saved or as current?

### Manual review checklist

- [ ] Read `docs/milestones/m9-1-plan.md` and answer §8.
- [ ] Roadmap row for 9.1.

## 2026-11-22 — Section A built; section B sheets and proposed ranges (stop for approval)

### What was done

**Section A (Looks v2), local commits `b900cf8`…`fd43c99`:**

- **Core:** looks hold the whole playfield setup except the cost keys. There is a shared file reader, a merge, and Classic pins every key.
- **Data:** saved looks moved to Dexie v6, migrated from localStorage once.
- **Backup:** format 1.3 includes looks, merged without overwriting.
- **Picker:** rename, export (saved, current, all), import, paste and drop.
- **Brief:** decisions 75, 108 and 121 updated.
- This review entry was missing for these steps; it is added here.

**Section B (ranges), commits `9996dfa`, `6310711`, `67e6d21`, `762a5d8`, `7b6fbf8`:**

- **Capture mode:** a fixed-step mode (`?capture=1`) that also reports particle budget load.
- **Sheets:** `e2e/ranges.spec.ts` renders 98 range sheets and 10 pair grids. Crops are near 1:1 where each setting acts, and labels show the value as the slider shows it, with the stored value in brackets.
- **Hidden-setting guard:** the spec now fails if a setting is hidden (inert) under its sheet's settings.
- **`docs/design/m9-1/ranges.md`:** the proposed table (60 of 98 settings change range, step or scale), the coarser steps, budget findings, pair grids, open questions and 6 sample JPEGs.
- **Zip:** `test-results/visual/ranges.zip`, 171 MB, 108 PNG sheets, outside git.
- **Registry:** not changed, as §B.5 requires.

### Decisions I made that weren't in the instructions

- **Shared sheet review.** I reviewed the 108 sheets with five parallel forks of this session, split by section and given the same criteria. Then I reconciled their tables myself; I didn't look at every sheet personally. I did spot-check the ones that matter: key depth, borders, key spill, black-lane lift, sustain count and the bloom pair.
  - **One conflict:** edge width max. Its own sheet suggested 0.15; the width × intensity grid shows 0.2 still reads. I kept 0.2.
- **Playwright output folder.** `outputDir` is now `test-results/playwright`. Playwright empties its output folder before every run, and the old setting (`test-results/`) meant any test run deleted the visual sheets, the zip and the perf results. That happened once here and cost a 26-minute re-run.
- **Proposed log sliders keep a 0 stop at the left** where 0 means off (glows, intensities). Spread knobs and name fade length become linear.
- **The zip is 171 MB, not the 30–60 MB the plan estimated,** because the near-1:1 crops make the sheets larger.

### Fixed along the way

- **Black-lane lift sheet:** it was inert, because lift only applies in Manual mode and the sheet didn't set it, and it used the keys crop. Both are fixed; the guard prevents a repeat.
- **Labels:** they printed raw stored numbers with a unit ("0.25 percent", "0.22 mm" for 5 mm). They now use the app's `formatSettingValue`.

### Results

- **`npm run check`:** passed, 681 tests in 100 files.
- **`npm run build`:** passed. Vite warns that `toLookFile` and `readLookFile` are imported both dynamically (`Library.ts`) and statically. The warning is harmless (no chunk split), but the dynamic import does nothing.
- **`npm run test:e2e`:** 148 passed (5.1 min), including the round trip "save, rename, export, delete, import the file back, Undo".
- **Range sheets:** `npm run test:visual -- -g range` passed 18 of 18 (25.8 min).
- **Particle budget at Medium (2048):** only `explosionCount` at 3× and `glitterCount`/`glitterLifetime` at 1.75× truncate. The proposed maximums stop below them.

### Known issues and open questions (details in `ranges.md` § Open questions)

1. **`minScale` > `maxScale`** inverts dynamics. Clamp it in the engine (my suggestion), or link the sliders?
2. **Settings the 45° camera can't judge:** head height, black-lane lift, shadow strength, press depths, pivots, key cone. Their ranges are kept. Do a low-tilt and mid-press pass before approval, or accept them?
3. **Sustain embers barely show at any value.** This looks like engine tuning. Tune them in section C, or now?
4. **Weak at max:** borders glow, vignette, bar and beat line glow (beat glow shows no effect at all, possibly a bug) and glitter. Raise their engine strength now, or in the tuning session?
5. **Black-key pivot default (8.04):** snap to 8 with step 0.5?
6. **Label size caps:** text 16, key labels 14, because larger sizes collide.

### Manual review checklist

- [ ] Read `docs/design/m9-1/ranges.md` and approve or amend the table.
- [ ] Skim `test-results/visual/ranges.zip`, especially the effects and pairs.
- [ ] Answer the six open questions.
- [ ] Once approved, I'll do step 5: registry ranges, log sliders, clamping tests.

## 2026-11-22 — Section B round 2: review answers, engine strengths, registry ranges

### What was done

- **Roadmap:** 9.2 replaced by "Practice clarity", covering loop visibility, black notes back on the highway, deeper black keys, open Home on a new session, and the pickers opening on the current song. The "bookmarks can have a look" idea was already under 9.5. Commit `7d55ba2`.
- **Engine (`df85440`):**
  - **Line glow:** borders, octaves, bar and beat lines now glow in the line's hue at full brightness, plus a soft aura for the bloom.
  - **Vignette:** reaches full strength in the corners.
  - **Embers:** about 3× bigger, with white-hot cores.
  - **Glitter:** 7 big white flecks per onset instead of 14 small dim ones.
- **Settings (`aa449e1`, `f4e4408`):**
  - **Log sliders:** registry `scale: 'log'`, with a pure position ↔ value mapping in `core/settings/logSlider.ts`, a 0 stop where 0 means off, and arrow keys that never stall.
  - **Size at softest clamp:** `velocityScaleBounds` clamps Size at softest to Size at loudest in the engine, and the slider shows "Limited by Size at loudest" (a new `limitHint` on the setting definition).
  - **Ranges:** every approved range is applied. Stored settings and imported looks clamp into them, and the defaults and built-in looks sit inside them (`trimmedRanges.spec.ts`).
  - **Defaults:** black pivot default 8; Classic's pinned 8.04 → 8.
- **Range sheets (`8930370`):** a low-camera pass at 25° (keys mid-press, the cone in motion, crops), plus look-ahead and label sizes from 25° and 85°. Spacing now follows the registry's slider scale. The hidden-setting guard also fails on disabled settings.
- **Docs (`097c73e`):** `docs/design/m9-1/ranges.md` is now the final table, with a round-2 section and 14 new sample JPEGs. The brief is updated: decision 46 (pivot 8), 47 (the clamp), 108 (ranges and log sliders), and 114 (label height 0–18, key label size 9–16).

### Decisions I made that weren't in the instructions

- **Glitter count max is 2, not 2.5.** After the fix, 2.5 still cuts 62 particles short in onset bursts, even though the per-frame peak (1790) stays under 2048. Lifetime max is 2.5 (peak 1045, none cut).
- **Ember ranges** after the fix: size 0.35–1.5, count 0.35–3, lifetime 0.35–2.5.
- **Beat glow** max is 2: at 3 it washes the highway in bands. Bar glow stays at 3.
- **Low-camera results:**
  - head height 0.1–0.8;
  - pivots 0–8 (no visible difference at the default press depth past about one key length);
  - white key depth range kept;
  - shadow strength and cone ranges kept.
- **Shadow strength has no visible effect** on the default dark highway: a black shadow on `#070B16` has nothing to darken. I didn't change it, since 9.2 reworks black notes.
- **Octave glow** got stronger at the same value, because it shares the line shader. Classic has octaves off, so Classic is unchanged.
- **Steps that fell off the grid:** the black key depth limit (0.52) is now off the 0.05 grid, so End lands on 0.5. Three e2e tests were updated for the coarser steps.
- **Playwright artifacts** now go to `test-results/playwright` (from round 1). Sheets survive any run.

### Results

- **`npm run check`:** passed, 722 tests in 103 files.
- **`npm run build`:** passed.
- **`npm run test:e2e` (chromium project):** 148 passed.
  - In the first full run, 4 failed: three needed the step updates above, and one was the picker's hover popover, which passed on re-run. I count that one as a flake under load.
- **`polish` project:** 20 passed, including the new "log sliders step through the dense low end; a limited size says why".
  - **Correction to round 1:** `npm run test:e2e` runs only the `chromium` project. The round-1 claim that 148 included the looks round trip was wrong. That test is in `polish`, which passes now (20 of 20).
- **Range sheets re-rendered:** lines, highway, glitter, effects-motion, pairs and the low-camera pass, all passing. I reviewed every touched sheet myself this round (glows, vignette, embers, glitter, all low-camera and 25°/85° sheets).
- **Viewed:** the "Limited by Size at loudest" hint and log thumb positions in the production preview.

### Known issues and open questions

- Shadow strength and the pivots still have little visible effect (see `ranges.md` § Open points).
- The Vite warning about `toLookFile`/`readLookFile` being both dynamically and statically imported remains (harmless).

### Manual review checklist

- [ ] `docs/design/m9-1/ranges.md`: the final table and round 2.
- [ ] Samples: embers (`effects.sustainSize.jpg`), glitter, beat and bar glow, the low-camera JPEGs.
- [ ] In the app: drag a glow slider (log, 0 stop), arrow keys at the low end; set Size at loudest below softest and see the hint.
- [ ] Classic still looks like Classic (only its black pivot moved 8.04 → 8).

## 2026-11-22 — Section C: built-in looks (stop for review)

### What was done

- **Looks (`b30dca4`):** `BUILT_IN_LOOKS` has the thirteen new looks after Classic, in the spec's picker order, with ids `builtin:<slug>`.
  - Each is a pinned copy of the 9.1 defaults (`BASE`) plus its own changes, so a later default change never moves a look; Classic stays pinned as before.
  - Levels use the trimmed ranges: subtle / medium / strong = 20 / 50 / 80 % of the slider, its log position for log sliders. They are written as literals, with the level in a comment.
- **Unit tests (`BUILT_IN_LOOKS.spec.ts`):**
  - order and ids;
  - complete (every look key, nothing else);
  - default camera, with Fireworks' longer look-ahead;
  - the options the spec names, per look;
  - at most one onset effect;
  - every look in range (already in `trimmedRanges.spec.ts`).
- **Visual test (`9acc6d3`, `e2e/looks.spec.ts`, `npm run test:visual -- -g looks`):**
  - each look at 1280×720 at quality Off and Medium, captured playing on the fixed step (Pedal demo bar 2, 0.4 s in), so effects show;
  - files `test-results/visual/looks/<slug>.<off|medium>.png`, plus `all-looks.png` (Medium).
  - JPEG in the repo: `docs/design/m9-1/all-looks.jpg`.
- **Brief (`c89f0cd`):** decision 121 lists the built-ins.

### Substitutions (a named option that isn't a setting)

- **Blueprint "Outline fill in `#6FA8FF`":** there is no note colour setting, so the notes keep their pitch colours in Outline. The `#6FA8FF` goes on the borders, octave lines and pedal border.
- **Stardust "Gradient sustains in `#E9E4FF`-ish light":** a light gradient tail (gradient end 0.65) instead of a colour.
- **Aurora "Glow in Secondary":** the highway borders glow in Secondary (medium).
- **Crystal "Cool lines in Primary":** the now line and the borders in Primary.
- **Fireworks "all in Pitch colour":** notes are always pitch-coloured; nothing to set.
- **Night Focus "lanes barely visible":** lane opacity 0.1.
- **Mist "no lines except a thin now line":** borders and octaves off, and lane, bar and beat opacity 0.
- **Primary and Secondary** are referenced as the menu colours (`primary`, `secondary`), which default to the named hexes. A user who changes their menu colours changes those lines too; that is decision 111's existing rule.

### Decisions I made that weren't in the instructions

- **Onsets:** "Scaling sparks", "Glitter", "Flame burst" and "Explosion" looks turn the default Sparks off, so the named effect reads on its own. Aurora and Mist name no onsets; as soft looks they have Sparks off too.
- **Cage stripes:** Synthwave's and Hazard's pedal-cage stripes are quiet (stripe A at 0.25 / 0.2, B at 0.5). The Pedal demo holds the pedal almost throughout, and at full strength Hazard's yellow cage stripes hid its yellow-striped notes. Synthwave's stripe colours aren't named; I used the border cyan on the highway colour.
- **Fireworks look-ahead:** 10 beats (default 8).
- **Bloom "subtle" is 0.1** (20% of the log travel from 0 to 3, against a default of 0.8), so Study and Night Focus barely bloom. That follows the rule literally; worth a look in the tuning session.
- **Key cones** (Crystal, Synthwave, Inferno) only show at shader detail Medium or High; at Off they're absent by design.

### Results

- **`npm run check`:** passed, 727 tests.
- **`npm run build`:** passed.
- **E2e:** 168 passed (148 `chromium` + 20 `polish`).
- **`@visual looks`:** passed.
- **Viewed by me:**
  - `all-looks.png`;
  - at full size: Hazard (Off), Synthwave (Medium), Neon (Off), Night Focus (Off).
  - Every look reads at Off; Neon at Off loses some colour to its white tube cores, but the notes stay clear.

### Known issues and open questions

- **Similar at full frame:** at 1280×720 full frame, the head fills (Crystal, Bubbles, Hot core, Outline) are small, so several looks look alike in `all-looks.png`. The differences show up close and in motion.
- **Static capture:** the sheet is a single moment; onset effects are only partly visible at 0.4 s on the Pedal demo.
- **Tuning session (step 7):** the subtle-bloom level and the shared octave-glow brightening from round 2.

### Manual review checklist

- [ ] `docs/design/m9-1/all-looks.jpg`, and the full-size `test-results/visual/looks/*.png` (Off and Medium).
- [ ] In the app: open the Look picker and try each built-in, with Undo, on a song with the pedal down; check Hazard and Synthwave notes over the cage.
- [ ] The substitutions above.
- [ ] Next: the tuning session (step 7).

## 2026-11-22 — Section C round 2: note colours, levels by slider position, a new all-looks sheet (stop for review)

### What was done

- **Note colours (`6d9b25d`, `899450a`):** a new Notes setting, part of looks: Default / Warm / Cool / Neon / Pastel / Mono (one custom colour) / Two-tone (white-key and black-key colours).
  - **Core:** `core/color/notePaletteColors.ts` (pure, tested). In the pitch-class palettes each sharp is a darker shade of the natural below it, as in Default.
  - **Engine:** one shared `NoteColors` (12 `Color`s updated in place). Everything that reads it per frame follows at once: pressed and approaching keys, the key light, cones, new particles. What bakes colours is recoloured once per palette change and once per new song: note geometry, labels (Auto and Note colours), the held glow and the Pitch now line.
  - **Brief:** new decision 122.
  - **Classic** pins Default; a look without the setting gets Default.
- **Levels (`6129968`):**
  - `core/settings/sliderLevel.ts` returns 20 / 50 / 80 % of the slider position (log mapping for log sliders, with its 0 stop), tested.
  - Every built-in level now calls it instead of a hand-written literal. The values come out the same as round 1, which already took them from the slider position (e.g. bloom subtle 0.1, medium 0.4, strong 1.3). Now the rule is enforced in code.
- **Palettes per look:**

  | Look                                         | Palette        |
  | -------------------------------------------- | -------------- |
  | Ember, Inferno                               | Warm           |
  | Crystal, Aurora                              | Cool           |
  | Synthwave                                    | Neon           |
  | Stardust                                     | Pastel         |
  | Mist                                         | Mono `#B8C7E0` |
  | Blueprint                                    | Mono `#6FA8FF` |
  | Hazard                                       | Mono `#FFC21A` |
  | Classic, Study, Night Focus, Neon, Fireworks | Default        |

- **Sheet (`ae3622b`):** `e2e/looks.spec.ts` now plays the long demo's dense chords (bar 2) on the fixed step, 0.2 s in, with each look's own camera. Each look gets two cells at Medium (the full frame, and a 16:9 crop near the keys), then a row at Off for Neon, Synthwave, Inferno and Fireworks. Every look's Off and Medium frames are still saved individually. JPEG: `docs/design/m9-1/all-looks.jpg`.
- **E2e:** "note colours recolour the notes and the keys": Mono changes the highway's notes and the keys' approach colours, Two-tone shows its two colour rows, and Default restores the frame.

### Decisions I made that weren't in the instructions

- **Aurora → Cool**, not Pastel, because Stardust is Pastel. Aurora keeps its Secondary border glow. **Mist → Mono `#B8C7E0`**, which matches its now line.
- **The Neon look stays on Default:** the spec gave the Neon palette to Synthwave and listed no change for Neon.
- **Overview piano roll** keeps the Default palette (brief decision 101 names the pitch-class palette); it's a UI view, not the scene. It can follow later if you want.
- **Mono and Two-tone defaults:** Mono `#8AB4FF` (the default primary); Two-tone `#7EE0C3` / `#C3A6FF`.
- **"Camera per look"** means each look renders with its own camera, which looks hold; only Fireworks differs from the default (look-ahead 10).
- **`changedPixels`** in `visualPolish.spec.ts` now takes an optional row band.

### Results

- **`npm run check`:** passed, 743 tests.
- **`npm run build`:** passed.
- **E2e:** 169 passed (149 `chromium` + 20 `polish`).
- **`@visual looks`:** passed.
- **Viewed:** `all-looks.png`. The looks now differ clearly: warm Ember and Inferno, blue Blueprint, grey Mist, yellow Hazard, neon Synthwave, pastel Stardust.

### Known issues (for the tuning session)

- **Inferno at Medium washes out on dense chords:** the strong bloom on top of hot-core fills and both flame effects whites out the keys and arriving notes. It reads at Off. Candidates: bloom medium, or flame count subtle.
- **Synthwave's** scaling sparks make white blobs at the keys on dense chords.
- **Crystal and Aurora** both use Cool and look alike at this distance; Aurora's secondary border glow barely shows. Pastel or a stronger border glow would separate them.
- **Commit `6d9b25d`** (the setting) on its own fails two look tests, because Classic gains the palette keys in `6129968`. The branch tip is green.

### Manual review checklist

- [ ] `docs/design/m9-1/all-looks.jpg`.
- [ ] In the app: Notes → Note colours, every palette; Mono and Two-tone colour pickers; the pressed keys and labels follow.
- [ ] Then the tuning session (step 7).
