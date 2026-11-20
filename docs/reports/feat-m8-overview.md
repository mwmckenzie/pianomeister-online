# Review report — `feat/m8-overview` (Milestone 8: Section overview & loop editor)

Plan: `docs/milestones/m8.md`, with the answers agreed when planning (m8.md "Agreed when planning", 19–23). References: `docs/design/m8/source/QGOverviewA.dc.html` (strip) and `QGOverviewB.dc.html` (editor).

## 2026-11-20 — Round 1: built

### What was done

**Docs**

- `docs/brief.md`: decisions 8, 24, 38, 60, 64, 69, 77 and 83 updated; new 101–107 (drawing, loop band, selection and action bar, playhead/zoom/keys, strip, editor page, editor edits bookmarks).
- `docs/roadmap.md`: 7.7 ✅, 8 in progress.
- `docs/milestones/m8.md`: "Agreed when planning" 19–23.

**Core — `src/core/overview/`** (pure, `overview.spec.ts`, 25 tests)

- `layoutBars` → `BarLayout`/`BarSpan`: bars in ticks from the bar map (meter changes, pickup bar 0), beat ticks, every 4th bar strong, the narrowest view (4 of the shortest bars, a pickup excluded).
- View math (`OverviewView`): `clampView`, `zoomAround` (anchor stays under the pointer), `viewForBars` (presets), `followView` (pages at 90 %, playhead 10 % from the left).
- `labelStep`/`isLabelledBar` (bar numbers ≥ 24 px apart, counted from bar 1), `pitchRange` (notes ±2 semitones, at least an octave), `notesInView` (binary-search culling).
- `hitTest`/`HitTarget` (grips win and reach 6 px beyond their box; the nearer of two touching handles), `stackLanes`/`LaneRow` (rows, `maxRows`, hidden count), `barAtTick`, `snapSelection`, `moveBarCursor`/`BarCursor`, `moveRange`, `resizeRange` (via `adjustLoopRange`), `playFromBar` (via `loopSeekBar`).
- `COMMANDS.ts`: **Toggle overview** [`V`] and **Loop editor** [`E`] (Player scope).

**UI — `src/ui/overview/`**

- `PianoRollCanvas.vue`: two canvases (notes + grid, redrawn on view/size/hands/theme; light layer for loop band, handles, tags, selection, bar cursor, playhead); pointer (handle drags applied on release, selection drags, click to seek), Ctrl/⌘+wheel and pinch zoom, wheel pan; keys (←/→ cursor, Shift extends, Enter loops, the Save-as-bookmark key saves the selection, Esc clears); a polite live region ("Selected bars 41–48 · 8 bars"). `RollFrame`, `rollScale`, `ThemeColors`/`readThemeColors`, `useElementSize`.
- `BookmarkLanes.vue` (strip: click loads, the playing one lit, ≤ 2 rows and "+N"; editor: click selects, the selected one's grips and body drag), `SelectionActions.vue` (the action bar), `OverviewMinimap.vue`, `useOverviewView.ts` (view, Follow, zoom slider, presets), `useSaveSelection.ts` (saves without loading; Load / Rename / Undo), `OverviewStrip.vue`, `OverviewHost.ts` + `overviewHostKey.ts`.
- `src/ui/views/LoopEditorView.vue` (`#/editor`, child route of the player).
- `PlayerView.vue`: the timeline's chevron; the strip between the columns (measured: counter / "bar N of M" on the left, the whole right column; 24 px gaps; recomputed by a ResizeObserver); title, composer and now-playing truncate at it; V/E; the editor freezes the scene (7.7's freeze), hides the HUD and keeps playback and its keys (not P or V); `provide(overviewHostKey)`; the strip and editor chunks prefetched on mount.
- `practiceStore.savedLoopChanged(id)` (+ unit test): an editor range edit of the loaded bookmark moves the loop with one jump unless a temporary loop wins.
- `uiStateStore.overviewOpen` (persisted). `App.vue`: H/S also on the editor. `SHORTCUT_GROUPS`: the "where" lines mention the loop editor.
- Bookmark manager: **Open in editor** in the edit panel (footer now two rows).

**Tests**

