# Milestone 10 plan: Hand cages

Spec: `docs/milestones/m10.md`. Source brief for later: `docs/milestones/m10-5-hand-detection-brief.md` (read only to keep room for it). Branch `feat/m10-hand-cages`.

**Status:** approved (answers in §10).

## 1. Where the spec meets the code

| Spec               | Code today                                                                                                                                                                                                                                                  | Plan                                                                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handOf(note)`     | `assignHands(notes, assignment)` in `core/hands` maps channel → hand and drops Hidden channels; `HandNote.hand` carries the result to audio and the engine.                                                                                                 | A `HandOf` function type, `(note: Note) => Hand \| null`, and `channelHandOf(assignment)` returning one. `assignHands` takes a `HandOf`, and so do the cages (§2). One function decides a note's hand for sound, notes and cages. |
| Bars               | `BarMap` (`barStartTick` / `barEndTick` per bar, meter changes, overrides).                                                                                                                                                                                 | `computeHandCages` walks `barMap.firstBar … barCount`.                                                                                                                                                                            |
| Cage renderer      | `CageLayer` (instanced quads, fills, stripes, border, glow, rounding, `NoteMask` stencil, loop dim, haze, clipped to the visible window), `CageRegion` with `openStart` / `openEnd`, `cageQuads` using the shared `keyLayout`. Only the pedal cage uses it. | Two more `CageLayer`s, right and left. `CageLayer` gains two per-instance attributes: **strength** (carried bars) and **deck** (listening). The pedal cage passes 1 and 0.                                                        |
| Loops, Next repeat | `loopDim` in the cage shader; `repeatSources` lists the pedal cage.                                                                                                                                                                                         | Add both hand-cage meshes to `repeatSources`. Loop dimming already works.                                                                                                                                                         |
| Listening          | Timeline `BarMap.joined` restarts bar numbers per song; notes carry `deck`; `bandStrength(deck, tick)` dims the ending song.                                                                                                                                | §3.3.                                                                                                                                                                                                                             |

## 2. Core (pure, unit-tested)

- `core/hands/HandOf.ts`: `type HandOf = (note: Note) => Hand | null`. `null` means Hidden: no sound, no note, no cage.
- `core/hands/channelHandOf.ts`: today's channel rule (a channel in both lists goes right, as now). `assignHands(notes, handOf)` keeps its behaviour, with tests.
- **Room for 10.5.** The brief assigns hands per note by id (`${track}:${noteOnIndex}`). In 10.5 a `Note` gains an id (and its track), and a new `handOf` reads the stored per-note assignment, falling back to channels. Nothing in the cage code or the engine changes: they only ever see `HandOf` and `HandNote.hand`. Nothing is added to `Note` now.
- `core/cages/computeHandCages.ts`: `computeHandCages(notes, barMap, handOf): HandCages`, exactly as the spec's algorithm. `HandCage` and `HandCages` are as specified. Constants `MIN_CAGE_SPREAD = 5`, `PIANO_LOW = 21` and `PIANO_HIGH = 108` live in the render model, per the spec (`engine/model`).
  - Sounding uses the **written** `endTick`, not the pedal-extended `soundEndTick` (Q3).
  - Zero-length notes count as `end = start + 1`.
  - Pitches outside 21–108 are clamped before the range is taken.
  - Cost: one sweep per hand over notes sorted by start, with an active set; O(notes + bars).
- `core/cages/cageRuns.ts`: turns one hand's cages into **runs**, consecutive bars with the same low/high.
  - A run is one region whether its bars are carried or not (spec R4).
  - Inside a run, a change between played and carried splits the region into pieces with open ends, so each piece has its own strength. There's no border between them, and the stripe phase runs on absolute ticks, so stripes stay continuous across the join.
  - Tested: equal ranges join, a range change splits, carried pieces keep their strength.
- **When to recompute:** song load and a hand-assignment change, nothing else. `PlaybackSession.prepare` already re-runs on both (the Library's channel picker reloads the song), so the cages are computed there next to `assignHands`. `EngineSong` gains `handCages: HandCages`. Tempo, seek, loops and pre-roll never touch them.

## 3. Engine

### 3.1 Layers and order

- Draw order: highway, pedal cage (`ORDER.cages` 1, y 0.003), **hand cages (order 1.1, y 0.0036)**, then notes.
- Different heights plus render order avoid z-fighting with the pedal cage. Lines stay over cages, as the pedal cage already does.
- The `NoteMask` stencil is synced when _any_ cage is shown, not only the pedal cage, so a cage never tints a note.

### 3.2 Render-time visibility

- `mesh.visible = handCages.show && <hand>` per layer, set in `applySettings`, so toggles never rebuild.
- Geometry is built once per `setSong` (one instance buffer per hand).
- Instances outside the visible window collapse in the vertex shader (the existing clip to now … 1.5 × look-ahead), so each hand is **one draw call** whatever the song length. Plus one glow-twin call when its border glows or its fill is emissive.

### 3.3 Listening (merged timeline)

- Cages are computed **per song** with that song's own bar map and hand assignment, in `prepare`. The timeline builder shifts them by each segment's start tick, as it does for notes and pedal spans, with `deck` set per segment.
- This sidesteps the joined bar map's restarting bar numbers.
- **Crossfade dimming:**
  - In the shader, `bandStrength(deck, vTick)` per fragment. A cage that starts before the band and runs into it fades from the band start, like the notes.
  - The notes use their start tick, because a note is one object; a cage bar can be long, so it fades per fragment.

## 4. Settings ("Pedal & cages" → new group "Hand cages"; all look keys)

New section `handCages` in `PlayerSettings`:

| Key                           | Default                          | Range                                                                              |
| ----------------------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| `show`                        | on                               | bool                                                                               |
| `right`, `left`               | on, on                           | bool                                                                               |
| `rightColor`, `leftColor`     | `primary`, `secondary`           | the line-colour choice (Primary / Secondary / Custom)                              |
| `rightCustom`, `leftCustom`   | `#8AB4FF`, `#7EE0C3`             | colour                                                                             |
| `rightFill`, `leftFill`       | Solid                            | the shared fill list                                                               |
| `fillOpacity`                 | 0.12                             | 0–0.5, step 0.01 (range-tested on the sheet)                                       |
| `borderWidth`                 | 0.03 (thin)                      | 0–0.15; 0 = no border (Q1)                                                         |
| `borderGlow`                  | 0.15 (low)                       | 0–1                                                                                |
| `cornerRadius`                | the pedal cage's default         | as the pedal cage                                                                  |
| `rightStripe…`, `leftStripe…` | the pedal cage's stripe defaults | the 9 `StripeStyle` keys per hand, shown when that hand's fill is Diagonal stripes |
| `carried`                     | 0.5                              | 0–1, step 0.05: strength of carried bars (fill and border)                         |

