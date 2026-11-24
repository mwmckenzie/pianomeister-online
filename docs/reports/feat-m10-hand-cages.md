# Milestone 10 — Hand cages (branch `feat/m10-hand-cages`)

## Round 1 — 2026-11-24: built, ready for review

Built in the approved order (plan §8), committed locally per step. **Nothing pushed.**

### What was done

| Step                    | Commits              | What                                                                                                                                                                                                                                                                                                    |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Housekeeping            | `b6db92b`, `fa1bd65` | Time-of-day seeds anchored to the calendar day; the flaky Welcome highlight test (a real app glitch, see below) fixed.                                                                                                                                                                                  |
| Core                    | `522f055`            | `HandOf` and `channelHandOf`; `assignHands` takes a `HandOf`; `computeHandCages` and `handCageRuns`, with a unit test for every case in the spec.                                                                                                                                                       |
| Engine, settings, looks | `cf1cc6c`            | Two cage layers (right, left) on the 9.x renderer; per-cage carried flag, deck and region span; render-time visibility; cages through load, the playlist timeline and both `setSong` calls; the Hand cages settings group; Study and Blueprint switch them on; the `?stats=1` seam `pianomeisterCages`. |
| E2e                     | `125b44f`     | `e2e/cages.spec.ts` (`@cages`, one also `@smoke`); `@cages` in the area map.                                                                                                                                                                                                                            |
| Sheets                  | `6287949`            | `scripts/make-cages-demo.mjs` → `test-fixtures/midi/cages-demo.mid`; `e2e/cagesSheets.spec.ts` writes JPEG sheets and `draw-calls.json` to `docs/design/m10/`.                                                                                                                                          |
| Docs                    | this round's commit  | Brief decision 127; this report.                                                                                                                                                                                                                                                                        |

**Housekeeping details:**

1. **Time-of-day seeds:**
   - New `e2e/support.ts` helpers: `middayDaysAgo(n)` and `earlierToday()` (halfway between local midnight and now).
   - Used by `sortingHistory` ("3 days", "Today"), the stats history (its "today" record), the profiles spec ("last practiced today", seeded an hour ago) and the Welcome streak test (a record 30 minutes ago counted as today).
   - The other `Date.now()` seeds were checked; they assert counts or durations, not day labels.
2. **The flaky Welcome highlight test was a real (brief) app glitch.** Under load, Welcome picked its highlights before the library had loaded, so the favourite song read "A removed song" until the library arrived. The test caught the title changing, not a rotation.
   - Fix: no highlights until the library has loaded.
   - The test also pins a mid-month clock. Its "this month" highlight would otherwise fail on the 1st and 2nd of every month.
   - It passed 12/12 with `--repeat-each=12` (4 workers).

### Decisions not in the instructions

1. **Constants:** `MIN_CAGE_SPREAD`, `PIANO_LOW` and `PIANO_HIGH` live in `core/cages`, not in the engine's render model. The pure `computeHandCages` needs them, and `core/` can't import the engine. They aren't settings.
2. **Widening direction:** decided by the mean of the bar's own range _before_ widening, compared with the previous cage after its widening (the spec's rule). Equal means alternate high/low starting with high.
3. **Joined regions:**
   - Consecutive equal cages are one region whether played or carried (spec R4).
   - Inside a region, played and carried bars are separate pieces with open ends: the strength differs, but no border line is drawn between them.
   - Each piece carries the region's whole span, so fills, stripes and rounded corners don't restart at the join.
