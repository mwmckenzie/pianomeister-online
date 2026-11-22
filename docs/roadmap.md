# PianoMeister Online — Roadmap & Ideas Backlog

Living document. The brief (`docs/brief.md`) records _decided_ scope; this file holds the plan for upcoming milestones and ideas not yet scheduled. When a milestone starts, its items move into `docs/milestones/mN.md` and decisions go into the brief.

## Milestone plan

| #   | Milestone                                    | Contents                                                                                                                                                                                                                                                                                  | Status      |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 0–3 | Setup, core, sound, engine                   | —                                                                                                                                                                                                                                                                                         | ✅ done     |
| 4   | Library                                      | Library page, uploads, song details, backup, web app manifest                                                                                                                                                                                                                             | ✅ done     |
| 5   | **Visual clarity**                           | 3D note heads; lifted black-key-lane notes with contact shadow; black-key lane shading; simple built-in shading; keyboard dimensions + rounded key edges; key edge profile (none / chamfer / rounded); animated keys; velocity-scaled effects; render quality (resolution, anti-aliasing) | ✅ done     |
| 6   | **UI foundation**                            | Design system (tokens + Reka UI components), settings registry with reset to default everywhere; settings in two homes (playfield sidebar + settings window); Quiet player HUD with toolbar and timeline; song picker; restyled Library; animated menus (respect reduced motion)          | ✅ done     |
| 7   | **Profiles, bookmarks, stats**               | (was milestone 5) Built on the new UI, incl. profile and bookmark management screens; bookmark manager page; picker stats and sorting (plays, time, last played, bookmarks); "Full song" tracked as a bookmark                                                                            | ✅ done     |
| 7.5 | **Shortcuts**                                | Settings → Shortcuts tab to rebind every command (press-to-record, conflict warnings, per-command reset, reset all), built on the command registry; later reused for MIDI pedal/foot-switch mapping in milestone 11                                                                       | ✅ done     |
| 7.6 | **Now playing & play tracking**              | The HUD shows exactly what's playing (a matching bookmark, Full song, or the setup itself); plays count starts; song stats include other setups, so editing or deleting bookmarks never changes a song's totals                                                                           | ✅ done     |
| 7.7 | **Welcome & stats** _(design session first)_ | Welcome start screen (greeting, pick up where you left off, highlights, at a glance, suggestions, quick actions); stats page (time ranges, drill-down, charts, records, CSV export)                                                                                                       | ✅ done     |
| 8   | **Section overview & loop editor**           | Horizontal 2D song overview; select A–B bars on it; create bookmarks from a selection                                                                                                                                                                                                     | ✅ done     |
| 9   | **Visual polish**                            | Post-processing (bloom/glow, distance fog, lighting) with quality presets; selectable shader styles for notes, keys and effects                                                                                                                                                           | ✅ done     |
| 9.1 | **Looks v2 & built-in looks**                | Looks cover the whole playfield sidebar (except device cost); rename, export, import, paste, backup; looks stored in Dexie; every slider range trimmed to what makes visual sense; thirteen built-in looks; then the tuning session that locks the defaults for 9 and 9.1                 | in progress |
| 9.5 | **Playlist mode** _(design session first)_   | Full songs back-to-back as background music with the highway as a visualizer: playlists per profile, shuffle/repeat, crossfade, listening-mode UI (show / minimal / hidden); not logged as practice                                                                                       |             |
| 10  | **Hand caging**                              | Per-bar hand-position look-ahead (design session first, using code from the Unity app)                                                                                                                                                                                                    |             |
| 11  | **Tablet, MIDI out, offline**                | (was milestone 6) Touch UI, performance pass, MIDI out, service worker / offline; load piano samples in two passes (middle octaves first) if song/dialog loading still lags on GitHub Pages                                                                                               |             |
| 12  | **Benchmark mode** _(spec first)_            | A built-in, repeatable performance test for any device (PC, laptop, iPad, desktop build): scripted songs and presets, frame/CPU/GPU timings, device info, results screen with export and local history                                                                                    |             |

### Why this order

- **Visual clarity first (5):** the main issue today is separation — notes, lanes and keys blend together. Everything in this milestone is engine + settings work on the keyboard and notes, and it affects every session. A sketch session tunes the defaults before building.
- **UI foundation before profiles (6 → 7):** milestone 7 adds several new screens (profiles, bookmarks, stats). Building the design system and app shell first means those screens are built once, in the final style, instead of being restyled later.
- **Loop editor after bookmarks (7 → 8):** an A–B selection and a bookmark are the same thing in different clothes; the overview is the natural place to create and edit them.
- **Visual polish after the features settle (9, 9.1):** post-processing and shader styles change how everything looks; doing them once the screens and scene are stable avoids re-tuning. Quality presets keep tablets smooth.
- **Hand caging (10)** is exploratory and independent — it can move earlier if it becomes the priority.
- **Tablet pass (11)**, with a quick iPad check at the end of every milestone so problems surface early.
- **Benchmark mode last (12):** it measures the finished app on every device, so it comes after the tablet and performance pass.

