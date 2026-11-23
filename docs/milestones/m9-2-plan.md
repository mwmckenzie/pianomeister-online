# Milestone 9.2 plan: Practice clarity

Spec: `docs/milestones/m9-2.md`. Branch `feat/m9-2-practice-clarity` from `main` (9.1 merged). Approved 2026-11-23 with the answers in §9 (they override §1–§8 where they differ).

Build order (spec): C (keyboard geometry) → B (black notes) → A (loop visibility) → D and E. Local commits per step, no push until approved.

## 1. Where the spec meets the current code

| #   | Spec asks for                                    | Today                                                                                                                                                                                                                                                              | Proposal                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Black keys at least as deep as the white keys    | `keyBodies`: every key has the same `thickness`. A black body spans `blackHeight − thickness … blackHeight`, so its bottom is `blackHeight` (≈ 0.51) above the white keys' bottom. A pressed white key uncovers that gap.                                          | Black bodies get `thickness + blackHeight + margin`, where the margin covers the deepest white press. Their bottom then sits at or below the white bottom at rest and at full press. The top and the press pivot stay where they are.                            |
| B1  | Black notes on the highway, explicit draw order  | Black-lane heads and sustains float at `blackLaneLift` (the key height by default). When that is below the white heads' tops they draw with `AlwaysDepth` (heads) or no depth test (sustains) to avoid z-fighting.                                                 | Black layers sit at a tiny lift (≈ 0.002 units). They always render after the white layers, with no depth test against white notes, so they win wherever they overlap. Within the black layer, far-to-near sorting (already there) keeps black on black correct. |
| B2  | Remove `notes.blackLift`                         | Two keys: `notes.blackLiftMode` (keys / manual) and `notes.blackLift`. Both are in looks, Classic and BASE.                                                                                                                                                        | Remove **both**: the mode means nothing without the lift. `SETTINGS_VERSION` 8 → 9, with a migration that drops them from settings, saved looks and look files. `blackLaneLift.ts` goes.                                                                         |
| B3  | White and Black note heights                     | One `notes.headHeight` (0.1–0.8, default 0.35).                                                                                                                                                                                                                    | `notes.headHeight` is renamed `notes.whiteHeadHeight` (keeps its value) and joined by `notes.blackHeadHeight` (default taller, about 0.5; the range is set on the sheet). The v9 migration renames the key. Both heads keep their front edge on the highway.     |
| B4  | Raised black sustains                            | Sustains are flat strips (`SustainLayer`).                                                                                                                                                                                                                         | A `RidgeLayer` for black sustains: the head's bevel-box shader with ticks `headEnd … end`, ridge height, square ends, and the sustain fill and transparency. Off: the flat black `SustainLayer`, as today.                                                       |
| B5  | Darker side faces on black heads                 | Heads are lit by `shade()`; side faces get the scene light only.                                                                                                                                                                                                   | A fixed darkening of black heads' side faces (not their top or front), in the head shader. No setting (**Q6**).                                                                                                                                                  |
| A1  | Dim outside the loop, as an overlay              | Nothing on the highway knows about the loop.                                                                                                                                                                                                                       | Dim in the shaders instead of a screen overlay (**Q1**): one `loopDim(tick)` in `TIME_GLSL`, used by every highway shader that already applies the haze.                                                                                                         |
| A3  | Next repeat beyond the loop end                  | The highway draws the song as is; at the wrap `uTick` jumps back to the pre-roll start.                                                                                                                                                                            | Extra draws of the existing note geometry with a tick offset (§4.3). No CPU duplication, not even once per loop change.                                                                                                                                          |
| D1  | "When the session rules say a new session began" | Decision 5: a session starts at the first playback and ends after 10 min without playback **or when the app closes**. `PlayRecorder` keeps the session in memory only, so every reload starts a new stats session. Taken literally, every refresh would open Home. | Use the 10-minute rule against the log: Home opens when at least 10 min have passed since the active profile's last playback ended, at most once per gap (**Q9**). The stats sessions don't change.                                                              |
| E1  | Picker and Library open on the current song      | The picker highlights the current song and selects Full song (not the current bookmark). It clears the search on every open and focuses the search field. The Library keeps its search, filters and grouping in the store and selects the first row.               | Both select the current song and the loaded bookmark, and scroll them into view. The Library shows the "hidden by the filter · Show" line. In the picker that can't happen while the search is cleared on open (**Q11**).                                        |

