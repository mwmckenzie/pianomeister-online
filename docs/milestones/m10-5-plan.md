# Milestone 10.5 plan: Hand detection and split

Spec: `docs/milestones/m10-5.md`. Behaviour: `docs/milestones/m10-5-hand-detection-brief.md` ("the HD brief"). Mockups: `docs/design/m10-5/source/`. Branch `feat/m10-5-hands` from `main` (#28 merged).

**Status:** waiting for approval. Nothing is built. §8 has the questions. Q1–Q4 change the design; the others have a default I'll take unless you say otherwise.

**Reference code:** read at `6caa9ec`, so I can port it; the pseudocode is the cross-check. The repo has no licence file; I assume it's yours to port from.

## 1. `handOf` audit

| #   | Where                                                                                      | Reads today                    | Change                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `core/hands/channelHandOf.ts`, used by `PlaybackSession.prepare`                           | channel → hand                 | `assignmentHandOf(resolved)`: flip, else voice role, else algorithm (for Split). `channelHandOf` stays only for row 10 and songs not yet converted (§3).   |
| 2   | `PlaybackSession.prepare`: `pedalIntervals.filter(assigned.has(channel))`                  | **hand channels**              | Keep a pedal span if its channel has at least one note that isn't Hidden. `applySustain` stays per channel: the pedal is a sound matter, not a hand.       |
| 3   | `PlaybackSession.prepare` / `load` options, default `DEFAULT_HAND_ASSIGNMENT`              | channel map                    | Takes a `HandOf`.                                                                                                                                          |
| 4   | `PlayerView.vue:341` song key                                                              | `JSON.stringify(opened.hands)` | The resolved-hands hash.                                                                                                                                   |
| 5   | `PlayerView.vue:215` `handsLabel` (`hud-hands`, screen-reader text)                        | "R ch0 · L ch1"                | "R 236 notes · L 176 notes".                                                                                                                               |
| 6   | `core/hands/defaultHands.ts`: `Library.openSong`, `buildEntries`, `SongDetailsPanel`       | channel map                    | Only used for migration and as a fallback (§3).                                                                                                            |
| 7   | `core/hands/summariseHandNotes.ts`: `SongPicker.vue:157` (notes per hand, range)           | channel facts + channel map    | Counts and range come from the resolved assignment, stored in its record. Before detection, as today.                                                      |
| 8   | `SongDetailsPanel.vue` (pickers, Swap hands, Restore default)                              | channel map                    | Replaced by the new Hands section.                                                                                                                         |
| 9   | `LibraryEntry.hands`, `OpenedSong.hands`, `Library.setHands/resetHands`, `libraryStore`    | channel map                    | Roles, confidence, source and counts.                                                                                                                      |
| 10  | `DebugView.vue` channel inputs                                                             | channel map                    | Stays channel-based: an unlinked developer tool that deliberately ignores stored hands. It passes `channelHandOf(...)` as its `HandOf`. The one exception. |
| 11  | Backup: `ProfileHandAssignment`, `readPracticeData`, `planBackupMerge`, `makePracticeData` | channel map per profile        | New rows (§4).                                                                                                                                             |
| 12  | `ListeningController.prepare`                                                              | passes `opened.hands`          | Passes the `HandOf`. A Library change while listening still applies from the next song (decision 127).                                                     |

- **Already per note, no change:** cages (`computeHandCages`), highway and effects (`HandNote.hand`), the loop editor's hands toggle, the overview strip and minimap, `buildTimeline` (copies notes), the transport and scheduler.
- **Stats don't read note hands:** records and bookmarks hold only the mute/solo modes.
- **There is no MIDI output yet**, so nothing to convert there.

### Note ids

`Note` has no id or track. `parseMidi` uses @tonejs/midi, which re-splits tracks by (program, channel) and loses event indexes, so a brief id can't be recovered from it.

- `scanChannelEvents` gains the event's index, counting **all** events of the track (meta and sysex too), as the reference does.
- `core/hands/extractNotes.ts` builds the notes from it, and `parseMidi` takes its notes from there (tonejs stays for tempo and meter). `Note` gains `id` and `track`.
- Two visible effects: notes never released now sound to the track's end (tonejs dropped them), and the "program change drops a note" quirk is gone. Zero-length notes are still not played.
- Note counts in stored facts can change for such files, so `FACTS_VERSION` goes to 2 with a manifest rebuild.
- Measured: the 3 bundled songs and 7 fixtures have no unreleased and no zero-length notes.

## 2. Mute and solo per note

Playback **already** routes by each note's hand: `HandNote.hand` → `ScheduledNote.hand` → `SmplrOutput.playNote` picks the right or left instrument, and mute/solo is a gain on that hand's bus. No channel is read after `assignHands`.

So no audio code changes: once `handOf` is per note, mute and solo are too. I'll add a scheduler test with two notes on one channel in different hands, checking that each carries its own hand to the output.

## 3. The default-map rule, and migration

**The rule** is `defaultHands(channels)` (`src/core/hands/defaultHands.ts`, brief decision 30):

- If channel 0 or 1 has notes: right = [0], left = [1], other channels Hidden.
- Otherwise by average pitch: highest → right, next → left, rest Hidden.

**Upload stores nothing.** The default is computed on open. A `handAssignments` row exists only after the player changes something, and Restore default deletes it. So:

- **No row** → default: queue for detection.
- **A row equal to the default on every channel that has notes** → default: queue. This is the spec's "still exactly the default", e.g. changed and then changed back by hand.
- **Any other row** → the player's: converted to voice roles, `source: 'user'`.

**Conversion can't happen inside the Dexie upgrade.** Voices need the MIDI file, and bundled files need a fetch. So the upgrade leaves old rows as they are, read as the player's channel map until the song is opened or the background pass reaches it. Then one transaction replaces the old row with voice roles. A crash or an offline start loses nothing, and no row is open to detection in between.

**Until detected,** a song uses the default map's hands, exactly as today.

## 4. Storage and versions

**Conflict (Q1).** The spec keys `handAssignments` by `songId`. That table exists (since v1), keyed `[profileId+songId]`, because brief decision 6 makes hands per profile. Two profiles with different hands for a song can't both survive in a single row, which breaks acceptance criterion 2. Dexie also can't change a primary key in place.

**Proposal:** two tables.

- **`handDetections`**, key `songId` (shared, derived): guesses, summary, confidence, detected roles, algorithm and params, resolved string and hash, counts and range, `detectorVersion`.
- **`handAssignments`**, key stays `[profileId+songId]`: the player's roles, algorithm, params, flips, confidence, resolved string and hash, counts and range. **A row here is what `source: 'user'` means** (except an unconverted default row, §3).
- Effective hands = the profile's row, else the detection, else the default.

Detection then never writes the player's settings, so "detection never touches it" holds by construction. Profile deletion, upload deletion and backup merging keep their rules.

| What              | Now | Becomes                                                |
| ----------------- | --- | ------------------------------------------------------ |
| Dexie             | v8  | **v9** (`handDetections` added; no data moved)         |
| Settings          | v9  | **v10** (three new keys with defaults; not look keys)  |
| Backup            | 1.4 | **1.5** (new row shape; old rows still read, as in §3) |
| `FACTS_VERSION`   | 1   | **2** (§1)                                             |
| `detectorVersion` | –   | **1**                                                  |

- **Resolved cache:** one char per note in `extractNotes` order. Its hash covers algorithm, params, roles and flips, plus `detectorVersion`, so a fixed algorithm invalidates it too.
- **Backups** hold the player's rows; detections are recomputed after an import.
- **Settings home:** "Library & data" isn't a settings tab today (no registry keys). It becomes one, with a "Hand detection" section above its current content.
- **Colour token:** `--warning` is used once (with a fallback) but never defined. I'll define it as `#E9C07A`.

## 5. Detection: where it runs

Measured with the reference code in Node on this machine:

| Song        | Notes  | Phrase look-ahead |
| ----------- | ------ | ----------------- |
| Minuet      | 408    | 34–35 ms          |
| Invention 1 | 572    | 45–49 ms          |
| Canon in D  | 1,589  | 120–127 ms        |
| `long-demo` | 12,688 | 857 ms            |

I expect a tablet to be slower, and the Advanced sliders re-run it. So detection and splitting run in a **Web Worker** (`ui/hands/handsWorker.ts`, like `tickerWorker`) around pure `core/hands` code, for uploads, the background pass and the Review page. The song is added first and its hands arrive right after; the list row updates then.

Background pass: as the spec, one song at a time, paused while playing. It checks for a player row again just before writing. A song loaded in the player keeps its hands until it's next loaded.

## 6. Piano-roll reuse

**`PianoRollCanvas.vue`: no. Its geometry: yes.**

- Its pointer and key handling is all loops, selections and bar cursors. Its notes are coloured by pitch class, and it has no per-note hit test, outline, stripes or focus. Adding those would put a second mode into a component the player depends on.
- **Reused:** `layoutBars`, `rollScale`, `RollFrame`, `zoomAround`, `clampView`, `notesInView`, `pitchRange`, `labelStep`, `isLabelledBar`, `useElementSize`.
- **New:** `ui/hands/HandRoll.vue` (canvas) for both lanes sharing one `OverviewView`, a scrollbar, `core/hands/noteAt.ts` for hit-testing, and one real focusable button placed over the focused note that carries its accessible name (Q8).
- The zoom limits (4 bars to the whole song) come with the shared geometry.

**Hand colours:** notes have no hand colour; they're coloured by pitch class. The only hand colours in a look are the hand cages', so the Review page and the bar use `handCages.rightColor` / `leftColor`, resolved (Primary, Secondary or Custom).

## 7. Build order

1. `core/hands`: extraction, stats, detection, four algorithms, resolve, hash, apply. HD brief criteria 1–11 as tests. The player still uses the channel map.
2. Parser switch, `FACTS_VERSION` 2, manifest.
3. Dexie v9, conversion, backup 1.5.
4. `handOf` everywhere (§1): cages, pedal, picker, HUD label.
5. Worker, upload, background pass, settings v10.
6. Library details section, hint, `@hands` e2e.
7. Review page.
8. Export dialog and MIDI writer.
9. `bench:hands`; docs (brief decisions 1, 6, 30–32, 35, 37, 75, 127; CLAUDE.md tags and commands; the `e2e-affected` map).

Existing e2e that must change: `library.spec.ts` (hand pickers, swap, restore, `hud-hands`), `cages.spec.ts` (`hand-ch1`), `profiles.spec.ts` (delete text), `visual-review.spec.ts`.

## 8. Questions

### Design

**Q1. Per profile or per song?** Spec: per song. Brief decision 6 and today's data: per profile.

_Recommend:_ §4, detection per song and the player's changes per profile. If you want per song, please say which profile's row wins; the others are lost.

**Q2. "Uncertain" doesn't work as written.** By the end of a song, the hypotheses in the final beam share almost their whole history. Measured, they differ only in the last 8 of 919 chords (Canon), 9 of 456 (Invention) and 6 of 274 (Minuet), so nothing before the last few bars would be striped in those songs.

_Recommend:_ the same 75 % rule, but using the beam as it stood **8 chords after** the note:

| Beam taken                                        | Canon          | Invention       | Minuet          |
| ------------------------------------------------- | -------------- | --------------- | --------------- |
| Final (spec): notes marked                        | 5 notes        | 6 notes         | 5 notes         |
| 4 chords later: notes marked / wrong notes caught | 18 % / 81 %    | 30 % / 46 %     | 31 % / 92 %     |
| **8 chords later**                                | **6 % / 43 %** | **15 % / 33 %** | **17 % / 73 %** |
| 16 chords later                                   | 1 % / 5 %      | 5 % / 11 %      | 2 % / 8 %       |

At 8, 27–39 % of the marked notes really are wrong. These are only three songs (both channels merged, the channels as truth), so it's a pointer, not a calibration.

**Q3. Detection can silence notes that play today.** Anything classed `other` or `drums` becomes Hidden. That includes a file whose voices all have fewer than 8 notes (all silent), and a third track on channel 0 (today: right hand). The background pass would do this to existing songs.

_Recommend:_ such a voice takes the role the default map gives its channel, so detection doesn't hide notes that sound today. A channel 9 voice stays Hidden, except where the default map plays it today.

**Q4. A single voice.**

- (a) A lone keyboard voice that is neither named nor classed `both` always gets 30 % by §5.4, so each such song shows "Check hands · 30 %" at any threshold. _Recommend:_ keep it. It's a guess, and the hint is honest.
- (b) The lone-voice rule also splits a voice **named** "Right hand" (85 %). `black-notes-demo` and `fills-demo` hit this. _Recommend:_ a voice chosen by name keeps its hand, a small deviation from HD brief §7.

### Smaller: the default I'll take

- **Q5. Library "Export menu":** there is none; Export is a button that makes the backup. _Default:_ make it a menu with "Back up library" and "Export split of ⟨song⟩…".
- **Q6. "Swap hands" and "Restore default":** not in the mockup or spec. _Default:_ both go; Reset to detected is on the Review page.
- **Q7. Wording conflicts.** The HD brief's summary sentences (§5.5) come from the reference's `HandsPanel`; its `hands.ts` has different ones. _Default:_ the brief's. The algorithm is "Chord-aware" (brief, spec), not "Chord-aware (note by note)" (code).
- **Q8. Tab through every note** could mean thousands of stops before the next control, and as many buttons. _Default:_ the lane is **one** Tab stop. ← and → move between notes in time order (Home and End for the ends), and Enter or Space flips. This deviates from the spec; if you want Tab itself, only notes in view would be stops.
- **Q9. Export with equal channels, two tracks:** the reference compares channels, so everything lands in "Right Hand". _Default:_ the dialog warns, as specified, and the writer picks the track by hand.
- **Q10. Changing one role in the Library:** _Default:_ the song becomes the player's, with the detection's other roles copied in, so a later detector can't change the rest of it.
