# Milestone 9.1 plan: Looks v2, range trimming, built-in looks

Spec: `docs/milestones/m9-1.md`. Branch `feat/m9-1-looks` from `main` (milestone 9 merged). Approved 2026-11-22 with the answers in §9.

## 1. Where the spec meets the current code

| #   | Spec asks for                                                    | Today                                                                                                                                                                           | Proposal                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | A look holds every playfield-sidebar setting except cost         | `LOOK_KEYS` = appearance only (136 keys). It leaves out camera (3), keyboard (11), look-ahead, black lift (2), key fade, and the render section's cost and resolution settings. | `LOOK_KEYS` = every key whose home is the sidebar, minus `COST_KEYS`. That adds 18 keys (camera, keyboard, look-ahead, black lift, key fade). Brief decision 121 is rewritten to match.                                                                                                                           |
| S2  | Cost = quality, bloom resolution, particle budget, shader detail | The render section also has a Resolution group: auto scale, render scale, max pixel ratio, anti-aliasing. These are per-device cost too, and the spec doesn't name them.        | Treat the Resolution group as cost as well (**Q1**). `COST_KEYS` gets its own file, and a test checks that no look stores or applies one.                                                                                                                                                                         |
| S3  | Self-contained apply: a missing key takes this device's default  | `applyLook` only writes the keys the look has. Saved looks hold all `LOOK_KEYS` today, but only the old 136.                                                                    | `applyLook(settings, look, device)` writes every `LOOK_KEY`, taking the look's value or else `defaultValue(key, device)`. It stays pure. 9.5's overlay = `lookSettings(base, look, device)`: effective settings that are never written (design only, §4).                                                         |
| S4  | Stable ids (UUID; fixed for built-ins)                           | Built-ins already use `builtin:<name>`. Saved looks get `look:<base36 time>`; Copy look uses a UUID.                                                                            | New looks get `crypto.randomUUID()`. Existing `look:…` ids are kept as they are: they are already stable and unique.                                                                                                                                                                                              |
| S5  | `createdAt` in the file format                                   | `Look` has no `createdAt`. Copy look stamps the time of the copy.                                                                                                               | Add `createdAt` (ISO) and `updatedAt` to saved looks. Built-ins use a fixed date. Migrated looks get the time of the migration.                                                                                                                                                                                   |
| S6  | Looks stored device-wide in Dexie (v6), not localStorage         | Saved looks and the active id sit inside `pianomeister.settings` in localStorage, which is read synchronously at startup. Dexie is at v5.                                       | Dexie **v6** adds a `looks` table (`id`, `name`, `createdAt`, `updatedAt`, `values`), loaded at startup. On first run, saved looks move from localStorage and the localStorage copy is dropped. The **active id** stays with the settings in localStorage, because "· modified" must be right on the first frame. |
| S7  | Saved looks go in the backup                                     | Brief decision 121 says "not in the library backup". `library.json` is version 1.x and holds songs and practice data.                                                           | `library.json` gains `looks: LookFileEntry[]` (version 1.x → next minor, so older readers still work). Merge rules: **Q3**. The brief's backup decisions (75, 121) are updated.                                                                                                                                   |
| S8  | Import clamps to the new ranges and migrates older versions      | `readLooks` already migrates and coerces (clamping included). The file-import path isn't built yet: Copy exists, Paste and Import don't.                                        | One core reader, `readLookFile(raw, existing, newId)`. It checks the format, migrates from the file's version, drops unknown and cost keys, coerces and clamps, fills missing keys from defaults, and resolves name and id clashes. It returns looks or an error. Import, Paste and backup all use it.            |
| S9  | Effect captures for the range sheets "with motion"               | Particles and pulses run on the real frame delta. `?animTime` only pins the shader clock, so a capture taken during play isn't repeatable.                                      | A test-only `?capture=1` hook (inert otherwise) that runs the transport and engine on a fixed 1/60 s step, with no audio, from a given bar. A playing frame at bar 2 + N s is then the same on every run. It also reports live particles and the budget, for "hits the budget" (§3).                              |

## 2. Section A — Looks v2

**Core** (`src/core/looks/`, unit-tested)

- **Keys:**
  - `COST_KEYS` (new file).
  - `LOOK_KEYS` = sidebar keys minus cost.
  - `Look` gains `createdAt` and `updatedAt`. `values` stays the flat key map.
- **Apply and capture:**
  - `applyLook(settings, look, device)` is self-contained and returns `{ settings, previous }` for Undo.
  - `captureLook` takes `LOOK_KEYS`.
  - `isLookModified` compares against the completed look (missing key = default), so an old partial look doesn't read "modified" on keys it never had.
