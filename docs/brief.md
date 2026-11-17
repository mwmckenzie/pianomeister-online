# PianoMeister Online — Design Brief

## Vision

A browser-based piano practice visualizer: MIDI songs scroll down a perspective note highway toward a full 88-key keyboard, with built-in piano sound (or MIDI out), and practice tools built around bars, tempo, and per-hand control. Redesign of the Unity practice app (MarkovMusicMaker), not a port. Ships as a static site on GitHub Pages; runs on desktop and tablet.

## Scope — v1

**In**

- Song library: bundled songs + user uploads (drag-and-drop / file picker), uploads persisted locally.
- Perspective note highway receding to a horizon (Guitar Hero / Rocksmith style), all 88 keys by default (closer camera settings may crop the outer keys).
- Per-pitch-class note colors (repeating each octave), sustain bars, note highlight while sounding, 3D keyboard keys lit in the note's color.
- Sound: built-in sampled piano (default, all devices); MIDI out where the browser supports Web MIDI.
- Hands: channel 0 = right, channel 1 = left by default; user can reassign channels per song.
- Practice controls:
  - Play / pause.
  - Tempo as % of the song's baseline (applies across tempo changes); display effective BPM.
  - Bar-based seek: next bar, previous bar, go to bar #.
  - Bar-based A–B loop: `1–3` = start of bar 1 to end of bar 3.
  - Pre-roll beats before start and before each loop iteration, played muted or at reduced volume (default 0).
  - Per-hand mute / solo (audio), independent of visibility.
- Profiles (local), with:
  - Bookmarks: a saved practice setup = A–B section, tempo, channel assignments, mute/solo, pre-roll.
  - Session stats: total sessions, songs practiced, total practice time, most practiced song, last practice, average session length, …
  - Song stats: plays, total play time, bookmark count, …
  - Bookmark stats: plays, total play time, last played, …

**Out (for now)**

- MIDI input / play-along / scoring — but the architecture keeps a seam for it.
- Accounts, servers, cloud sync.
- Song editing.

## Key technical decisions

| Concern        | Decision                                                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell / UI | Vite + Vue 3 + TypeScript, Pinia                                                                                                                                                                                           |
| Rendering      | Plain Three.js in an isolated `engine/` module (not TresJS); instanced note meshes; 3D keyboard in the same scene so lanes align with keys                                                                                 |
| MIDI parsing   | `@tonejs/midi` → converted into our own Song model                                                                                                                                                                         |
| Timing         | Own transport/scheduler on the Web Audio clock. Audio clock is master; visuals read song position each frame. Tempo % scales song-time advance.                                                                            |
| Bars           | Bar map built from the file's time-signature + tempo events (default 4/4 if none), unless the song has a per-song meter override, which replaces the file's time signatures. All seek/loop/pre-roll math is in bars/beats. |
| Sound          | `smplr` sampled grand, samples self-hosted in the repo; fewer velocity layers on mobile                                                                                                                                    |
| MIDI out       | Web MIDI via WEBMIDI.js, feature-detected (absent on iPad/Safari)                                                                                                                                                          |
| Storage        | IndexedDB via Dexie (uploads, profiles, bookmarks, play log); schema versioned from day one                                                                                                                                |
| Song identity  | Content hash of the MIDI file — stats and bookmarks survive renames and re-uploads                                                                                                                                         |
| Stats          | Store a raw play log; compute stats from it rather than maintaining counters                                                                                                                                               |
| Deploy         | GitHub Actions → GitHub Pages; Vitest + Playwright in CI                                                                                                                                                                   |

## Architecture outline

```
src/
  core/      pure TS, no DOM — song model, MIDI import, bar map, transport,
             practice config, stats calculations. Fully unit-tested.
  audio/     sampler output, MIDI out, output routing (per-hand mute/solo)
  engine/    Three.js scene: highway, notes, keyboard, camera; reads transport time
  data/      Dexie database, repositories (songs, profiles, bookmarks, play log)
  ui/        Vue components + Pinia stores (library, player HUD, settings, stats)
```

The transport emits note-on/note-off events on a small event bus; audio, MIDI out, and the visual key highlights all subscribe. Future MIDI input becomes one more participant on that bus.

### Core data model (sketch)

