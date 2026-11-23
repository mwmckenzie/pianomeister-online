# Milestone 9.5 — Playlist mode (branch `feat/m9-5-playlists`)

## Round 1 — 2026-11-23: built, ready for review

Built in the approved order A → timeline core → C → D → B → E, committed locally per step. **Nothing pushed.**

### What was done

| Part                  | Commit                          | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Data               | `92ca956`                       | Playlist model, `.pmplaylist.json` read/write (carrying saved looks, with the looks' collision rules), Dexie v8 `playlists` table, backup 1.4 (playlists merge per profile choice).                                                                                                                                                                                                                                                                                                                                            |
| Timeline core         | `06cb0fe`                       | `buildTimeline` (songs placed on one beat-based timeline, PPQ 960, joined tempo map, bars restarting per song), `songStartTimes` (overlap = min(crossfade, half of either song), 1 s gap at 0), play order (shuffle, repeat, previous-song rule), equal-power gains; decks in `SmplrOutput`; `Transport.replaceSong` (a swap mid-play, re-planning pending notes).                                                                                                                                                             |
| C. Listening          | `e7d978f`, `a645f0d`            | `ListeningController`: the rolling timeline (current song + the next, appended 10 s before the current ends and swapped in place; rebased once the old song's release is over), Next/Previous, shuffle, repeat, finish, crossfade in step with the timeline. Listening HUD (Show / Minimal / Hidden) and menu; tracking suspended; the look overlay; Leave parks at the bar. Listening keys and a cheat-sheet group shown only while listening. "Update playlist look" in the look picker; beat dots follow each song's meter. |
| D. Seam and crossfade | `e98fd20`                       | `PlaylistSeam` (seam line with glow, a constant-size "Title · Composer" label, the crossfade band); the ending song's notes dim through the band (0.85 → 0.25); look easing across a seam (`easeSettings`, core).                                                                                                                                                                                                                                                                                                              |
| B. Playlists tab      | `45461db`                       | Third Manage tab (list, editor, per-song looks, drag and Alt+↑/↓, Add songs panel, Export / Export all / Import with "Import its looks too", Delete with Undo, empty states, list keys); "Add to playlist…" in the Library details and the song picker.                                                                                                                                                                                                                                                                        |
| E. Welcome            | `3571f89`                       | "Listen" card under the 12-week calendar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Tests, sheets, brief  | `91d4637` + this round's commit | `@playlists` e2e spec, listening contact sheets, brief decision 126.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### Decisions not in the instructions

1. **Look swatch** (the dot beside a look's name): a look's mono or white-key colour, else its palette's C (`core/looks/lookSwatch`). The board's swatches were hand-picked; this derives one.
2. **Welcome card:** up to three playlists, but **two below 800 px tall**. At 720 px three ran into the bottom edge; the board shows two at that size.
3. **"Update playlist look"** shows only when the song is showing the playlist's look **and that look is a saved one** (built-ins can't be changed). It saves the sidebar's changes over that look, with Undo.
4. **Import** reads the file once first; if it carries looks, a dialog asks "Import its looks too (N)" (default on). Files without looks import straight away. Importing the same file twice says "Those playlists are here already".
5. **Duplicate** names the copy "⟨Name⟩ copy" (made unique) and keeps the looks, shuffle and repeat.
6. **Look easing runs on the wall clock** (performance.now), not the song clock, so pausing during an ease doesn't hold it. Under reduced motion, the switch happens at the midpoint.
7. **"Added to ⟨playlist⟩"** toast with **Open** after "Add to playlist…"; "New playlist…" makes one holding the song and opens it with the name selected.
8. **Engine continuity:** `Engine.setSong(song, { shiftTicks })` keeps particles and the tick history across a swap, so a swap isn't read as a seek (no effect reset at the seam or the rebase).

### Measurements

**Swap timing** (the engine rebuild for a new timeline, production build, chromium headless, 1280×720):

| Swap                             | ms        |
| -------------------------------- | --------- |
| Start (one song)                 | 3.5 – 4.6 |
| Append the next song (two songs) | 6.1 – 7.7 |
| Rebase after the seam (one song) | 2.3 – 2.4 |

All of them are well under one 60 fps frame (16.7 ms), so the **build-then-swap-in-one-frame fallback wasn't needed** and isn't built. Late seams (the next song not ready in time): **0** in every run.

**Draw calls** (`renderer.info`, Minuet → Canon → Invention, same frames):

| Quality | One song | Seam ahead (line, label, band) | In the overlap |
| ------- | -------- | ------------------------------ | -------------- |
| Off     | 20       | 22                             | 21             |
| Medium  | 38       | 41                             | 40             |

The seam adds 1–3 draw calls. Both songs' notes share the existing instanced meshes (a per-note deck attribute), so the overlap doesn't double them.

### Tests and checks

- `npm run check`: type-check and lint pass; **803 unit tests pass** (114 files). New unit tests:
  - `easeSettings`
  - `lookSwatch`
  - `newPlaylist`, `moveEntry`, `recentPlaylists`
  - from the earlier commits: the playlist model and file, the Dexie v8 upgrade, backup 1.4, `buildTimeline` and `songStartTimes`, play order, and `Transport.replaceSong`
- `npm run build`: passes.
- `npm run test:e2e:affected` (`@smoke` plus `@playlists @welcome @library @player @shortcuts @looks @settings @loop @bookmarks @stats`; chromium project): **182 passed, 1 failed**.
  - The failure was in my new test: `getByText` also matched the toast's screen-reader alert region.
  - Fixed by scoping both toast checks to the toast; it then passed with `--last-failed --repeat-each=3`.
- New e2e: `e2e/playlists.spec.ts`, 5 tests tagged `@playlists`, one also `@smoke`:
  - make, order and set looks, then play, Next and Esc
  - nothing recorded and the stored look unchanged
  - export → import round trip
  - the Welcome card
  - Add to playlist from the Library
- Full suite: not run locally (policy).

### Contact sheets (`test-results/visual/m9-5/`, visual project, 1600×900)

Run with `npx playwright test --project=visual e2e/listeningSheets.spec.ts`. Real playback, paused for stills, so frames differ a little run to run.

- `seam-off.png`, `seam-medium.png`: tilt 25 / 35 / 85° × crossfade 0 / 2 / 8 s, 1.5 s before the seam.
- `hud-modes.png`: Show, Minimal, Hidden.
- `look-ease.png`: Classic → Synthwave with an 8 s crossfade:
  - before the seam
  - early ease (~2 s; colours partly eased, fills still Classic)
  - after the midpoint (~5 s; discrete keys switched)
  - after (~9 s)

### Known issues and open questions

1. **Missing songs** show as "Missing song · Not in this library" in the editor and are skipped when playing. There's no way to relink one.
2. **Import with looks:** the "Import its looks too" checkbox has no e2e test. The file reading behind it is unit-tested, both with and without looks.
3. **Easing on the wall clock** (decision 6): should a paused ease hold instead?
4. **The `?stats=1` test seam `pianomeisterListening`** (play, seek, state, swap timings) stays in the build, like the existing stats seams.
5. **Song length** in the lists is the library's `durationSeconds`. Listening's own length adds a 0.5 s release, so totals can differ by a second or so.

### Manual review checklist

- [ ] Playlists tab:
  - make a playlist, rename it inline, add songs (+ and ✓ → "Added again · Undo")
  - drag a row, and Alt+↑/↓ on a focused row
  - per-song look picker ("Playlist look (⟨name⟩)" dim until overridden)
- [ ] ⋯ menu: Rename, Duplicate, Export all, Delete → Undo.
- [ ] Export, delete, then import the file back. Try a file whose playlist uses a saved look and check the "Import its looks too" dialog.
- [ ] Library details and the song picker: "Add to playlist…" → a playlist, and → "New playlist…".
- [ ] Play a playlist:
  - HUD modes (D)
  - next and previous (→/N, ←/Shift+N; ← restarts after 3 s)
  - M mute
  - the cheat sheet shows the Listening group only now
  - Esc leaves at the bar where it stopped, with your own look back
- [ ] Let a song run into the next one at crossfade 0, 2 and 8 s: listen for the fade, and watch the seam line, the label and the dimming band.
- [ ] Give the second song a different look and watch it ease across the seam (and with reduced motion: a switch at the midpoint).
- [ ] While listening, change something in the playfield sidebar: the note "Changes here last until you leave listening" shows, and leaving restores your settings. With the playlist's look a saved look, try "Update playlist look".
- [ ] Stats after listening: no new session, time or plays.
- [ ] Welcome: no card with no playlists; with some, recent first, Play listens, "All playlists" opens the tab.
