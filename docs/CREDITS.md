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
