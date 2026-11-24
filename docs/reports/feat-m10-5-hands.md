# Milestone 10.5 report: Hand detection and split

## Round 0 — 2026-11-24: plan

**Done**

- Committed the spec and mockups.
- Wrote `docs/milestones/m10-5-plan.md`. No code changed.

**How the plan was checked**

- Read the reference code at `6caa9ec` and ran it, outside the repo: detection on the 3 bundled songs and 7 fixtures; the four algorithms on the 3 songs with both hands merged to one voice; the look-ahead's runtime and uncertainty also on `long-demo`. Timings are Node on this machine, not a browser or tablet.
- `npm run check` and e2e not run: documentation only.

**Decisions not in the instructions**

- Proposals only, all in the plan: two tables instead of one, a Web Worker, notes parsed from raw events with `FACTS_VERSION` 2, a new roll component on the shared geometry.

**Known issues and open questions**

- Four design questions (plan §8, Q1–Q4): per profile or per song; the "uncertain" rule; notes detection would silence; single voices.
- The brief (`docs/brief.md`) will need updates to decisions 1, 6, 30–32, 35, 37, 75 and 127.

**Review**

- [ ] Answer Q1–Q4.
- [ ] Object to any default in Q5–Q10.
- [ ] Approve the plan.

## Round 1 — 2026-11-24: steps 1–6 (detection and the Library section)

**Built**

- `core/midi` (event-level reader and writer) and `core/hands` (extraction, voices, detection, four methods, resolve, cache hash, apply). Compared with the reference code at `6caa9ec` on the 3 bundled songs and `long-demo`: same notes, stats, guesses and hands, all four methods (default parameters, 120 bpm).
- Notes come from raw events with stable ids; `FACTS_VERSION` 2. Bundled facts changed in version number only.
- Dexie v9 (`handDetections`), profile rows with voice roles, conversion of old channel maps, backup 1.5, settings v10.
- `handOf` everywhere in plan §1. Detection and splits run in a worker. Upload detection, background pass, toast.
- Library: Hands section, row hint. Brief decision 128.

**Decisions not in the instructions**

1. A song's last 8 chords are never marked uncertain: no beam exists 8 chords after them, and a younger one marks even clean endings.
2. A song with no detected hand takes the lowest confidence of its shown voices; none if nothing is shown.
3. A database created by this version gets no toast for the bundled songs.
4. A song that isn't detected shows "Not detected" and a "Detect hands" button (otherwise "Detect hands on upload" off would be a dead end).
5. The pass also detects songs with the player's own hands, for the reasons only. They aren't counted in the toast.
6. Returning to the player reloads a song only when a note's hand actually changed.
7. The toast, percent and role texts follow the spec; instrument names are the General MIDI list.

**Checks**

- `npm run check`: exit 0, 896 unit tests (124 files). `npm run build`: pass. `songs:manifest:check`: up to date.
- `npm run test:e2e:affected`: 133 passed after step 2; **162 passed, 0 failed** after step 6 (chromium and polish, 11 tags), including 5 new `@hands` tests.
- **Not run as asked:** e2e after _every_ step. Step 1 wasn't wired to anything; steps 3–6 were built together, because the new types don't compile without the new Library section, and tested together. Commit `8a6429d` doesn't type-check by itself for the same reason.
- Seen on screen: details section (Detected · 95 %, split bar, Why) and the amber row hint, 1280×720.

**Known issues and open points**

- **Song-load time (criterion 6) is not measured.** The comparison against `main` was denied in the session, so I left it. Load now reads the file twice (tonejs for tempo and meter, raw events for notes); no split runs on load for a cached song.
- A song opened in the moment before its detection finishes plays with the channel map until it is next opened.
- "Review hands…" and "Export split…" are left out until steps 7 and 8. Until then an edited song can't go back to its detected roles in one click.
- Unreleased notes: no bundled song or fixture has one, so no drone was seen. Not tried on other real files.
- Detection was tried on the bundled songs, the fixtures and synthetic files only; the benchmark is step 9.

**Review**

- [ ] Upload real files with both hands on one channel: badge, reasons, colours, cages, mute and solo.
- [ ] Songs whose hands you had changed: same as before, shown as "Edited".
- [ ] Change a role; reload; switch profile.
- [ ] On your existing library: the background toast, once.
- [ ] Settings → Library & data → Hand detection.
- [ ] Listen for droning notes.

## Round 2 — 2026-11-24: load time and recovered files (stopped before step 7)

Round 1 approved. No code changed in this round.

**Song load, `main` against this branch**

Node on this machine; parse plus hand assignment, median of 5 runs after a warm-up, three separate processes. Hashing the file, IndexedDB and drawing are not included.

| Song        | `main` (ms)        | branch (ms)        | Change            |
| ----------- | ------------------ | ------------------ | ----------------- |
| Minuet      | 0.4 / 0.4 / 0.3    | 0.4 / 0.6 / 0.6    | +14 / +44 / +83 % |
| Invention 1 | 0.5 / 0.7 / 0.5    | 0.7 / 0.7 / 0.8    | +29 / +5 / +43 %  |
| Canon in D  | 1.2 / 1.2 / 1.1    | 1.6 / 1.7 / 1.6    | +29 / +44 / +40 % |
| `long-demo` | 74.2 / 75.2 / 71.9 | 79.2 / 78.3 / 78.3 | +7 / +4 / +9 %    |