4. **Crossfade fading** is per fragment for cages (`bandStrength(deck, tick)`), not per start tick as for notes, because a cage bar can be long. The pedal cage has no deck and never fades (as before).
5. **Layer height:** hand cages sit at y 0.0036 with render order 1.1. The pedal cage is at 0.003 and 1, and the notes are at 3 and above. No z-fighting was seen on the sheets.
6. **Defaults:**
   - Border width 0.04 ("thin"), border glow 0.15 ("low"), corner rounding 0 (the pedal cage's default), fill opacity 12 %, carried bars 50 %.
   - Custom colours start as the default primary and secondary; custom border colours start white.
   - Stripes start as the pedal cage's.
7. **Hand cages are on by default** (spec: "Show hand cages: on"). Users not on a look will see them. Classic and the base look pin them off, so Classic is still the milestone-8 picture.
8. **Blueprint's cages:**
   - Right hand in the blueprint blue (`#6FA8FF`), left in a pale steel (`#C9D7F0`).
   - Fill 5 %, border width 0.05.
   - **Study** uses the defaults (primary and secondary).
9. **The sheets' JPEGs:** `writeSheet` now writes a JPEG (quality 0.86) when the path ends in `.jpg`. Total in `docs/design/m10/`: about 0.6 MB.

### Draw calls (`docs/design/m10/draw-calls.json`, cages demo at bar 3, Classic with cages)

| Quality | Cages off | Cages on |
| ------- | --------- | -------- |
| Off     | 17        | 19       |
| Medium  | 31        | 35       |

- **What the extra calls are:** each hand is one draw call; cages outside the visible window collapse in the vertex shader. At Medium, each hand's glow twin adds one more (border glow 0.15 > 0).
- **Loops:** with a loop and Next repeat, the repeat copies add the same again.
- **Tablets:** the cost goes on the milestone-11 list.

### Tests and checks

- `npm run check`: type-check and lint pass, **821 unit tests** (116 files). New tests:
  - `handCages.spec.ts`: every case in the spec, plus "reads hands only through `handOf`"
  - `handCageRegions.spec.ts`
  - the timeline places each song's cages with its deck
  - `cageQuads.spec` updated
  - `assignHands.spec` updated for `HandOf`
- `npm run build`: pass.
- New e2e `e2e/cages.spec.ts` (`@cages`): 3 tests, all pass:
  - cages for both hands, over the pedal cage and behind the notes
  - the toggles apply at once without a rebuild, and are stored
  - a Library hand change updates the cages
- `npm run test:e2e:affected` (chromium; `@smoke @cages @library @settings @stats @welcome @player @looks @playlists @loop`, 54 changed files): **152 passed, 0 failed**.

### Known issues and open questions

1. **Hand changes during a playlist** apply from the next song, as agreed.
2. **Blueprint's cages are faint** (5 % fill and a thin blue border) on purpose. Tuning is for the looks pass.
3. **Cages from a long held note:** a note held through many bars widens every one of them (the spec's "sounding" rule). Pedal-only sustain is ignored, as agreed.
4. **Very long rests** carry the last range indefinitely, dimmed (spec open question 2). Revisit after use.

### Manual review checklist

- [ ] Open a bundled song:
  - cages for both hands, behind the notes
  - aligned to the key lanes and bar lines
  - the left in the secondary colour, the right in the primary
- [ ] Pedal & cages → Hand cages:
  - toggle Hand cages, Right hand and Left hand (instant)
  - colours, fills (try Diagonal stripes per hand), fill opacity, border, border colours, width, glow, corners, Carried bars
- [ ] Library → the song's details → set a channel to Hidden → play: that hand has no cages.
- [ ] Upload `test-fixtures/midi/cages-demo.mid`:
  - bar 3 narrow (widened up)
  - bars 4–5 carried (dimmed)
  - bar 6 narrow (widened down)
  - the held notes across bars 7–8 (3/4)
  - both keyboard ends in bars 9–10
  - no right-hand cage after bar 12
  - no left-hand cage in bars 1–2
- [ ] A loop with Next repeat: the cages dim outside it and repeat.
- [ ] Looks: Classic has no cages; Study and Blueprint have them.
- [ ] A playlist: cages follow each song and fade through the crossfade.
- [ ] Sheets in `docs/design/m10/`.
