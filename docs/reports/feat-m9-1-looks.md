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
