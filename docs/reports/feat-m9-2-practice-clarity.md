# Report: feat/m9-2-practice-clarity (milestone 9.2, Practice clarity)

Spec `docs/milestones/m9-2.md`, plan `docs/milestones/m9-2-plan.md` (approved 2026-11-23, answers in §9).

## Round 1 — 2026-11-23: sections C and B, stop for the shadow decision (B6)

### What was done

**C. Deeper black keys** (`src/engine/model/keyBodies.ts`)

- Black key bodies now reach from their raised top down past the white keys' bottom: thickness = black key height + key thickness + 0.02. The top, the press pivot and the press motion don't change (`pressedKeyTop` untouched), so notes still meet the key tops exactly.
- The key shader has no vertical terms, so the taller sides take the normal black side shading. Spill, cones and overlays are unchanged on the sheet.
- Unit test: across thickness 0.2–1.2, black height 0–1.2 and white press depth 0–1.2, every black bottom is below every white bottom. A pressed white key's top never drops below its own resting bottom (the press is capped at the thickness), so the face it uncovers is always the solid black side.
- `keyboard.pressDepthBlack`: the range is unchanged (0–1.12, effectively capped at black height − 0.08 by `constrainKeyboard`). On the sheet, 0 / 0.15 / 0.3 / 0.43 all look right at 25° and 85°; the deeper body adds no new limit.
- Sheet: `docs/design/m9-2/keys.before.jpg` and `keys.after.jpg`. These show white keys pressed next to black keys mid-press (0.017 s, 0.034 s, held), white key depth 0.4 and 0.6, and black key depth 0–0.43, at 25° and 85°.
  - At the default white depth the old gap was only a hair: the black key bodies used to end 0.09 below the white tops.
  - It shows at deeper presses. Before, the black key over the pressed red key showed its rounded underside; after, its side runs straight down into the pressed key.

**B. Black notes back on the highway**

- **Draw order** (`Engine.applySettings`, `HeadLayer`, `SustainLayer`):
  - Black-lane sustains, ridges and heads sit at y = 0.012, 0.002 above the white ones as a safety margin.
  - They always draw after the white notes and are not depth-tested against them, so they win wherever they overlap, at any distance or camera.
  - Black heads keep far-to-near order among themselves. The glow twins follow the same depth state.
- **Settings** (sidebar → Notes, all look keys, pinned in Classic and the base):

  | Key                      | Label                 | Default | Range               |
  | ------------------------ | --------------------- | ------- | ------------------- |
  | `notes.whiteHeadHeight`  | White note height     | 0.35    | 0.1–0.8, step 0.05  |
  | `notes.blackHeadHeight`  | Black note height     | 0.5     | 0.1–0.8, step 0.05  |
  | `notes.blackSideShading` | Black side shading    | 40%     | 0–100%, step 5%     |
  | `notes.blackRidge`       | Raised black sustains | off     | (3D heads only)     |
  | `notes.blackRidgeHeight` | Ridge height          | 0.08    | 0.02–0.2, step 0.01 |

  Classic uses the new taller black default (answer 7). The other built-ins inherit the base.

- **Removed:** `notes.blackLift` and `notes.blackLiftMode`, and `blackLaneLift.ts`.
  - The settings version goes 8 → 9: the lift keys are dropped and `headHeight` becomes `whiteHeadHeight`.
  - This applies to stored settings, look files and backups (both carry their version).
  - Saved looks in Dexie carry no version, so **database v7** runs the same migration on them once.
- **Raised black sustains:** a `HeadLayer` in ridge mode (`RIDGE` define).
  - It spans head end → note end, with square ends and the sustain fill, stripes and transparency.
  - It replaces the flat black sustain while on, and only with 3D heads.
  - Both translucency variants are built. The default is one alpha on every face. A review seam (`?ridgeSides=solid`, `Engine.setRidgeSolidSides`) gives opaque sides under a translucent top. It goes once you pick.