- **Clashes:** `uniqueLookName(name, taken)` → "Name (2)", "Name (3)"…; built-in names count as taken.
- **Files:**
  - `readLookFile(raw, existing, newId)` → `{ looks } | { error }`, as described in S8.
  - The format stays `{ format: 'pianomeister-look', version, looks: [{ id, name, createdAt, settings }] }`.
  - `toLookFile` drops cost keys (already true) and nests by section.
- **Backup:** `planLookMerge(incoming, local, newId)` (rules per Q3).
- **Classic stays frozen:** every key it holds is pinned explicitly, including camera, keyboard and look-ahead at their milestone 8 values. A later default change, including the tuning session, can't move it. A unit test compares Classic with a snapshot.

**Data** (`src/data/`)

- `PianoMeisterDb` v6: a `looks` table, plus an upgrade spec.
- `Looks` repository: list, put, rename, delete, bulk add.
- One-time move from localStorage; old entries get the self-contained fill.

**UI** (`LookPicker.vue`, `settingsStore`)

- **Picker:** built-ins in one list, then a "My looks" group. A modified look shows "⟨Name⟩ · modified".
- **Built-ins:**
  - Save as new…, Copy, Export.
  - No Save, Rename or Delete.
- **Saved looks:**
  - Save, Save as new…, Rename (inline, like naming), Delete (with Undo), Copy, Export.
- **A "more" menu** (the existing menu component), to keep the sidebar header small:
  - Export all my looks.
  - Import… (file picker, `.pmlook.json` and `.json`).
  - Paste look.
- **Drag and drop:** dropping a file anywhere on the sidebar shows a drop outline and imports it.
- **Export:**
  - Exports the selected look's **saved** values, not unsaved changes. Copy look still copies the current settings, as in milestone 9.
  - Downloads `<name>.pmlook.json` (file-safe name).
  - Export all → `pianomeister-looks.pmlook.json`.
- **Import and Paste:**
  - Add to My looks and never apply.
  - Toast: "Imported 3 looks", or "Imported look 'Name' · Apply" when there is exactly one.
  - Errors:
    - "That file isn't a PianoMeister look" (wrong format).
    - "That look file is from a newer version" (newer version).
    - "The clipboard has no look" (Paste with nothing usable).
  - Any error changes nothing.
- **Backup:** saved looks go into the export, and the import toast names them ("… · 2 looks added").

## 3. Section B — ranges (stops for approval)

1. **Which settings:** every numeric sidebar setting, minus cost (S2) — **98** of them. Notes:
   - A setting that only shows when another is on is rendered with that one on (stripe width with Stripes fill, pedal knobs with the cage shown, effect knobs with the effect on).
   - Colours and choices aren't ranged.
2. **Values:** 7 per sheet: min, default, and 5 spread across the range.
   - Log-spaced for perceptual settings: sizes, widths, strengths, glow, counts, lifetimes, rates, radius, opacity-like shares near 0.
   - Linear for geometry and angles.
   - Each spacing is listed in `ranges.md`.
3. **Static frames:** Pedal demo, bar 2, `?animTime=3`, 1280×720, defaults. Saved to `test-results/visual/ranges/<section>/<key>.png` with the value under each frame.
4. **Motion** (onsets, sustain effects, pulse, flicker): the `?capture=1` fixed-step run (S9).
   - Onset effects use the Clarity demo's dense chord, at three moments after it (0.1, 0.3 and 0.6 s) per value. The sheet is then 7 values × 3 moments.
   - The hook logs live particles against the budget at Medium (2048). `ranges.md` gets a "budget" column showing the value where the budget starts truncating.
5. **Pairs:** a 4×4 grid each.
   - Bloom strength × threshold.
   - Bloom strength × radius.
   - Edge glow width × intensity.
   - Onset count × lifetime (each onset effect).
   - Sustain rate × lifetime.
   - Vignette × three highway colours (dark, default, light), as a 4×3 grid.
6. **Review:** I look at every sheet myself and write `docs/design/m9-1/ranges.md` with:
   - section, key, old min/max/step, new min/max/step, default, scale (lin/log), budget (particles), why;
   - a list of settings whose step should be coarser.
7. **Stop:** I send the table and the zip, then wait for approval (see Q4).
8. **After approval:**
   - Update the registry and add a slider `scale: 'log'` (the slider maps position ↔ value; the stored value stays the real one).
   - Unit tests:
     - stored v8 values and imported looks clamp into the new ranges;
     - defaults and every built-in sit inside the ranges.

## 4. Designed now, built in 9.5: temporary looks

- **Pure function:** `lookSettings(base, look, device)` returns the effective settings and never writes.
- **Store:** later the settings store gets an `overlay: Look | null`, and the engine reads `effective = overlay ? lookSettings(settings, overlay, device) : settings`.
- **Writes:** edits made while an overlay is on still go to the user's own settings.
- **Ids:** playlists hold a look id. A missing id falls back to no overlay.
- **Now:** nothing in 9.1 writes the overlay. The function and its tests exist now, so 9.5 only adds the store field.

