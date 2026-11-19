# Review report — `feat/m7-5-shortcuts` (Milestone 7.5: Shortcuts)

Plan: `docs/milestones/m7-5.md`, approved with these answers:

- **Shift:** folded into character bindings and shown without Shift. The tab's help text says Shift+letter isn't a separate shortcut, while Ctrl and Alt combos are.
- **Bookmark manager:** ↑/↓ added to its list, using the same "Next / Previous in list" commands.
- **Show shortcuts:** works on the player, library and bookmark manager. It is blocked while typing or while another dialog is open. The cheat sheet lists every scope and closes on its own key or Esc.
- **Close (Esc):** listed as fixed.
- **Storage:** v5 stores `{ settings, shortcuts }`.
- **Transport tooltips:** show the keys in effect.

Step 0 is committed on its own (`7a92a63 fix: give confirm dialogs the standard dialog layout`). Nothing else is committed.

---

## 2026-11-18 — Round 1: milestone 7.5 built

### What was done

| Area            | Files                                                                                                                                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 0: dialogs | `AppDialog.vue`, `BookmarkManagerView.vue`, `ProfilesTab.vue`, `ProfileCollisionDialog.vue`, `visual-review.spec.ts`                                      | **Cause:** `AppDialog` had no inner layout, so every `show-title` dialog put its title flush at the edge.<br>**Fix:** `AppDialog` with `show-title` now has the standard layout: a padded title, a body, and a `#footer` slot for right-aligned buttons. It uses the picker's spacing: 22 px sides and 10 px between buttons.<br>**Dialogs moved to it:** discard duplicate, profile delete and import collision.<br>**Upload delete:** an inline confirm inside the details panel, not a dialog. It already sits in the panel's padding and is left as is (see open question 3).<br>**New shots:** `dialog-discard-duplicate` and `dialog-profile-delete` at 1280×720.                                   |
| Core: bindings  | `core/commands/`: `KeyBinding`, `Binding`, `KeyEventLike`, `keyBindings`, `formatBinding`, `reservedKeys`                                                 | **`KeyBinding`** is `{ kind: 'key', match: 'char' \| 'code', value, ctrl, alt, shift, meta }`. `Binding` is a union of that type, ready for MIDI.<br>**`bindingFromEvent` / `matchesEvent`** follow decision 87: printable characters without Ctrl/Alt/Meta are matched by character (Shift folded in); everything else by physical key with exact modifiers.<br>**`formatBinding`** writes labels like "Ctrl+Shift+K", "←", "?". It uses the layout map when there is one, else US names.<br>**`reservedReason`** gives the reason a key is refused.                                                                                                                                                     |
| Core: registry  | `COMMANDS`, `Command`, `CommandScope`, `CommandId`, `shortcutBindings`, `ShortcutOverrides`, `ShortcutEdit`, `applyShortcutEdit`, `readShortcutOverrides` | **Registry:** every command has a description. Defaults move to character bindings: B, M, O, L, P, `,`, `?`, `-`, `+`, `=`, `0`.<br>**New commands:** Tempo down / up / 100%, Loop on/off, Revert to bookmark, Show shortcuts (scope `app`). Close is `fixed`.<br>**`effectiveBindings`, `scopesConflict`, `findConflicts`, `commandForEvent`:** look-up and conflicts under the decision 86 rules.<br>**`applyShortcutEdit`:** set / add / remove / replace / reset / reset all. It returns the previous overrides for Undo and drops an override that equals the defaults.<br>**`readShortcutOverrides`:** validation for storage.<br>**Removed:** `commandKeys.ts` (the milestone 7 code-only lookup). |
| Settings v5     | `loadSettings.ts`, `settingsStore.ts`                                                                                                                     | **Storage:** `{ version: 5, settings, shortcuts }`; v4 migrates to no overrides.<br>**Store:** `shortcuts`, `bindings`, `editShortcuts`, `restoreShortcuts`, `keyLabel`, `shortcutLabel`.<br>**Layout map:** read once from `navigator.keyboard.getLayoutMap()` where available.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Key handling    | `PlayerView.vue`, `SongPicker.vue`, `LibraryView.vue`, `BookmarkManagerView.vue`, `AppDialog.vue`, `App.vue`, `input/keyCapture.ts`, `input/typesText.ts` | **All handlers** match the bindings in effect (`commandForEvent`). Typing protection is unchanged. While a key is recorded (`keyCapture`), every handler stands aside and the dialogs' Esc (ours and Reka's) is blocked.<br>**Picker search:** a list command rebound to a letter can't fire while typing there.<br>**New:** tempo keys (step-aware, through the practice store), Loop on/off, Revert to bookmark.<br>**`App.vue`** handles `?` on the player, library and manager; the bookmark manager gets ↑/↓.                                                                                                                                                                                        |
| Hints           | `PlayerView.vue`, `IconButton.vue`, `HudToggle` uses                                                                                                      | **Menu hints and toggle hints** read the key in effect.<br>**Transport tooltips** show the key ("Play Space").<br>**Menu:** new "Keyboard shortcuts" item (`?`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Shortcuts tab   | `settings/ShortcutsTab.vue`, `settings/ShortcutRow.vue`, `SettingsWindow.vue`, `shortcuts/SHORTCUT_GROUPS.ts`                                             | **Groups:** Player / Lists / Everywhere / Dialogs, each with where it applies.<br>**Rows:** the label, key chips (click to record, × on hover/focus), "+", the reset icon, and "—" for no key.<br>**Recording:** shows "Press a key… · Esc to cancel"; blur stops it. A reserved key is refused with a message; a conflict shows "Already used by … Replace / Cancel".<br>**Footer:** "N shortcuts changed from default" and "Reset all shortcuts" with Undo; the tab gets the changed dot.                                                                                                                                                                                                               |
| Cheat sheet     | `shortcuts/ShortcutsSheet.vue`, `stores/uiStateStore.ts`                                                                                                  | **Content:** all commands with their keys in effect, two columns grouped by scope.<br>**"Change shortcuts…":** opens Settings → Shortcuts, going to the player first if needed (`settingsTabRequest`).<br>**Closing:** its own key or Esc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Docs            | `docs/brief.md`, `docs/roadmap.md`, `docs/milestones/m7-5.md`                                                                                             | **Brief:** decisions 60 (default shortcuts) and 80 (registry) updated; **new 83–89**.<br>**Roadmap:** 7 ✅, 7.5 in progress.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Decisions I made that weren't in the instructions

1. **A fourth scope, "Everywhere" (`app`),** for Show shortcuts, as your answer 8 needs. It conflicts with every scope, like Dialogs.
2. **Reserved list, applied by physical key:** Ctrl+L etc. are refused regardless of Shift ("Ctrl+Shift+L is used by the browser"). Alt+F4 is reserved too ("Alt+F4 closes the window").
3. **Recording a key the command already has** does nothing (no duplicate chip). A third key isn't possible: there is no "+" at two keys.
4. **Tempo keys** step by the tempo step, clamped to the tempo slider's range (decision 81), so with a 4 % step they stop at 28 % and 200 %.
5. **Revert to bookmark** does nothing without temporary changes. **Loop on/off** is the loop button.
6. **Picker search:** a list command bound to a character never fires while typing in the search box; arrows and Enter still do.
7. **Labels:** Meta is written "Meta" (no ⌘/⊞ detection). The numpad Enter reads "Num Enter". Physical letters follow the layout map where the browser offers one.
8. **The cheat sheet's "Change shortcuts…"** goes to the player first when opened on the library or manager, because the settings window lives there.
9. **Key capture is released at once** when a key is accepted. When Esc cancels, it is released a tick later so the dialog's own Esc doesn't also close the window. (An e2e test caught the closing Esc arriving within that tick.)
10. **Menu:** a "Keyboard shortcuts" item (keyboard icon) after Settings, as the "left-menu hint area" entry point.

### Test and check results

- `npm run check`: type-check, lint and **502 unit tests** pass (486 after milestone 7).
  - New: binding matching by character and by physical key (including German-layout cases: `?` via Shift+ß, `-` and `+` on their own keys, AltGr), recording rules, reserved keys, the scope conflict rules, `applyShortcutEdit` (record, add, remove, replace, reset, reset all, the Undo value, fixed commands), labels with and without a layout map, storage validation, settings v4 → v5.
  - The "no conflicting defaults" test now uses `findConflicts`.
- `npm run build`: passes, no chunk warning. Prettier is clean.
- **e2e, `CI=1` preview, `--retries=0`: 91/91** (12.4 min), including the new `shortcuts.spec.ts` (9 tests):
  - rebind to K (persists, reset restores Space);
  - second key, removing keys, "—";
  - a Ctrl+Shift combo;
  - conflict Replace / Cancel, and an Everywhere conflict;
  - reserved keys with messages;
  - Esc cancels recording with the window still open; a modifier alone keeps waiting; blur stops;
  - Reset all + Undo;
  - tempo keys with the step and a bookmark's temporary dot;
  - `?` on player, library and manager, blocked while typing and in another dialog, closing on its key and Esc, "Change shortcuts…";
  - menu hints and tooltips after rebinding, and a rebound letter typing in the picker search;
  - ↑/↓ in the bookmark manager.
- **e2e on dev:** the first full run after the changes failed 5/81. Two were version expectations (4 → 5, fixed); the other three passed alone, so they were the known dev-server queueing. The new spec passes 9/9 on dev.
- **Visual (`CI=1`): 98/98** (18.1 min). New:
  - `dialog-discard-duplicate` and `dialog-profile-delete` (1280×720);
  - `m7-5-shortcuts`, `-changed`, `-recording`, `-conflict` and `m7-5-cheat-sheet` (1280×720 and 1024×768, Glacier).
  - I looked at them: the dialogs are padded; the tab rows, dot, footer, recording chip and conflict line read correctly; the cheat sheet fits at 1024×768. The cheat sheet's numpad Enter showed "Enter" twice, so it now reads "Num Enter".
- Perf not re-run (no render-path changes).

### Known issues and open questions

1. **Character bindings and dead keys:** on layouts where a character needs a dead key (e.g. `^` on German), the press reports "Dead" and records as a physical key. That's harmless but reads oddly ("Shift+Backquote"). Leave it?
2. **Meta label:** "Meta" rather than ⌘ on macOS. Detect the platform?
3. **Upload delete confirm** (not a dialog): when it opens, its buttons can be below the fold of the details panel, and the panel doesn't scroll them into view. Want a scroll-into-view?
4. **Dev-server flakes** as in milestone 7 (the first full dev run had 5 failures; all passed when re-run alone).

### Manual review checklist

- [ ] Step 0: the duplicate-discard, profile-delete and import-collision dialogs have proper padding.
- [ ] Settings → Shortcuts:
  - [ ] rebind Play/pause to K, then reload;
  - [ ] add a second key and remove keys ("—");
  - [ ] a conflict with Replace and Cancel;
  - [ ] Ctrl+W refused;
  - [ ] Esc while recording keeps the window open;
  - [ ] Reset all, then Undo.
- [ ] A German (or other) layout: `?`, `-`, `+` and `,` work and read correctly.
- [ ] `-` / `+` / `0` change the tempo by the tempo step; with a bookmark loaded, the dot appears.
- [ ] `?` on the player, library and bookmark manager: the cheat sheet opens, and "Change shortcuts…" works.
- [ ] Hover the transport buttons and the menu: the keys shown follow your rebinding.
- [ ] Bookmark manager: ↑/↓ move through the list.

---

## 2026-11-19 — Round 2: more commands, list roles, page-level list keys

Your additions (Next/Previous tab, side-list keys, loop nudges, rules A and B), approved with these answers:

- a **Tabs** scope;
- reaching a tag makes it the only tag, with the source kept; an **"All songs"** item heads the library's side list and clears the source and tag filters;
- page search fields pass on keys that type nothing;
- nudges show at once and apply once, 400 ms after the last;
- Next/Previous tab wraps; ←/→ stay picker-only.

### What was done

| Area                 | Files                                                                                                           | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core                 | `COMMANDS.ts`, `CommandScope.ts`, `shortcutBindings.ts`, `practice/nudgeLoop.ts`                                | **New commands:** Next / Previous tab (`]` / `[`, scope Tabs), Next / Previous in side list (Shift+↓ / Shift+↑), Loop start −1 / +1 bar, Loop end −1 / +1 bar (no keys).<br>**Tabs scope:** conflicts with Lists, Dialogs and Everywhere, not with Player.<br>**`nudgeLoop`:** one end by whole bars, through `adjustLoopRange`.                                                                                                                                                                                                                                 |
| Page-level list keys | `input/pageListCommand.ts`, `input/useWindowKeys.ts`, `SegmentedControl.vue`                                    | **`pageListCommand`:** the shared guard for the picker, library, manager and settings window. It stands aside while recording, while typing (a field marked `data-list-search` passes on ↑/↓, Shift+↑/↓ and Enter), on a focused control that owns the arrows (sliders, timeline, segmented controls, tab lists, menus), for Enter on a button that isn't a list row, and while another dialog is open on top.<br>**Window listeners:** the picker and settings listen on the window while open, so keys still work after a click leaves focus on the page body. |
| Picker               | `SongPicker.vue`                                                                                                | ↑/↓ always the songs, Shift+↑/↓ the Load list (was: whichever list had focus). ←/→ and `[ ]` move focus between the lists. Enter loads the selected Load-list entry.                                                                                                                                                                                                                                                                                                                                                                                             |
| Library              | `LibraryView.vue`                                                                                               | **Window keys:** ↑/↓ the songs, Shift+↑/↓ the filter column (All songs, Bundled, Uploaded, then the tags), Enter plays, `[ ]` to Bookmarks.<br>**Filter cursor:** the item last reached or clicked has a marker (a primary bar on sources, a ring on tags); focus follows when it was in the column.<br>**"All songs":** clicking it now clears the tag filter too.                                                                                                                                                                                              |
| Bookmark manager     | `BookmarkManagerView.vue`                                                                                       | **Window keys:** ↑/↓ the bookmarks, Shift+↑/↓ the song filter (through the route, so the unsaved-duplicate check still asks), Enter loads in the player (rows are `data-list-row`), `[ ]` to Library.<br>**Focus:** follows the selection only when it was on a row of that list (it was always moved before).                                                                                                                                                                                                                                                   |
| Settings             | `SettingsWindow.vue`                                                                                            | `]` / `[` step through the tabs and wrap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Loop                 | `player/useLoopNudge.ts`, `LoopPopover.vue`, `PlayerView.vue`, `input/KEY_SETTLE_MS.ts`, `RangeSliderField.vue` | **`useLoopNudge`:** the pending range shows at once (HUD label and From/To), then applies once with one jump after 400 ms of quiet. With the loop off it starts from the last range and turns the loop on.<br>**Cancelled by:** any other loop change or a song load.<br>**Popover:** −/+ buttons beside From and To.<br>**Shared constant:** `KEY_SETTLE_MS` with the range slider.                                                                                                                                                                             |
| Help                 | `shortcuts/LIST_ROLES.ts`, `ListRolesTable.vue`, `ShortcutsTab.vue`, `ShortcutsSheet.vue`, `SHORTCUT_GROUPS.ts` | **Role table:** page, main list, side list and what Enter does, with the keys in effect in the headers. It appears in the Lists group of the tab (with a line on where list keys work) and across the bottom of the cheat sheet.<br>**Groups:** a new "Tabs" group.                                                                                                                                                                                                                                                                                              |
| Docs                 | `docs/brief.md`                                                                                                 | **Updated:** decisions 83, 86 and 89.<br>**New:** 90 (list roles, tabs), 91 (page-level list keys), 92 (loop nudges).                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### Decisions I made that weren't in the instructions

1. **←/→ in a search field** stay with the caret. Only ↑/↓, Shift+↑/↓ and Enter pass on to the lists. Your answer 3 said "arrows"; I left ←/→ out because moving focus out of the field while editing text would be surprising.
2. **Reaching a source** (Bundled, Uploaded) by keyboard clears the tags, as the plan said. Clicking a source still keeps them; clicking "All songs" now clears them, like reaching it.
3. **Library filter cursor:** a marker on the item last reached or clicked, since the column's pressed states can't show which item ↑/↓ moves from. It sits on the current source until you move.
4. **Focus follows the selection** only when it was already on a row of that list. Otherwise focus stays put, e.g. in search.
5. **Enter on a focused button** (Export, Delete, sort headers…) stays that button's. Bookmark rows are marked as list rows, so Enter on one loads it.
6. **Nudges are cancelled** by any other loop change (slider, fields, toggle, clear) and by loading another song.
7. **Command labels:** "Next in side list" / "Previous in side list", and "Open the selection" for Enter (was "Load the selection").

### Test and check results

- `npm run check`: **511 unit tests** pass (502 in round 1).
  - New: `nudgeLoop` (move, push, clamp, four in a row); the Tabs conflict rules and `]` free for the player; Shift+↓ vs ↓; `[` via AltGr on German isn't the character binding (see open question 1); `pageListCommand` guards (search field, slider, segmented control, buttons vs list rows, recording, another dialog).
- `npm run build`: passes. Prettier is clean.
- New `e2e/listKeys.spec.ts` (6 tests), all passing on `CI=1` preview:
  - library from the page body: ↑/↓, the side list through All songs, the sources and the tag and back, `]` typed in search, ↓ from search, `[ ]`, Enter plays;
  - manager: ↑/↓, a focused slider keeps ↓, Shift+↑/↓ filter, `[` typed in search, Enter loads;
  - picker: Shift+↓ from search, ↑/↓ from the dialog body, ↓ vs Shift+↓ with the Load list focused, `[ ]` focus, Enter loads;
  - settings: `]` / `[` and wrapping;
  - four quick nudges (300 ms apart, fake clock) show at once, then one jump to 42:1;
  - a nudge key with the loop off turns the loop on from the last range.
- **Changed tests:**
  - in `picker.spec.ts`, the Load-list step now uses Shift+↓ (was → then ↓);
  - the round 1 manager ↑/↓ test passes unchanged: focus follows because it was on a row.
- **Full e2e (`CI=1` preview, `--retries=0`), final build: 103/103** (9.7 min).
  - An earlier full run, before the layout fix, failed one test: `player.spec.ts` "loop range" (Tab from From to To landed on the new −/+ buttons). Fixed as described below.
- **Visual (`CI=1`):**
  - the affected shots pass: all m7.5, both loop popovers, m7 library, bookmarks and picker;
  - new: `m7-5-shortcuts-lists`, `m7-5-loop-nudges` (both viewports), `m7-5-cheat-sheet-800x600`, `m7-5-cheat-sheet-roles-800x600` and `m7-5-shortcuts-800x600`;
  - I looked at them (see the layout fix below for what the first pass showed).

### Cheat sheet layout fix (your follow-up)

- **Cheat sheet:**
  - `width: min(1100px, 100vw - 48px)`;
  - groups in `repeat(auto-fit, minmax(min(340px, 100%), 1fr))`, so two columns where there's room and one where there isn't;
  - `min-width: 0` down the tree, and the body scrolls only vertically.
- **Rows** (cheat sheet and Shortcuts tab): flex-wrap.
  - The label is `flex: 1 1 12ch` and wraps.
  - The keys never shrink (`flex-shrink: 0`, `nowrap`) and stay right-aligned. When they don't fit beside the label they move under it, still right-aligned.
  - In the tab, the chips, "+" and the reset icon move together.
- **"Lists on each page":** the role table is now its own full-width section at the bottom of the cheat sheet and the Shortcuts tab. Below 720 px of its own width (a container query) it stacks into one block per page: "Main list ↑ ↓: Songs", "Side list …", "Enter: Load".
- **Found in the first shots and fixed:**
  - the cheat sheet scrolled at 1024×768 once the new commands were added;
  - the loop popover's −/+ buttons overflowed into the To field (now a `minmax(0, 1fr) 28px 28px` grid).
- **Loop popover −/+ and Tab:** the buttons broke Tab from From to To, which `player.spec.ts` covers, so they are out of the Tab order (`tabindex="-1"`). Keyboard users have the fields and the nudge commands. Say if you'd rather they be tabbable.
- **New `e2e/shortcutsLayout.spec.ts`** (6 tests), passing at 1280×720, 1024×768 and 800×600 for the cheat sheet and for the Shortcuts tab with a second key added:
  - `scrollWidth <= clientWidth` on the dialog and every scroll container in it;
  - every key chip's bounding box lies inside its row.

### Known issues and open questions

1. **`[` / `]` on German and other layouts** where they need AltGr: AltGr reports Ctrl+Alt, so per decision 87 the press is a physical-key combo and doesn't match the `[` character binding. The defaults don't work there until rebound. Options:
   - let character bindings also match AltGr-typed characters (accepting that a Ctrl+Alt+8 combo bound elsewhere would compete);
   - leave it, since rebinding takes two clicks.
2. **Library side list across tags:** reaching a tag keeps the source, so moving Uploaded → a tag shows Uploaded songs with that tag (often none). That follows your answer, but it can look like the list emptied. Fine?
3. Round 1 questions 1–4 are still open (dead keys, the Meta label, the upload-delete confirm, dev flakes).

### Manual review checklist

- [ ] Library: click empty page space, then ↑/↓, Shift+↑/↓ (watch the filter marker), Enter plays; `]` goes to Bookmarks.
- [ ] Bookmark manager: ↑/↓, Shift+↑/↓ through the songs, Enter loads; arrows on the tempo slider stay with the slider.
- [ ] Picker: ↓ moves the songs and Shift+↓ the Load list, also from the search box; Enter loads.
- [ ] Settings: `]` / `[` step through the tabs and wrap.
- [ ] Loop popover: −/+ beside From/To; the label updates at once, then one jump. Bind a nudge key and try it with the loop off.
- [ ] Shortcuts tab (Lists group) and cheat sheet: the role table reads right.

---

## 2026-11-19 — Round 3: open questions answered

Round 2 is approved, including the three departures. Your answers, and what changed:

| Item                  | Files                                                                                                         | Change                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AltGr characters      | `core/commands/keyBindings.ts`, `shortcutBindings.ts`, `ui/input/typesText.ts`                                | **Matching:** a Ctrl+Alt press that types a printable character also matches the character bindings, but only when no physical-key binding matches it first. A Ctrl+Alt combo the user recorded therefore still wins.<br>**Typing:** `typesText` counts AltGr characters as typing, so `@` or `[` typed in a search field stay text.                                                            |
| Library empty state   | `LibraryView.vue`                                                                                             | With a source or tag filter active, the empty list reads "No songs match these filters · Shift+↑ to All songs" (the key in effect; without one, just the first part). A search alone still reads "No songs match."                                                                                                                                                                              |
| Dead keys             | —                                                                                                             | Left as is.                                                                                                                                                                                                                                                                                                                                                                                     |
| Meta label            | `core/commands/metaKeyLabel.ts`, `formatBinding.ts`, `reservedKeys.ts`, `settingsStore.ts`, `ShortcutRow.vue` | **Label:** ⌘ on macOS, iPadOS and iOS, "Win" on Windows, "Meta" elsewhere. It is read once from `navigator.userAgentData.platform`, else `navigator.platform`, and Ctrl stays "Ctrl".<br>**Reserved-key messages** use the same label ("⌘+W is used by the browser").                                                                                                                           |
| Upload-delete confirm | `SongDetailsPanel.vue`                                                                                        | It scrolls into view when it opens (`block: 'nearest'`; smooth unless motion is reduced).                                                                                                                                                                                                                                                                                                       |
| e2e server            | `playwright.config.ts`, `package.json`, `CLAUDE.md`                                                           | **`npm run test:e2e`** builds (`build-only`) and runs against the production preview (port 4173).<br>**`npm run test:e2e:dev`** runs against the dev server (5173, reused if running). The config tells them apart by the npm script name, or `PW_DEV=1`, so Windows needs no cross-env.<br>**CLAUDE.md** explains why: on the dev server the sample downloads saturate HTTP/1.1's connections. |
| Docs                  | `docs/brief.md`                                                                                               | Decision 87 (AltGr, the Meta label), 90 (the empty state) and 74 (the confirm scrolls into view).                                                                                                                                                                                                                                                                                               |

### Decisions I made that weren't in the instructions

1. **`test:visual` and `test:perf` also build first and use the preview**, since the config now defaults to it. Perf numbers from earlier milestones were taken on the dev server, so the next perf report may not compare directly.
2. **Retries and workers still follow `CI`.** Only the server choice changed.

### Test and check results

- `npm run check`: **515 unit tests** pass.
  - New: AltGr `[ ] { } @` on a German layout, a recorded Ctrl+Alt+Q beating `@`, Ctrl+Alt with a dead key, Meta+`[` not counted as AltGr.
  - The Meta label for macOS, MacIntel, iPad, iPhone, Windows, Win32, Linux, Chrome OS and an empty platform; the label in combos and in reserved-key messages.
- `npm run build`: passes.
- **Affected e2e via the new `npm run test:e2e`** (preview, `--retries=0`, 1 worker): **88/88** (2.1 min), after one fix:
  - The first run failed 1/88: "a loop nudge key with the loop off turns it on". The loop button reads on while a nudge is waiting, but clicking it then turned on the old range and dropped the nudge.
  - **Fix:** a click while a nudge waits turns the loop off and keeps the nudged range for the next click (`toggleLoop` in `PlayerView.vue`).
  - **Test:** now on the fake clock, checking the timeline (which shows only the applied loop) before and after the 400 ms. It also covers a click during the wait.
  - Specs: listKeys, shortcuts, shortcutsLayout, library, picker, bookmarks, player, loopJump.
  - New assertions: the library's filter empty state; the upload-delete confirm in the viewport when it opens.

### Known issues and open questions

None new.

### Manual review checklist

- [ ] German layout: AltGr+8 / AltGr+9 (`[` `]`) switch tabs.
- [ ] Library: Uploaded + a tag shows the new empty text.
- [ ] Settings → Shortcuts on Windows: a Win-key combo reads "Win+…".
- [ ] Library details: "Delete upload…" on a song low in the panel scrolls the confirm into view.
- [ ] `npm run test:e2e` builds and runs on the preview; `npm run test:e2e:dev` uses your dev server.