- **Black side shading:** vertical faces of black heads and ridges are multiplied by `1 − amount` (the top face is untouched).
- **Contact shadow:** now cast from the black head height (instead of the old lift), so it falls like a block's shadow.

**Fixture and sheets**

- `scripts/make-black-notes-demo.mjs` → `test-fixtures/midi/black-notes-demo.mid`: white chords next to black notes with long sustains, plus a white/black run.
- `e2e/practiceClarity.spec.ts`: the 9.2 sheets (keys; black notes at 25°, 45° and 85°, quality Off and Medium; ridge variants).
- `e2e/ranges.spec.ts`: a "range black notes" test covering both heights, ridge height, side shading and shadow strength.
  - Moments: 2.2 s approaching, 2.85 s reaching the keys, and 5.1 s with the black sustains ending (the release check).
  - Tilts: 25° and 85°.
  - `Motion` gains a start bar and the `black` song; `captureWith` takes extra query parameters.

### Decisions not in the instructions

- **Black lane y = white + 0.002**, names 0.003 above that. This is the "tiny world lift". Depth isn't what separates the layers (draw order is), so it only guards against coplanar shimmer.
- **Ridges have square ends even with rounded heads** ("the same shape as a 3D head but lower, square ends").
- **Side shading applies to ridges too:** they are the same block shape.
- **Ranges:**
  - Both head heights keep the old 0.1–0.8. At 25° and 85°, no height in that range lets the top face dominate: from 85° the heads are seen from above at every height, and from 25° 0.8 is still a compact block.
  - Ridge height 0.02–0.2: nothing in that range makes a release read late (5.1 s frames). The ridge stays well below the heads. If you want ridges that read more clearly, the cap could go up; see the open questions.
- **The contact shadow offset now uses the black head height**, so it still reads as cast by a block standing on the highway.

### Results

- `npm run check`: type-check, lint, **745 unit tests** pass.
- E2e, the specs touched so far (`--retries=0`):
  - `chromium` `player.spec.ts`: 21/21.
  - `polish`: 21/21 after the version-literal fix (the Copy-look test asserted version 8; it now uses `SETTINGS_VERSION`).

  The full suite runs at the end of the milestone.

### B6 — Shadow strength: decision needed

Sheets: `docs/design/m9-2/notes.shadowStrength.tilt-25.jpg` and `.tilt-85.jpg`.

- **From the default and low cameras (25°–45°)** it's still close to invisible at the default 45%; at 100% there is a faint dark fringe beside the black sustains.
- **From high tilts (85°)** it now does something useful. From about 80% it draws a clear dark edge where a black note lies over a white one, separating the two. At 45% that edge is faint.

**Proposal: keep it, rework it into a separation edge.**

- Rename it "Black note outline" (or keep "Shadow under black-lane notes" with the new meaning).
- Raise the default to about 80%.
- Tighten the soft edge so it hugs the black note rather than spreading.

The alternatives are removing it (black side shading and the draw order already separate black from white), or keeping it as is. The rework is small (the default and the soft-edge width).

### Open questions

1. **B6:** keep and rework (above), keep as is, or remove?
2. **Ridge variant:** one alpha on every face, or opaque sides under a translucent top (`black-notes.*.jpg`, columns 4 and 5)? At the default height the difference is small; in close-up the solid sides read more like a block.
3. **Ridge height cap:** 0.2 is far from looking late. Raise it (say to 0.3) so ridges read more clearly from the default camera, or keep it low as the spec asks?
4. **Black side shading at 40%** is subtle at the default camera; it shows clearly at 80–100%. Keep 40% as the default?

### Manual review checklist

- Press white keys next to black keys at max white key depth: no black key undersides show, at 25° and 85°.
- Black notes over white notes: black always on top; zoom in and out and tilt 25°–85°: no shimmer.
- Notes → White note height / Black note height: both move; the front edges stay on the highway.
- Turn on Raised black sustains: a low ridge replaces the flat black sustain; it hides with 3D heads off.
- Reload with old settings that had a manual lift: no lift, your old head height is now the white height.
- A saved look from 9.1 still applies, with its head height as the white height.