- `e2e/overview.spec.ts` (8) and `e2e/loopEditor.spec.ts` (5): every case m8 lists, plus B with a selection, the "Already saved" toast, arrows staying in the overview, E from the player and the manager, Space in the editor, playback still running there.
- `e2e/perf.spec.ts`: the 340-bar strip test. `scripts/make-long-demo.mjs` → `test-fixtures/midi/long-demo.mid` (340 bars, 9,520 notes).
- `e2e/visual-review.spec.ts` block 12: strip (whole song with two lane rows; zoomed with a selection and the action bar) and editor (32 bars, B section selected), 1280×720 / 1024×768, Glacier / Ember.

### Decisions I made that weren't in the instructions

- **Follow pages** rather than scrolling every frame (at 90 % of the width, the playhead put back at 10 %): the notes layer redraws once per page, not per frame.
- **Narrowest zoom = 4 of the shortest bars** (a pickup bar 0 not counted), so any 4 bars fit a preset across a meter change.
- **Handles and grips snap to the nearest bar boundary** while dragging; a drag of less than 4 px is a click (seek / pick).
- **First ←/→** on the focused roll places the cursor at the playhead's bar without moving it; a click on the notes also clears an existing selection.
- **Editor:** the roll has focus on arrival (Space plays, arrows move the cursor); a lane click selects that bookmark and clears the note selection, and a new note selection deselects the bookmark; E toggles back to the player; H and S work there.
- **Open in editor** (manager) for a song that isn't loaded loads it as Full song first; for the loaded song what's loaded stays (temporary changes included).
- The Undo toast after a range edit names the bookmark as it was before the edit ("Bars of "Bars 17–32 · …" changed to 17–36").
- **Chunks prefetched:** the strip's and editor's lazy chunks are requested on player mount, like the picker's and settings' — under e2e load their on-demand requests queued behind the samples (found in the first full run, see below).
- **Perf hook:** `window.pianomeisterOverviewDraws`, recorded only when a test puts an array there.
- The fixture has 9,520 notes (sixteenths over three-note chords), not "about 10,000".

### Deviations from the sources

- **Strip width:** between the HUD columns (agreed), so 780 px at 1280 and 526 px at 1024 instead of the mockup's 1248. Header items drop as it narrows: the hand legend below 880 px, the "Overview" caption and the word "Zoom" below 600, the song line and zoom below 460, Open editor below 300 (with the playfield panel open on a tablet the strip is ~167 px; V, E and the chevron still work).
- **Strip header** gains **Open editor** (missing from A) and the **Follow** chip (only while following is off).
- **Timeline** ends 28 px earlier for the chevron (QGOverviewA shows the strip open, so no chevron there).
- **Strip loop tags** (bar numbers) show only while dragging, in the bar-number row; the editor shows them always (as B).
- **Lanes:** a bookmark starting left of the view keeps its label in sight; lanes are clipped to the notes' insets; the strip lane's second row pushes the notes down 26 px.
- **Editor presets** in the order Whole song · 32 · 16 · 8 (B has 16 before 32); the notes area grows with the window (B is 300 px at 720; the minimap stays 74 px off the bottom as in B); the panel's stats columns size to their values ("1 h 13 min" didn't fit thirds); the minimap marks the loop (secondary 18 %).
- **No-bookmark panel** (not in B): "Selection" / "Loop" / "Nothing selected", the range, a help line, Loop these bars and Save as bookmark.
- **Bookmark manager** footer in two rows (Load in player · Open in editor / Duplicate · Delete).
- The visual shot shows bars 1–32 (B shows 9–40).

### Test and check results

- `npm run check`: pass — 576 unit tests (550 + 25 overview + 1 practice store).
- `npm run build`: pass. New chunks: `OverviewStrip` 5.6 kB, `LoopEditorView` 11.4 kB (gzip 2.4 / 4.6 kB).
- **Full e2e, preview, `--retries=0`:** first run **137/143** — 2 overview tests waited for the strip's lazy chunk (fixed by the prefetch) and 4 existing tests (bookmarks ×2, listKeys picker, longNames manager) waited for a load after navigation, the round-3 load pattern on paths this milestone doesn't touch. After the fix: **143/143 three times** (2.0, 1.6, 1.5 min).
- **Perf** (`npm run test:perf`, headed, 1600×900):

  | Generated 340-bar song (9,520 notes), playing | Engine frame | Frame interval | Main thread busy |
  | --------------------------------------------- | ------------ | -------------- | ---------------- |
  | Strip closed                                  | 0.33 ms      | 8.33 ms        | 164 ms/s         |
  | Strip open, whole song                        | 0.25 ms      | 8.33 ms        | 144 ms/s         |
  | Strip open, zoomed in, following              | 0.25 ms      | 8.33 ms        | 144 ms/s         |

  Notes-layer redraw on zoom (7 steps, whole song ↔ 4 bars): **mean 0.89 ms, max 2.1 ms** (target < 16 ms). Following while zoomed: 1 redraw in 11 s. Canon runs unchanged (0.27–0.34 ms per frame); Welcome still 0 frames/s.