## 5. Section C — built-in looks

- **The looks:** the thirteen looks from the spec, in picker order, with fixed ids `builtin:<slug>`.
  - Values use the trimmed ranges.
  - "Strong / medium / subtle" = 80 / 50 / 20 % of the trimmed range: log position for log sliders, linear otherwise.
  - Fill substitutions as in section C.
  - Every substitution is listed in the report (for example, if "Sustain glow", "Explosion count strong" or "Soft gradient" needs mapping to an existing setting).
- **Camera:** every look keeps the default camera (Fireworks: look-ahead +2 beats). Because looks now hold the camera, picking any built-in resets camera and keyboard to the defaults (**Q2**).
- **Tests:**
  - A unit test checks every built-in is complete and in range.
  - A visual test per look at 1280×720, at quality Off and Medium.
  - `test-results/visual/looks/all-looks.png` (Medium, names under each); its JPEG goes in the report.

## 6. Brief and roadmap

- **Roadmap:** 9 ✅; a new **9.1 Looks v2 & built-in looks** row, in progress, between 9 and 9.5. Done with this plan.
- **Brief:**
  - Decision 121 is rewritten (full sidebar scope, cost keys, self-contained, ids, file format, import rules, backup, Dexie storage, the 9.5 overlay).
  - Decision 75 (backup) gains looks.
  - Decision 108 is updated: tuning moves to the end of 9.1.
  - After section B: the new ranges where the brief names them.
  - After section C: the built-in looks list.

## 7. Build order (local commits per step)

1. **A, core:** keys, apply, file reader, name and id clashes, merge, Classic pinned. Unit tests.
2. **A, data:** Dexie v6, repository, move from localStorage. Unit and upgrade tests.
3. **A, UI:** picker actions, import, export, paste, drag and drop, backup. E2e test: save → rename → export → delete → import the file back → Undo.
4. **B:** the capture hook, range and pair sheets, `ranges.md`, zip. **Stop and report.**
5. **After approval:** registry ranges, log sliders, clamping tests.
6. **C:** the thirteen looks, the in-range test, per-look visual tests, the all-looks sheet. Report.
7. Manual review, then the tuning session.

## 8. Questions

1. **Resolution as cost:** should the render Resolution group (auto scale, render scale, max pixel ratio, anti-aliasing) count as device cost too, so looks never store it? I recommend yes: it's per-device performance like the other four.
2. **Camera in built-ins:** with looks covering the whole sidebar, picking any built-in resets camera, keyboard and look-ahead to the defaults (it's self-contained, with Undo). OK? The only other option is a built-in-only exception, which would break "same look, same picture".
3. **Backup collisions for looks:**
   - Same id and same values → skipped (already here).
   - Same id, different values → added with a new id.
   - A name clash → "Name (2)".
   - Nothing local is ever overwritten.

   OK?

4. **Range sheets:** about 98 sheets plus about 10 pair grids, roughly 30–60 MB as PNG. I'd put the zip (PNGs) at `test-results/visual/ranges.zip` and give you the path, rather than commit it. `ranges.md` and a few representative JPEGs go in `docs/design/m9-1/`. OK, or do you want all the sheets committed as JPEGs?
5. **Export of a modified look:** Export writes the look as **saved**; Copy look keeps copying the **current** settings (milestone 9 behaviour). Or should Export also take the current settings when "· modified"?

## 9. Answers (approved 2026-11-22)

S4, S6, Classic pinning every key, the fixed-step capture mode and the shared reader are approved.

1. **Resolution is cost.** Render scale, auto scale, max pixel ratio and anti-aliasing are never stored in or applied by a look.
2. **A look is the complete playfield setup.** Applying any look, built-in or saved, sets every playfield setting, including camera, tilt, keyboard and look-ahead, with Undo.
   - Built-in looks may have their own camera and look-ahead values; Fireworks keeps its extra look-ahead.
   - There is no "include camera" option.
   - `m9-1.md` §A and §C were updated.
3. **Backup:**
   - An identical look is skipped.
   - The same id with different values is added under a new id.
   - A name clash becomes "Name (2)".
   - Nothing local is ever overwritten.
   - Built-ins are never in a backup.
4. **Range sheets:** the zip is at `test-results/visual/ranges.zip`, outside git. `ranges.md` and a few sample JPEGs are committed.
5. **Export:** "Export look" exports the saved values. While the look is "· modified", a second item, **"Export current settings"**, exports what's on screen as "⟨Name⟩ (modified)" with a new id, the same as Copy look.

Also: the roadmap gains the idea "Bookmarks can have a look" (9.5 or later), which uses the same temporary-look overlay. `lookSettings` stays pure and reusable.