- **Pinning:** all keys are pinned in Classic and the base look, with `show: false` in Classic. Built-ins that switch them on are covered in Q2.
- **Ranges:** follow the 9.1 format, with a contact-sheet row for fill opacity, border width and carried strength.
- **Versions:** adding keys needs no settings-version bump (missing keys take defaults; looks fill missing keys from the device default). `FACTS_VERSION` is untouched.

## 5. Housekeeping (built first, its own commit)

1. **Time-of-day seeds.**
   - A helper `daysAgoAtMidday(n, now)` in `e2e/support.ts` returns local midday n calendar days ago.
   - `practiceSeeds.ts` (`sortingHistory` and others) and the specs that assert day labels ("Today", "Yesterday", "N days", "last practiced …") use it.
   - Specs found with `Date.now()` seeds: backup, homeOnNewSession, library, listKeys, loopJump, nowPlaying, picker, profiles, stats, welcome. Each is checked; only day-sensitive seeds change. Session-gap tests (homeOnNewSession) keep their exact offsets, because they test durations.
2. **Flaky Welcome highlights test.** There are two causes:
   - **Hover race:** `clock.runFor` can run before the hover reaches the rotator, so it rotates while "hovered".
     - The rotator gets a `data-paused` attribute (the state it already keeps).
     - The test waits for it before running the clock, and for its removal after the mouse leaves.
   - **Month boundary:** "went from 70% to 85% this month", seeded 1–2 days ago, fails on the 1st and 2nd of a month.
     - `page.clock.install({ time })` pins a mid-month date, which makes the test fully deterministic.
   - I'll check other `clock.install()` tests for the same month-boundary risk.

## 6. E2e (`@cages`)

