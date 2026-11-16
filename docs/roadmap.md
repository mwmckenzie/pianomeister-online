# PianoMeister Online — Roadmap & Ideas Backlog

Living document. The brief (`docs/brief.md`) records *decided* scope; this file holds the plan for upcoming milestones and ideas not yet scheduled. When a milestone starts, its items move into `docs/milestones/mN.md` and decisions go into the brief.

## Milestone plan

| # | Milestone | Contents | Status |
|---|---|---|---|
| 0–3 | Setup, core, sound, engine | — | ✅ done |
| 4 | Library | Library page, uploads, song details, backup, web app manifest | ✅ done |
| 5 | **Visual clarity** | 3D note heads; lifted black-key-lane notes with contact shadow; black-key lane shading; simple built-in shading; keyboard dimensions + rounded key edges; animated keys; velocity-scaled effects; render quality (resolution, anti-aliasing) | next (sketch session first) |
| 6 | **UI foundation** | Design system, app shell with navigation, tabbed settings, animated menus/tabs; restyle Library; replace the player's temporary controls | |
| 7 | **Profiles, bookmarks, stats** | (was milestone 5) Built on the new UI, incl. profile and bookmark management screens | |
| 8 | **Section overview & loop editor** | Horizontal 2D song overview; select A–B bars on it; create bookmarks from a selection | |
| 9 | **Visual polish** | Post-processing (bloom/glow, distance fog, lighting) with quality presets; selectable shader styles for notes, keys and effects | |
| 10 | **Hand caging** | Per-bar hand-position look-ahead (design session first, using code from the Unity app) | |
| 11 | **Tablet, MIDI out, offline** | (was milestone 6) Touch UI, performance pass, MIDI out, service worker / offline | |

### Why this order

- **Visual clarity first (5):** the main issue today is separation — notes, lanes and keys blend together. Everything in this milestone is engine + settings work on the keyboard and notes, and it affects every session. A sketch session tunes the defaults before building.
- **UI foundation before profiles (6 → 7):** milestone 7 adds several new screens (profiles, bookmarks, stats). Building the design system and app shell first means those screens are built once, in the final style, instead of being restyled later.
- **Loop editor after bookmarks (7 → 8):** an A–B selection and a bookmark are the same thing in different clothes; the overview is the natural place to create and edit them.
- **Visual polish after the features settle (9):** post-processing and shader styles change how everything looks; doing them once the screens and scene are stable avoids re-tuning. Quality presets keep tablets smooth.
- **Hand caging (10)** is exploratory and independent — it can move earlier if it becomes the priority.
- **Tablet pass last (11)**, but with a quick iPad check at the end of every milestone so problems surface early.

## Backlog — idea details

### 3D note heads *(milestone 5)*
- Note heads become raised blocks (same footprint as today's 1/64-note head), with adjustable height and optional rounded edges. Sustains stay flat.
- Needs simple built-in shading (lighter top face, darker sides, highlight on rounded edges) so the 3D shape reads — done in the shaders, not the full lighting of milestone 9.

### Black-key lane notes lifted + contact shadow *(milestone 5)*
- Notes in black-key lanes float slightly higher (default: the black keys' raise height, adjustable), so they meet the raised black key tops exactly at the now line.
- A soft contact shadow under black-lane notes falls onto neighboring white-lane notes, separating them when they sit side by side. Toggle + strength.

### Black-key lane shading *(milestone 5)*
- Black-key lanes on the highway are shaded slightly darker than white-key lanes (piano-roll style), so sharps are recognizable even in empty lanes. Toggle + strength.

### Animated keys *(milestone 5)*
- Keys press down on note-on and return on note-off, pivoting at the back like a real key. Toggle + press depth.

### Velocity-scaled effects *(milestone 5)*
- Now-line sparks and glow scale with note velocity (harder = bigger/brighter). Settings: minimum and maximum size, or a uniform size for all notes.

### Render quality *(milestone 5)*
- Settings: render scale (e.g. 0.5×–2× of device pixel ratio, plus "auto"), anti-aliasing (off / MSAA / FXAA or SMAA), max pixel ratio cap (currently 2).
- Investigate why it looks grainy today (likely pixel-ratio cap, no MSAA on the render target, or thin lines aliasing) and fix the defaults, not just add knobs.
- Show the resulting internal resolution and frame time in the settings so the trade-off is visible.

### Keyboard dimensions & rounded edges *(milestone 5)*
- Settings: black key length (ratio of white), black key height (raise), key thickness (depth of the key bodies), gap between keys.
- Rounded key edges: toggle + radius (uses the same built-in shading as the note heads).
- Gaps must keep lanes and keys aligned: lane positions are derived from the same key layout.
- Defaults stay the grand-piano proportions from decision 20; "Reset to grand piano".

### UI foundation *(milestone 6)*
- Decide: custom components vs. a headless component library (e.g. Reka UI) + own styling. No heavy UI framework.
- Design tokens (colors, type, spacing, radii, motion) matching the dark scene palette.
- App shell: navigation between Player, Library, Settings (and later Profiles/Bookmarks/Stats).
- Tabbed settings pages (Display/Camera, Keyboard, Highway, Notes, Audio, Effects, Data).
- Animated menus, tabs and panel transitions (Vue transitions; respect "reduce motion").
- Replace the player's temporary top-center controls with a designed transport bar.

### Section overview & loop editor *(milestone 8)*
- A horizontal, scrollable 2D view of the whole song (piano-roll style, bars numbered, notes colored by pitch class, hands distinguishable).
- Drag to select bars → sets the A–B loop; current loop and playback position shown live.
- "Save as bookmark" from a selection; bookmarks listed and editable here.
- Possibly zoom levels (whole song ↔ a few bars).

### Post-processing & lighting *(milestone 9)*
- Selective bloom/glow on note heads, sounding keys and effects (not on the whole scene).
- Real distance fog (complementing the existing horizon haze), subtle scene lighting on keys.
- Quality presets (Off / Low / High); tablets default to Low or Off. This revises the earlier "no full-screen bloom" guidance into "bloom optional, preset-controlled".

### Shader styles *(milestone 9)*
- Selectable looks for notes, keys and now-line effects (e.g. neon outline, glass/gloss, gradient trails, particle variants).
- Start with a design session: collect reference videos/screenshots of looks you like, sketch them, then pick 2–3 to implement as presets.
- Architecture: a "visual style" setting that swaps shader/material variants without touching the render model.

### Hand caging *(milestone 10)*
- Look-ahead visualization of where each hand needs to be per bar (a "cage" spanning the hand's key range).
- Design session first: review the approach from the Unity app (code to be provided), decide range computation, transitions between bars, and how it's drawn on the highway/keyboard.

## Other ideas (unscheduled)

- *(add new ideas here; they get scheduled when a milestone is planned)*