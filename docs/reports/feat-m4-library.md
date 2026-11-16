# Review report — `feat/m4-library` (Milestone 4: library, uploads, song details, backup)

Plan: `docs/milestones/m4.md`. Nothing on this branch is committed yet beyond the plan commit;
this report is committed with the work.

---

## 2026-11-16 — Round 1: milestone 4 built

Summarised after the fact (the reporting rule was added in round 2); details were in the review
reply.

### What was done

- **Brief:** Milestone 4 line, SongMeta / StoredUpload in the data model, decisions 26–34 from
  m4, plus proposed 35–38 (delete cascades, upload title rule, export excludes hands, playback
  survives navigation).
- **Bundled songs:** the three real songs moved to `public/songs/`; `npm run songs:manifest`
  (`scripts/build-song-manifest.mjs`) writes `manifest.json` using the app's own TS modules;
  a unit test fails when the manifest is stale.
- **Pure logic (`src/core/library/`, `src/core/hands/defaultHands.ts`):** song facts, manifest
  update, metadata merge, tag normalisation, search/sort/group/filter, upload validation, zip
  archive build/read, import planning. `importMidi` gained per-channel pitch stats and the
  decision-36 title rule (raw scanner extracted to `scanChannelEvents.ts`).
- **Data layer (`src/data/`):** Dexie database (schema v1, five tables) and the `Library` service.
- **UI:** Library page (`#/library`) with details panel, tag editor and meter-override editor;
  player opens the last song via the library and shows bar count and hand channels; one shared
  `PlaybackSession`; debug page lists library songs plus the pedal demo.
- **Web app:** `manifest.webmanifest`, Apple meta tags, icons from `scripts/make-icons.mjs`.

### Results

- `npm run check`: pass, 231 unit tests. `npm run build`: pass (main chunk 865 kB, warning).
- `npm run test:e2e`: 12/12 on the dev server and on the `CI=1` preview build.
- `npm run test:visual`: 12/12.

---

## 2026-11-16 — Round 2: fix for DataCloneError on "Swap hands"

### Problem

Clicking **Swap hands** in the song details panel logged
`Uncaught (in promise) DexieError → DataCloneError: Failed to execute 'put' on 'IDBObjectStore'`.
The hand assignment lived in a deep `ref`, so the swapped assignment was built from reactive
proxy arrays; IndexedDB's structured clone rejects proxies. The swap was shown but not stored.

### What changed

| Area             | Files                                                                                          | Change                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data boundary    | `src/data/toPlainData.ts` (new), `src/data/PianoMeisterDb.ts`                                  | Dexie DBCore middleware converts every `put`/`add` value on every table (incl. `bulkPut`, `update`) to plain data, unwrapping proxies.                                                                    |
| Store            | `src/ui/stores/libraryStore.ts`                                                                | Edit actions (metadata, reset, hands, restore default, meter override, delete, last song) catch failures, `console.error` them, keep a message in `store.error`, and return `true`/`false`.               |
| Details panel    | `src/ui/components/SongDetailsPanel.vue`                                                       | Hands held in a `shallowRef` of plain data; hand changes are shown only after they're stored; a failed per-channel change re-renders the select from the stored value; error shown with a dismiss button. |
| Library / player | `src/ui/views/LibraryView.vue`, `src/ui/views/PlayerView.vue`                                  | Show store write errors; Library action errors are also logged; Play stays on the Library if the last song couldn't be saved.                                                                             |
| Tests            | `src/data/PianoMeisterDb.spec.ts`, `src/data/toPlainData.spec.ts` (new), `e2e/library.spec.ts` | See results.                                                                                                                                                                                              |
| Docs             | `CLAUDE.md`                                                                                    | Added the Reports section.                                                                                                                                                                                |

### Decisions not in the instructions

- **Middleware, not per-call copies:** the conversion sits in the Dexie database itself so every
  table and write path is covered, and `src/data` doesn't import Vue (the helper reads through
  properties, which unwraps any proxy).
- **Hands update after the save, not optimistically.** The new e2e test exposed a second bug: the
  panel showed a change before the IndexedDB write committed, so a quick reload lost it (seen on
  the preview build). Waiting costs a few milliseconds and the panel never shows unsaved state.
- **Edit actions don't throw.** Fire-and-forget UI handlers get a boolean instead, so nothing
  ends up as an unhandled rejection. Upload/import/export still throw; the Library page catches,
  shows and logs those.
- **Errors stay until dismissed or the next successful edit.**
- **Report path:** the branch name contains a slash, so this file is
  `docs/reports/feat/m4-library.md` (the branch name taken literally). Changed in round 3 to the
  flat name `docs/reports/feat-m4-library.md`.

### Results

- `npm run check`: **pass** — type-check, lint (0 warnings), 236 unit tests in 36 files.
- `npm run build`: **pass** — main chunk 866 kB (same size warning as round 1).
- `npm run test:e2e`: **14/14** on the dev server and **14/14** on the `CI=1` preview build
  (no retries). Library e2e repeated 5× each: **40/40**.
