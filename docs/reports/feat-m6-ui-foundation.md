# Review report — `feat/m6-ui-foundation` (Milestone 6: UI foundation)

Plan: `docs/milestones/m6.md`, approved with these choices and additions:

- **Choices:**
  - tempo, loop and pre-roll in popovers;
  - keyboard lengths shown in mm;
  - a light code split.
- **Additions:**
  - shortcuts ignored while typing;
  - pre-roll in the loop popover;
  - a synchronous Dexie upgrade that tolerates unreadable uploads;
  - brief decision 61 limits bookmark overrides;
  - a single Undo toast.

Nothing is committed yet. This report goes in with the work.

---

## 2026-11-17 — Round 1: milestone 6 built

### What was done

| Area              | Files                                                                                                                                                                                                                                                                | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs              | `docs/brief.md`, `docs/roadmap.md`, `docs/CREDITS.md`                                                                                                                                                                                                                | **Brief:** decisions **50–63**; decision 25 now points to the Quiet HUD (60); milestone 6 line updated. **Roadmap:** milestone 5 ✅, milestone 6 in progress with the two-homes wording; milestone 7 gains the bookmark manager page, picker stats and sorting, and "Full song" as a bookmark. **Credits:** Inter Tight (OFL) and Reka UI.                                                                                                                |
| Dependency        | `package.json`                                                                                                                                                                                                                                                       | `reka-ui` 2.11.0 (approved). Nothing else added.                                                                                                                                                                                                                                                                                                                                                                                                          |
| Font              | `src/ui/theme/fonts/`, `fonts.css`                                                                                                                                                                                                                                   | Inter Tight 300/400/500/600 as woff2 (latin + latin-ext), self-hosted, with the OFL text. No runtime font requests.                                                                                                                                                                                                                                                                                                                                       |
| Tokens            | `src/ui/theme/tokens.css`, `base.css`, `applyTheme.ts`                                                                                                                                                                                                               | **Tokens:** colours and text levels, primary/secondary with translucent variants, type scale, spacing, radii 10/12/22, shadows, durations/easings. **Runtime:** `applyTheme()` writes them from the Appearance settings. **Glass:** a `.glass` class, more opaque at blur 0 or where `backdrop-filter` is unsupported. **Motion:** enter/leave animations whose movement is scaled by `--move`; under reduced motion they are fades only.                 |
| Settings registry | `src/core/settings/SETTINGS_REGISTRY.ts`, `SettingDefinition.ts`, `SettingKey.ts`, `SettingValue.ts`, `SettingHome.ts`, `SETTINGS_LAYOUT.ts`, `SettingGroup.ts`, `settingGroups.ts`, `settingValues.ts`, `settingMax.ts`, `formatSettingValue.ts`, `SETTING_KEYS.ts` | **Registry:** one entry per setting, holding label, default, limits, unit and home. A mapped type makes the compiler require exactly one entry of the right value type per setting. **Derived from it:** `DEFAULT_SETTINGS`, stored-value validation, reset groups (section / tab / sidebar) and the UI. **Removed:** `SETTING_RANGES` and `SETTING_CHOICES`.                                                                                             |
| Settings v3       | `PlayerSettings.ts`, `loadSettings.ts`                                                                                                                                                                                                                               | **New sections:** `audio`, `practice` and `appearance`. **Migration:** v1 → v2 → v3 keeps every value.                                                                                                                                                                                                                                                                                                                                                    |
| Tempo range       | `core/timing/tempoRange.ts`, `core/library/formatTempoRange.ts`, `computeSongFacts.ts`, `SongFacts.ts`, `public/songs/manifest.json`                                                                                                                                 | Facts gain `bpmMin`/`bpmMax` (up to the song's end), and the manifest is regenerated. Display: "120–126 bpm", or one value when the tempo is constant.                                                                                                                                                                                                                                                                                                    |
| Sync parse        | `core/song/parseMidi.ts`, `ParsedMidi.ts`, `importMidi.ts`                                                                                                                                                                                                           | Parsing split from hashing (`importMidi` = `parseMidi` + id), so the database upgrade can parse synchronously.                                                                                                                                                                                                                                                                                                                                            |
| Database v2       | `src/data/PianoMeisterDb.ts`, `refreshUploadFacts.ts`                                                                                                                                                                                                                | Synchronous upgrade that recomputes the facts of stored uploads. A file that fails to parse is logged, keeps its old facts, and the upgrade carries on (decision 56 then shows its start tempo).                                                                                                                                                                                                                                                          |
| Core helpers      | `core/library/composerSuggestions.ts`, `core/color/textColorOn.ts`, `THEME_PRESETS.ts`, `sortEntries.ts`                                                                                                                                                             | **Composers:** suggestions and the all-composers list with counts. **Contrast:** dark or light text on primary, by WCAG contrast ratio. **Presets:** the five theme presets. **Sorting:** a `bars` sort field.                                                                                                                                                                                                                                            |
| Components        | `src/ui/components/`                                                                                                                                                                                                                                                 | `GlassPanel`, `IconButton`, `AppButton`, `SegmentedControl`, `SliderField`, `ToggleField`, `SelectField`, `ComboboxField`, `ColorField`, `ResetButton`, `SettingRow`, `SettingsSection`, `AppAccordion`, `TabbedWindow`, `AppDialog`, `ToastHost`, `RangeBar`, `SortableHeader`, plus `AppPopover` and `AppIcon` (our own 24 px line icons).                                                                                                              |
| Stores            | `settingsStore.ts`, `toastStore.ts`, `uiStateStore.ts`                                                                                                                                                                                                               | **Settings store:** `get` / `set` / `isDefault` / `reset` / `resetGroup` / `restore` / `changedCount`. Settings are now immutable plain data (shallow ref), so the engine gets them without proxies. **Toasts:** one Undo toast at a time. **UI state:** the sidebar's open state and expanded sections (`pianomeister.ui`).                                                                                                                              |
| Player            | `views/PlayerView.vue`, `ui/player/*`, `engine/Engine.ts`                                                                                                                                                                                                            | **Quiet HUD:** title and composer; bar:beat with "bar N of M · time / length"; large bpm with "% of base". **Toolbar:** picker, previous bar, play/pause, next bar, loop + options, playfield panel. **Timeline:** loop region and a draggable, keyboard-operable playhead. **Placement:** `engine.nowLineScreenY()` keeps the controls above the now line. **Shortcuts:** Space, ←/→, Home, O, P. **Audio:** the Audio settings now reach the scheduler. |
| Sidebar           | `ui/player/PlayfieldSidebar.vue`, `RenderReadout.vue`                                                                                                                                                                                                                | 360 px glass panel beside the highway, which resizes. Accordion: Camera, Keyboard, Highway (+ Colors), Notes, Effects, Render quality. "All settings…" and "Reset all playfield settings".                                                                                                                                                                                                                                                                |
| Settings window   | `ui/settings/*`                                                                                                                                                                                                                                                      | Tabs: Practice, Audio, Appearance, Library & data, About. Footer: "N settings changed from default" and "Reset all ⟨tab⟩ settings". The nav footer links to the playfield panel.                                                                                                                                                                                                                                                                          |
| Picker            | `ui/picker/SongPicker.vue`                                                                                                                                                                                                                                           | Search; song list with sortable Title/Composer and a "—" bookmark column; details (length, bars, meter, tempo range) with an empty stats slot; "Full song" with a range bar. Footer: Library…, Cancel, Load full song.                                                                                                                                                                                                                                    |
| Library           | `views/LibraryView.vue`, `components/SongDetailsPanel.vue`, `MeterOverrideEditor.vue`, `TagEditor.vue`, `ui/library/useLibraryBackup.ts`, `ui/format/*`                                                                                                              | **Page:** full-screen glass page; header with tab bar (Library only), search, Upload MIDI / Export / Import. **Filters:** source with counts, tag chips, Group by, Sort by, storage status. **Table:** Title (with "uploaded" subtitle), Composer, Length, Bars, all sortable. **Drop zone. Details panel:** composer combo box; hand selects; meter override behind "Override meter…".                                                                   |
| Bundle            | `vite.config.ts`, `engine/RenderPipeline.ts`                                                                                                                                                                                                                         | **Lazy:** settings window, picker and library load on first use; FXAA/SMAA load on demand. **Vendor chunks:** `three` and `vue`. **Dev:** lazily used dependencies are pre-bundled.                                                                                                                                                                                                                                                                       |
| Removed           | `SettingsPanel.vue`, `SettingSlider.vue`, `SETTING_RANGES.ts`, `SETTING_CHOICES.ts`                                                                                                                                                                                  | Replaced by the above.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Tests             | specs next to the code; `e2e/support.ts`, `player.spec.ts`, `settings.spec.ts` (new), `picker.spec.ts` (new), `library.spec.ts`, `smoke.spec.ts`, `visual-review.spec.ts`, `perf.spec.ts`                                                                            | See below.                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### Decisions I made that weren't in the instructions

1. **Component names.** Vue's lint rule forbids single-word component names, so `Button`, `Dialog`, `Toast` and `Accordion` became `AppButton`, `AppDialog`, `ToastHost` and `AppAccordion`. I also added `AppPopover` and `AppIcon`, which the popovers and toolbar needed.
2. **Composer field.** It uses Reka's **Autocomplete**, built for free typing with suggestions, rather than Combobox, which selects from a list. Behaviour:
   - the list button shows everyone with song counts under "All composers";
   - typing filters case-insensitively;
   - "Add ‘…’ as a new composer" appears when nothing matches exactly;
   - the value commits on choosing, Enter or leaving the field.
3. **Choices render by option count.** Choices render as segmented buttons; Output (one option until milestone 11) is a select. Anti-aliasing (Off / MSAA / FXAA / SMAA) became segmented as well; it fits the sidebar.
4. **Sidebar placement.** The key colour fade-in and "key colour before the note" settings sit in **Notes**, not Keyboard, so "Reset keyboard to grand piano" only touches dimensions. Scene colours and line opacities sit in **Highway** under a "Colors" heading.
5. **"Is default" uses half a slider step.** Defaults like 12/23.5 aren't on the slider grid, so dragging back to "12 mm" must count as default.
6. **Loop defaults.** The loop button turns on the last loop set (bars 1–4 before any); loading a different song clears the loop. Tempo % remains session state, as before: it isn't a setting, so "Reset to 100%" sits in the tempo popover.
7. **Timeline.** It seeks on release, to the start of the bar under the pointer, so seeking stays in bars. ←/→/Home/End work on the focused timeline.
8. **Picker keys.** In the song list ↑/↓ move; ←/→ switch between the lists; Enter (also from the search field) and double-click load.
9. **Glass fallback.** At blur 0, or without `backdrop-filter` support, panels use at least 90% opacity.
10. **Library rows.** Tags no longer show in the rows (m6), and the old start-tempo BPM column is gone. The tempo range shows in the picker and details panel.
11. **Dialogs close on any unhandled Esc from inside.** Reka only reacted when the dialog was its top layer, and tooltips opened by keyboard focus inside the window could leave it thinking it wasn't, so Esc did nothing. Popups (select lists, combo boxes) render outside the dialog and handle their own Esc.
12. **Toasts accept clicks over modal dialogs.** A modal dialog switches off pointer events outside itself. Without this fix, "Undo" after a tab reset couldn't be clicked.
13. **Chunk warning limit.** It is **560 kB**, just above three.js (538 kB). Every other chunk is far smaller (below).

### Deviations from the mockups (`docs/design/m6/`)

- **Player:**
  - The HUD shows "bar 18 of 64 · 0:24 / 1:31" (m6 text); the mockup reads "bar of 64".
  - No bookmark name after the composer until milestone 7.
  - The toolbar's loop button has a small caret for the loop popover (tempo, loop and pre-roll had to go somewhere).
- **Audio tab:**
  - Defaults stay as in the brief and code: metronome **Off**, metronome volume **60%**. The mockup shows "Pre-roll only" and 70%.
  - The On/Mute/Solo rows carry a label ("Right hand sound") for screen readers and the reset tooltip.
- **Sidebar:**
  - Every physical length is in mm ("Key thickness 14 mm", "Gap 1.4 mm", "White key depth 5.2 mm"). The mockup mixed raw units with mm.
  - Edge profile has a "Key edges" label.
- **Range bars** use the **secondary** colour, per m6 decision 3 ("bar-range indicators"). The mockup draws them blue.
- **Picker:**
  - No Plays/Time/Last columns and no stats.
  - The right column has "Full song" only (milestone 7).
  - Sort headers are Title and Composer.
- **Library:**
  - The page sits on a static scene-coloured backdrop, not the live highway, because leaving the player unmounts the engine and pauses (brief 38).
  - No Plays/Last columns and no Bookmarks tab or button (milestone 7).
  - Subtitles say "uploaded" for uploads; there is no bookmark count yet.
  - A "Sort by" select keeps milestone 4's date-added and source sorting.

### Deferred to milestone 7

- Bookmarks: Bookmarks tab, picker right-column entries, bookmark name in the HUD, bookmark counts.
- Plays / practice time / last played (picker columns and stats slot, library columns).
- Profiles tab; overrides of mute/solo, pre-roll and tempo by bookmarks (decision 61).
- General, MIDI and Shortcuts tabs stay hidden until they have content.

### Test and check results

- **`npm run check`:** type-check, lint (no warnings) and **312 unit tests** pass, up from 271. New unit coverage:
  - the registry: valid defaults within limits, every key homed, groups partition the settings;
  - reset / reset group / restore with dependent keyboard values;
  - the half-step `isDefault`;
  - v1 and v2 → v3 migration and validation of the new sections;
  - mm formatting and `settingMax`;
  - tempo range: constant, changing, a single event after tick 0, no events, events at the end;
  - composer suggestions;
  - text contrast on every preset;
  - `bars` sort;
  - the Dexie v1 → v2 upgrade, including a corrupt upload;
  - Undo toast replacement;
  - `isTypingTarget`;
  - the audio-settings mapping.
- **`npm run build`:** passes with **no chunk warning**.
- **`npm run test:e2e`: 30/30** on the dev server and **30/30** on the `CI=1` production preview. New and updated cases:
  - **Settings and reset:**
    - reset icon lights up and restores the default;
    - section reset + Undo, and a newer reset replacing the Undo;
    - tab reset + Undo with the changed count;
    - visual/render settings persist, every AA mode renders;
    - v1 migration;
    - keyboard limits.
  - **Theme:** preset and custom primary persist, dark primary → light button text.
  - **Picker:** button and `O`; arrows + Enter; typing "op" in search opens and closes nothing; Esc returns focus; Library….
  - **Sidebar:** `P`, live change, canvas narrows, open state persists.
  - **Dialogs:** Esc closes, focus trapped and returned.
  - **Tempo and loop popovers**, with pre-roll and its reset icon.
  - **Timeline** seek.
  - **Reduced motion** → fade-only animation.
  - **Blur 0** → opaque panel.
  - No console errors throughout.
- **`npm run test:visual`:** **60/60** (36 kept from earlier milestones plus 24 new m6 shots), run on the production preview. I reviewed the m6 shots against the mockups (see deviations).
- **`npm run test:perf`** (Canon, 20 s, headed Chromium, same machine as m5), average engine CPU time per frame and frame interval:

  | Run                                          | CPU per frame | Frame interval |
  | -------------------------------------------- | ------------- | -------------- |
  | Defaults                                     | 0.29 ms       | 9.7 ms         |
  | Playfield sidebar open (canvas 1240 px wide) | 0.51 ms       | 9.8 ms         |
  | Highest (3200×1800, SMAA)                    | 0.57 ms       | 9.8 ms         |

  The frame interval is the display's: a blank page in the same browser measured 10.6 ms (~94 Hz) today, against 120 Hz in m5, so the monitor or refresh setting differs from the m5 run. The sidebar costs no frame rate.

- **Bundle** (minified / gzip):

  | Chunk                            | m5        | Now             |
  | -------------------------------- | --------- | --------------- |
  | Main                             | 964 kB    | 130 kB / 43 kB  |
  | `three`                          | (in main) | 538 kB / 133 kB |
  | `vue` (Vue, router, Pinia, Reka) | (in main) | 302 kB / 96 kB  |
  | Library code (`libraryStore`)    | —         | 150 kB / 48 kB  |
  | Settings window                  | —         | 9 kB, lazy      |
  | Picker                           | —         | 6.5 kB, lazy    |
  | Library page                     | —         | 24 kB, lazy     |
  | SMAA                             | (in main) | 61 kB, lazy     |
  | FXAA                             | (in main) | 6 kB, lazy      |

### Screenshots (`test-results/visual/`, not committed)

- `m6-player-{1280x720,1024x768}-{glacier,ember}.png`
- `m6-player-sidebar-…` (Keyboard section open)
- `m6-settings-audio-…` (left hand at 60%, so one reset icon and the tab dot are lit)
- `m6-settings-appearance-…`
- `m6-picker-…`
- `m6-library-…` (Minuet selected, composer list open)
- The milestone 3–5 shots are unchanged in content; the HUD in them is now the Quiet HUD.

### Known issues and open questions

1. **Bundled tempo ranges.** Canon in D shows **50–100 bpm**: the file slows to 50 for its last notes. That is what decision 56 asks for (min–max over the tempo map), but a final ritardando dominates the range. Should the range ignore the last bar, or stay literal?
2. **Tab order** in a slider row is reset button → slider (the reset sits next to the value above the slider, as in the mockup). Swap it?
3. **Dev-server note.** A dev server was already running on port 5173 (started 09:31, before this work), so the dev-mode e2e runs used it. My `vite.config.ts` changes made it re-optimize dependencies mid-run once, which caused two dynamic imports to fail; after that the suite was green. If you see "Failed to fetch dynamically imported module" in dev, restart that server. The production preview is unaffected.
4. **Library at 1024 px** with the details panel open: the table gets narrow and long composer names wrap to two lines. It's readable, but tighter than the mockup.
5. **The Output select has one option** ("Built-in grand piano") until MIDI out in milestone 11.
6. **Not tested** on Safari or an iPad: only the 1024×768 viewport in Chromium.

### Manual review checklist

- [ ] **Player:**
  - [ ] the HUD reads well over the highway;
  - [ ] the controls never cover the now line at tilt 20° and 85°, or with the sidebar open;
  - [ ] play/pause, bars, Home, O and P work;
  - [ ] the timeline drags and seeks to bar starts.
- [ ] **Tempo popover** (click the bpm): the slider changes the bpm readout; "Reset to 100%".
- [ ] **Loop popover** (caret next to loop): set bars 17–32, toggle with the loop button, pre-roll beats with its reset icon, Back to start.
- [ ] **Sidebar:**
  - [ ] it opens beside the highway, with no overlap;
  - [ ] changes apply live;
  - [ ] section dots appear;
  - [ ] "Reset keyboard to grand piano" offers Undo;
  - [ ] it stays open across a reload.
- [ ] **Settings window:**
  - [ ] tabs, changed dots and the changed count;
  - [ ] "Reset all Audio settings" with Undo;
  - [ ] Esc closes and focus comes back;
  - [ ] "Open playfield panel" works.
- [ ] **Appearance:**
  - [ ] each preset recolours buttons, sliders, focus rings and range bars, not the notes;
  - [ ] a custom dark primary gets white button text;
  - [ ] blur 0 still reads well;
  - [ ] the Motion setting turns slides into fades.
- [ ] **Picker:** search, sort, arrows and Enter, "Load full song", Library….
- [ ] **Library:**
  - [ ] upload / drop, export / import;
  - [ ] composer combo box (list all, add new);
  - [ ] hands, swap and restore;
  - [ ] Override meter…;
  - [ ] delete an upload;
  - [ ] Play.
- [ ] **Audio:** volumes and On/Mute/Solo from the Audio tab are heard during playback.
- [ ] **An iPad if available:** sidebar width, picker and library at 1024×768.

---

## 2026-11-17 — Round 2: review rounds 1 + 2

Your 18 points, built against the HTML sources in `docs/design/m6/source/`: sizes, spacing, font sizes, colours and grid columns come from them. Nothing is committed yet.

### What was done

| #     | Point                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Tempo range             | `core/timing/tempoRange.ts` now takes the 5th–95th percentile of the tempo, weighted by **seconds** played (it now needs `ppq`). `computeSongFacts`, the manifest script and the Dexie v2 upgrade (`refreshUploadFacts`) all call it. I regenerated the manifest: **Canon in D is now 100 bpm**. Decision 56 is updated.                                                                                                                                                          |
| 2     | Tab order               | Unchanged, as you said.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 3     | Long text               | Titles and composers truncate with an ellipsis and carry a `title` tooltip. This covers picker and library rows, the HUD title and composer, and the composer list. Rows stay on one line at 1024 px.                                                                                                                                                                                                                                                                             |
| 4     | Scrollbars              | In `base.css`: a thin themed `::-webkit-scrollbar` (10 px, rounded thumb, no buttons) for Chromium and Safari. `scrollbar-width: thin` and `scrollbar-color` apply only where `::-webkit-scrollbar` isn't supported, because Chrome on Windows keeps its arrow buttons with the standard properties.                                                                                                                                                                              |
| 5     | Reference scale         | The type tokens use the sources' px scale: body 14 px; 11/12/13/14/15/17/20/22; hero 44.<br>• Picker: 1180×640, columns 440 / flex / 380.<br>• Library: inset 16 px, filters 190 px, details 340 px.<br>• Settings window: 980×620, nav 220 px.<br>• Rows: 10–12 px padding; titles 14/500, subtitles 12, caps labels 12.<br>• Glass: `rgb(18 24 44)` with `saturate(1.4)`; dividers 8% and 6% white; field borders 14%.                                                          |
| 6     | Columns and headers     | Reference grids:<br>• Picker `minmax(0,1fr) 36px 50px 56px`: bookmarks, Bars, Length.<br>• Library `minmax(0,2.2fr) minmax(0,1.6fr) 64px 56px 80px`: Title, Composer, Length, Bars, **Added**.<br>Headers use the same grid and are the sort controls. Numeric headers sit flush right above their values. The library "Sort by" select is gone; Added sorts newest first.                                                                                                        |
| 7     | One song row            | `ui/components/SongRow.vue` is used by both. There's no "uploaded" subtitle; the source shows in the filter counts and at the top of the details panel (`details-source`).                                                                                                                                                                                                                                                                                                        |
| 8     | Same surface + backdrop | The library uses the picker's glass tokens. Leaving the player calls `engine.captureFrame()`, which renders one frame and copies it, in the same task, to a JPEG at most 960 px wide stored in `ui/playback/sceneSnapshot`. The library shows it blurred (12 px) under a 72% scrim, or the static gradient when there's no frame.                                                                                                                                                 |
| 9     | Details always visible  | The first row is selected on load. If the selected song is filtered out or deleted, the selection moves to the first visible row. ↑/↓ in the list move it. There's no close button.                                                                                                                                                                                                                                                                                               |
| 10    | Search fields           | A shared `SearchField.vue`: 40 px tall, no border at rest, and a 1 px primary ring on focus (`--focus-ring-field`). Text inputs, the combo box and selects show a 1 px primary border on focus.                                                                                                                                                                                                                                                                                   |
| 11    | Picker middle column    | Under the facts: Right hand and Left hand note counts, and the pitch range. They come from `core/hands/summariseHandNotes.ts`, using the song's channels and stored hand assignment; hidden channels don't count.                                                                                                                                                                                                                                                                 |
| 12    | Meter                   | `core/timing/summariseMeter.ts` returns the meter covering the most bars (the earlier one on a tie) and every run. `MeterReadout.vue` shows "3/4", or "4/4 · 2 changes", where "2 changes" opens a scrollable popover of "bar X · meter". It's used in the picker and in the details panel ("3/4 from file · bar 1 at tick 0").                                                                                                                                                   |
| 13–14 | HUD text                | Top left: title, composer, "bar **18:1** beat" (44 px light numerals with small lowercase labels on the baseline), beat dots, then "bar 18 of 64".<br>Top right: "**126** bpm", "100% of 126 bpm", then "0:24 / 1:31".                                                                                                                                                                                                                                                            |
| 15    | HUD polish              | • `BeatDots.vue`: the current beat in primary with a glow; the downbeat brighter.<br>• Radial dark gradients behind the top corners replace the text shadows.<br>• A frosted pill behind the toolbar, opaque at blur 0.<br>• Timeline: progress in primary, bar ticks (every bar, or every 2nd, 4th… bar so at most 64 show), loop region tinted secondary, and a white playhead with a primary glow.<br>• Movement still scales with `--move`.                                   |
| 16    | Auto-hide               | `ui/player/useIdleHide.ts`. While playing, the toolbar and timeline fade out (opacity only, no movement) after the idle time, and the cursor hides with them. Pointer move or press, a key, touch or the wheel brings them back. They never hide while paused, with a popover or dialog open, or with the pointer over them.<br>New setting **Appearance → Player controls → Hide controls when idle**: Off / 2 s / 3 s (default) / 5 s / 10 s, with its reset icon. Decision 64. |
| 17    | Loop range              | Every change goes through `core/practice/adjustLoopRange.ts`: it clamps to 1–N and whole bars, and the moved end pushes the other (start = end is allowed).<br>`RangeSliderField.vue` (two Reka thumbs) sits above the From/To fields; the fields commit on Enter or blur.<br>While the loop is on, changes apply at once. Otherwise they become the range the loop button turns on ("Loop these bars").                                                                          |
| 18    | Inverted pre-roll       | `SettingRow` gained `inverted`, `value-text` and `end-label`. In the loop popover, pre-roll fills right to left into a secondary marker labelled "bar 17" and reads "4 beats before bar 17" (0 reads "None · starts at bar 17").                                                                                                                                                                                                                                                  |

**Also:**

- `formatAddedAt` (core, with tests) for the Added column: "Today", "Yesterday", "3 days", "10 Nov", "2 Jan 2025"; bundled songs show "—".
- Hand selects are a compact 34 px, labelled "Channel 0 · 258 notes", with the pitch range in the tooltip.
- Tag chips, the combo box, buttons, segmented controls and selects are resized to the sources.
- In segmented and select rows, the control and its reset icon now wrap together.
- `-webkit-backdrop-filter` is added for Safari and iPad.

### Decisions I made that weren't in the instructions

- **Picker numeric columns in m6.** The reference's Plays, Time and Last columns have no data until milestone 7.
  - The 50 and 56 px columns show **Bars** and **Length**, sortable, largest first.
  - The 36 px column keeps the bookmark icon, with "—" in each row.
  - The 74 px Last column is left out.
  - The title cell's header is "Title · Composer" (both sortable) instead of the "SONGS" caption.
- **The Added column is 80 px.** The reference's last two columns are 64 and 60 px, but "Yesterday" needs about 62 px at 14 px.
- **Range-slider keys are handled by us, not Reka.** Reka sends Home to the first thumb and End to the last, whichever has focus, and when one thumb steps past the other it re-sorts them and moves focus.
  - Our handling always moves the focused thumb and pushes the other.
  - Pointer drags are still Reka's: a thumb dragged into the other stops there, and the other thumb then follows the pointer, so they never cross.
- **The loop fields re-select their text after a commit changes them.** Without this, pressing Tab from From to To selected the old To text, the commit then replaced that text and lost the selection, and typing "32" gave "1732", clamped to 64. I found this while checking the screenshot; e2e covers it.
- **Library below 1100 px:** the table columns narrow to `1.6fr 1.2fr 52px 40px 72px`, and the 190 and 340 px side columns keep their widths.
- **Picker below 1220 px:** the side columns narrow to 400 and 260 px, so the middle column keeps about 330 px at 1024.
- **Brief:** decisions 56, 57 and 60 are updated, and decision **64** (idle controls) is added.

### Deviations from the sources

- Library rows have no subtitle until the milestone 7 bookmark count, as you asked, so they are a little shorter than the reference rows.
- Below the hand counts, the picker's middle column stays empty until the milestone 7 stats.

### Test and check results

- **`npm run check`:** type-check, lint (no warnings) and **334 unit tests** pass, up from 312. New unit tests:
  - time-weighted tempo percentiles: a closing ritardando under 5%, a short fast pickup, a slowdown over 5% kept, seconds-not-ticks weighting, plus the Canon fixture;
  - `summariseMeter`;
  - `summariseHandNotes`;
  - `adjustLoopRange`;
  - `formatAddedAt`;
  - the new setting's default.
- **`npm run build`:** passes with no chunk warning. Main 137 kB, `three` 538 kB, `vue` 302 kB; picker 8 kB, settings 9 kB and library 25 kB, all lazy.
- **`npm run test:e2e`: 34/34** on the dev server, and **34/34** on the `CI=1` production preview. New and updated tests:
  - **Idle controls:**
    - never hidden while paused, or with the pointer over the toolbar;
    - fade after 2 s idle;
    - pointer and key presses bring them back;
    - a popover keeps them visible;
    - the setting's reset icon lights when changed.
  - **Loop range:**
    - typed start past the end pulls the end along;
    - the thumbs move the fields;
    - End on the start thumb puts both at the last bar;
    - an end typed before the start pulls the start back;
    - the focused thumb pushes the other;
    - values are clamped;
    - inverted pre-roll text;
    - changes apply live while the loop is on;
    - Tab-and-type into "To".
  - **HUD:** beat dots, "126 bpm", "100% of 126 bpm", the time line.
  - **Library:**
    - first row selected and details shown;
    - ↓ moves the selection;
    - the Added column and sorting by it;
    - the selection follows filtering;
    - source shown in the details instead of the row;
    - static backdrop when opened directly.
  - **Picker:** Canon shows "100 bpm"; the snapshot backdrop appears after going to the library from the player.
- **`npm run test:visual`** (production preview, `CI=1`): no complete run this round: the clean full run was stopped when round 3 arrived (round 3 has the final run). There's one new shot per size and theme: `m6-loop-popover-…`.
  - The first full run passed 56/64. The other 8 were 1024×768 m6 shots that hit the 30 s test timeout: headless Chromium renders WebGL in software, and with the sidebar or a dialog's glass over the canvas a frame or screenshot takes several seconds.
  - Removing the toolbar's blur didn't fix it (I tried that A/B), so the visual project now has a 90 s timeout (`playwright.config.ts`), and that group then passed 14/14.
  - On a real GPU the same shots take 2 min for all 64.
- **`npm run test:perf`** (headed, real GPU):

  | Variant                | CPU per frame | Frame interval |
  | ---------------------- | ------------- | -------------- |
  | Defaults               | 0.29 ms       | 8.5 ms         |
  | Playfield sidebar open | 0.39 ms       | 8.3 ms         |
  | Highest                | 0.42 ms       | 8.3 ms         |

  The display ran at 120 Hz today, and the toolbar pill's blur costs no frame rate.

### Known issues and open questions

1. **Range-slider pointer drags** past the other thumb hand over to it (see the decisions above); the keyboard always pushes. Is that acceptable, or should a drag push the other thumb along too? That would need our own pointer handling instead of Reka's.
2. **Hand counts and meter changes in the picker** need the song parsed, so they appear a moment after a song is highlighted.
3. **Pre-roll without a loop** reads "before bar N" using the popover's range start, though without a loop, playback pre-rolls from wherever you press play.
4. **No bundled song changes meter,** so the "· N changes" popover is covered by unit tests (`summariseMeter`) but not shown in a screenshot.
5. **Still open from round 1:** the Output select has one option until milestone 11, and nothing is tested on Safari or an iPad yet.

### Manual review checklist

- [ ] **Picker:**
  - [ ] columns and headers line up;
  - [ ] sorting by Title, Composer, Bars and Length;
  - [ ] long names truncate and show a tooltip;
  - [ ] hand counts and the pitch range appear.
- [ ] **Library:**
  - [ ] the first song is selected on arrival, and the details never close;
  - [ ] the Added column and its sort; there's no Sort by select;
  - [ ] ↑/↓ in the list;
  - [ ] coming from the player, the backdrop is the blurred last frame.
- [ ] **Scrollbars:** thin and themed with no arrows, in the picker list, details panel, settings window and sidebar.
- [ ] **Search fields:** no ring at rest; a 1 px primary ring when focused.
- [ ] **HUD:**
  - [ ] "bar 18:1 beat", with the beat dots following the beat;
  - [ ] "126 bpm", then "100% of 126 bpm", then the time;
  - [ ] it reads well over bright notes;
  - [ ] the frosted toolbar pill.
- [ ] **Idle controls:**
  - [ ] playing, keep still for 3 s: they fade; move the pointer: they come back;
  - [ ] they never hide while paused, while hovering the toolbar, or with a popover open;
  - [ ] with the setting Off, they never hide.
- [ ] **Loop popover:**
  - [ ] drag both thumbs;
  - [ ] type in From and To, committing with Enter, Tab and blur;
  - [ ] try start after end, and values outside 1–N;
  - [ ] with the loop on, changes apply live;
  - [ ] the pre-roll slider fills right to left into "bar N".
- [ ] **Canon in D:** shows 100 bpm in the picker and in the library details.

---

## 2026-11-17 — Round 3: player layout on the sides

Reference: `docs/design/m6/source/QGHudSides.dc.html`, plus `docs/design/m6/8 · Player timeline on top (always visible)…@2x.png`. The `player-sides.png` named in your message isn't in the folder; that PNG matches your description. Nothing is committed yet.

### What was done

| #   | Point                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| —   | Keep the text styling | Text sizes, weights and colours are as in round 2 (title 17/500, composer 13, numbers 44 px / 300, labels 13). No backgrounds behind any HUD element: the corner gradients and the toolbar's frosted pill are removed. Text shadows and the glow on the big numbers come from the source: `0 1px 10px rgb(0 0 0 / 90%)` on HUD text, plus `0 0 22px` primary at 30% on the bar:beat and bpm numbers (tokens `--text-shadow-hud`, `--text-shadow-hud-number`; icons get a matching drop shadow). See open question 1.                                                                                                                                   |
| 1   | Timeline              | `PlayerTimeline` sits along the top edge (28 px side margins) and never hides.<br>• A 3 px line with bar ticks, cut as dark gaps as in the source.<br>• Progress is a gradient into primary.<br>• The playhead is 13 px white with a primary glow.<br>• The loop region is tinted secondary, with its first and last bar numbers below it in 10 px secondary (one number for a one-bar loop).                                                                                                                                                                                                                                                          |
| 2   | Left column           | Title, composer, the counter and "bar N of M"; then, 44 px lower, `HudMenuButton` ×4: Change song (O), Library (L), Playfield panel (P), Settings (,). They are grey and desaturated at rest; on hover or focus they turn white and show "Name Key" as plain text. Playfield is primary while the panel is open. New shortcuts: `L` opens the library and `,` the settings window. They're removed from the transport. New icons: `song`, `library`, `settings`, `tempo`.                                                                                                                                                                              |
| 3   | Right column          | The bpm readout is plain text now (not a button). "85% of 126 bpm" has the percentage in primary when it isn't 100%. The time is unchanged.<br>Below: prev / play / next with no background (hover only changes the colour).<br>Then two toggle rows:<br>• `LoopPopover`: "bars 17–32" in secondary, the loop-options caret, and the loop toggle (secondary + glow when on).<br>• `TempoPopover`: "85%" in primary, then the tempo icon (primary when ≠ 100%). It opens the tempo slider.<br>Off = a dim grey icon with no value text (`HudToggle.vue`). Both popovers open to the left, top-aligned with their row, so they don't cover the bpm text. |
| 4   | Auto-hide             | The app menu and the playback block (transport + toggles) fade. The timeline and all info text stay. They never hide while paused, with a popover or dialog open, while a playfield-panel control has focus, or with the pointer over the menu or the playback block.                                                                                                                                                                                                                                                                                                                                                                                  |
| 5   | Bar:beat counter      | `BarBeatCounter.vue`: bar and beat in fixed-width slots of `N ch` in the 44 px font with tabular digits. The bar slot is the digits of the song's highest bar, right-aligned; the beat slot is the digits of its largest beat count (from `summariseMeter`). A tight colon (1 px each side) and fixed 8 px gaps to "bar" and "beat". **E2e:** the colon's x position is identical at bars 1, 9, 10 and 57.                                                                                                                                                                                                                                             |
| 6   | Beat dots             | A vertical stack 14 px right of "beat", with beat 1 at the bottom, filling upward. The current beat is primary with a soft glow; beats already played in the bar are primary at 35%; the rest are dim. It resets on each downbeat. `core/timing/beatGroups.ts` (tested) splits long bars into columns: up to 5 beats in one column; 6/9/12 in groups of 3; others in 4s (7 = 4+3).                                                                                                                                                                                                                                                                     |

**Also:**

- `Engine.nowLineScreenY()` is removed: nothing sits over the highway any more, so the HUD no longer needs the now line's position.
- Brief decisions 60 (layout, menu, toggles, counter, dots, shortcuts) and 64 (what auto-hides) are rewritten.

### Decisions I made that weren't in the instructions

- **Focus inside the HUD controls doesn't stop them hiding.** I tried it, but a mouse click on Play leaves focus on Play, so the controls would never hide after clicking it. A key press brings them back anyway. Focus in the playfield panel does keep them visible, as you asked.
- **Beat grouping** starts at 6 beats (your 6/8 example), not above 6. A 5-beat bar stays one column (about 45 px, close to the numbers' height).
- **The loop row shows "bar 17"** for a one-bar loop, rather than "bars 17–17".
- **The library and settings menu items** use the test ids `menu-library` / `menu-settings`, because the picker's "Library…" already uses `open-library`.

### Test and check results

Round 3 code, run once before your round 3 review (I stopped the run when your review arrived, so it's incomplete):

- **`npm run check`:** pass, **338 unit tests**, lint clean.
- **`npm run build`:** pass, no chunk warning (main 140 kB).
- **`npm run test:e2e`:**
  - dev server **36/36**;
  - `CI=1` preview **33 passed, 2 failed, 1 flaky**:
    - the idle-controls test failed;
    - the bar:beat colon test timed out: stepping 57 bars by key, waiting each time, is too slow when headless Chromium renders WebGL in software;
    - the tab-reset settings test passed on retry.
- **`npm run test:visual`:** not completed; the run was stopped.

Round 4 fixes the colon test (it seeks by clicking the timeline) and has the complete runs.

### Known issues and open questions

1. **"Keep the text shadows and glow as they are now":** round 2 had actually replaced the text shadows with the corner gradients, so there were none to keep. I took both from the new source (values above). Sizes and weights stay as they are now (44 px / 300), not the source's 52 px / 200. Say if you want the source's heavier, larger numbers instead.
2. **Pre-roll bars:** during a pre-roll the bar number can be 0 or negative. "-1" is wider than a one-digit bar slot (songs under 10 bars) and spills left into the gap before "bar", but the colon still doesn't move.
3. **Sidebar open at 1024 px:** the stage is about 664 px wide, and the left column is limited to 45% of it, so long titles truncate sooner.
4. **Still open from earlier rounds:** range-slider pointer drags hand over to the other thumb (keyboard pushes); the Output select has one option; not tested on Safari or an iPad.

### Manual review checklist

- [ ] **Nothing covers the highway;** no pills or gradients behind the HUD; the text reads well over bright notes.
- [ ] **Timeline** at the top: drag and click seek; with a loop on, the region and its bar numbers show; it never fades.
- [ ] **Menu icons:**
  - [ ] dim at rest;
  - [ ] hovering or tabbing shows "Library L" and similar;
  - [ ] O, L, P and , work;
  - [ ] the playfield icon is lit while the panel is open.
- [ ] **Right column:**
  - [ ] the bpm isn't clickable;
  - [ ] the tempo icon opens the tempo popover; at 85% the "85%" and the icon turn primary;
  - [ ] the loop caret opens the loop popover; loop on shows "bars 17–32" in secondary.
- [ ] **Counter:** step through bars 9 → 10 and 99 → 100 (Canon has 102 bars); nothing shifts sideways. The beat dots fill upward and reset each bar.
- [ ] **Idle:**
  - [ ] playing and still: the menu and the playback block fade; the timeline and text stay;
  - [ ] never while paused, while hovering them, with a popover open, or while focus is in the playfield panel.

---

## 2026-11-17 — Round 4: round 3 review

Nothing is committed yet.

### What was done

| #   | Point                              | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Round 3 results                    | Filled in above with what that run showed. The complete runs for this round are below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1   | Text styling                       | Unchanged: 44 px / 300 numbers, with the source's text shadow and glow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2   | Pre-roll counter                   | New `Transport.activePreRoll` (the count-in window, only while inside it) and `core/transport/preRollBeat.ts` (which count-in beat is playing); both are tested. During a count-in the HUD shows the target bar and beat 1 (e.g. "17:1"), with the numbers and labels at 45% opacity. The beat dots count the pre-roll beats (8 beats = two columns of four), and normal display returns at the target bar's downbeat. Bar 0 and negative bars no longer appear; a real pickup bar 0 (a song starting before bar 1) still shows as bar 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3   | Range slider                       | `RangeSliderField` handles the pointer itself (capture-phase `pointerdown`, pointer capture, our own value mapping matching Reka's "contain" thumb inset). The thumb you grab stays the one you drag, and dragging it into the other pushes that one along (via `adjustLoopRange`), the same as the keys. Reka still draws the thumbs and provides their ARIA.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 4   | Stored facts                       | `SongFacts` gains `channels` (note count and min/max/average pitch per channel) and `meter` (the file's `MeterSummary`). `computeSongFacts` fills them, so the manifest (regenerated) and the Dexie v2 upgrade get them too.<br>`LibraryEntry` gains `hands`: the stored assignment, or `defaultHands(facts.channels)`. `Library.entries()` reads the hand-assignment table for this.<br>The picker no longer opens or parses the highlighted song: notes per hand, pitch range and meter changes show immediately and follow a changed hand assignment. With a meter override it shows the override's single meter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 5   | Pre-roll text                      | Without a loop: "4 beats before the play position", with the slider's end marker labelled "play position". With a loop: "4 beats before bar 17". At 0 beats: "None".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 6   | Meter-change fixture               | `scripts/make-meter-demo.mjs` writes `test-fixtures/midi/meter-demo.mid` (our own content, 14 bars): 4/4 ×2, 3/4 ×3, 6/8 ×3, 5/4 ×2, 4/4 ×4. It reads as "4/4 · 4 changes". New visual shot `m6-picker-meter-…` shows the picker on it with the meter popover open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 7   | Facts versioning (your bug report) | **Cause:** your IndexedDB had already run the v2 upgrade in an earlier round, before round 4 added the channel stats and meter to it. The upgrade never ran again, so those uploads (e.g. Autumn Leaves) had facts without the new fields and the picker showed "—".<br>**Fix:**<br>• `core/library/FACTS_VERSION.ts` (now 1); `computeSongFacts` stamps `factsVersion` on every facts object, uploads and manifest entries alike.<br>• `needsFactsRefresh` (core, tested): a missing or older version needs a refresh, unless recomputing already failed at this version.<br>• `data/refreshStaleFacts.ts`: on the first library load the store starts it in the background. One file at a time, it yields to the UI before each, parses → `computeSongFacts` → saves, and refreshes the entries so the picker and library update as each finishes.<br>• An unparseable file keeps its old facts. The failure is remembered in `appState` as `factsRefreshFailed:<sha256>` = the version, so it isn't retried until the next bump; deleting the upload removes the key.<br>• Dexie v2 is now `version(2).stores({})` only. `refreshUploadFacts.ts` is removed.<br>• `npm run songs:manifest:check` exits 1 and names each entry whose `factsVersion` is missing or old, or when the manifest is otherwise out of date. A new unit test fails the same way.<br>• `CLAUDE.md` has the rule: bump `FACTS_VERSION` whenever `SongFacts` gains a field. Brief decision 56 is updated. |

### Decisions I made that weren't in the instructions

- **Hand counts follow the stored hand assignment.** That's why the per-channel stats are stored rather than per-hand counts: a later hand change shows at once.
- **When a drag starts with both thumbs on one bar,** the side of the pointer decides which thumb you grab.
- **Grabbing a thumb focuses it,** so arrow keys continue from the same end.
- **The colon e2e test seeks by clicking the timeline** at each bar's middle (the Minuet's bars are all one length) instead of stepping with keys.

### Test and check results

- **`npm run check`:** type-check, lint (no warnings) and **348 unit tests** pass. New tests:
  - `preRollBeat`, `Transport.activePreRoll`;
  - `needsFactsRefresh`;
  - `refreshStaleFacts`:
    - missing and older versions refreshed, one at a time with a callback each;
    - a second pass does nothing;
    - a corrupt file keeps its facts, is remembered and isn't retried, but is retried after a version bump;
  - the v2 schema-only upgrade;
  - stored channel stats and meter in `computeSongFacts`, including the meter-demo fixture;
  - entry hands (stored, default from channels, missing);
  - manifest entries at the current `FACTS_VERSION`.
- **`npm run songs:manifest:check`:** up to date. I also checked its exit codes: with `factsVersion` set to 0 it exits 1 and names each entry; after regenerating it exits 0.
- **`npm run build`:** passes with no chunk warning. Main 141 kB, `three` 538 kB, `vue` 302 kB.
- **`npm run test:e2e`:**
  - dev server **40/40**;
  - `CI=1` preview **40/40**, with **1 flaky**: the idle-controls test failed once and passed on retry. It didn't fail again in 3 repeats alone or in a full player-spec run on the preview without retries (17/17), so it looks like a timing flake under the full suite's load in headless software rendering.
- **New e2e tests:**
  - count-in: target bar dimmed, 8 pre-roll dots, normal at the downbeat;
  - a pointer drag pushes the other thumb, and the grabbed thumb keeps focus;
  - "4 beats before the play position" without a loop;
  - picker stored facts and the meter popover: the meter-demo runs, and the Minuet's "258 notes" / "G2–B5" without opening the song;
  - old-shape facts refreshed in the background: an upload is rewritten in IndexedDB without `factsVersion`, channels and meter, the page reloads, and the picker shows note counts and "4/4 · 4 changes".
- **Bug found by the stored-facts test:** **Esc in a popover inside a dialog also closed the dialog.** Pressing Esc in the picker's meter popover closed the whole picker. `AppDialog` now leaves Esc to Reka while a popup (popover, select, combo list; not a tooltip) is open, and the test checks that the picker stays open.
- **`npm run test:visual`** (`CI=1` preview): **68/68**, in 11.9 min, with the 90 s timeout from round 2. New: `m6-picker-meter-…`, the picker on the meter demo with the popover open. I reviewed the m6 shots.
- **`npm run test:perf`** (headed, real GPU):

  | Variant      | CPU per frame | Frame interval |
  | ------------ | ------------- | -------------- |
  | Defaults     | 0.37 ms       | 8.4 ms         |
  | Sidebar open | 0.31 ms       | 8.3 ms         |
  | Highest      | 0.32 ms       | 8.3 ms         |

### Known issues and open questions

1. **Older uploads whose bytes no longer parse** keep their old facts (decision from round 1), so the picker shows "—" for their hand counts and the plain meter.
2. **The picker shows notes per hand only for channels assigned to a hand.** A channel set to Hidden doesn't count.
3. **In the picker's narrow Meter cell, "4/4 · 4 changes" wraps to two lines** (see `m6-picker-meter-…`). Making it one line would push into the Tempo cell.
4. **The idle-controls e2e test** was flaky once on the headless preview (see above).
5. **Still open from earlier rounds:** the Output select has one option until milestone 11; nothing is tested on Safari or an iPad.

### Manual review checklist

- [ ] **Count-in:**
  - [ ] set a loop at bar 17 with 4 pre-roll beats and press play: "17:1" shows dimmed while the dots count 1–4 upward;
  - [ ] at the downbeat it brightens and the dots switch to the bar's beats;
  - [ ] no 0 or negative bar ever appears.
- [ ] **Range slider:**
  - [ ] drag the start thumb into the end: the end is pushed;
  - [ ] drag back: the start follows the pointer and the end stays;
  - [ ] the same with the end thumb into the start.
- [ ] **Picker:**
  - [ ] hand counts, range and meter show instantly when moving through songs;
  - [ ] after uploading `test-fixtures/midi/meter-demo.mid`, it shows "4/4+" (see the Final round), and the popover lists bars 1, 3, 6, 9 and 11.
- [ ] **Pre-roll text:** without a loop, "4 beats before the play position"; with a loop, "… before bar N".

---

## 2026-11-17 — Final round

### What was done

| #   | Item                    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Meter "+"               | `MeterReadout.vue` shows the main meter followed by a small superscript "+" in the secondary colour when the meter changes ("4/4+"), on one line, with no "N changes" text. The "+" is a button named "4 meter changes". It opens the existing popover on mouse hover (250 ms), keyboard focus (`:focus-visible`) and click or tap, and closes on pointer leave (150 ms grace so you can move into the list), Esc, a tap elsewhere, or tabbing away. The details panel uses the same readout. Brief decision 57 is updated. The popover uses Reka's `PopoverAnchor`, not its trigger, so Reka's click-to-toggle doesn't fight the hover. Focus and presses on the "+" are excluded from Reka's outside-dismiss. Without that, focusing the "+" by keyboard closed the popover as it opened, and the next Esc closed the picker. |
| 2   | Deterministic idle test | The idle-controls test installs Playwright's fake clock before loading the page. The clock runs in real time, and the test jumps it 2.6 s past the 2 s delay with `page.clock.fastForward` instead of waiting. `idleFor` is removed from `e2e/support.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | Tests                   | `picker.spec`: "4/4+", the accessible name, hover open and leave close, click open, Esc keeping the picker, and Tab (keyboard focus) opening it with `aria-expanded="true"` and Esc again. The visual meter shot now expects "4/4+".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### Results

- `npm run check`: 348 unit tests pass. `npm run build` passes with no chunk warning.
- e2e on the dev server, no retries: **40/40**.
- Idle test on the `CI=1` preview, no retries, `--repeat-each=5`: **5/5**.
- Visual `m6-picker-meter-…` (4 shots): pass, reviewed.
- **e2e on the `CI=1` preview, no retries: 39/40. This is the blocker.** `settings.spec` › "tab reset applies at once, counts changes, and can be undone" timed out. Run alone with `--repeat-each=4` it timed out 3 times out of 4, and its passing runs took 29.9 s against the 30 s test timeout. It's slow, not wrong: every step passes, but with software WebGL rendering behind the dialog, 40 slider key presses plus the resets don't fit in 30 s. Earlier rounds didn't catch it because CI mode retries twice. My changes this round didn't touch it.

### Fix (your choice: b)

The tab-reset test now sets the left volume with `Home` and then six `PageUp` steps (10% each) instead of 40 arrow presses, and keeps the 30 s limit. On the `CI=1` preview with no retries it took 7.1–12.1 s over 4 repeats.

### Final results

- `npm run check`: 348 unit tests pass. `npm run build` passes with no chunk warning.
- e2e on the dev server, no retries: **40/40**.
- e2e on the `CI=1` preview, **no retries: 40/40** (4.5 min).
- Idle test on the preview, no retries, 5 repeats: 5/5.
- Visual: 68/68 in round 4. The `m6-picker-meter-…` shots, the only ones this round affects, re-ran 4/4 and were reviewed.
- Perf (round 4, unchanged code paths): 0.37/0.31/0.32 ms per frame at 120 Hz.

### Known issues

- The slowest test on the preview is now "keyboard limits: lowering the black keys clamps their press depth" at 27 s, close to the 30 s limit with software rendering. If it starts timing out, it can get the same treatment (fewer key presses).

### Left for milestone 7

- Bookmarks: the manager page, "Full song" tracked as a bookmark, per-bookmark overrides (decision 61: hand mute/solo, pre-roll and tempo).
- Picker stats and sorting: the reserved Plays/Time/Last columns and the empty stats slot.
- The library's Bookmarks tab and bookmark counts in song rows.