- **Visual** (`m6 player|m6 library|m6 settings|m7 |m7.5|m7.6|m7.7|m8 `): **90/90**, the m8 shots compared with QGOverviewA/B.

### Known issues and open questions

1. **Very narrow strip:** with the playfield panel open at 1024 the strip is ~167 px — useful for seeing where you are and selecting, little else. Hide the strip below some width instead (and say so on the chevron)?
2. **The e2e suite's margin under load** is still thin on this machine (one run in four failed on unrelated paths before the prefetch). The cause is round 3's (CPU-bound software WebGL in parallel); the prefetch removes this milestone's share of it.
3. Strip lane items are buttons, so each is a Tab stop; with many bookmarks that's a long Tab path through the strip. Make the lane one stop with arrow keys?
4. The editor's hand checkboxes are view-only and not remembered between visits.

### Manual review checklist

- [ ] Player: the chevron at the timeline's end and V open/close the strip; it stays open after a reload; the HUD columns don't move; the title and composer truncate at the strip.
- [ ] Strip: drag across the notes → the action bar; Loop these bars (one jump); Save as bookmark (not loaded; Load / Rename / Undo); click a bar (seek; with a loop, outside lands on its start); drag a loop handle; click a lane bookmark (loads).
- [ ] Zoom: the slider, Ctrl/⌘+wheel around the pointer, wheel panning; play zoomed in (Follow pages along; pan by hand → the Follow chip).
- [ ] Keys on the focused strip: ←/→, Shift+←/→, Enter, B, Esc; Space still plays.
- [ ] E (or Open editor) while playing: playback continues; presets; minimap drag; select a bookmark and drag its ends/body, From/To, Undo; "Same settings as …"; Play from bar N with a selection outside the loop.
- [ ] Bookmark manager → Open in editor for another song's bookmark.
- [ ] Ember theme, 1024×768, and the playfield panel open with the strip.

## 2026-11-20 — Round 2: review changes

### What changed

1. **No room, no strip:** below 360 px between the HUD columns the strip isn't shown. The chevron's hint (and accessible name) reads "Not enough room for the overview here · open the loop editor (E)", and the chevron or `V` open the loop editor instead. The columns are now measured whenever the HUD shows (strip open or not), so the strip comes back by itself when there's room (`PlayerView.vue`: `stripFits`, `watchStripRoom`).
2. **Bookmark lanes are one Tab stop** (strip and editor, `BookmarkLanes.vue`): a roving tabindex — the last focused bookmark, else the lit/selected one, else the first — with ←/→ along a row, ↑/↓ to the nearest bookmark (by its middle) in the row above or below, Enter/Space loads (strip) or selects (editor); the arrows are handled there, so the player's bar keys don't also run. The focused item shows the usual focus ring.
3. **The editor's hand toggles** are remembered in `pianomeister.ui` (`uiStateStore.editorHands`). Toggling them now also redraws the roll and minimap (they had watched the object, not its fields).
4. **Loop editor in the left menu**, after Change song: a new `loopEditor` icon (a piano-roll strip with a selected section), hint "Loop editor E", lit (`active`) while the editor is open; on Welcome it opens the editor. The cheat sheet lists it (the command "Loop editor", `E`). Menu items are now 36 px tall with 2 px gaps (were 40 / 4), so the column still clears the keyboard: with two profiles (nine items) the menu ends at y = 561 at both 1280×720 and 1024×768, strip open or closed (one profile: 523); the keyboard starts at ≈ 572 (720) / 640 (768).
- Brief decisions 60, 105 and 106 and m8.md (agreed 24) updated.

### Results

- `npm run check`: pass (576). `npm run build`: pass.
- Full e2e, preview, `--retries=0`: **147/147** (new: the no-room chevron, the lane's arrow keys in the strip and the editor, the remembered hand toggles, the menu item from the player and Welcome).
- Visual: the whole visual project, **138/138** (every player shot changed with the menu).

### Known issues and open questions

- The menu item is lit while the editor is open, but the editor page covers the player's menu (QGOverviewB has none), so the lit state isn't visible there. Show the app menu on the editor like on Welcome?