- **AREA_MAP:** `src/core/cages` and the cage parts of `src/engine` map to `@cages`, and `src/core/hands` to `@cages` as well as `@player`.
- **Test seam:** `?stats=1` gains `pianomeisterCages()`, returning `{ right: { count, visible }, left: { count, visible } }` (instances and mesh visibility) and the draw order. Tests:
  1. On a bundled song, both hands have cages, and both meshes draw before the note layers.
  2. Toggling Show, Right and Left in the sidebar applies at once (visibility flips, the count doesn't change, no rebuild).
  3. In the Library, moving the left channel to Hidden leaves only right-hand cages; moving it back restores them.
- **Screenshot check:** one test checks a cage pixel next to a note head, and the note head's colour unchanged (no tint over notes).

## 7. Contact sheets (visual project; PNGs in `docs/design/m10/`)

- **Demo song:** a new `test-fixtures/midi/cages-demo.mid` made by `scripts/make-cages-demo.mjs`, as the other demos are. It has:
  - both hands on channels 0 and 1
  - rests mid-song (carried bars) and a leading rest in the left hand
  - notes sustained across bar lines
  - a 4/4 → 3/4 → 4/4 meter change
  - a narrow passage near A0 and near C8 (clamping)
  - a hand moving up and down into narrow bars
- **Sheets:**
  - 25°, 35° and 85° × quality Off and Medium, in Classic with cages on.
  - Two more looks (Q2).
  - A carried-bars row at 0 / 50 / 100 %.
  - A loop with Next repeat.
  - A fill-opacity and border-width range row.
- **Draw calls:** cages on vs off, at Off and Medium, reported in the review.

## 8. Build order and commits

1. Housekeeping (§5): two commits.
2. Core: `HandOf`, `channelHandOf`, `assignHands` on `HandOf`, `computeHandCages` and `cageRuns`, with every unit test the spec lists.
3. Engine: `CageLayer` strength and deck attributes, the two hand layers, masks, repeats, `EngineSong.handCages`, the timeline shift.
4. Settings, sidebar group, look pinning, the stats seam.
5. E2e (`@cages`), demo MIDI, contact sheets, draw calls, brief decision, report. Then stop for review.

## 9. Questions

1. **Border:** the spec lists width and glow but no on/off. Plan: the border is in the hand's colour and always on, with width 0 meaning none. The pedal cage has its own Border toggle and border colour. Should hand cages match it (a Border toggle plus a border colour per hand)?
2. **Built-in looks with cages on:**
   - Classic is off.
   - Proposed on: **Study**, **Blueprint** and **Night Focus** (practice-minded looks), with the fill and border set from each look's palette.
   - Everything else off, with tuning left to the looks pass. OK?
3. **Sustain pedal:** the spec counts notes _sounding_ in a bar by their written end. Plan: ignore the pedal, because with the pedal down a whole phrase would widen every bar it rings through. Confirm.
4. **Hands crossing:** where the right and left cages overlap, both draw, translucent, so the overlap reads as a mix. Any wish for another treatment (e.g. the overlap shown by the borders only)?
5. **Contact-sheet PNGs in `docs/design/m10/`** (the spec names that folder): commit them to the repo? Earlier sheets stayed in `test-results/`. Plan: commit them, compressed, about 1–2 MB in total.
6. **Library hand-assignment change while listening:** listening builds per-song cages at prepare time. A channel change made in the Library while a playlist plays takes effect at the next song (or on a restart). Fine?
7. **Settings section name:** `handCages` (keys like `handCages.rightFill`). Fine, or `cages`?

## 10. Answers

Approved 2026-11-24.

1. **Border:** as the pedal cage: a Border toggle (default on) plus a border colour per hand, "Hand colour" (default) or Custom.
2. **Built-in looks:** cages on in **Study** and **Blueprint** only (fill and border from each look's palette). Night Focus stays off (the least distracting look); all others off. Tuning in the looks pass.
3. **Sustain:** confirmed: written end, ignore the pedal.
4. **Crossing hands:** both translucent; the borders mark each cage.
5. **Sheets:** committed as JPEGs in `docs/design/m10/` (as in 9.x), about 1–2 MB in total.
6. **Library change while listening:** applies from the next song.
7. **Section name:** `handCages`.