## Backlog — idea details

### 3D note heads _(milestone 5)_

- Note heads become raised blocks (same footprint as today's 1/64-note head), with adjustable height and optional rounded edges. Sustains stay flat.
- Needs simple built-in shading (lighter top face, darker sides, highlight on rounded edges) so the 3D shape reads — done in the shaders, not the full lighting of milestone 9.

### Black-key lane notes lifted + contact shadow _(milestone 5)_

- Notes in black-key lanes float slightly higher (default: the black keys' raise height, adjustable), so they meet the raised black key tops exactly at the now line.
- A soft contact shadow under black-lane notes falls onto neighboring white-lane notes, separating them when they sit side by side. Toggle + strength.

### Black-key lane shading _(milestone 5)_

- Black-key lanes on the highway are shaded slightly darker than white-key lanes (piano-roll style), so sharps are recognizable even in empty lanes. Toggle + strength.

### Animated keys _(milestone 5)_

- Keys press down on note-on and return on note-off, pivoting at the back like a real key. Toggle + press depth.

### Velocity-scaled effects _(milestone 5)_

- Now-line sparks and glow scale with note velocity (harder = bigger/brighter). Settings: minimum and maximum size, or a uniform size for all notes.

### Render quality _(milestone 5)_

- Settings: render scale (e.g. 0.5×–2× of device pixel ratio, plus "auto"), anti-aliasing (off / MSAA / FXAA or SMAA), max pixel ratio cap (currently 2).
- Investigate why it looks grainy today (likely pixel-ratio cap, no MSAA on the render target, or thin lines aliasing) and fix the defaults, not just add knobs.
- Show the resulting internal resolution and frame time in the settings so the trade-off is visible.

### Keyboard dimensions & rounded edges _(milestone 5)_

- Settings: black key length (ratio of white), black key height (raise), key thickness (depth of the key bodies), gap between keys.
- Rounded key edges: toggle + radius (uses the same built-in shading as the note heads).
- Gaps must keep lanes and keys aligned: lane positions are derived from the same key layout.
- Defaults stay the grand-piano proportions from decision 20; "Reset to grand piano".

### UI foundation _(milestone 6)_

- Decide: custom components vs. a headless component library (e.g. Reka UI) + own styling. No heavy UI framework.
- Design tokens (colors, type, spacing, radii, motion) matching the dark scene palette.
- App shell: navigation between Player, Library, Settings (and later Profiles/Bookmarks/Stats).
- Tabbed settings pages (Display/Camera, Keyboard, Highway, Notes, Audio, Effects, Data).
- Animated menus, tabs and panel transitions (Vue transitions; respect "reduce motion").
- Replace the player's temporary top-center controls with a designed transport bar.

### 7.5 Shortcuts _(milestone 7.5)_

Settings → **Shortcuts** tab to rebind every command: press-to-record a key, conflict warnings (two commands on one key in the same scope), per-command reset and reset all. Built on the command registry (`src/core/commands/COMMANDS.ts`, brief decision 80), which already holds every command's id, label, default keys and scope. Later reused for MIDI pedal / foot-switch mapping in milestone 11.

### 7.6 Now playing & play tracking _(milestone 7.6)_

The player's now-playing line reflects the current setup live: a matching bookmark (or Full song) shows its name with the bookmark icon, anything else shows the setup itself. A play is a start (load, stop, song end, loop wrap, loop jump). Song stats come from all of a song's records — "other setups" included — and a bookmark or Full song only gets plays and time while the setup matches it exactly. See `docs/milestones/m7-6.md`.

### 7.7 Welcome & stats (design session first)

**Welcome screen** — the default start screen, fun and inviting, showing off what the profile has been up to:

- Greeting by name and time of day ("Good evening, Matt").
- "Pick up where you left off": the last song/bookmark with when it was played and its range bar, and a Resume button that loads it and opens the player.
- Highlights that fade in and out: favourite song (by practice time this month), most practiced bookmark this week/month, longest session, current streak, a tempo milestone ("B section: 70% → 85% this month").
- At a glance: this week's minutes vs last week, days practiced in a row, a small 12-week calendar heatmap.
- Gentle suggestions: a bookmark not practiced in a while, a song never played.
- Quick actions: pick a song, library, switch profile. Backdrop: the softly blurred highway, maybe slowly playing.
- Setting: start on Welcome or go straight to the player.

**Stats page** — everything in one explorable place, for stats lovers:

- Time range filter (week / month / year / all) and drill-down by song and bookmark.
- Charts: daily/weekly minutes, calendar heatmap, practice by weekday and time of day, session length distribution, top songs and bookmarks, tempo progress per bookmark over time, plays (starts) per bookmark and setup, time on other setups per song.
- Records: longest session, longest streak, most plays in a day, total time.
- Export the play log as CSV.

The play log already keeps what these need: each record stores the full setup it was played with — tempo, loop range, hand modes, pre-roll beats and mode, metronome mode — and the bookmark or Full song it matched, or none for other setups (brief decision 70).

Open questions for the design session: how much animation on Welcome, which highlights rotate vs. stay fixed, and whether Welcome replaces the player as the home route.

### Section overview & loop editor _(milestone 8)_

- A horizontal, scrollable 2D view of the whole song (piano-roll style, bars numbered, notes colored by pitch class, hands distinguishable).
- Drag to select bars → sets the A–B loop; current loop and playback position shown live.
- "Save as bookmark" from a selection; bookmarks listed and editable here.
- Possibly zoom levels (whole song ↔ a few bars).

### Post-processing & lighting _(milestone 9)_

- Selective bloom/glow on note heads, sounding keys and effects (not on the whole scene).
- Real distance fog (complementing the existing horizon haze), subtle scene lighting on keys.
- Quality presets (Off / Low / High); tablets default to Low or Off. This revises the earlier "no full-screen bloom" guidance into "bloom optional, preset-controlled".

### Shader styles _(milestone 9)_

- Selectable looks for notes, keys and now-line effects (e.g. neon outline, glass/gloss, gradient trails, particle variants).
- Start with a design session: collect reference videos/screenshots of looks you like, sketch them, then pick 2–3 to implement as presets.
- Architecture: a "visual style" setting that swaps shader/material variants without touching the render model.

### 9.5 Playlist mode (design session first)

Play full songs back-to-back as background music, with the piano and highway as a visualizer.

- Playlists contain full songs only (no bookmarks — keeps them simple to manage). Create, rename, delete; add songs from the library or picker; reorder by drag; remove. Stored per profile, included in backups.
- Playback: play a playlist from any song; next/previous song; shuffle and repeat (playlist / one song).
- Crossfade between songs: a setting, 0–8 s in 0.5 s steps, default 2 s, with its reset icon. At 0 there's a short silent gap (~1 s) instead. Design question: how the highway transitions while two songs overlap in audio.
- Play UI in listening mode: show (normal HUD), minimal (title and composer only), or hidden (pure visualizer). In every option the menu icons stay reachable and follow the idle-hide setting, so you can change settings or leave listening mode at any time. Mute as a quick toggle.
- Full songs at 100% (tempo changeable for the session); no loops, pre-roll or count-in.
- Listening is not practice and is not logged: no plays, practice time or listening stats.
- Entry points: a Playlists tab next to Library | Bookmarks, and possibly a Welcome-screen tile (7.7).

### Hand caging _(milestone 10)_

- Look-ahead visualization of where each hand needs to be per bar (a "cage" spanning the hand's key range).
- Design session first: review the approach from the Unity app (code to be provided), decide range computation, transitions between bars, and how it's drawn on the highway/keyboard.

### Benchmark mode _(milestone 12, the final milestone; spec to be written when we reach it)_

A built-in, repeatable performance test that can be run on any device (PC, laptop, iPad, a desktop build), with results collected.

- **Where:** main Settings, in a "Benchmark" area under Render/Performance (exact place decided in the spec). A Start button with a short explanation; Esc cancels.
- **What it runs:** a fixed, scripted sequence:
  - bundled test songs: a normal piece and the dense-chord stress passage;
  - a fixed camera and a fixed look;
  - each quality preset (Off / Low / Medium / High), interleaved and repeated so drift hits all presets alike;
  - a short warm-up first.
- **What it measures:**
  - frame interval (median, p95, p99, dropped frames);
  - engine CPU per frame, and GPU time where the timer query exists;
  - draw calls, particle counts, bloom availability;
  - load times (song, samples).
- **Device info:**
  - browser and user agent, GPU renderer string (where available);
  - screen size and pixel ratio, CPU cores, device memory;
  - device class (desktop/tablet), app version and commit.
- **Output:**
  - a results screen (a table per preset);
  - Export (.json, a stable documented format) and Copy summary (short text);
  - results kept locally with a history, so runs can be compared.

## Other ideas (unscheduled)

- _(add new ideas here; they get scheduled when a milestone is planned)_
