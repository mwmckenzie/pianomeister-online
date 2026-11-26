# Milestone 11, Phase 1a plan: draw less, and not while paused

Branch `feat/m11-perf-cull`, from `feat/m11-perf-measure` (Phase 0 not merged, nothing pushed). Order: 1, stop for review, 2, 3. Device runs wait.

## 1. Draw only the visible window

**Today.** One draw per layer, all the song's notes as instances; the shader collapses what isn't shown. A rounded head is 972 triangles, and the heads are drawn again for the glow and the cage masks. A square head is 12.

**How.** One set of static buffers per layer, as now, and nothing uploaded while playing.

- The per-note attributes go into one interleaved instance buffer per layer. Small geometries ("variants") share it and differ only in the start offset of their attributes and in `instanceCount`. That is a base instance emulated by attribute offsets, which Three.js and WebGL2 support (read in `WebGLBindingStates`; its cache ignores a changed offset, so a new start needs a new geometry object, not a changed one).
- Each frame, after the time uniforms are set, every layer picks its variant and count. Same number of draw calls, no streaming. Variants start on buckets of 16 notes, and a few are kept per layer. An old one is released without freeing the shared buffer (Three's `dispose` would free it), which I'll test.
- Rejected: one mesh per time bucket (draw calls × layers × twins × repeats); refilling a buffer (uploads while drawing, and one buffer per repeat).
- If the offset approach fails on a device, the fallback is the refilled buffer, behind the same interface.

**The window.** Notes are sorted by start; a running maximum of their ends makes the near edge exact for long sustains.

- **Far:** start < now + 1.5 look-aheads, where the shader's haze has reached zero. Plus the labels' offset. Then rounded outwards and **one more full bucket**, at least one beat. The fade is measured in ticks, so tilt and look-ahead don't change where it ends in ticks; the test still runs at the longest look-ahead and the steepest and flattest tilts.
- **Near:** end > now, minus one bucket and one beat, with the labels' offset. Below the hit line the shader draws nothing of a note. Key light, release, particles and held glow come from the key states and particles, not from these instances, and don't change.
- Labels, heads, sustains, ridges, black outline, masks and glow twins all follow. Bar and beat lines, cages and pedal areas stay whole (2 triangles each).
- A drone held for many bars keeps the notes between its start and now in the window. Correct, only less saving.

**Correctness.**

| Case                          | How                                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Seek, loop wrap               | Window is worked out in the frame that shows the new position; there is nothing to fill, so no frame can miss notes.                     |
| Next repeat and its ghosts    | Each copy gets its own window: playhead moved back by k periods, clipped to the iteration. Copies use other variants of the same buffer. |
| Tempo change, look-ahead ease | Works in ticks, read after the uniforms.                                                                                                 |
| Crossfade, timeline swap      | `setSong` builds the buffers as now; the window applies in the first frame. Both songs are in one timeline.                              |
| Heads (far to near order)     | The same range, mirrored; order is unchanged.                                                                                            |
| Note colours, label reveals   | Written into the shared buffer as now (update ranges adapted to it).                                                                     |
| Rounded/square heads          | Rebuilds the layer's variants.                                                                                                           |

**Tests.**

- Unit: the window function (drones, equal starts, empty songs, before the song, after the end, repeats) against a plain per-note check on random songs; bucket margins.
- Engine: a test-only switch draws everything. In capture mode, on one GPU, full and culled frames must be **identical**: Study and Classic, playing and paused, in a loop with Next repeat, across a crossfade; at the far fade, right after a seek and a loop wrap, at the longest look-ahead and both tilt limits. Any different pixel fails.
- The test has to be able to fail: I'll shrink the margin below zero and show that it does.
- Also compared once with the Phase 0 build's screenshots, which is the real "before".
- Instance counts in a test: far below the song's notes.

**Then measure:** smoke on strong, weak-cpu and Floor, before and after in the same sitting, window in front, twice each, with triangles and frame times. Frames locked to about 1 s are reported, not counted. **Stop there.** Nothing about note-head detail.

## 2. Draw nothing while paused

- **Engine:** the loop asks for the next frame only while playing, while something is still moving, or when asked. "Still moving" is reported by the parts (particles, key presses and key light, label reveals, held glow, pulses after a pause, the tempo clock), so it isn't a timeout. The frozen mode stays and uses the same path. Animated fills already hold still while stopped.
- **Redraw once:** settings, looks and their easing, colours, seek and any `timelineChange`, `stateChange`, loop, song, seam, resize, device-pixel ratio (a media query listener, as it's checked per frame today), reduced motion, the font atlas, late-loaded anti-aliasing passes, tab shown again, WebGL context restored.
- **Resume:** playing asks for a frame at once. The first one has no time step (the old timestamp is dropped). Nothing is disposed while idle, so nothing recompiles.
- **HUD:** its loop runs while playing. Otherwise it steps on transport events, song, tempo and loop changes. The key light and countdowns follow because pre-roll counts as playing (to be confirmed in code).
- **Benchmark:** its `idle` segment and the perf overlay would see no frames. The idle segment will force drawing (to measure the frame's cost); paused cost stays with `--idle`. The overlay shows "idle" and doesn't keep the engine awake.
- **Tests:** no frames while idle-paused; one redraw (and its settling) after a settings change, a seek, a resize and a look; no long frame on resume; a pause while particles fly ends with them gone, then still. Existing paused-frame tests (`visualPolish`) must pass unchanged.
- **Measure:** `--idle` on strong and weak-cpu, before and after, paused against Home.

## 3. Hidden-tab playlist

`ListeningController.frame()` splits: `advance()` (seam, rebuild, preparing the next song, fade gains, finishing) and `frame()` (look easing, HUD clock). `advance()` runs from the scheduler's 25 ms worker ticker, which keeps firing in hidden tabs, and reads the audio clock. A step that does nothing must cost next to nothing. Song loading doesn't need frames. `finish()` also needs the `stateChange`. The expected-failure mark goes; the unit tests of `ListeningController` get the split; I'll confirm in plain Chrome too, as in Phase 0.

A look change across a seam in a hidden tab isn't eased (nobody sees it) but must be complete when the tab is shown: covered by a test.

## Not in this phase

Head detail, MSAA, glow, the HUD's rate while playing, protected-zone fixes, anything else in Phase 1.

## Questions

1. **Merge Phase 0 first?** I chose not to: nothing needs pushing, and it has no device numbers yet. If you want it merged first, say so and I'll rebase.
2. **Cull labels by the same window?** They are cheap, but their vertex shader runs per note. Default: yes.
3. **Pixel identity:** I require zero difference on the same GPU. Default: keep that. If an exact match proves impossible for a reason I can explain, I stop and ask.
