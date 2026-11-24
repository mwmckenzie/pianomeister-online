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
- **Not run as asked:** e2e after *every* step. Step 1 wasn't wired to anything; steps 3–6 were built together, because the new types don't compile without the new Library section, and tested together. Commit `8a6429d` doesn't type-check by itself for the same reason.
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
