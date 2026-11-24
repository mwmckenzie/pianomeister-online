# Milestone 10.6 plan: Note colour set editor

Spec: `docs/milestones/m10-6.md`. Mockup: `docs/design/m10-6/source/QGColourSets.dc.html`. Branch `feat/m10-6-colour-sets` from `main` (#29 merged).

**Status:** approved 2026-11-25, with the answers in §10 (they override §1–§9 where they differ).

## 1. The palette model today

`notePaletteColors(choice)` (`src/core/color/notePaletteColors.ts`) turns a look's settings into 12 colours by pitch class. The list order and names match the spec.

| Set                      | How it is built                                                                                | 12 fixed colours? |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ----------------- |
| Default                  | `PITCH_CLASS_COLORS`, 12 hexes                                                                 | yes               |
| Warm, Cool, Neon, Pastel | 7 naturals; each sharp is its natural × 0.66                                                   | yes, once built   |
| **Mono**                 | **one colour from the look** (`notes.paletteMono`, default `#8AB4FF`)                          | **no**            |
| **Two-tone**             | **two colours from the look** (`notes.paletteWhite` `#7EE0C3`, `notes.paletteBlack` `#C3A6FF`) | **no**            |

Five built-in looks use their own Mono or Two-tone colours: Blueprint (`#6FA8FF`), Mist (`#B8C7E0`), Hazard (`#FFC21A`), Aurora (`#7EE0C3` / `#B08CFF`), Synthwave (`#FF4FD8` / `#4FE3FF`). Saved looks can too. With 12 fixed colours per set, all of them would lose their own colours.

**Proposal (Q1):** Mono and Two-tone keep their look colours, and the sidebar keeps the one or two colour fields. Overrides are laid on top, per pitch class, in every look that uses the set. With no override, every picture is exactly as today, and nothing is migrated. In the editor:

- The base is the current look's colours if it uses that set, else the default ones.
- A line says "Unchanged notes take the look's colour".
- "Was #xxxxxx", reset, and "picking the original removes the override" compare with that base. Duplicate and "Save as new set…" store the 12 colours shown.

**Who reads the colours:** `Engine.applyNoteColors`, `PianoRollCanvas`, `OverviewMinimap` and `lookSwatch` (look dots in Playlists and Welcome). All four get the new resolver. The engine already recolours live when the 12 colours change, so editing needs only a small `engine.setColourSets(sets)`. Review hands doesn't use the note palette.

Colours are stored as upper-case `#RRGGBB`, as everywhere in the app; input is case-insensitive.

## 2. Where the settings live

- App settings are in localStorage (`pianomeister.settings`) as `{ version, settings, shortcuts, looks, deviceClass }`. They are **device-wide**, not per profile (brief decisions 6 and 23), Appearance included. Colour sets follow that.
- `noteColourSets` goes **beside** `settings`, as `shortcuts` does. The registry holds only numbers, switches, choices and colours; a sparse map and a list don't fit it.
- Stored data is validated on load: unknown built-ins, bad pitch classes, bad hexes and malformed or duplicate custom sets are dropped.
- Custom names: 1–60 characters, as for looks.

## 3. How looks store the set today

- A look has only `notes.palette` (the choice) and the three Mono and Two-tone colours. Saved looks are in Dexie (`looks`); look files, playlist files and backups all write them through `toLookFile`.
- **Two things would break a custom id:** `coerceSetting` turns an unlisted choice into Default (on settings load and look import), and the `NotePalette` type is closed.

**Change**

- `notes.palette` becomes a new setting kind that accepts a built-in id or `custom-…`.
- A second, hidden look key `notes.paletteSaved` holds `{ name, colours } | null`. It must be in the live settings too, not only in stored looks: the screen may be showing a missing set.
- Resolution is one pure function (`core/color`): built-in → base plus overrides; custom that exists → its colours; custom that is missing → the snapshot; no valid snapshot → Default.
- `captureLook` writes a fresh snapshot (Save, Save as new, Update playlist look, Copy, Export current). Look files, playlist files and backups also refresh it when written, so an export never carries old colours.
- "⟨Look⟩ · modified" ignores the snapshot, or editing a set would mark every look that uses it. The backup's identical-look check includes it.
- Across a playlist seam, the id and snapshot switch together at the midpoint, as the palette does today.
- Built-in looks need no snapshot: they use built-in sets, which always exist.

**Gap in the spec: deleting a set edited after the look was saved.** The look's snapshot would be older than what it was showing, so deleting would change its colours (criterion 3). So Delete first refreshes the snapshot in every saved look that uses the set, and in the settings on screen (under a listening overlay too), then removes the set.

**"Save as a set"** (Q4) recreates the set under the missing id, so every look that used it is connected again. If another saved look has the same missing id with different colours, only this look is moved, to a new id.

## 4. Versions

| What                                | Now       | New       | Why                                                          |
| ----------------------------------- | --------- | --------- | ------------------------------------------------------------ |
| Settings                            | 10        | 11        | `noteColourSets` and `notes.paletteSaved`; empty migration   |
| Look file                           | 10        | 11        | It uses the settings version; older apps say "newer version" |
| Backup                              | 1.5       | 1.6       | Colour sets; 1.0–1.5 still import                            |
| Playlist file                       | 1         | 1         | Only the looks in it change                                  |
| Dexie                               | 9         | 9         | Looks are stored as whole objects; no index changes          |
| `FACTS_VERSION`, `DETECTOR_VERSION` | unchanged | unchanged |                                                              |

**Backups don't contain app settings today** (only songs, practice data, looks and playlists), and import never overwrites. Colour sets would be the first settings in one. Proposal (Q3):

- **Custom sets:** same id and content → skipped; same id, other content → added under a new id, and the backup's looks follow it; taken name → "⟨name⟩ 2".
- **Overrides:** taken only for a built-in this device hasn't modified.
- Sets are merged before looks. The UI store passes them in; `Library` still never reads localStorage.

## 5. The Appearance page

**The mockup doesn't match today's window.** It shows four tabs on top and a nearly full-screen window. The app has vertical tabs in a 980 × 620 window, and Appearance is a scrolling list of sections. The mockup's columns need about 1140 px (250 + 588 + 300), without the vertical tabs.

**Proposal (Q2):** a "Note colours" section in Appearance with the sets' strips and **Edit colours…**. It opens the editor as a page inside the tab (with Back), and the window grows to at most 1280 × 720 while it is open. Where the columns don't fit (iPad), the preview goes under the editor; narrower still, the list becomes a select. The sidebar's "Edit colours…" opens this page with the set selected (`ui.settingsTabRequest` plus a set id).

**Parts**

- New components in `src/ui/colours/`: list, octave, selected colour, preview. The picker and hex field reuse `ColorField`, which already accepts both hex forms and reverts on anything else.
- **Octave:** a radio group with one tab stop; ←/→ move by semitone, Home and End go to C and B. Esc still closes the window.
- **Preview:** a 2D canvas, solid or gradient; other fills are drawn solid, because they are shaders. Still under reduced motion, stopped when hidden.
- **Sidebar select:** `notes.palette` gets its own row (the registry's options are fixed), with "Built-in", "Your sets" and "Saved in look" groups and the same reset button.
- Delete asks in the app's dialog. Renaming to a taken name is refused with a toast, as for looks.

## 6. Warning

OKLab and ΔE go to `core/color` with tests. Measured on the shipped colours (threshold 8):

| Set      | Closest neighbours         | Warns?              |
| -------- | -------------------------- | ------------------- |
| Default  | F and F♯ 12.0              | no                  |
| Warm     | **E and F 6.8**            | **yes, unmodified** |
| Cool     | E and F 8.7                | no                  |
| Neon     | B and C 9.0                | no                  |
| Pastel   | **B and C 7.5**            | **yes, unmodified** |
| Mono     | all equal                  | no                  |
| Two-tone | E and F, B and C are equal | no                  |

So Warm and Pastel show it as shipped (Q5).

## 7. Reset

Decision 51: section and tab resets apply at once with **Undo**, no confirm dialog. The spec asks for a confirm on the Appearance reset ("Reset all Appearance settings" in the app). See Q6. Either way the reset clears overrides and keeps custom sets, and modified built-ins count in "N settings changed" and the tab's dot.

**Brief updates:** decisions 23, 51 (if Q6 changes it), 75, 120, 121 and 122, the line "Only these 12 colors are used for notes", and a new decision 129.

## 8. Steps and tests

1. Core: sets, resolution, names, hex, ΔE and the warning, validation; unit tests.
2. Settings v11, the new setting kind, snapshots in looks and look files; unit tests.
3. Store, engine, overview, look dots, sidebar select with "Edit colours…". Pictures with no override must not change.
4. Editor page, preview, warning, resets, delete and "Save as a set".
5. Backup 1.6.
6. E2e `@colours` and the e2e map (`src/core/color`, `src/ui/colours`, plus the settings and looks rows), brief, CLAUDE.md tag, roadmap, report.

The spec's unit and e2e lists apply as written. Additions: delete after an edit; all 14 built-in looks keep their colours; a custom id survives a reload and a look import.

**Pixel check:** `@cages` reads a `?stats=1` hook for the computed cages, not pixels. I'll do the same for the engine's 12 colours, plus the piano roll screenshot comparison that `overview.spec.ts` already uses for Note colours. No pixel reading on the highway, unless you want it.

## 9. Questions

Each has a default that I'll build if you just say "go".

1. **Mono and Two-tone:** overrides on top of the look's colours (§1)? The alternative, 12 fixed colours, changes five built-in looks and needs a migration for saved ones.
2. **Page layout:** a page inside the Appearance tab, with the window growing (§5)? The alternative is the mockup's window, which redesigns all the settings tabs.
3. **Backup:** include custom sets and overrides with the rules in §4?
4. **"Save as a set":** reuse the missing id so all its looks reconnect (§3)?
5. **Warning on the shipped Warm and Pastel:** show it, as the spec says? Default: yes. The alternative is to show it only for modified or custom sets.
6. **Reset confirm:** default: keep decision 51 (no dialog; Undo brings the overrides back). The alternative is your confirm text, as an exception to decision 51.
7. **An edited built-in on another device:** a look using an edited Neon shows the other device's own Neon there, because the set exists (the spec's rule). Only custom sets travel with a look. The preview text "A look that uses this set stores its colours…" promises more than that, so for built-ins I'd show "Looks that use this set show your changes on this device. To take them along, save as a new set." OK?

## 10. Answers (2026-11-25)

1. Yes: overrides on top of the look's own Mono and Two-tone colours; no migration.
2. Yes: a page inside the Appearance tab, the window growing to at most 1280 × 720, with the narrow-screen fallbacks.
3. Yes: custom sets and overrides in backup 1.6, with the merge rules of §4.
4. Yes: "Save as a set" reuses the missing id, so all its looks reconnect.
5. **Changed:** the warning shows only for modified built-ins and custom sets. The brief notes that Warm (E and F) and Pastel (B and C) are close as shipped.
6. Decision 51 stays: no dialog, Undo restores the overrides.
7. Yes: the new text for built-ins, the spec's text for custom sets.

Pixel check: the `?stats=1` hook for the engine's 12 colours plus the piano roll screenshot comparison.