## Round 2 — 2026-11-23: B reworked, A, D, E built; depth and label fixes; stop for review

### What was done

**B, round-1 review answers**

- **Black note outline** replaces the contact shadow.
  - Keys: `notes.contactShadow` → `notes.blackOutline`, `notes.shadowStrength` → `notes.blackOutlineStrength`. The v9 migration carries the switch over, and the strength only where it was changed from the old 45%, so the new 80% default applies otherwise.
  - The rim is now the same width on every side of the note (0.08, solid with a short soft edge), with no offset.
  - It shows as a thin dark line along black notes from 25° and 45°, and as an even outline from 85°.
  - Sheets: `notes.blackOutlineStrength.tilt-25/45/85.jpg`.
- **Ridges:** opaque, darker sides under a sustain-transparent top. The one-alpha variant and the `?ridgeSides` seam are gone.
  - The ridge height cap is now 0.35. In the 5.1 s release frames, releases still don't read late at 0.35, so I kept it.
- **New defaults:**
  - Black side shading 70%.
  - Black note height 0.6 (white stays 0.35).
  - Camera tilt 35° and look-ahead 10 beats, on desktop and tablet. Every built-in look pins them, Classic and Fireworks included (Fireworks loses its extra look-ahead).
- **Depth fix** (your Toccata screenshot): black heads behind a nearer white head were drawn on top of it.
  - Every head and ridge is now depth-tested and writes depth, white and black alike.
  - Black notes win only where they share a surface with a white note (overlapping sustains, a chord's front faces). They do it by their 0.002 lift plus a `polygonOffset` bias, with the depth test on. The black sustains and the outline are depth-tested too, and the glow twins copy the bias.
  - Sheet: `occlusion.jpg`. A3 and B3 have A♯3 a 32nd later, just behind and taller, drawn in Two-tone so the colours differ, at 25°, 35°, 45° and 85°, at default and tall heights. The nearer white heads cover the black head's base. The black sustain still wins over the white sustains. There is no z-fighting.
  - Toccata isn't bundled (it's your upload), so the case was added to the Black notes demo instead.
- **Label fix** (Toccata bar 51): note-name labels now draw in an overlay the render pipeline draws last.
  - They come after the notes, the bloom mix and anti-aliasing, straight onto the frame with no depth test or write.
  - Within each lane colour they are drawn far to near.
  - The label glow twin has the same depth state.
  - Avoid overlaps, stack slots and placement are unchanged.
  - `occlusion.jpg`, bottom row: the label sits whole over the heads at 25° and 35°.
  - Key-top labels aren't affected. They lie on their own keys, nothing is drawn in front of them, and they keep their depth test.

**A. Loop visibility** (sidebar section **Loop**, after Highway; all look keys, pinned in Classic and the base)

| Setting              | Default     | Range                                |
| -------------------- | ----------- | ------------------------------------ |
| Dim outside the loop | on          |                                      |
| Dim strength         | 60%         | 0–95%, step 5                        |
| After the loop end   | Next repeat | Next repeat / Song continues         |
| Loop boundary lines  | on          |                                      |
| Colour               | Secondary   | white / primary / secondary / custom |
| Width                | 0.14        | 0.02–0.3, log                        |
| Glow                 | 1           | 0–3, log with a 0 stop               |

- **Dim** happens in the shaders, by song tick (`loopDim` in `TIME_GLSL`). Only [loop start, loop end) is left undimmed; the pre-roll is dimmed both live and in the repeat (answer 2, spec amended).
  - Heads fade toward the highway colour. Sustains, ridges, the outline, lanes, bar and beat lines, borders, octave lines, cages and labels fade by alpha and glow.
  - The keyboard, the now line and the now-line effects are never dimmed.
