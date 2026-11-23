# Milestone 9.5 plan: Playlist mode

Spec: `docs/milestones/m9-5.md`. Boards: `docs/design/m9-5/source/`. Branch `feat/m9-5-playlists` from `main` (#25 merged). **Draft, waiting for approval.** Questions are in §9.

Testing follows `CLAUDE.md` → Testing, not the spec's Process section:

- **Locally:** related unit tests, and `npm run test:e2e:affected` with a new `@playlists` tag (added to `scripts/e2e-affected.mjs`).
- **Before the PR:** `npm run check` once.
- **No full e2e runs.** The E2E workflow is manual only for now.

## 1. Where the spec meets the code

| #   | Spec                                                                 | Today                                                                                                                                                                                                             | Proposal                                                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Two songs sound and scroll together during the crossfade.            | One `Transport` (one song, seconds ↔ ticks through its tempo map), one `AudioScheduler`, one `SmplrOutput`. The engine draws one song, and its highway is tick- (beat-) based with `uTick` shared by every layer. | **A rolling playlist timeline** (§3): the current and next songs merged into one song placed in **time**. The existing transport, scheduler and engine play it as one song, so tempo and meter changes join at the seam by construction. The alternative (two transports, two engine songs with their own clocks) means duplicating the timing core; I'd rather not (**Q1**). |
| P2  | The ending song fades out, the next fades in (equal power).          | Notes route to hand × normal/pre-roll buses. smplr has no per-note gain.                                                                                                                                          | Two **decks** in `SmplrOutput`. Each song in the timeline is deck A or B (alternating), and each deck has its own gain node with an equal-power curve over the overlap. That's 8 instruments instead of 4. The sample loader is shared, so the samples are decoded once.                                                                                                      |
| P3  | "Start ≥ crossfade + 5 s ahead … delay the seam rather than glitch." | Songs load per `PlaybackSession.load` (parse, hands, sustain). Samples are global and already loaded.                                                                                                             | The next song is prepared (parsed, hands assigned) when the current one has `crossfade + 10 s` left. The timeline is rebuilt with it appended (§3). If preparing is late, the seam waits (silence) and debug stats count it.                                                                                                                                                  |
| P4  | The look overlay, never written.                                     | `lookSettings(base, look, device)` is pure (9.1). The settings store writes every edit to the user's settings.                                                                                                    | A **listening overlay** in the settings store: while listening, the effective settings are `base + overlay`, and sidebar edits write the overlay only. Leaving drops it.                                                                                                                                                                                                      |
| P5  | Tracking suspended, no Home auto-open.                               | `stats.trackingSuspended` (9.2) stops the recorder and pauses the Home timer.                                                                                                                                     | Listening sets it on and leaving sets it off. Unit-tested end to end with the recorder.                                                                                                                                                                                                                                                                                       |
| P6  | Commands in a "Listening" scope.                                     | Scopes: player, lists, tabs, dialogs, app.                                                                                                                                                                        | A new `listening` scope, active instead of `player` while listening (app keys still work). Bindings: §6 and **Q6**.                                                                                                                                                                                                                                                           |
| P7  | Playlists per profile; backups.                                      | Dexie v7; backup format 1.3 with looks.                                                                                                                                                                           | Dexie **v8** adds a `playlists` table (`id, profileId, [profileId+updatedAt]`). Backup format 1.4 adds `playlists` (older readers ignore it), merged with the looks rules.                                                                                                                                                                                                    |

## 2. A. Data (core, unit-tested)

- **`Playlist`**: `{ id, profileId, name, lookId | null, entries: { songId, lookId | null }[], shuffle, repeat: 'playlist' | 'one' | 'off', createdAt, updatedAt, lastPlayedAt | null }`.
  - `lastPlayedAt` is the only thing listening remembers (E3).
- **Pure functions:**
  - `resolvePlaylist(playlist, songs, looks)`: entries with `missing` flags. A missing look falls back to "Current look" with a hint.
  - `playlistLength`.
  - `readPlaylistFile(raw, existing, library, looks)`: the format check, then matching songs by **song id**. The id is the content hash, the identity the backup already uses. Missing songs become "Missing song" entries.
  - `toPlaylistFile(playlists, looks)`: carries the referenced **saved** looks as a look file inside (built-ins resolve by id).
  - `planPlaylistMerge` (backup): identical skipped, same id with different content gets a new id, a name clash gets "(2)", nothing local overwritten.
- **Repository and migration:** `data/Playlists.ts` and the Dexie v8 upgrade (an empty table). The backup reads and writes playlists, with tests.

## 3. C + D. Listening and the continuous highway

### 3.1 The rolling timeline (core, pure)

- **`songStartTimes(durations, crossfade)`:** each song starts `crossfade` s before the previous one ends. At 0 there is a 1 s gap.
  - A song's "end" is its last note's release (the trailing silence in the file is trimmed).
- **`buildTimeline(segments)`:** `segments` = 1–2 songs, each with its start time in seconds. It returns one `TransportSong`-like song:
  - A common PPQ (960).
  - A merged **tempo map** (each song's tempo segments from its start).
  - Notes in merged ticks, tagged with their **segment** (deck A/B).
  - A per-segment **beat list** for the highway grid (bars switch at the seam).
  - Per-segment bar maps for the HUD's "bar : beat" (song-local numbering).
- **Rebuild:** while song k plays, the timeline holds [k, k+1] once k+1 is prepared.
  - When song k+1 is the current one, the timeline is rebuilt as [k+1, k+2], rebased so k+1 starts at 0.
  - `Transport.replaceSong(song, position)` (new) swaps the song **without stopping**, re-anchors at the same audible point and makes the scheduler replan.
  - The engine's `setSong` rebuild happens at that moment (mid-song, not at the seam). Its cost is measured; if it hitches, the next song's layers get built and swapped in one frame.

### 3.2 Listening session (UI state, `ui/playback/ListeningSession.ts`)

- **Start:** from Play on a playlist, a row or a Welcome tile.
  - Snapshot of what's loaded; `trackingSuspended` on; loop, pre-roll and count-in off; tempo 100 %; no bookmark.
  - The order is built (shuffle and repeat), the first song prepared, and the timeline built.
- **Next and Previous:** seek in the timeline to the next song's start (prepared at once if needed). Previous restarts the current song when more than 3 s in, otherwise goes to the previous song in play order (`previousSongAction`, pure).
  - A seek skips the crossfade (the decks jump to 1 and 0).
- **Shuffle:**
  - `shuffleOrder(n, current, rng)`: no repeats until every entry has played, then reshuffled.
  - Switched on mid-playlist, the current song stays first.
- **Repeat:**
  - Playlist: wraps with a crossfade.
  - One song: the song crossfades into itself.
  - Off: stops after the last song, paused, showing "Playlist finished · Play again".
- **Missing songs** are skipped.
- **Tempo** applies to the whole listening session and resets on leave.
- **Leave:** Esc (with no panel open), Leave, or any normal song open.
  - Stops; the overlay is dropped; tracking resumes; the Home timer re-arms.
  - The last song is loaded as Full song, parked at the bar it was in (**Q10**).
  - A reload never resumes listening.

### 3.3 Engine

- **Seam line:** the 9.2 `LoopLines` renderer, at the next segment's start, with "Title · Composer" along it near the left edge (a small canvas texture). It shows in every HUD mode.
- **Crossfade band:** a faint tint between the seam and the ending song's end, using the loop-dim mechanism (a tick range uniform plus a tint).
  - Ending-song notes dim with that deck's gain (a per-segment uniform; notes carry their segment).
- **Effects** come from the merged song's onsets, so both songs get them during the overlap.
- **Look across the seam** (**Q7**):
  - **Eased** over max(crossfade, 0.5 s): camera (tilt, distance, pan), look-ahead, every colour, opacities, glows, bloom strength, vignette and the dim strengths. These are uniforms or cheap settings, interpolated per frame into an "eased settings" snapshot.
  - **Switched at the midpoint:** discrete settings (fills, styles, toggles, palettes) and the keyboard geometry (rebuilding it per frame is too costly).
  - Under reduced motion everything switches at the midpoint.
- **Draw calls** during an overlap vs one song, at Off and Medium, go in the report. The two segments share the same layers (one merged song), so I expect roughly the same counts plus the seam and band.

## 4. HUD and menu (board `QGListen`)

- **Show:**
  - The normal left column, with "⟨playlist⟩ · song N of M" (teal, headphone icon) above the title and "Up next · ⟨title · composer surname⟩" under bar:beat.
  - The right column: bpm, "100% · full song" (the tempo % in primary when not 100), time, the transport (previous / play-pause / next **song**), then "shuffle on|off" and "repeat playlist|one song|off" state labels.
  - No loop row.
- **Minimal:** title and composer, top left.
- **Hidden:** nothing, timeline included.
- **In Minimal and Hidden,** a compact transport at the bottom right follows idle-hide.
- **Menu column:**
  - "Leave listening · Esc" (secondary).
  - Mute (M), #FF9D7A when muted.
  - Playlists, Playfield panel, Settings.
- **Song announcement:** centred: "Now playing · N of M", the title (40 px) and the composer. It fades in when a new song's seam crosses the now line, holds about 3 s, then fades out. Not in Hidden; under reduced motion it shows and hides without a fade.
- **Sidebar while listening:**
  - The line "Changes here last until you leave listening".
  - The look picker offers "Save as new look…" and "Update playlist look" (when the look came from the playlist).

## 5. B. Playlists tab, E. Welcome (boards `QGPlaylists`, `QGWelcomePlaylists`)

- **Playlists tab:** a third tab (Library | Bookmarks | Playlists).
  - **Left column:** playlists with name, "N songs · length" and the look swatch with "Look: ⟨name⟩". The footer reads "Listening isn't practice: nothing is logged while a playlist plays."
  - **Editor toolbar:** Play, Shuffle, Repeat, Look, Export, ⋯ (Rename, Duplicate, Export all, Delete with Undo).
  - **Header meta:** "N songs · length · crossfade X s".
  - **Rows:** drag handle, #, song, length, per-song look picker, remove with Undo.
    - The first option in the look picker is "Playlist look (⟨name⟩)".
    - Alt+↑/↓ moves the focused row, with an aria-live announcement.
  - **Add songs panel:** search the library; "+" adds; "✓" marks songs already in (clicking it adds the song again, with an "Added again · Undo" toast).
  - **Empty states:** as in the spec. List keys as in Library and Bookmarks.
  - **"Add to playlist…"** in the Library's song actions and the song picker.
- **Welcome "Listen" card:** under "Last 12 weeks". Up to 3 playlists, the most recently played first, then the newest. Each has a play button, and the card has an "All playlists" link. **Hidden** when the profile has none (**Q8**).

## 6. Settings and commands

| Setting                       | Home                                            | Default                       |
| ----------------------------- | ----------------------------------------------- | ----------------------------- |
| Listening HUD                 | Settings → Appearance (new "Listening" section) | Show / Minimal / Hidden: Show |
| Crossfade between songs       | Settings → Audio → Playback (new section)       | 2 s (0–8, step 0.5)           |
| Playlist seam line (look key) | Sidebar → Loop, group "Playlist seam" (**Q4**)  | on                            |
| Seam colour (look key)        | same                                            | Secondary (loop-line palette) |

Commands, scope `listening` (cheat sheet section "Listening"):

| Command             | Keys                                                          |
| ------------------- | ------------------------------------------------------------- |
| Play/pause          | Space (shared with the player's binding)                      |
| Next song           | → and N                                                       |
| Previous song       | ← and Shift+N                                                 |
| Mute                | M (the metronome's key; the metronome is off while listening) |
| Cycle listening HUD | D                                                             |
| Leave listening     | Esc (closes an open panel first)                              |

Tempo − / + / 0 keep their player keys while listening (**Q6**).

## 7. Build order

1. **A:** data, Dexie v8, file format, backup.
2. **The timeline core:** `songStartTimes`, `buildTimeline`, shuffle, repeat, previous; `Transport.replaceSong`; decks in the output.
3. **C:** listening session and HUD, crossfade 0 first (back to back, 1 s gap).
4. **D:** overlap, gains, seam, band, look easing.
5. **B:** Playlists tab.
6. **E:** Welcome card.

Same as the spec's order, with the timeline core split out first, because C and D both stand on it.

## 8. Tests and sheets

- **Unit:**
  - The playlist model and the Dexie migration.
  - File and backup import (missing songs and looks).
  - `songStartTimes` and `buildTimeline`, including tempo and meter joins and the 0 s gap.
  - Shuffle, repeat and the previous-song rule.
  - Equal-power gains.
  - Tracking stays suspended for the whole of listening.
- **E2e (`@playlists`, run through `test:e2e:affected`):**
  - Create, edit, reorder, per-song look.
  - Export → import round trip.
  - Play, next and previous; Esc leaves and restores the look.
  - No plays or sessions recorded.
  - The Welcome card plays.
- **Sheets** (visual project, run once when the milestone is ready for review):
  - Seam and band at 25°, 35° and 85°; crossfade 0, 2 and 8 s; quality Off and Medium.
  - The three HUD modes.
  - A look change across the seam (before, mid-ease, after).

## 9. Questions

1. **Architecture (P1):** a rolling merged timeline (the current and next song as one song placed in time, replayed by the existing transport, scheduler and engine) instead of two independent players. It's much less new timing code, and tempo and meter joins come for free. OK?
2. **Highway speed across the seam:** the highway stays beat-based, as within a song. Where the next song has a different tempo, notes beyond the seam scroll at its tempo's beat spacing, exactly like a tempo change inside one song. OK, or do you want a time-based highway while listening?
3. **Bar numbers while listening:** song-local ("bar 1 : 1" when the next song starts), not continuous across songs. OK?
4. **Seam settings home:** the two look keys in the sidebar's Loop section, group "Playlist seam"? Or a new sidebar section "Playlist"?
5. **Crossfade setting home:** Settings → Audio, in a new "Playback" section. OK?
6. **Keys:** Next → / N, Previous ← / Shift+N, Mute M, Cycle HUD D, Leave Esc, Play/pause Space. Tempo −/+/0 stay active while listening; bar, loop and bookmark keys are off. OK?
7. **Look easing:** ease the camera, look-ahead, colours, opacities, glows, bloom and vignette; switch fills, styles, toggles, palettes and the keyboard geometry at the midpoint. Is that reduced set OK?
8. **Welcome card:** hidden when the profile has no playlists (the spec's preference)?
9. **Playlist export and looks:** the file carries the referenced saved looks. On import, offer "Import its looks too" as a checkbox in the import toast/dialog, default on? Or always import them silently?
10. **Leaving listening:** the last song is loaded as Full song, parked at the bar where listening stopped (song-local). Or at bar 1?
11. **Board vs spec:**
    - **Show HUD tempo:** the board always shows "100% · full song" and the bpm; the spec says a small tempo % only when not 100. I'd follow the board (always shown, % in primary when not 100). OK?
    - **"Up next":** use the surname only, as the board does ("Für Elise · Beethoven")?
12. **Mute:** session-only (it resets on leave, separate from the master volume)?