- **Over the 20 % limit on Canon in every process** (about 0.4–0.5 ms), and on the other two bundled songs in two of three, where the values are too small to be steady. `long-demo` is within it. So work stopped here.
- The notes are identical to `main`'s on all four songs.
- Reading the raw events and notes takes 0.2 ms on Canon and 1.4–3.4 ms on `long-demo`. The rest of the increase wasn't broken down.
- Proposal: read tempo and meter from the raw events too and drop @tonejs/midi from `parseMidi`, so the file's notes aren't built twice. Not built or measured.

**Files recovered from the transcript**

22 source files, in two batches, plus one scratch script. Each was compared as typed (formatted) with HEAD.

- Unchanged since: `core/midi/` `MidiEvent`, `MidiFile`, `readMidiFile`, `writeMidiFile`; `core/hands/` `HandLetter`, `voiceId`, `extractNotes`, `VoiceStats`, `computeVoiceStats`, `HandDetection`, `VoiceInfo`, `CachedHands`, `DetectedHands`, `SongHands`, `summariseHands`, `resolveSongHands`, `assignmentHandOf`, `sameChannelHands`.
- Changed on purpose afterwards: `RawNote` (id and track moved to `Note`), `detectHands` (shared `MIN_VOICE_NOTES`), `detectSongHands` (computes the channels itself), `library/ProfileHandAssignment` (split into `PlayerHands` and `ChannelHands`).
- The script (`s3.mjs`, not in the repo) made or edited files in `core/song`, `core/library`, `core/hands`, `core/testing`, `data` and `SongPicker.vue`. All its edits applied. It overwrote `ChannelInfo.ts` through `channelInfo.ts` (same name on Windows); that file is identical to `main`'s again, and no duplicate is tracked.

Found:

- No file is missing, and no duplicate from the recovery.
- `applyHandAssignment` and `writeMidiFile` have no user outside tests yet: they are step 8's. Every other export that only its own file uses is a type or constant.
- `detectSongHands` reads the file, then `resolveSongHands` reads it again (in the worker). Wasteful, not wrong.
- `summariseHands` and `summariseHandNotes` look alike but both are needed: resolved notes, and the channel map before detection.
- Stale comments: `channelHandOf.ts` ("the Library's Right / Left / Hidden per channel") and `PracticeConfig.ts` ("Hand-channel assignments").

**Open question**

- [ ] Accept the load time, or make the proposal's change first?

## Round 3 — 2026-11-24: Review page and export (steps 7 and 8)

**Built**

- Load time accepted; roadmap item "Parse MIDI once". Stale comments fixed, detection reads the file once, `s3.mjs` deleted.
- **Review hands** (`#/hands/⟨song⟩`): voices, method, Advanced, result, two lanes on one time axis, flips, compare, uncertain stripes, Save, Reset to detected, the Discard question.
- **Export split:** dialog (Library details and the new Export menu), warnings, "⟨Title⟩ (hands).mid". Runs in the worker.

**Decisions not in the instructions**

1. Save is available without changes: accepting the detection makes the hands the player's and clears the hint.
2. Reset to detected detects first a song that never was. That stores the detection, not the player's hands.
3. Changing the method drops the old method's parameters; flips stay.
4. Compare uses the other method's default parameters, against the hands with flips. The first view is 8 bars.
5. Leaving waits for a running save. A reload or closed tab doesn't ask about unsaved changes.
6. Home doesn't open by itself over this page.
7. Export uses the saved hands.
8. A test hook for the computed cages (`?stats=1` only).

**Fixed while testing**

- Esc in the Discard question closed it and asked again.
- Esc right after Save asked about changes being saved.

**Checks**

- `npm run check`: exit 0, 905 unit tests (125 files). `npm run build`: pass.
- `npm run test:e2e:affected` (chromium and polish): **180 passed, 1 failed**; the 12 `@hands` tests pass. Run once, after step 8, for both steps.
  - Failed: `playlists.spec.ts` "make a playlist…" (`@smoke`). **A real bug from step 5**, not a flake: the playlist name field put the stored name back on every re-render, and the background pass re-renders the page after each song, so a half-typed name was lost. Confirmed with the pass held back: 0 of 12 failed, against 6 of 12 without. The run after step 6 had passed by chance.
  - Fixed: the field keeps a draft. New test "a name being typed survives a library refresh", which failed on the old build. Both tests pass 8 of 8; `playlists`, `hands` and `reviewHands` specs: 20 passed. The whole affected set was not run again (testing policy).
  - The other `:value`-bound text fields don't depend on the library list; the song details keep their own drafts.
- Seen on screen: Review page at 1280×720 and 1024×768, Hands section and export dialog at 1280×720. Afterwards three small layout fixes (name wrap, method text, zoom buttons together), not looked at again.

**Known issues**

- The Review page has no touch pinch zoom (drag pans, buttons zoom); not tried on a tablet or with a screen reader.
- Not tried on real uploads. Step 9 (benchmark, remaining docs) is open.

**Review**

- [ ] Review a real one-channel song: flips, uncertain stripes, compare, Advanced.
- [ ] Keyboard only: Tab to the lane, arrows, Enter, Save, Esc.
- [ ] Open an exported file in another program, both layouts.
- [ ] Reset to detected on an edited song.