- **Next repeat** (`LoopRepeat`): copies of each repeated layer share its geometry and material.
  - Copy k draws with the playhead moved back k periods and clipped to one iteration (`uClipLo/uClipHi`, set in `onBeforeRender` and put back after). Nothing is duplicated on the CPU, per frame or ever.
  - The song itself is cut at the loop end.
  - Repeated layers: note layers, outline, labels, pedal cage, stencil masks, bar and beat lines, and their glow twins.
  - Static lanes and borders map highway ticks back to song ticks (`loopSongTick`) so they dim correctly.
  - The repeat shows only while the playhead is inside the iteration (count-in included); outside it, the song shows dimmed.
- **Boundary lines** (`LoopLines`) use the highway lines' coverage and glow, under the notes, never dimmed. The end line glows 1.5× (fixed). Each repeat seam gets its own start and end line.
  - The first defaults (width 0.06, glow 0.6) were too faint on the sheet, so I raised them to 0.14 and 1.
- **Timing:** `loopWindowFor` uses the same count-in as the transport (`preRollWindowFor`; `Transport.windowFor` now calls it too). The repeat lands exactly where the playhead will be after each wrap. `PlayerView` passes the window to the engine in the same tick as the jump to the loop start.
- **Sheets:** `loop.off.jpg` and `loop.medium.jpg`.
  - Rows: a short loop (bar 3, 2 beats of pre-roll) seen from inside it, and a long loop (bars 2–5) near its end.
  - Columns: Next repeat, Song continues, dim 0, dim 95%, no boundary lines.

**A.5 — draw calls per frame** (all passes; `docs/design/m9-2/draw-calls.json`, long demo, 1280×720):

| Case                                | Off | Medium |
| ----------------------------------- | --: | -----: |
| No loop                             |  22 |     41 |
| No loop, look-ahead 32              |  22 |     41 |
| Long loop (bars 2–5), near its end  |  34 |     58 |
| Short loop (bar 3, pre-roll 2)      |  45 |     73 |
| One-bar loop, look-ahead 32 (worst) | 155 |    223 |

Each repeat adds about 11 draws at Off and 15 at Medium, and only while it's on screen. The worst case is a one-bar loop at the maximum look-ahead, which needs 12 repeats. If that is too much for the tablet pass (milestone 11), the fallback in the plan is one instanced draw per layer of the loop's notes, rebuilt only when the loop changes.

**D. Open Home when a new session starts** (Appearance → Start)

- **Settings:**
  - "Open Home when a new session starts" (on).
  - "New session after": 10 / 20 / 30 / 60 min, default 30. It replaces the fixed 10-minute gap everywhere: the recorder, `sessionize`, headline stats, highlights and profile summaries.
- **One rule:** `isNewSession(lastPlaybackEnd, now, gap)`.
  - `shouldOpenHome` opens Home at most once per session per profile (the last auto-open is stored), and never for a profile that has never played (see the decisions below).
  - Checked on load, on refocus (`visibilitychange` and window `focus`), and by an idle timer for the rest of the gap, re-armed when playback starts or ends.
- **Never interrupts:** not while playing, with a bookmark draft open (Bookmark manager), or in the loop editor. A blocked check still counts as handled.
  - The picker, settings window, tempo and loop popovers and the shortcuts sheet close first.
- **Tracking suspended:** `stats.trackingSuspended`, which nothing turns on yet.
  - The recorder ends a stretch under way and then records nothing (no sessions, time or plays). It keeps following loads and setup, so tracking resumes with the right song.
  - The Home timer pauses. Unit-tested. Roadmap 9.5 notes it.
- **Stored or derived?** Both.
  - The recorder stores a `Session` row per session and a `sessionId` on each play record. It already continued the stored last session after a reload, within the gap.
  - Every number the app shows (session counts, average session, Welcome highlights, profile summaries) is recomputed from the play log with `sessionize` and the current gap.
  - So the new 30-minute default changes how past sessions are counted on screen: sessions 10–30 minutes apart now merge. The stored `sessionId`s keep the grouping they were recorded with, but nothing displays them.

**E. Change song and the Library open on the current song**

