# PianoMeister Online — Design Brief

## Vision

A browser-based piano practice visualizer: MIDI songs scroll down a perspective note highway toward a full 88-key keyboard, with built-in piano sound (or MIDI out), and practice tools built around bars, tempo, and per-hand control. Redesign of the Unity practice app (MarkovMusicMaker), not a port. Ships as a static site on GitHub Pages; runs on desktop and tablet.

## Scope — v1

**In**
- Song library: bundled songs + user uploads (drag-and-drop / file picker), uploads persisted locally.
- Perspective note highway receding to a horizon (Guitar Hero / Rocksmith style), always showing all 88 keys.
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

| Concern | Decision |
|---|---|
| App shell / UI | Vite + Vue 3 + TypeScript, Pinia |
| Rendering | Plain Three.js in an isolated `engine/` module (not TresJS); instanced note meshes; 3D keyboard in the same scene so lanes align with keys |
| MIDI parsing | `@tonejs/midi` → converted into our own Song model |
| Timing | Own transport/scheduler on the Web Audio clock. Audio clock is master; visuals read song position each frame. Tempo % scales song-time advance. |
| Bars | Bar map built from the file's time-signature + tempo events (default 4/4 if none). All seek/loop/pre-roll math is in bars/beats. |
| Sound | `smplr` sampled grand, samples self-hosted in the repo; fewer velocity layers on mobile |
| MIDI out | Web MIDI via WEBMIDI.js, feature-detected (absent on iPad/Safari) |
| Storage | IndexedDB via Dexie (uploads, profiles, bookmarks, play log); schema versioned from day one |
| Song identity | Content hash of the MIDI file — stats and bookmarks survive renames and re-uploads |
| Stats | Store a raw play log; compute stats from it rather than maintaining counters |
| Deploy | GitHub Actions → GitHub Pages; Vitest + Playwright in CI |

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
- **PracticeConfig**: loop `{startBar, endBar} | null`, tempoPercent, hand → channel assignments, per-hand audio (on / muted / solo), preRollBeats, preRollMode (muted | quiet).
- **MeterOverride**: time signature, bar-1 start tick (per song, shared across profiles).
- **Profile**: name, settings, per-song channel assignments.
- **Bookmark**: profileId, songId, name, PracticeConfig, createdAt.
- **Session**: profileId, startedAt, endedAt.
- **PlayRecord**: profileId, sessionId, songId, bookmarkId?, startedAt, playedMs.

## Milestones

0. Scaffold, CLAUDE.md, CI, deploy "hello world" to Pages.
1. Core: MIDI import → Song model, bar map, transport (play/pause/tempo/seek/loop/pre-roll) — tested headless.
2. Audio: sampled piano, per-hand mute/solo, pre-roll muted/quiet.
3. Engine: perspective highway, 88-key 3D keyboard, colors, sustains, highlights.
4. Library: bundled manifest, uploads, per-song channel assignment.
5. Profiles, bookmarks, stats.
6. Tablet polish (touch UI, audio unlock, performance), MIDI out, optional PWA.

## Confirmed decisions

1. **Unassigned channels** (neither hand) are hidden and silent.
2. **Pre-roll** shows the preceding bars' notes on the highway while their sound is muted or quieted; when there is nothing before the start (e.g. bar 1), the highway runs empty for the pre-roll. **Optional metronome click** during pre-roll.
3. **Per-song meter override**: MIDI files can carry wrong or missing time signatures, leading silence, or a pickup (anacrusis). Each song can override its meter with a time signature (replacing the file's) plus the tick where bar 1 starts; anything before that tick forms bar 0 (a pickup or lead-in). All bar-based features (seek, A–B loops, bookmarks, pre-roll) use the overridden bar map.
4. **Profiles are local to the browser/device**, with JSON export/import for backup and moving between devices.
5. **Session** = starts on first playback, ends after 10 minutes without playback or when the app closes. Practice time counts only while playing (not paused).
6. **Songs are shared** across profiles on a device; bookmarks, stats, and per-song channel assignments are per profile.
7. **Tablet readability** of 88 lanes: deferred — not a primary concern for v1.

## Note color palette

Pitch-class colors (from the Unity `MMMColorSchemes_PianoKeys` asset, `colorSecondary`). Each sharp is a darker shade of the natural below it.

| Pitch | Hex | Pitch | Hex |
|---|---|---|---|
| C  | `#FF0000` | F#  | `#D97500` |
| C# | `#A80000` | G   | `#1CFF00` |
| D  | `#FFE500` | G#  | `#13AC00` |
| D# | `#A19000` | A   | `#9500FF` |
| E  | `#00C2FF` | A#  | `#5E00AB` |
| F  | `#FF9D00` | B   | `#FF00D5` |

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
