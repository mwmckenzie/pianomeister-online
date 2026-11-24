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