- **Picker:** the current song is highlighted and the loaded bookmark selected (else Full song). Both are scrolled into view, whatever the sort. Focus stays in the search field (answer 12). The search is still cleared on open (answer 11).
- **Library:** the current song is selected, centred and the song list focused, whatever the sort and grouping.
  - When a search or filter hides it: "Current song is hidden by the filter · Show". Show clears what hides it and reveals the song.
  - The Library's details panel doesn't list bookmarks, so there is no "current bookmark" to select there.

### Decisions not in the instructions

- **Home never opens for a profile that has never played.** There's no "last playback" to start a new session from, and Start on already decides a first run.
  - This also keeps fresh e2e profiles on the player.
  - The shared e2e storage turns the setting off, because many tests seed sessions from days ago and Home would open over the page under test. `homeOnNewSession.spec` turns it back on.
- **The loop editor counts as work in progress** (it has no separate unsaved state). Home waits while it's open.
- **Labels draw over the finished frame,** after vignette and AA too, not just after the glow, so neither bloom nor vignette dims them.
- **Loop line defaults raised to width 0.14 and glow 1,** from the sheet.
- **The 9.1 design images in `docs/design/m9-1/` are left as they are.** They record the 9.1 decisions, and some show settings that no longer exist. A fresh `all-looks.jpg` at the new camera is in `docs/design/m9-2/`.

### Visual baselines and the camera

The visual-review shots, the all-looks sheet and every 9.2 sheet were regenerated after the default camera moved to 35° and 10 beats. **Shots taken at the default camera look different because of the camera, not because of a regression.** That covers the player, Welcome backdrop, strip and look shots in `test-results/visual`, and `all-looks.jpg`. The whole visual-review, looks and 9.2 sheet run passed: 161 tests. The black-note range sheets were re-rendered after the depth fix.

### Results

- `npm run check`: type-check, lint, **765 unit tests** pass. `npm run build` passes.
- **E2e, `chromium` + `polish`, production preview, `--retries=0`:**
  - **175 passed, 3 failed** before the last fixes. All three failures followed intended 9.2 changes, not load timing:
    - `listKeys.spec.ts:29`: the Library now opens on the current song (Minuet), not the first row.
    - `bookmarks.spec.ts:274`: the picker now selects the loaded bookmark, not Full song.
    - `player.spec.ts:72`: the tilt default is 35°, so +3 is 38°, not 48°.
  - I updated those tests and re-ran their specs: all pass.
  - New: `homeOnNewSession.spec` (5), `currentSong.spec` (2), and the polish test "the first frame after a loop change shows it".
- **Draw calls:** see A.5.

### Known issues and open questions

1. **Draw calls for very short loops at the maximum look-ahead** (223 at Medium). Fine on desktop; to check in the tablet pass.
2. **The repeat doesn't draw particles.** Effects only happen at the now line, which is always in the live song.
3. **Label order:** far-to-near holds within the white and within the black labels, not across them (they're two layers).
4. **Raised black sustains** read clearly only close up from the default camera, even at 0.35.

### Manual review checklist

- **Loop, dim and lines:**
  - Set a short loop with pre-roll 2 and play.
  - Beyond the end line you should see the loop's count-in (dimmed), then the loop again (bright), repeated as far as the highway reaches. The seams flow into the now line with no jump at the wrap.
- **Switch to Song continues:** the song continues beyond the end, dimmed.
- **Loop changes:** toggle the loop while playing, and seek while paused. There should be no flash. Load a bookmark: same behaviour.
- **Black notes:**
  - At 35°, a white chord in front of later black notes: the nearer heads cover the farther ones. Black sustains stay above white sustains.
  - Turn note names on: labels are never cut by heads.
- **Home on a new session:**
  - Set "New session after" to 10 min.
  - Play, pause, and leave the app idle for 10 minutes: Home opens by itself.
  - With a bookmark draft open it doesn't, and it doesn't open again on refocus.
- **Library:**
  - Search "canon" in the Library, go to the player and back: the hidden-song line shows, and Show reveals Minuet.
  - Change song (O): the current song and bookmark are selected and in view under every sort, and typing still searches.
