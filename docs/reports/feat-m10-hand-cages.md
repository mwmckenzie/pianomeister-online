# Milestone 10 — Hand cages (branch `feat/m10-hand-cages`)

## Round 1 — 2026-11-24: built, ready for review

Built in the approved order (plan §8), committed locally per step. **Nothing pushed.**

### What was done

| Step                    | Commits              | What                                                                                                                                                                                                                                                                                                    |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Housekeeping            | `b6db92b`, `fa1bd65` | Time-of-day seeds anchored to the calendar day; the flaky Welcome highlight test (a real app glitch, see below) fixed.                                                                                                                                                                                  |
| Core                    | `522f055`            | `HandOf` and `channelHandOf`; `assignHands` takes a `HandOf`; `computeHandCages` and `handCageRuns`, with a unit test for every case in the spec.                                                                                                                                                       |
| Engine, settings, looks | `cf1cc6c`            | Two cage layers (right, left) on the 9.x renderer; per-cage carried flag, deck and region span; render-time visibility; cages through load, the playlist timeline and both `setSong` calls; the Hand cages settings group; Study and Blueprint switch them on; the `?stats=1` seam `pianomeisterCages`. |
| E2e                     | `125b44f`            | `e2e/cages.spec.ts` (`@cages`, one also `@smoke`); `@cages` in the area map.                                                                                                                                                                                                                            |
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
   - The cause is inferred from the failure output; the flake never reproduced in isolation (12/12 passed before the fix too). After the fix: 12/12 with `--repeat-each=12 --workers=5` (round 2).

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

## Round 2 — 2026-11-24: approved, PR

Round 1 approved; decisions 1–9 stand. Blueprint's faint cages stay as they are for the looks pass. Roadmap: 10 is marked ✅ done, landing with the merge.

**Corrections to round 1:**

- The "12/12" repeat run of the Welcome highlight test was made before the fix, not after. It has now been run on the fixed code (12/12), but since it passed before too, it doesn't prove the fix.
- The pixel test in plan §6 (a note's colour unchanged over a cage) was **not built**. "Behind the notes" is covered by draw order only, plus looking at the sheets.
- Cages fading through a playlist crossfade were not viewed on screen; only their placement and deck are unit-tested.

**Checks:**

- `npm run check`: pass, 821 unit tests.
- `npm run test:e2e:affected` (chromium): 151 passed, 1 failed (`@library a file already in the library selects that song; mixed drops report both`). It passed on one `--last-failed` re-run and in round 1; cause not investigated.

## Round 3 — 2026-11-24: timeline seeking in listening mode (`e87e4e0`)

**Done**

- The listening timeline is the player's `PlayerTimeline`: click or drag seeks by bar within the current song. Shown in Show and Minimal, not in Hidden.
- "Seek back 5 s" (Shift+←) and "Seek forward 5 s" (Shift+→) in the Listening group.
- A seek inside the prepare window (crossfade + 10 s before the end) waits for the next song to load (the current one plays on meanwhile), then seeks and places it in one step. Inside the crossfade the next song starts 0.1 s after landing.
- A seek while both songs sound stays in the song shown; the ending song is removed and both decks reset to full.

**Decisions**

1. A seek lands at most 0.5 s before a song's end, so the next song still overlaps it.
2. The timeline seeks to bar starts, as in the player; only the 5 s keys are in seconds.
3. ← and → stay song keys while the timeline has focus. Up, Down, Home and End move by bar there.

**Existing problems fixed on the way**

- A crossfade is scheduled up to 12 s ahead on the audio clock, so pausing before a seam let it run without the music and could leave the song silent on resume. It's now dropped on pause and scheduled again.
- A next song with no overlap could start on a deck left at zero.
- Previous (restart) during a crossfade replayed the ending song's tail.

**Checks**

- `npm run check`: pass, 832 unit tests (118 files). New: `ListeningController.spec.ts` (8, fake transport and output) and `placeNextSong.spec.ts` (3).
- `npm run test:e2e:affected` (chromium, 11 tags): 173 passed, 0 failed. After it, only mock types in the unit spec changed.
- New e2e `@playlists listening seeks…`: 4/4 with `--repeat-each=4`.
- Seen in the app: a drag, a click at the very end, Shift+→ inside the band, the cheat sheet. **Not heard:** e2e plays silent samples, so fades are checked by deck gains and scheduling only.

**Review by ear**

- [ ] Seek to just before a seam at crossfade 0, 2 and 8 s.
- [ ] Seek during a crossfade: one song, full volume.
- [ ] Pause a few seconds before a seam, wait, play on.

## Round 4 — 2026-11-24: pixel test (`32e34a9`), crossfade curves (`c8eee30`)

**Pixel test** (`e2e/cagesPixels.spec.ts`, `@cages`)

- Pedal cage and both hand cages at 0.5, Solid: every note over a cage (heads and sustains) keeps its colour within 4/255, and the cages must change the pixels beside it. Sustains are 60 % transparent, because opaque ones hide a tint by themselves.
- 3/3 with `--repeat-each=3`. It fails with the note mask broken (95 off) and with mask and draw order broken (136 off).

**Crossfade curves**

- Setting "Crossfade curve": Sequential (default), S-curve, Equal power. Disabled at crossfade 0.
- From the middle of the overlap the ending song starts nothing new, with every curve.
- The band and the dimming follow the outgoing gain.

**Decisions**

1. Notes after the middle are left out of the timeline, so they are gone from the highway and keys too, not shown silent. Pedal spans and cages starting there go as well.
2. Notes follow the gain where they start and, once sounding, the gain now, so held notes fade with their audio. They never go below 10 % strength, so they stay readable.
3. A change of curve applies at once, also during a crossfade.

**Checks**

- Type-check and lint pass; **838 unit tests** (119 files). New: gains of the three curves at 0, 25, 50, 75 and 100 %, and the midpoint rule.
- `npm run check` itself exits 1 on this machine: Vitest also collects `.claude/worktrees/m10-pixel-test` (another session's checkout). Every failure is in there. Excluding it, all pass.
- `npm run test:e2e:affected` (chromium, 11 tags): 174 passed, 0 failed, on a preview on port 4174: the one already running on 4173 served a different build.
- Seen on screen: the three curves before and during the overlap (8 s), with hand cages fading with their song. The round 1 crossfade was checked by ear by the author; the new curves are not yet.