- **Song**: `id` (hash), title, source (bundled | uploaded), channels present, duration, bar map.
- **SongMeta**: songId, display title, composer, tags — user edits, shared across profiles.
- **StoredUpload**: songId, file name, bytes, addedAt.
- **PracticeConfig**: loop `{startBar, endBar} | null`, tempoPercent, hand → channel assignments, per-hand audio (on / muted / solo), preRollBeats, preRollMode (muted | quiet).
- **MeterOverride**: time signature, bar-1 start tick (per song, shared across profiles).
- **PedalInterval**: channel, startTick, endTick (sustain pedal CC64 down at value ≥ 64).
- **Profile**: name, settings, per-song channel assignments.
- **Bookmark**: profileId, songId, name, PracticeConfig, createdAt.
- **Session**: profileId, startedAt, endedAt.
- **PlayRecord**: profileId, sessionId, songId, bookmarkId?, startedAt, playedMs.

## Milestones

0. Scaffold, CLAUDE.md, CI, deploy "hello world" to Pages.
1. Core: MIDI import → Song model, bar map, transport (play/pause/tempo/seek/loop/pre-roll) — tested headless.
2. Audio: self-hosted sampled piano, look-ahead scheduler, per-hand volume/mute/solo, sustain pedal (sound), pre-roll muted/quiet, metronome.
3. Engine: perspective highway, 88-key 3D keyboard, colors, sustains, highlights, pedal shading band; player screen + HUD, settings panel (localStorage).
4. Library page, bundled manifest, uploads (IndexedDB), song details panel (metadata, tags, hand channels, meter override), library export/import, web app manifest.
5. Visual clarity: 3D note heads, lifted black-lane notes with contact shadow, black-key lane shading, simple lighting, keyboard dimensions and key edge profile, animated keys, velocity-scaled effects, render quality.
6. UI foundation: design system (tokens, Reka UI components), settings registry with reset everywhere, Quiet player HUD, playfield sidebar, settings window, song picker, restyled library.
7. Profiles, bookmarks, stats.
8. Section overview & loop editor.
9. Visual polish (post-processing, shader styles).
10. Hand caging.
11. Tablet, MIDI out, offline.

Unscheduled ideas and the reasoning behind this order live in `docs/roadmap.md`.

## Confirmed decisions