- Reproduced first: the new unit tests failed with `DataCloneError` before the fix. With the fix
  temporarily reverted, the new swap e2e test failed with the same error and passed again once
  restored.
- New tests:
  - Unit: reactive objects written directly into all five tables, and through every `Library`
    write path (swap pattern, per-channel, restore default, metadata + tags, meter override,
    upload).
  - e2e: swap → reload, per-channel Hidden → reload, Restore default → reload, all persisted;
    player HUD shows `R – · L ch0`; no console errors and no error message.
  - e2e: simulated IndexedDB write failure → error shown and logged for a swap and a per-channel
    change, selects stay at the stored values, error can be dismissed.

### Known issues and open questions

- Main bundle is 866 kB (Three.js + Dexie); Vite warns about chunk size. Not addressed.
- Not tested on Safari / iPad (persistent storage, home-screen install).
- Metadata fields (title/composer) are still saved on change without waiting; a failure shows the
  error but the typed text stays in the field until the panel is reopened. Fixed in round 3.
- The milestone doc is named `md4.md` (others are `m1.md`–`m3.md`); rename? Done in round 3.

### Manual review checklist

- [ ] In the Library, open a song → **Swap hands** → reload → reopen: the swap is still there; no
      console errors.
- [ ] Set a channel to **Hidden** → reload → still hidden; Play shows it in the HUD hands line.
- [ ] **Restore default** → reload → channel 0 Right, channel 1 Left; the button is disabled.
- [ ] Edit title, tags and meter override; reload; all kept.
- [ ] Optional: in DevTools, run
      `IDBObjectStore.prototype.put = () => { throw new DOMException('test', 'QuotaExceededError') }`,
      then swap hands: a red "Couldn't save the hand channels" message appears, the console shows
      the error, and the selects don't change. Reload to restore.

---

## 2026-11-16 — Round 3: review follow-ups

Round 2 was approved with four follow-ups, all done.

### What changed

| Area | Files | Change |
| --- | --- | --- |
| Milestone doc | `docs/milestones/md4.md` → `docs/milestones/m4.md` | Renamed; the report's references updated (nothing else referred to it). |
| Reports rule | `CLAUDE.md`, this file | Flat report names: `/` in the branch name becomes `-`. This report moved from `docs/reports/feat/m4-library.md`; the empty `feat/` folder is gone. |
| Title and composer | `src/ui/components/SongDetailsPanel.vue` | Saved on blur or Enter (Enter blurs the field), one field at a time. The panel waits for the write, then shows the stored value: the trimmed value on success, the previous value on failure (with the error shown). Tags save the same way; their chips always show the stored tags. |
| Player startup | `src/ui/views/PlayerView.vue` | The player now opens the song (manifest, MIDI file, IndexedDB) **before** creating the playback session, which starts the sample downloads. See below. |
| Tests | `e2e/library.spec.ts` | New: failed title (Tab) and composer (Enter) saves show the error, restore the fields, log twice, and nothing is stored after a reload. The edit test now saves the composer with Enter and checks trimming. |

### Decisions not in the instructions

- **Each text field saves alone.** The other fields are sent with their stored values, so saving
  the title never carries along unsaved text from the composer field, and a failure only resets
  the field that was saved.
- **Player startup order (bug found while running the e2e suite repeatedly).** On a first visit
  the session started ~230 sample downloads before the song's manifest and MIDI requests, which
  then queued behind them; under parallel test load the title stayed empty for over 5 s
  ("player reopens the last song" failed 5 of 8 repeats). A slow connection would see the same
  empty player. Opening the song first fixed it (8/8, and the full suite 3× with no retries);
  samples start a few milliseconds later.

### Results

- `npm run check`: **pass** — type-check, lint (0 warnings), 236 unit tests in 36 files.
- `npm run build`: **pass** — main chunk 866.5 kB (size warning, see known issues).
- `npm run test:e2e`: **15/15** on the dev server and **15/15** on the `CI=1` preview build
  (no retries). Full suite repeated 3× with no retries: **45/45**; library suite 5×: **45/45**.
- `npm run test:visual`: **12/12**; the pedal-demo shot now shows the song while samples are
  still loading (106/226), as intended.

### Known issues and open questions

- **Bundle size, deferred to milestone 6:** the main chunk is 866 kB (Three.js + Dexie), and Vite
  warns about chunks over 500 kB. The Library page and the zip code are already lazy chunks.
- Not tested on Safari / iPad (persistent storage, home-screen install).
- The debug page still creates the session as soon as it opens; it's a developer tool, so it
  wasn't reordered.

### Manual review checklist

- [ ] Library → open a song → change the title, press **Enter** → the row updates; reload → kept.
- [ ] Type a composer with spaces around it and Tab away → the field shows the trimmed value.
- [ ] Optional failure check: in DevTools run
      `IDBObjectStore.prototype.put = () => { throw new DOMException('test', 'QuotaExceededError') }`,
      edit the title and press Enter → "Couldn't save the song details" appears and the field
      returns to the stored title. Reload to restore.
- [ ] Hard-reload the player with the network throttled (DevTools → Slow 4G): the song title and
      highway appear before the samples finish loading.
