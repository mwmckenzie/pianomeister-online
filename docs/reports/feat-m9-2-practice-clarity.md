# Report: feat/m9-2-practice-clarity (milestone 9.2, Practice clarity)

Spec `docs/milestones/m9-2.md`, plan `docs/milestones/m9-2-plan.md` (approved 2026-11-23, answers in §9).

## Round 1 — 2026-11-23: sections C and B, stop for the shadow decision (B6)

### What was done

**C. Deeper black keys** (`src/engine/model/keyBodies.ts`)

- Black key bodies now reach from their raised top down past the white keys' bottom: thickness = black key height + key thickness + 0.02. The top, the press pivot and the press motion don't change (`pressedKeyTop` untouched), so notes still meet the key tops exactly.
- The key shader has no vertical terms, so the taller sides take the normal black side shading. Spill, cones and overlays are unchanged on the sheet.
- Unit test: across thickness 0.2–1.2, black height 0–1.2 and white press depth 0–1.2, every black bottom is below every white bottom. A pressed white key's top never drops below its own resting bottom (the press is capped at the thickness), so the face it uncovers is always the solid black side.
- `keyboard.pressDepthBlack`: the range is unchanged (0–1.12, effectively capped at black height − 0.08 by `constrainKeyboard`). On the sheet, 0 / 0.15 / 0.3 / 0.43 all look right at 25° and 85°; the deeper body adds no new limit.
- Sheet: `docs/design/m9-2/keys.before.jpg` and `keys.after.jpg`. These show white keys pressed next to black keys mid-press (0.017 s, 0.034 s, held), white key depth 0.4 and 0.6, and black key depth 0–0.43, at 25° and 85°.
  - At the default white depth the old gap was only a hair: the black key bodies used to end 0.09 below the white tops.
  - It shows at deeper presses. Before, the black key over the pressed red key showed its rounded underside; after, its side runs straight down into the pressed key.

**B. Black notes back on the highway**

- **Draw order** (`Engine.applySettings`, `HeadLayer`, `SustainLayer`):
  - Black-lane sustains, ridges and heads sit at y = 0.012, 0.002 above the white ones as a safety margin.
  - They always draw after the white notes and are not depth-tested against them, so they win wherever they overlap, at any distance or camera.
  - Black heads keep far-to-near order among themselves. The glow twins follow the same depth state.
- **Settings** (sidebar → Notes, all look keys, pinned in Classic and the base):

  | Key                      | Label                 | Default | Range               |
  | ------------------------ | --------------------- | ------- | ------------------- |
  | `notes.whiteHeadHeight`  | White note height     | 0.35    | 0.1–0.8, step 0.05  |
  | `notes.blackHeadHeight`  | Black note height     | 0.5     | 0.1–0.8, step 0.05  |
  | `notes.blackSideShading` | Black side shading    | 40%     | 0–100%, step 5%     |
  | `notes.blackRidge`       | Raised black sustains | off     | (3D heads only)     |
  | `notes.blackRidgeHeight` | Ridge height          | 0.08    | 0.02–0.2, step 0.01 |

  Classic uses the new taller black default (answer 7). The other built-ins inherit the base.

- **Removed:** `notes.blackLift` and `notes.blackLiftMode`, and `blackLaneLift.ts`.
  - The settings version goes 8 → 9: the lift keys are dropped and `headHeight` becomes `whiteHeadHeight`.
  - This applies to stored settings, look files and backups (both carry their version).
  - Saved looks in Dexie carry no version, so **database v7** runs the same migration on them once.
- **Raised black sustains:** a `HeadLayer` in ridge mode (`RIDGE` define).
  - It spans head end → note end, with square ends and the sustain fill, stripes and transparency.
  - It replaces the flat black sustain while on, and only with 3D heads.
  - Both translucency variants are built. The default is one alpha on every face. A review seam (`?ridgeSides=solid`, `Engine.setRidgeSolidSides`) gives opaque sides under a translucent top. It goes once you pick.