1. **Unassigned channels** (neither hand) are hidden and silent.
2. **Pre-roll** shows the preceding bars' notes on the highway while their sound is muted or quieted; when there is nothing before the start (e.g. bar 1), the highway runs empty for the pre-roll. **Optional metronome click** during pre-roll.
3. **Per-song meter override**: MIDI files can carry wrong or missing time signatures, leading silence, or a pickup (anacrusis). Each song can override its meter with a time signature (replacing the file's) plus the tick where bar 1 starts; anything before that tick forms bar 0 (a pickup or lead-in). All bar-based features (seek, A–B loops, bookmarks, pre-roll) use the overridden bar map.
4. **Profiles are local to the browser/device**, with JSON export/import for backup and moving between devices.
5. **Session** = starts on first playback, ends after 10 minutes without playback or when the app closes. Practice time counts only while playing (not paused).
6. **Songs are shared** across profiles on a device; bookmarks, stats, and per-song channel assignments are per profile.
7. **Tablet readability** of 88 lanes: deferred — not a primary concern for v1.
8. **Stop and song end:** stop rewinds to the loop's start bar if a loop is set, otherwise to the song start (bar 0 if there is a pickup). A stopped transport is parked there, so setting a loop while stopped moves it to the loop start. Reaching the last note-off with no loop silences all notes and stops (rewound).
9. **Jumps play onsets only:** after a seek or loop wrap, notes already held at the target are not retriggered; only notes starting from there on sound.
10. **Pre-roll triggers:** play from stopped, any seek (including a seek while paused, which applies on the next play), and each loop iteration. Resuming from pause without a seek does not re-apply pre-roll. Pre-roll beats are spaced at the tempo and meter of the target bar.
11. **Piano samples are self-hosted** in the repo (Splendid Grand Piano, public domain, via smplr), credited in `docs/CREDITS.md`. No runtime dependency on third-party sample servers.
12. **Sustain pedal (CC64)** is honored in the **sound only**: a note released while its channel's pedal is down keeps sounding until the pedal is released (re-striking the same pitch cuts the previous one). Highway bars still show written lengths.
13. **Pedal shading:** periods with the pedal down are shown as a subtle, desaturated band underneath the full width of the note highway — low-contrast so it doesn't compete with the notes. Rendering is milestone 3; the data comes from milestone 2.
14. **Volume controls:** master volume; per hand a volume slider plus on / muted / solo (if any hand is soloed, only soloed hands sound). Audio only — never affects visibility.
15. **Pre-roll "quiet" level** defaults to 25% of normal volume.
16. **Metronome:** synthesized click (no sound files), accented on beat 1. Modes: off / pre-roll only / always. Own volume slider.
17. **Data model:** `PedalInterval` — channel, startTick, endTick (down at value ≥ 64).
18. **Highway geometry:** look-ahead measured in quarter notes (ticks / ppq), default **8**, adjustable. The visible highway — from the now line to where the top of the screen meets the highway — corresponds to **1.5×** the look-ahead: the look-ahead fills the lower two thirds, and notes fade in through a haze in the top third (1×–1.5×), so nothing pops in at the screen edge. Spacing is tempo-independent: slowing the tempo slows the scroll, not the spacing.
19. **Notes:** flat strips. **Head** = solid pitch color, length of a **1/64 note** (ppq/16 ticks), or the whole note if shorter. **Sustain** = the rest of the note, full lane width, translucent with a gradient **across the lane**: **25% transparent at the lane center, 75% at the lane edges** (both adjustable). The gradient is computed in each note's own lane coordinates, so it follows the note's perspective and taper — it is never screen-aligned.
20. **Keyboard proportions (grand piano):** white key 23.5 mm wide × 150 mm visible length; black key 13.7 mm × 95 mm, slightly raised. World unit = one white-key width. Key proportions are fixed in world space and never change with camera settings.
21. **Camera:** tilt default **45°** (adjustable); **distance offset**: 0 = all 88 keys exactly fill the screen width, positive = farther away, **negative = closer, cropping the outer keys**; **horizontal pan**, default centered. The keyboard and the highway share the camera, so lanes always meet their keys.
22. **Scene defaults (all adjustable):** background very dark blue (`#05070F`), highway surface slightly lighter (`#0A0F1E`); lane lines desaturated blue, translucent; bar lines the same hue, clearly more visible; beat lines barely visible; pedal band subtle desaturated blue-grey.
23. **Settings** are stored in localStorage (versioned) until profiles arrive in milestone 7.
24. **Player is the home page** (`/`); the debug page stays at `#/debug`.
25. **HUD:** replaced in milestone 6 by the Quiet HUD (decision 60). Milestone 3 layout, for reference: top-left song title, length, position, bar:beat; top-right current and song BPM and tempo %; temporary top-center controls; a gear button for the settings panel.
26. **Library page** at `#/library`: searchable, sortable list; group by composer or tag; filter by tag and source. Picking a song opens it in the player; the player has a Library button.
27. **Startup:** the player (home page) reopens the last selected song (from milestone 7: the last song _or bookmark_). First run falls back to the first bundled song.
28. **Song metadata is editable for every song** (bundled and uploaded): display title, composer, free-form tags. Edits are stored locally and shared across profiles; the original values are kept and can be restored ("Reset to original").
29. **Uploads:** multiple files at once; `.mid`/`.midi` only; max 2 MB each; duplicates detected by content hash (against bundled songs and other uploads) are skipped with a message; uploads can be deleted (with confirmation). Bundled songs can't be deleted.
30. **Hand channel fallback:** if neither channel 0 nor 1 has notes, assign by average pitch — highest-average channel → right hand, next → left, others hidden; a single channel → right hand. Users can change it in the song's details panel.
31. **Song details panel** (inside the Library page): metadata and tags, file facts, hand channel assignment, meter override editor, delete (uploads only), Play.
32. **Library export/import:** one `.zip` containing all uploaded MIDI files plus a versioned `library.json` (metadata edits and tags for all songs, meter overrides). Importing skips duplicates; for songs already present, local metadata edits are kept and the import report says so.
33. **Storage protection:** request persistent storage (`navigator.storage.persist()`) on the first upload and show the storage status in the Library; ship a web app manifest so the site can be added to an iPad/iPhone home screen (home-screen apps aren't subject to Safari's 7-day storage deletion). Offline support (service worker) stays in milestone 11.
34. **Adding bundled songs:** drop the `.mid` into `public/songs/`, run `npm run songs:manifest`, then fill in title/composer/tags in the manifest.
35. **Deleting an upload** also deletes its metadata edits, meter override and hand assignments. Re-uploading starts fresh (future stats and bookmarks are keyed by hash and are unaffected).
36. **Original title of an upload:** the MIDI sequence name — the name of a format 0 file's track, or of a format 1 file's first track when it is a conductor track (no notes) — otherwise the file name without its extension. Other track names are ignored: they usually name the instrument ("Piano"). Uploads have no original composer or tags.
37. **Library export** holds metadata edits and meter overrides, not hand assignments: those are per profile and travel with the profile export (milestone 7).
38. **Playback survives navigation:** the app keeps one playback session, so going to the Library and back doesn't reload the piano samples. Leaving the player pauses playback.
39. **3D note heads:** heads are raised blocks with the head's footprint (lane width × 1/64 note), height **0.35**, **rounded edges on** (radius 0.06, at most 40% of the head's smallest side). The bevel keeps its world size whatever the note length, tempo or look-ahead. Sustains stay flat. Black-lane heads draw above white-lane heads.
40. **Black-key-lane notes are lifted** (heads and sustains). Default: **match the black-key height**, so they meet the raised key tops at the now line; or a manual lift 0–0.8 (default 0.51).
41. **Contact shadow** under black-lane notes, falling on the highway and neighbouring white-lane notes: strength **45%**, soft edge. Faked with soft quads — no shadow maps.
42. **Black-key lane shading:** black-key lanes on the highway are darker than white-key lanes: **on**, strength **22%**.
43. **Simple lighting:** one key light + ambient, computed in the shaders, for keys and note heads: lighter top faces, darker sides, highlights on bevels. No shadow maps or post-processing (milestone 9).
44. **Keyboard dimensions** (defaults = real grand-piano proportions; "Reset to grand piano" restores them): key thickness (body height) **0.6**, gap between white keys **0.06**, black key length **63%** of white, black key height **12 mm (0.51)** above the white keys. Lanes never move: the gap shrinks white key bodies inside their lanes; black keys keep their lane width. **Limits** (in the settings and in the geometry): black key height ≤ key thickness, so a raised black key's body always reaches down to the white keys and never floats above them; black press depth ≤ black key height − 0.08 (≈2 mm), so a fully pressed black key's top stays above the white key tops (lowering the black keys lowers this limit and clamps the depth); white press depth ≤ key thickness, so a pressed white key's front never drops below the keyboard's bottom.
45. **Key edge profile:** none / chamfer / rounded, with a size. Default **chamfer, 0.04** (≈1 mm) on all edges of white and black keys.
46. **Animated keys:** keys go down on note-on and return on note-off (quick press ≈40 ms, slower release ≈90 ms, eased, no overshoot); a repeated note re-strikes from half-pressed. **On**. Separate settings for white and black keys: press depth = how far the key's **front edge** drops (white **0.22**, black **0.30**), and pivot offset = how far the pivot sits **behind** the key's visible back edge (white **0** — hinged at the play line; black **2 × the black key's visible length**, ≈8.04). Real keys pivot well behind their visible part (the balance rail), so they move mostly downward with a slight tilt; with the default black pivot a black key's back drops 2/3 as far as its front and stays on the play line (it moves a hair away from the player, never opening a gap). The colour overlay moves with the key.
47. **Velocity-scaled effects:** spark count and size and held-glow size scale linearly with velocity, **0.6×** at velocity 0 to **1.7×** at 127: **on**; or uniform size.
48. **Render quality:** render scale **auto** (device pixel ratio) or 0.5×–2×, capped by max pixel ratio (default **2**); anti-aliasing off / MSAA / FXAA / SMAA (three's built-in passes), default **MSAA**. The drawing buffer follows device-pixel-ratio changes (zoom, moving between monitors). The settings show internal resolution and average frame time.
49. **Settings schema v2** with migration: stored v1 settings are kept and new keys get their defaults; settings from an unknown newer version fall back to defaults.
50. **Two homes for settings.** Settings that change what you see on the playfield (camera, keyboard, highway, notes, effects, render quality) live in the **playfield sidebar**, beside the live view. Everything else lives in the **settings window** with tabs: General, Practice, Audio, Appearance, MIDI, Profiles, Library & data, Shortcuts, About. Tabs with nothing to show yet are left out until they have content (milestone 6 shows Practice, Audio, Appearance, Library & data and About).
51. **Reset to default everywhere.** Every setting control has a reset button: a circular-arrow icon with a "Reset to default" tooltip (hover and keyboard focus), dim at the default and in the primary color when changed, never shifting the layout. Every section ends with "Reset ⟨section⟩"; every settings tab and the playfield sidebar end with "Reset all ⟨tab⟩ settings". Section and tab resets apply at once and show a toast with **Undo** for 6 seconds (no confirm dialogs); a new reset replaces a visible Undo toast, and Undo restores only the most recent reset. Tabs and sidebar sections with changed values show a small dot in the primary color.
52. **Menu colors.** Appearance has a **primary** color (buttons, sliders, selection, active tabs, focus rings) and a **secondary** color (charts, bar-range indicators, highlights), each with a color picker and hex value, plus presets: Glacier `#8AB4FF`/`#7EE0C3` (default), Aurora `#7EE0C3`/`#C3A6FF`, Ember `#FFB38A`/`#FFD98A`, Orchid `#D3A6FF`/`#8AB4FF`, Mono `#E8ECF6`/`#A7B0C6`. They affect only the UI, never the note palette. Text on primary buttons is dark or light, whichever contrasts more.
53. **Glass panels:** panel opacity (default **58%**, 30–95%) and background blur (default **26 px**, 0–40). With blur 0, or where `backdrop-filter` is unsupported, panels use a more opaque surface.
54. **Motion:** menu animations "Follow system" (default, respects `prefers-reduced-motion`) / Full / Reduced. Reduced = fades only, no movement.
55. **Font:** Inter Tight, self-hosted woff2 (weights 300/400/500/600), credited in `docs/CREDITS.md` (OFL). No runtime Google Fonts request.
56. **Tempo shown as a range** wherever a song's tempo is displayed: the 5th to 95th percentile of the tempo, weighted by song time (seconds at each tempo), up to the song's end — so a short ritardando or pickup doesn't set the range. A single value when constant, e.g. "120–126 bpm" or "100 bpm". The library facts, the bundled manifest and the stored uploads all use the same function. Stored facts carry a `factsVersion` (`FACTS_VERSION`, bumped whenever the facts gain a field): on library load, uploads with older or missing facts are recomputed in the background one at a time and the lists update as each finishes; a file that can't be re-read keeps its old facts and isn't retried until the next version. The bundled manifest must be at the current version (`npm run songs:manifest:check`, and a unit test). The stored facts also hold each channel's note count and pitch range and the file's meter summary, so the picker shows notes per hand (with the song's hand assignment), the pitch range and meter changes without parsing the file. The player HUD keeps showing the current bpm.
57. **Song picker** opens from the player toolbar and with `O`. Left: song list. Middle: details of the highlighted song (until milestone 7's stats: notes per hand and the pitch range under the facts). Right: what to load — "Full song" pinned first, bookmarks below (milestone 7). The picker and the library share one song-row component and the reference grids: fixed-width numeric columns whose headers are the sort controls. Long titles and composers truncate with an ellipsis and show the full text as a tooltip. The library's details panel is always shown (first row selected by default); its backdrop is the player's last frame, blurred. A song's meter shows the meter covering the most bars, followed by a small superscript "+" in the secondary colour when it changes ("4/4+"). The "+" is a button named for the count ("4 meter changes"); hover (after a short delay), keyboard focus, or a click or tap opens a popover listing "bar X · meter", and leaving it, Esc, or a tap elsewhere closes it. Esc there never closes the dialog around it.
58. **Composer field** is a combo box: free typing with suggestions from composers already in the library (case-insensitive substring), a button that lists all of them with song counts, and "Add ‘…’ as a new composer" when nothing matches exactly.
59. **UI components:** Reka UI (headless, accessible primitives) for dialog, tabs, accordion, slider, combobox, select, tooltip, toggle group, popover and toast, styled with our own design tokens (`src/ui/theme/tokens.css`). No styled component framework. Settings are declared once in a registry in `core/settings` (label, default, limits, unit, home); reset groups are derived from it.
60. **Quiet HUD, on the sides of the highway** (nothing over it; no panels, pills or scrims behind any HUD element — text shadows keep it readable). **Top edge:** a thin full-width timeline (28 px side margins) with bar ticks, progress in the primary color with a soft playhead glow, the loop region tinted with the secondary color and its first and last bar numbers below; it seeks to bar starts and never hides. **Left column:** song title, composer (· bookmark name, milestone 7), the "bar 18:2 beat" counter and "bar N of M"; then the app menu as a vertical column of icons — Change song (`O`), Library (`L`), Playfield panel (`P`), Settings (`,`). They are grey and dim at rest; on hover or focus they turn white and show their name and shortcut as plain text beside them; the playfield icon is primary while the panel is open. **Right column**, right-aligned: the current "107 bpm" (information only, not clickable), "85% of 126 bpm" (the percentage in primary when not 100%), the time "0:52 / 1:31"; then the transport (previous bar, play/pause, next bar), and one line per toggle with its value as colored text left of its icon: "bars 17–32", the loop-options caret and the loop icon (secondary when on); "85%" and the tempo icon (primary when not 100%; it opens the tempo popover, 25–200%). Off = a dim grey icon with no value. The loop popover has a two-thumb bar range kept in sync with from/to fields (start ≤ end, a one-bar loop allowed; the dragged or focused end pushes the other, for pointer and keys alike), pre-roll beats on an inverted slider reading "4 beats before bar 17" ("4 beats before the play position" without a loop), and "Back to start". **Bar:beat counter:** bar and beat sit in fixed-width digit slots measured in the big font's `ch` (the bar slot fits the song's highest bar number, right-aligned; the beat slot its largest beat count), with a tight colon and fixed 8 px gaps to "bar" and "beat", so nothing shifts as the numbers change. To its right a vertical stack of beat dots, beat 1 at the bottom filling upward like the highway: the current beat primary with a soft glow, beats already played in the bar faintly lit, reset on each downbeat; bars of 6 or more beats split into columns by pulse (6/8 = two columns of three). During a count-in the counter never shows bar 0 or negative bars: it shows the target bar and beat 1 (e.g. "17:1") dimmed to about 45%, and the dots count the pre-roll beats; from the target bar's downbeat it is back to normal. Shortcuts: Space, ←/→, `Home` (back to start), `O`, `L`, `P`, `,`; they are ignored while typing in a text field, combo box or editable area.
61. **Audio and practice settings are persisted** (master volume, per-hand volume and on/mute/solo, quiet pre-roll level, metronome mode and volume, pre-roll beats and mode). They are what "Full song" uses. From milestone 7 a bookmark may override **only** per-hand mute/solo, pre-roll beats and mode, and tempo; master volume, hand volume levels and metronome settings stay global.
62. **Keyboard lengths are shown in mm** (world units × 23.5), e.g. black key height 12 mm; they are stored in world units.
63. **Settings schema v3** adds the audio, practice and appearance sections; v1 and v2 settings are migrated (values kept, new keys get defaults). The playfield panel's open state is UI state, stored separately (`pianomeister.ui`), and has no reset.
64. **Controls hide when idle:** while playing, the app menu icons and the right-hand playback block (transport and toggles) fade out after a few seconds without pointer, keyboard or touch activity; any activity brings them back. The timeline and all information text (title, counter, bpm, time) always stay. They never hide while paused, while a popover or dialog is open, while a playfield-panel control has focus, or while the pointer is over them. Appearance → Player controls → "Hide controls when idle": Off / 2 s / 3 s (default) / 5 s / 10 s.

## Note color palette

Pitch-class colors (from the Unity `MMMColorSchemes_PianoKeys` asset, `colorSecondary`). Each sharp is a darker shade of the natural below it.

| Pitch | Hex       | Pitch | Hex       |
| ----- | --------- | ----- | --------- |
| C     | `#FF0000` | F#    | `#D97500` |
| C#    | `#A80000` | G     | `#1CFF00` |
| D     | `#FFE500` | G#    | `#13AC00` |
| D#    | `#A19000` | A     | `#9500FF` |
| E     | `#00C2FF` | A#    | `#5E00AB` |
| F     | `#FF9D00` | B     | `#FF00D5` |

Only these 12 colors are used for notes. The other fields in the Unity asset are ignored.

## Key and note visual behavior

**Piano keys**

- At rest, keys are plain white or black.
- As a note approaches, its pitch color is laid over the key and fades in, from fully transparent to more visible. The fade runs over a short window before the note starts (default: 1 beat, tempo-relative, configurable).
- While the note sounds, the key shows the pitch color at full strength.
- When the note ends, the key returns to white or black, unless the next note on that key is already fading in.
- Repeated notes on one key: a sounding note always takes priority over the next note's fade-in.

**Effects on the "now" line** (the zero-lookahead line at the near end of the highway, directly above the keys)

- **Note start:** a short, bright burst in the pitch color, such as a flash or a small spray of sparks.
- **While held:** a mild, steady effect in the pitch color, such as a pulsing glow or a small flame. It should be clearly visible but not distracting.
- **Note end:** the held effect fades out quickly.
- **Performance:** use cheap additive-blended sprites or instanced particles rather than full-screen bloom, so that dense chords stay smooth on tablets. Limit the number of particles alive at once.
