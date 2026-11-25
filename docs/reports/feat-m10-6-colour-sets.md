# Milestone 10.6 report: Note colour set editor

## Round 0 — 2026-11-25: plan

**Done**

- Committed the spec and mockup; wrote `docs/milestones/m10-6-plan.md`. No app code changed.

**How the plan was checked**

- Read the palette, looks, settings, backup, playlist file and settings window code. The warning was measured on the shipped colours with a throwaway script outside the repo.
- Unit tests and e2e not run: documentation only.

**Decisions not in the instructions**

- Proposals only, all in the plan.

**Open questions**

- Seven, in plan §9. The main ones: Mono and Two-tone are not 12 fixed colours (Q1), and the mockup's window doesn't match the app's (Q2).

**Review**

- [ ] Answer Q1–Q7 or say "go" for the defaults.
- [ ] Approve the plan.

## Round 1 — 2026-11-25: built

**Built** (plan §8, steps 1–6)

- `core/color`: sets, edits, names, hex, OKLab distance and the warning, validation, backup merge.
- Settings v11 and two setting kinds: `notes.palette` takes custom ids; `notes.paletteSaved` is the look's copy. Looks, look files, playlist files and backups carry the copy.
- `engine.setColourSets`; the piano roll, minimap and look dots follow. `?stats=1` hook for the engine's 12 colours.
- `src/ui/colours`: the editor page (list, octave, selected colour, warning, preview). Sidebar: the new Note colours row.
- Backup 1.6. Brief decision 129 and updates to 23, 75, 120–122; CLAUDE.md tag; roadmap row "built, in review".

**Decisions not in the instructions**

1. Reset all colours has an Undo toast, and the Note colours section has its own "Reset note colours" (decision 51).
2. Importing the same backup twice doesn't add a moved set again (same colours, its name starts with the backup's).
3. A backup look counts as identical without comparing its copy while its set exists here: the picture is the same.
4. A look with a missing set and no valid copy shows Default and is listed as "Missing set".
5. A listening overlay is covered when a set is deleted or saved again.

**Checks**

- `npm run check`: exit 0, 933 unit tests (128 files). `npm run build`: pass.
- `npm run test:e2e:affected` (chromium and polish, 12 tags, run once): **186 passed, 1 failed**; the other five `@colours` tests pass.
  - Failed: the new "Appearance reset" test, a mistake in the test: it looked up Undo by role, but the toast is outside the modal dialog. It now uses the test id the settings tests use. Re-run alone: 4 of 4 passed. The whole set was not run again (testing policy).
- Seen on screen: the editor at 1440×900, 1024×768 and 768×1024, the Appearance section at 1440×900, the sidebar row at 1440×900 (before any change). Not looked at: custom set rows, the dialogs, "(saved in look)".

**Known issues**

- At 1024×768 the list and the editor scroll together, and the preview is below them, out of view at first.
- The preview draws every fill but Gradient as solid.
- Not tried on a tablet, with a screen reader or in Safari. The native colour picker was not driven in tests (the hex field was).
- Deleting a set while a playlist eases between two looks (a few seconds) is not handled specially.
- Several tabs open at once: the last one to save wins, as for all settings.

**Review**

- [ ] Edit Default while a song plays: highway, keys, piano roll.
- [ ] Mono in Blueprint, Mist and Hazard: one changed note, then reset.
- [ ] Make a set, use it in a look and a playlist, delete it; "Save as a set".
- [ ] Copy a look with an own set to another browser.
- [ ] Back up and restore with an edited set.
- [ ] iPad: the octave, the native picker, scrolling.

## Round 2 — 2026-11-25: compact preview

Round 1 approved, all five decisions kept.

**Done**

- `ColourSetEditor.vue`: where the preview column doesn't fit, a 120 px highway strip directly under the selected-colour row, instead of the preview at the bottom. The column at wider sizes is unchanged.
- `ColourPreview.vue`: `compact` (28 px keys, short notes at least 8 px, the whole pattern with all 12 notes still passes through).
- `e2e/colours.spec.ts`: one test per size (1024×768, 768×1024). Brief decision 129 updated.

**Decisions not in the instructions**

1. The selected-colour row and the strip are pinned together, so they stay in view while the rest scrolls. Under 640 px viewport height they scroll along: pinned, they would hide the keys.
2. The breakpoint is the editor's existing one (its own width under 900 px), so some windows a little wider than 1024 px get the strip too.
3. Tighter spacing in the narrow layouts, and at 768×1024 the built-in label is "Built-in set: edit or duplicate it": otherwise the pinned block covered about 10 px of the keys.

**Checks**

- Related unit tests (`--changed origin/main`): 293 passed; no unit test covers the two components. Type-check, lint, build: pass. The full `npm run check` was not run again.
- `@colours` (chromium; polish has none): 6 of 8 passed. The two new tests failed on their own height check: it was measured during the dialog's opening scale, then compared exactly with a fraction off (119.99997). Now polled and rounded: 6 of 6 (both tests, three times). The other six were not run again, and only the test file changed after they passed.
- Seen on screen: 1024×768 and 768×1024, unchanged and with a warning and resets; also scrolled to the end; 1440×900 with a warning.

**Known issues**

- The 1024×768 issue of round 1 is fixed. The other round 1 issues stay.
- With every reset and the warning showing, the warning and Save as new set still need a scroll at both sizes.
- Not looked at: viewports under 640 px high, phone widths.

**Review**

- [ ] iPad, both orientations: edit a colour, the strip follows; scroll to Save as new set.
- [ ] The round 1 checklist.