## 2. C. Deeper black keys

- **Geometry** (`keyBodies`, `KeyBody`, `pressedKeyTop`):
  - Black thickness = `thickness + blackHeight + max(pressDepthWhite, small margin)`.
  - The top face, the front face's top edge and the pivot are unchanged, so the press motion and `pressedKeyTop` (notes meet the key tops) stay exact.
  - A unit test checks the black bottom is at or below the white bottom, at rest and with neighbours fully pressed, for every keyboard setting combination at its range ends (`constrainKeyboard` bounds).
- **Shading:** side faces use the black key's side shading. The key shader's vertical terms (if any) are checked against the taller box, so there are no lighter strips low on the side. Spill, cones and pressed overlays are viewed on the sheet.
- **`keyboard.pressDepthBlack`:** re-range it on the keys sheet at the lowest and highest tilt. The upper limit is where the pressed key starts to clip into the keybed area or looks wrong, whichever comes first.
- **Sheet** (`docs/design/m9-2/keys-*.jpg`): white keys pressed next to black keys, mid-press via the fixed step, at the lowest and highest tilt, before and after.

## 3. B. Black notes back on the highway

- **Draw order** (`Highway`/`Engine` layer setup):
  - White sustains → white heads → black sustains or ridges → black heads, by `renderOrder`.
  - Black layers: no depth test against white notes, but depth write on for the heads, so black heads still sort among themselves. Concretely, black heads keep `AlwaysDepth` with far-to-near order. Black sustains are drawn before black heads, so a black head always covers its own sustain.
  - Lift ≈ 0.002 units as the safety margin. The glow twins get the same order, so a white note's glow never shows through a black head.
- **Heights:** `whiteHeadHeight` and `blackHeadHeight` replace `headHeight`. Both only show with 3D heads on. Range-test both at 25° and 85° tilt. The max is where the top face starts to dominate at 85° (the block reads as a slab, not an edge).
- **Raised black sustains:** `notes.blackRidge` (bool, default off) and `notes.blackRidgeHeight` (range from the sheet; the max is where releases start to look late).
  - Visible only with 3D heads on, because a ridge is a lower head (**Q5**).
  - Translucency: the ridge uses the sustain transparency on every face. Overlapping faces of one box would stack their alpha, so the ridge draws its top face plus the sides facing the camera, with one alpha. I'll check it on the sheet and may make the sides opaque-dark if it reads better (**Q5**).
- **Contact shadow:** today it darkens the highway under lifted black notes. With the notes on the highway it becomes a soft ground shadow hugging the block's base. Per spec B6, I re-check shadow strength on the sheet and then **stop for your decision** (keep, rework or remove), before section A.
- **Migration** (v9): drop `notes.blackLiftMode` and `notes.blackLift`, and rename `notes.headHeight` → `notes.whiteHeadHeight`. This applies to stored settings, saved looks (Dexie), look files and backups through the existing `migrateLookValues` path. The new keys take their defaults.
- **Built-in looks:** Classic and BASE pin the new keys. Classic pins a black height (**Q7**); its black notes do move onto the highway, which is the point of the milestone. Other looks inherit BASE. Their `sliderLevel` values are recomputed only where they referenced `headHeight`.
- **Sheet** (`docs/design/m9-2/black-notes-*.jpg`): white and black heights, ridges on and off, a white-key chord next to black keys, at 25°, 45° and 85°, quality Off and Medium.

## 4. A. Loop visibility

### 4.1 Settings (sidebar → Highway, new group "Loop")

| Key                | Label                | Default        | Range / options                                     |
| ------------------ | -------------------- | -------------- | --------------------------------------------------- |
| `loop.dim`         | Dim outside the loop | on             | bool                                                |
| `loop.dimStrength` | Dim strength         | 0.6            | 0–0.95, step 0.05, linear, percent                  |
| `loop.lines`       | Loop boundary lines  | on             | bool                                                |
| `loop.linesColor`  | Colour               | Secondary      | white / primary / secondary / custom (+ custom hex) |
| `loop.linesWidth`  | Width                | from the sheet | log, like the other line widths                     |
| `loop.linesGlow`   | Glow                 | from the sheet | log with a 0 stop, like the other glows             |
| `loop.after`       | After the loop end   | Next repeat    | Next repeat / Song continues                        |

