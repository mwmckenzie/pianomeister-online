# Review report — `feat/m7-6-now-playing` (Milestone 7.6: Now playing & play tracking)

Plan: `docs/milestones/m7-6.md`, approved with these answers:

1. Adoption changes only the now-playing line and attribution. The last loaded entry stays as it is: it's what Back to returns to, it decides temporary vs. global edits, and it's what Resume reopens.
2. "Back to Full song" (loop off, 100%) when Full song was last loaded and the setup differs.
3. Play after Stop and a timeline click is a start; each loop wrap is one more play (a start and three wraps make four plays).
4. Records keep the full setup; `temporary` goes.
5. **Your change to decision 70:** a committed loop change's jump to the new loop start is a start. While playing it counts at once; while paused or stopped it arms the next Play. Nudges settle first, so one jump is one play.

Nothing is committed.

---

## 2026-11-19 — Round 1: built

### What was done

| Area               | Files                                                                                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 0             | `docs/roadmap.md`, `docs/milestones/m7-6.md`                                                                        | **Roadmap:** 7.5 ✅; a new 7.6 row and section (in progress); Welcome & stats becomes **7.7** with "plays (starts) per bookmark and setup", "most plays in a day", "time on other setups per song", and the play-log sentence lists the new setup fields.<br>**m7-6.md:** your four additions plus answers 1–5, as decisions 14–20.                                                                                                                                                                                                |
| Now playing (core) | `core/practice/nowPlaying.ts`, `NowPlayingInfo.ts`, `sameBookmarkSettings.ts`, `bookmarkSummary.ts`                 | **`nowPlaying(songId, setup, bookmarks, fullSong, bars)`** returns a bookmark the setup matches exactly (its range clamped as on load), else Full song (no loop, 100%, hands, pre-roll and metronome as the globals), else a custom setup labelled with the automatic-name text ("Full song · …" with no loop).<br>**Supporting changes:** `sameBookmarkSettings` now compares any song and setup (a null loop included). `bookmarkSummary` has a `wholeSong` option.                                                              |
| Play log (core)    | `core/stats/PlayRecorder.ts`, `RecorderEvent.ts`, `PlayRecord.ts`, `PlaySetup.ts`, `sumPractice.ts`                 | **Recorder rewritten:** a play is a start (load, Stop, song end, each wrap, each loop jump). Each stretch keeps the full setup and what it matched (`bookmarkId`: a bookmark, `full:<songId>`, or null); a change of either splits it. The range, seek and range-start inputs and pass counting are gone.<br>**Records:** `PlayRecord.plays` replaces `passes`; `PlaySetup` is the full `PracticeConfig`.<br>**Totals:** per-entry totals skip other setups; `otherSetupTotals` is new; song totals already came from all records. |
| Backup             | `buildArchive.ts`, `readPracticeData.ts`, `planBackupMerge.ts`                                                      | Writes **1.2**. A 1.1 record's `passes` are read as `plays`. The reader keeps a null `bookmarkId`, hand modes and pre-roll. Add-as-new leaves null and Full song ids alone.                                                                                                                                                                                                                                                                                                                                                        |
| Data               | `data/PianoMeisterDb.ts`                                                                                            | **Dexie v5:** schema unchanged. Each record's `passes` is copied to `plays` and then deleted; nothing else is touched.                                                                                                                                                                                                                                                                                                                                                                                                             |
| Session layer      | `ui/stores/practiceStore.ts`                                                                                        | **New:** `now` (the now-playing info), `loads` (a counter for each real load) and `backToLoaded()` (bookmark: drop the temporary changes; Full song: loop off and 100%; it jumps only if the loop changes).<br>**`changed`** now covers Full song too (loop and tempo), so Back to shows for it.<br>**Removed:** `rangeMatchesSaved` and `revert()`.                                                                                                                                                                               |
| Play-log wiring    | `ui/playback/playLog.ts`                                                                                            | **Sends:** `setup` with the full setup and `now.entryId` on every change; `load` on each load (counted by `practice.loads`); `jump` on each `loopJump` not caused by a load; and play, pause, stop and end from the transport.<br>**Order:** the setup watch is registered first, so a loop change's new record exists before its jump is counted.                                                                                                                                                                                 |
| HUD                | `PlayerView.vue`                                                                                                    | **The now-playing line:** a bookmark icon plus the name in the secondary colour for a bookmark or Full song. A custom setup is plain dim text, hovering "Doesn't match a bookmark · press ⟨key⟩ to save it" (with no key: "… · Save as bookmark to keep it").<br>**Test ids:** `hud-entry[data-kind]`, `hud-entry-icon`, `hud-bookmark`, `hud-full-song`, `hud-custom`.<br>**Removed:** the dot.                                                                                                                                   |
| Notes and Back to  | `LoopPopover.vue`, `TempoPopover.vue`, `AudioTab.vue`, `settings/DefaultsNote.vue` (was `player/TemporaryNote.vue`) | **Back to:** "Back to ⟨name⟩" / "Back to Full song" (`back-to-loaded`) shows while the setup differs from the last loaded entry. It replaces "Revert to bookmark".<br>**Notes:** the "Temporary for …" notes are gone. The Practice tab's defaults note stays, now as `DefaultsNote`.                                                                                                                                                                                                                                              |
| Command            | `COMMANDS.ts`                                                                                                       | Revert to bookmark becomes **"Back to bookmark"**. The id `revertBookmark` is kept so stored key bindings survive.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Picker             | `SongPicker.vue`, `statsStore.ts`                                                                                   | "Other setups: 12 plays · 18 min" under the selected entry's stats, when the song has any.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Brief              | `docs/brief.md`                                                                                                     | **Rewritten:** decisions 68, 69, 70 and 71.<br>**Edited:** 60 (the now-playing line, the metronome wording), 72 (the Other setups line), 73 (Plays are starts), 75 (backup 1.2), 77 (save simply matches) and 89 (Back to bookmark).<br>**Data model:** the `PlayRecord` entry.                                                                                                                                                                                                                                                    |

