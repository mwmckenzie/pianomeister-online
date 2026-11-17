# Credits

## Piano samples — Splendid Grand Piano

The built-in piano sound uses the **Splendid Grand Piano** samples: Steinway samples released
into the **public domain** by **AKAI** (early 2000s), cleaned up and mapped to SFZ by kinwie for
the sfzinstruments project.

- Source: <https://github.com/sfzinstruments/SplendidGrandPiano> ("Public Domain samples by AKAI")
- Encoded (ogg / m4a) as published by smplr at
  <https://smpldsnds.github.io/sfzinstruments-splendid-grand-piano/samples>

The files are self-hosted in `public/samples/splendid-grand-piano/` (downloaded once with
`scripts/fetch-piano-samples.mjs`), so the app makes no requests to third-party sample hosts.

## smplr

Sample playback uses [smplr](https://github.com/danigb/smplr) by danigb, **MIT License**.

## @tonejs/midi

MIDI file parsing uses [@tonejs/midi](https://github.com/Tonejs/Midi), **MIT License**.

## Inter Tight (font)

The interface font is [Inter Tight](https://github.com/rsms/inter-tight), Copyright 2022 The
Inter Project Authors, licensed under the **SIL Open Font License 1.1** (full text in
`src/ui/theme/fonts/OFL.txt`).

The woff2 files (weights 300/400/500/600, latin and latin-ext subsets) were downloaded once
from the [Fontsource](https://fontsource.org/fonts/inter-tight) package
`@fontsource/inter-tight@5.3.0` and are self-hosted in `src/ui/theme/fonts/`; the app makes no
runtime font requests.

## Reka UI

Accessible headless UI primitives (dialogs, tabs, sliders, combo boxes, …) come from
[Reka UI](https://reka-ui.com), **MIT License**. All styling is our own.