- All are look keys and are pinned in Classic and BASE. The width and glow ranges come from a contact sheet, in the 9.1 format.
- A new `loop` section in `PlayerSettings` instead of `highway.*`, so the group reads as one block in looks and files (**Q3**).

### 4.2 Dim

- **Core:** `loopWindow(loop, preRoll, barMap, tempoMap)` → `{ startTick, endTick, preStartTick, periodTicks }` (pure, unit-tested).
  - `preStartTick` = the tick at the pre-roll window's start (same maths as `Transport.windowFor`; it can be negative before bar 1).
  - `periodTicks` = `endTick − preStartTick`, which is exactly the `uTick` jump at the wrap.
- **Engine:** `engine.setLoop(window | null, settings)`. The uniforms are `uLoopStart`, `uLoopEnd`, `uLoopPreStart`, `uLoopDim` (0 when off or no loop) and `uLoopRepeat`.
- **GLSL:** `loopDim(tick)`, used next to `hazeAlpha` in notes, sustains, ridges, heads, bar and beat lines, lanes, cages, note names and the now-line effects that sit on the highway.
  - Opaque surfaces mix toward the highway background colour.
  - Blended layers scale their alpha.
  - The glow pass scales its output.

  The result looks the same as an overlay, but it is exact on 3D heads, whose tops would otherwise poke out of or into a flat overlay (**Q1**).

- **What's dimmed** (**Q2** on the pre-roll):
  - Ticks before the pre-roll start.
  - In Song continues, ticks after the loop end.
  - The keyboard never.
- **No flash:** the uniforms update in the same frame as the transport change that causes them (loop on/off, seek, bookmark load). The engine reads the window when `setLoop` is called, not lazily. An e2e test samples frames across a toggle.

### 4.3 Next repeat

- Beyond `endTick` the highway shows `[preStartTick, endTick)` again, shifted by `k · periodTicks`, for as many copies as `1.5 × look-ahead` needs. A 1-bar loop at 32 beats of look-ahead needs up to 12; the cap is `ceil(1.5 · lookAhead / period)`.
- **Drawing:** each note layer gets `uTickOffset` and `uClip` (a tick range).
  - Pass 0 is the song, clipped at `endTick` while the repeat is on.
  - Pass k ≥ 1 reuses the **same geometry and material** with offset `k · period`, clipped to its copy. It is drawn by small proxy meshes whose `onBeforeRender` sets the two uniforms.
  - Bar and beat lines and note names repeat the same way. Lanes, borders and octave lines are static, so nothing to do. Effects only happen at the now line.
- **Timing:** the copy sits exactly where `uTick` will be after the wrap, so it scrolls into the now line seamlessly. The boundary lines mark each seam (end line, then start line one pre-roll later).
- **Draw calls:** measured with `renderer.info` on the perf page, for no loop, a long loop and a 1-bar loop at max look-ahead, Off and Medium. The numbers go in the report. If a 1-bar loop at max look-ahead costs too much, fallback: one instanced draw per layer of the loop's notes duplicated per copy, rebuilt on loop change only.

### 4.4 Boundary lines

- Drawn by the existing line renderer (`Highway` bar-line path with glow twin), at `startTick` and `endTick` (and each repeat seam).
- Render order: after lanes and bar lines, before every note layer, so they draw under the heads.

### 4.5 Edge cases (unit and e2e)

- A loop shorter than the look-ahead.
- A loop at bar 1 with pre-roll (negative `preStartTick`, an empty highway in the gap).
- A one-bar loop.
- Loop on/off while playing.
- Seek while paused.
- Bookmark load.
- A loop editor range applied.
- A tempo change inside the loop.

## 5. D. Open Home when a new session starts