### Decisions I made that weren't in the instructions

1. **Back to only jumps when the loop changes.** Before, Revert always jumped. Now going back from a tempo-only change doesn't restart the section, and so (with your loop-jump rule) doesn't count a play. Back to Full song turns the loop off, which never jumps.
2. **Save as bookmark doesn't count as a load.** The new bookmark becomes the loaded one without a jump (as before) and without arming a start, so saving mid-play doesn't add a play.
3. **Loading a bookmark jumps to its loop start**, but that jump is the load's start, not a second play.
4. **The record is written as each play counts**, not only on ticks and at the end, so the picker and library update as you play.
5. **The custom hint with no key bound** reads "Doesn't match a bookmark · Save as bookmark to keep it".
6. **Late last session:** the play log keeps one recorder for the page and hands it the stored last session when that's read (`continueSession`), instead of replacing it. Replacing it could re-arm a start (see the results).
7. **Type file name:** `NowPlayingInfo.ts`. A type file named `NowPlaying.ts` would clash with `nowPlaying.ts` on Windows' case-insensitive file system; that's how I found it.

### Test and check results

- `npm run check`: **521 unit tests** pass.
  - New `nowPlaying` spec: a bookmark, adoption, Full song, a custom label identical to the auto name, "Full song · …" without a loop, a clamped range, another song's bookmarks.
  - Recorder: the first Play, pause/resume and a seek while paused (not counted), Stop and song end (counted, a seek in between too), a start plus three wraps = 4, writes as each play counts, a loop jump while playing (counted in the new loop's record) and while paused or stopped (armed), load, hidden/visible, attribution switching mid-play, adoption, splits on any setup field, sessions.
  - Stats: song totals from all records including other setups, entry totals and share, other-setup totals.
  - Practice store: `now`, adoption with the loaded entry kept, Back to (bookmark and Full song), jumps.
  - Dexie v5 (passes → plays, nothing else touched); reading a 1.1 and a 1.2 backup.
- `npm run build`: passes.
- **e2e** (production preview, `--retries=0`): **109/109** on the final build (2.7 min).
  - An earlier full run failed 1/109: "pausing and resuming is one play". The test read records in key order (random UUIDs); it now sorts by start time and passed 3/3 in a row.
  - While looking at that, I found a real race and fixed it: when the stored last session was read after the first Play, the play log _replaced_ its recorder, which re-armed a start, so a later resume could count as a play. The recorder is now kept and handed the session (`continueSession`), with a unit test.
  - **New `nowPlaying.spec.ts`:**
    - Full song with its icon; a tempo key makes it custom; Back to Full song;
    - changing the loop to equal another bookmark adopts it (no toast, Back to the loaded one) and it gets the play;
    - pause, a seek and resume are one play;
    - deleting a bookmark leaves the song's 15 plays and 28 min unchanged, and the picker shows "Other setups: 12 plays · 18 min" and a 36% share.
  - **`loopJump.spec.ts`:** a loop jump while playing counts at once; while paused it counts on the next Play; "Back to the bookmark jumps to its start".
  - **`bookmarks.spec.ts`:** the HUD line (icon, custom text, hint, back to the bookmark when the tempo is changed back), no notes, Back to, a start plus wraps for the matching bookmark, the metronome and the Practice tab without the dot.
  - **Seeds:** use `plays`.
- **Visual:** **32/32** for the affected shots (m7 player bookmark, loop popover, picker, library and bookmarks, and the new `m7-6-player-custom`, `m7-6-player-full-song` and `m7-6-picker-other-setups`; 1280×720 and 1024×768, Glacier and Ember). I looked at them:
  - the icon and name in the secondary colour (Ember too);
  - Full song with its icon;
  - the custom setup dim with no icon;
  - "Back to B section" in the loop popover;
  - "Other setups: 12 plays · 12 min" in the picker.

  The custom line's hover hint is a native `title` tooltip, which screenshots don't capture; the e2e test checks its text.

### Known issues and open questions

1. **Exact wrap counting in e2e:** the "three wraps" test polls until at least 4 plays (a start and three wraps) on a one-bar loop at 200%. Real audio time can't be paused, so the exact per-wrap count is checked in the unit tests rather than end to end.
2. **Old records' attribution:** as decided, records from before 7.6 keep the bookmark they were recorded under, even if they were played with temporary changes (they carry `temporary: true`). Song totals are unaffected.

### Manual review checklist

- [ ] Load a bookmark: icon and name in the secondary colour. Change the tempo: plain dim text, and the hover hint names your Save key. Change it back: the icon returns.
- [ ] Full song: the icon and "Full song". `-` makes it "Full song · 95% · …"; the loop popover offers "Back to Full song".
- [ ] Set the loop and tempo to another bookmark's: its name shows, with no toast; "Back to ⟨loaded⟩" is offered.
- [ ] Play a short loop: plays go up by one per wrap. Pause and resume: no new play. Change the loop while playing: one more play.
- [ ] Picker: "Other setups: … plays · … min" after playing a custom setup.
- [ ] Delete a bookmark you've practised: the library's Plays and the picker's song numbers stay the same.
- [ ] Settings → Shortcuts: the command reads "Back to bookmark".

---

## 2026-11-19 — Round 2: long names and loop bounds

### What was done

| Area           | Files                                                                                                                                         | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Back to button | `LoopPopover.vue`                                                                                                                             | "Back to" is on the first line, and the name sits under it in the dim text colour. The name wraps within the popover, stops at two lines with an ellipsis, and the full text is in the tooltip. "Back to Full song" works the same way.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| HUD line       | `PlayerView.vue`                                                                                                                              | The line already truncates with an ellipsis. A bookmark's tooltip is its name; a custom setup's tooltip is now the full setup, then the hint ("…\nDoesn't match a bookmark · press B to save it"), so a cut-short setup can still be read. The left column gets `data-testid="hud-left"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Overflow audit | `e2e/longNames.spec.ts`                                                                                                                       | The longest auto name ("Bars 100–120 · 85% · left only · quiet pre-roll 4 · metronome in pre-roll", on the Canon) is checked at 1280×720 and 1024×768 on:<br>• the HUD line, with the sidebar open, as a bookmark and as a custom setup;<br>• the loop popover (Back to) and the tempo popover;<br>• the "Saved …" and "Already saved as …" toasts;<br>• the picker (Load list, selected entry);<br>• the bookmark manager (rows, edit panel);<br>• the discard-duplicate dialog, the profile-delete confirm and the cheat sheet.<br>**Checks:** nothing sticks out of its container (unless clipped inside it); no scroll container scrolls sideways; any element showing the name cut short has the full name in a tooltip.<br>**Result:** only the Back to button overflowed. Every other surface already wrapped or truncated with a tooltip. |
| Loop bounds    | `core/transport/loopSeekBar.ts`, `Transport.ts`                                                                                               | **One rule, in `Transport.seekToBar`,** which every seek goes through (timeline click and drag release, its keys, ←/→, Home): while a loop is on, a bar outside it lands on the loop's first bar. So → on the last bar wraps to the start and ← on the first bar stays. While dragging, the preview still follows the pointer, and the seek snaps on release.<br>**Safety net:** `play()` from a playhead outside the active loop starts at the loop start, pre-roll first.                                                                                                                                                                                                                                                                                                                                                                       |
| Timeline       | `PlayerTimeline.vue`                                                                                                                          | While the loop is on, the parts outside it are dimmed (a 45 % dark overlay over the rail; ticks still show).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Tests          | `loopSeekBar.spec.ts`, `Transport.spec.ts`, `e2e/loopBounds.spec.ts`, `e2e/loopJump.spec.ts`, `e2e/listKeys.spec.ts`, `visual-review.spec.ts` | **Unit:** the clamp rule; seeks with a loop on (paused and playing, →/← at the edges, the loop off again); Play from outside the loop.<br>**e2e:** clicks before and after the loop (paused), a drag released before the loop and a click after it (playing), → wraps and ← stays (and the timeline's End), and the loop off frees seeking again.<br>**Reworked:** the loop-jump tests used to park at bar 1 with a loop on bars 40–44, which can't happen any more. They now start inside a wide loop (10–44), so each jump is still clearly visible. The nudge test now parks at the loop start.<br>**Visual:** `m7-6-loop-popover-long-name` at both sizes.                                                                                                                                                                                    |

### Decisions I made that weren't in the instructions

1. **Play from outside the loop isn't counted as an extra play.** It only happens if a loop was turned on without its usual jump, which the player never does now; resuming still isn't a start.
2. **The Back to button** is a plain button styled like the popover's text buttons, with the reset icon at its top-left.
3. **`expectAt` in the loop-jump spec** now polls for "at the target bar or one past it" while playing. The old "≥ target" check passed as soon as the playhead was anywhere past the target, before the jump had even happened. That's a test fix, not an app change.

### Test and check results

- `npm run check`: **527 unit tests** pass.
- **Affected e2e** (preview, `--retries=0`): loopBounds, longNames, loopJump, player, bookmarks, nowPlaying, listKeys, shortcuts and picker, **80/80** after the fixes above.
  - The first run failed 11. Ten were loop-jump tests and one was the nudge test, all parking outside a loop.
  - loopJump then passed 15/15 twice and listKeys 6/6.
- **Visual:** the m7.6, loop-popover and player shots pass **36/36**. I looked at the long-name popover (two dim lines under "Back to") and the dimmed timeline outside the loop.
- I didn't re-run the full suite this round; that will happen before committing.

### Manual review checklist

- [ ] A bookmark with a long auto name, then change the tempo: the loop popover shows "Back to", with the name on up to two dim lines and the full name on hover.
- [ ] With the sidebar open at 1024×768: the HUD line truncates; hovering shows the full name or setup.
- [ ] Loop 20–35: click or drag the timeline to bar 12 or 50, paused and playing: it lands on bar 20. → on bar 35 goes to 20; ← on bar 20 stays.
- [ ] The timeline is dimmed outside the loop; turn the loop off and seeking goes anywhere.

---

## 2026-11-19 — Final

**Final run:**

- `npm run check`: 527 unit tests pass.
- `npm run build`: passes.
- Full e2e on the production preview, `--retries=0`: **117/117** (3.0 min).

Your testing found nothing further, so this is committed in focused commits and opened as a PR.