- **Black side shading:** vertical faces of black heads and ridges are multiplied by `1 − amount` (the top face is untouched).
- **Contact shadow:** now cast from the black head height (instead of the old lift), so it falls like a block's shadow.

**Fixture and sheets**

- `scripts/make-black-notes-demo.mjs` → `test-fixtures/midi/black-notes-demo.mid`: white chords next to black notes with long sustains, plus a white/black run.
- `e2e/practiceClarity.spec.ts`: the 9.2 sheets (keys; black notes at 25°, 45° and 85°, quality Off and Medium; ridge variants).
- `e2e/ranges.spec.ts`: a "range black notes" test covering both heights, ridge height, side shading and shadow strength.
  - Moments: 2.2 s approaching, 2.85 s reaching the keys, and 5.1 s with the black sustains ending (the release check).
  - Tilts: 25° and 85°.
  - `Motion` gains a start bar and the `black` song; `captureWith` takes extra query parameters.

### Decisions not in the instructions

- **Black lane y = white + 0.002**, names 0.003 above that. This is the "tiny world lift". Depth isn't what separates the layers (draw order is), so it only guards against coplanar shimmer.
- **Ridges have square ends even with rounded heads** ("the same shape as a 3D head but lower, square ends").
- **Side shading applies to ridges too:** they are the same block shape.
- **Ranges:**
  - Both head heights keep the old 0.1–0.8. At 25° and 85°, no height in that range lets the top face dominate: from 85° the heads are seen from above at every height, and from 25° 0.8 is still a compact block.
  - Ridge height 0.02–0.2: nothing in that range makes a release read late (5.1 s frames). The ridge stays well below the heads. If you want ridges that read more clearly, the cap could go up; see the open questions.
- **The contact shadow offset now uses the black head height**, so it still reads as cast by a block standing on the highway.

### Results

- `npm run check`: type-check, lint, **745 unit tests** pass.
- E2e, the specs touched so far (`--retries=0`):
  - `chromium` `player.spec.ts`: 21/21.
  - `polish`: 21/21 after the version-literal fix (the Copy-look test asserted version 8; it now uses `SETTINGS_VERSION`).

  The full suite runs at the end of the milestone.

### B6 — Shadow strength: decision needed

Sheets: `docs/design/m9-2/notes.shadowStrength.tilt-25.jpg` and `.tilt-85.jpg`.

- **From the default and low cameras (25°–45°)** it's still close to invisible at the default 45%; at 100% there is a faint dark fringe beside the black sustains.
- **From high tilts (85°)** it now does something useful. From about 80% it draws a clear dark edge where a black note lies over a white one, separating the two. At 45% that edge is faint.

**Proposal: keep it, rework it into a separation edge.**

- Rename it "Black note outline" (or keep "Shadow under black-lane notes" with the new meaning).
- Raise the default to about 80%.
- Tighten the soft edge so it hugs the black note rather than spreading.

The alternatives are removing it (black side shading and the draw order already separate black from white), or keeping it as is. The rework is small (the default and the soft-edge width).

### Open questions

1. **B6:** keep and rework (above), keep as is, or remove?
2. **Ridge variant:** one alpha on every face, or opaque sides under a translucent top (`black-notes.*.jpg`, columns 4 and 5)? At the default height the difference is small; in close-up the solid sides read more like a block.
3. **Ridge height cap:** 0.2 is far from looking late. Raise it (say to 0.3) so ridges read more clearly from the default camera, or keep it low as the spec asks?
4. **Black side shading at 40%** is subtle at the default camera; it shows clearly at 80–100%. Keep 40% as the default?

### Manual review checklist

- Press white keys next to black keys at max white key depth: no black key undersides show, at 25° and 85°.
- Black notes over white notes: black always on top; zoom in and out and tilt 25°–85°: no shimmer.
- Notes → White note height / Black note height: both move; the front edges stay on the highway.
- Turn on Raised black sustains: a low ridge replaces the flat black sustain; it hides with 3D heads off.
- Reload with old settings that had a manual lift: no lift, your old head height is now the white height.
- A saved look from 9.1 still applies, with its head height as the white height.