- **Setting:** `appearance.homeOnNewSession` (default on), in Settings → Appearance → Start, next to "Start on" (there's no Home/Welcome tab; **Q8**).
- **Rule** (core, pure: `shouldOpenHome(now, lastPlaybackEnd, lastAutoOpen, state)`):
  - Open Home when `now − lastPlaybackEnd ≥ SESSION_GAP_MS` and no auto-open has happened since `lastPlaybackEnd`.
  - `lastPlaybackEnd` comes from the active profile's newest play record's end, or the in-memory recorder while running.
  - `lastAutoOpen` is kept per profile in localStorage.
  - With no playback ever, it opens once.
- **When it is checked:** on load (after the profile and log are read) and on `visibilitychange` → visible and on window `focus`. Also, with the tab visible and idle, when the gap passes (**Q10**).
- **Never interrupts:**
  - Skip while playing.
  - Skip while any dialog is open (`[role="dialog"][data-state="open"]`, as the app keys already check).
  - Skip while there is an unsaved draft (the bookmark draft and loop-editor edits; a small `ui.hasDraft` flag).
  - Skip outside the app pages.

  A skipped check still counts as handled for this gap ("waits until the next new session").

- **Start on:** with Start on = Welcome nothing changes at the root. With Start on = Player, or on a reload of `#/`, this rule can still open Home when a new session began. Decision 24 is amended to say so.
- **E2e:** a fake clock (`page.clock`) with a play record more than 10 min old opens Home on load and on refocus. It doesn't open while playing, with a bookmark draft open, or with the setting off. A second refocus in the same gap doesn't open it again.

## 6. E. Picker and Library open on the current song

- **Picker:**
  - On open, highlight the current song and select the **loaded bookmark** (else Full song), whatever the sort.
  - Scroll both lists so the selection is in view (`block: 'center'` the first time).
  - Focus the song list, not the search field (**Q12**).
- **Library:**
  - On open, select the current song (instead of the first row) and scroll it into view, whatever the sort and grouping.
  - If the store's search or tag or source filter hides it, show "Current song is hidden by the filter · Show". Show calls the existing `clearFiltersHiding` and reveals and selects the song.
  - The song details panel's bookmark list marks the current bookmark.
  - Focus starts on the song list.
- **E2e:** for each sort order (and direction), open the picker and the Library and check that the current song is selected, visible in the scroll box, and focused. Repeat with a filter that hides it: the line appears, Show clears it and reveals the song.

## 7. Process and checks

- **Contact sheets** (`npm run test:visual`, JPEGs in `docs/design/m9-2/`): black notes, keys and loop, as listed in the spec, using the 9.1 sheet helpers (`ranges.spec.ts`, `contactSheet.ts`, `?capture=1`). I view each sheet at full size before reporting.
- **Unit tests:**
  - `loopWindow`.
  - The repeat copy count.
  - `shouldOpenHome`.
  - Black key depth.
  - The v9 migration (settings, looks, look files).
  - The new registry ranges and clamping.
  - The look pins.
- **E2e:**
  - New tests for D and E.
  - The loop toggle with no flash, the repeat seam (a pixel check at the end line), and the ridge setting visible only with 3D heads.
  - Run with `chromium` and `polish`, `--retries=0`, and report both.
- **Brief:** amend the decisions on black lift and contact shadow (milestone 5 ones), head height, decision 24 (Start on), and the looks key list. Add new decisions for loop visibility, the repeat, and Home on a new session.
- **Report** `docs/reports/feat-m9-2-practice-clarity.md` with sheets, results and the A.5 draw-call numbers.
- **Stops:**
  1. After this plan.
  2. After B6 (shadow decision).
  3. At the end, for review.

## 8. Questions

1. **Dim by shader, not by an overlay quad (A1).** A flat overlay on the highway plane can't cover 3D heads correctly. Heads just inside the loop poke up into the dimmed area, and heads beyond the end poke out of it. Dimming per fragment by tick gives the overlay's look, mixing toward the highway background, and is exact. OK to build it that way?
2. **Pre-roll stretch (A1, A3).** The spec says the repeat's pre-roll is not dimmed. For consistency I'd also **not** dim the live pre-roll bars before the loop start, and dim only before the pre-roll start (and after the end in Song continues). The start line marks where the loop begins. Or do you want the pre-roll bars dimmed in both places?
3. **Where the settings live (A).** A new `loop.*` section (keys `loop.dim`, `loop.dimStrength`, `loop.lines`, …) shown as a "Loop" group at the end of the sidebar's Highway section. Or would you rather have a separate sidebar section "Loop"?
4. **Boundary line defaults.** Same width and glow as the bar lines' defaults, then tuned on the loop sheet. The start and end lines look the same (one colour setting). OK, or do you want the end line distinct (for example a dashed end or a stronger glow)?
5. **Raised black sustains.** Only shown with 3D heads on? And with sustain transparency, the ridge's faces at one alpha (top plus visible sides), or opaque, darker sides with a translucent top? I'll show both on the sheet if you have no preference.
6. **Darker side faces (B5).** A fixed amount, no setting? (It's always useful, and a setting adds to the look surface.)
7. **Classic's black note height.** Equal to its white height (0.35), or the new taller default? Either way its black notes move onto the highway.
8. **D's setting home.** Settings → Appearance → Start ("Open Home when a new session starts"), next to Start on. OK?
9. **What "a new session has begun" means (D1).** Decision 5 also ends a session when the app closes, and the recorder starts a new stats session on every reload. If D followed that literally, every refresh would open Home. Proposal: Home opens when at least 10 min have passed since the last playback ended (from the play log), once per gap. The stats session rules stay as they are. OK? (And should stats sessions then also continue across a reload within 10 min? I'd leave that out of scope.)
10. **Idle with the tab in front.** If you leave the player open and visible, without playback, and the 10 min pass, should Home open by itself? The spec lists load, refresh and refocus. I'd say **no**, only on those three, so the screen never changes while you might be looking at it.
11. **Picker search on open (E2).** The picker clears its search every time it opens, so it can never hide the current song, and the "hidden by the filter" line would only ever show in the Library. Keep clearing it, or should the picker now keep its search and sort between opens (then it gets the line too)? The spec's e2e mentions a filter in the picker; with clearing kept, that test targets the Library.
12. **Focus in the picker (E3).** Today focus starts in the search field (type to search), and the list keys already work from there (decisions 90–91). Moving focus to the song list means typing no longer goes straight into the search. Keep it in the search field with the selection on the current song? Or move focus to the list as the spec says?

## 9. Answers (approved 2026-11-23)

1. Dim per fragment in the shaders, not an overlay.
2. Only [loop start, loop end) is undimmed. Pre-roll, before it, and after the end in Song continues are dimmed, live and in the repeat. The spec is amended.
3. A separate sidebar section **Loop**, after Highway; keys in `loop.*`.
4. One shared colour, width and glow; the end line is drawn stronger by default (fixed ≈ 1.5× glow).
5. Ridges only with 3D heads on. The sheet shows both translucency variants (one-alpha faces; opaque darker sides with a translucent top) for a pick.
6. **Black side shading**: a setting, 0–100 %, default ≈ 40 %, part of looks, pinned in Classic and BASE.
7. Classic uses the new taller black head height default.
8. "Open Home when a new session starts" in Settings → Appearance → Start.
9. **One session rule for Home and stats:**
   - "New session after" (Appearance → Start): 10 / 20 / 30 / 60 min, default 30. It replaces `SESSION_GAP_MS` everywhere.
   - New session = at least the gap since the last playback ended (from the play log), once per gap. A reload within the gap continues the same stats session. One shared core function, unit-tested; decision 5 amended.
   - Report whether stats sessions are stored or derived from the log (whether the new default changes how past sessions count).
10. Home also opens by itself when the gap passes while the app is open and idle (a timer for the remaining gap, re-armed on playback).
    - Blocks: playback running, an unsaved draft (bookmark draft, loop-editor edits); then it waits for the next new session.
    - Plain menus, dialogs and settings without unsaved work don't block: they close and Home opens.
    - **Tracking suspended** (for 9.5): one store flag, unused for now. While on, nothing is recorded (sessions, time, song and bookmark plays) and the session/idle timer is paused. Unit-tested. Roadmap 9.5 notes it.
11. The picker keeps clearing its search on open; the hidden-by-filter line is Library-only. The spec's e2e is adjusted.
12. The picker's focus stays in the search field, with the current song and bookmark selected (overrides E3). The Library's focus starts on the song list.

Order C → B → A → D/E. Stop after B6 for the shadow decision. Local commits, no push.
