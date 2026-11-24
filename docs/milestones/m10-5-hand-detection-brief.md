> **Milestone 10.5 — Hand detection and split.** Adopted 2026-11-24 from the side project midi-transformer, as the source brief. The app-specific spec (m10-5.md) will be written when 10.5 starts. Key integration points: it replaces milestone 10's `handOf(note)` with a per-note assignment (stored per song, no MIDI rewrite unless exported), feeds the hand cages, and extends the Library's current channel → hand picker.

# Milestone brief: Piano hand detection and split (RH / LH)

**Source of truth:** `mwmckenzie/midi-transformer` @ `main` (6caa9ec), files `src/analysis/{notes,voices,hands,split,splitBeam}.ts`, `src/transforms/handSplit.ts`, `src/components/HandsPanel.tsx`.
**Purpose of this document:** a portable spec so the same feature can be rebuilt in another project. It describes behaviour and numbers exactly as implemented, with reference pseudocode. Language and UI framework are up to the target project.

---

## 1. Goal

Given a MIDI file, work out which notes are played by the right hand and which by the left, show a recommendation with a confidence percentage and the reasons behind it, let the user accept or override it, and then rewrite the file so the right hand is on one channel (default 0) and the left on another (default 1).

The key idea that makes this work well on real-world files: **the unit of classification is a "voice", which is a (track, channel) pair, not a channel and not a track.** That means:

- A file with one track per hand on the same channel is detected correctly (two voices, same channel, different tracks).
- A file with one track that holds both hands on two channels is detected correctly (two voices, same track, different channels).
- A file with both hands on one channel in one track is detected as a single "both hands" voice and routed to a split algorithm that assigns hands note by note.
- Track names (for example "Piano RH", "Left", "Bass") are used as strong hints because they belong to the track the voice lives in.

## 2. Scope of the milestone

In scope:

1. Note extraction with stable note ids.
2. Voice statistics per (track, channel).
3. Voice-level hand detection with role, confidence (0–1, shown as %) and human-readable reasons.
4. Pluggable note-level split algorithms for voices that hold both hands (four shipped: Phrase look-ahead, Chord-aware, Moving split, Fixed split).
5. User override at voice level (role picker) and at note level (click a note to flip it).
6. Applying the assignment: move notes to RH/LH channels, either in place or into two new tracks, copying channel-wide events (program, sustain, pitch bend) to both hands.
7. Tests and an accuracy benchmark.

Out of scope: playback, fingering, per-note confidence from split algorithms (see §11 for a suggested extension).

## 3. Data model

```ts
Note {
  id: string            // stable within one extraction: `${track}:${noteOnEventIndex}`
  track: number         // index of the track in the file
  channel: number       // 0–15
  pitch: number         // 0–127
  velocity: number
  start: number         // ticks
  end: number           // ticks
  onIndex: number       // index of the note-on event in its track
  offIndex: number      // index of the matching note-off, or -1 if never released
}

voiceId(note) = `${track}:${channel}`   // e.g. "1:0" = track 1, channel 0

VoiceStats {
  id, track, channel,
  trackName: string           // from the track's name meta event (may be "")
  program: number | undefined // first program change, see §4.2
  noteCount,
  minPitch, maxPitch, meanPitch, medianPitch,
  p10, p90                    // 10th / 90th percentile pitch
  avgPolyphony, maxPolyphony  // notes sounding at each onset
  wideSpanRatio               // fraction of onsets whose sounding notes span > ONE_HAND_REACH
  histogramGap                // longest run of empty semitones between p10 and p90
}

HandRole = 'right' | 'left' | 'both' | 'other' | 'drums'

VoiceGuess { voiceId, role: HandRole, confidence: 0..1, reasons: string[] }

HandDetection {
  guesses: VoiceGuess[]   // one per voice, in the same order as the stats
  right: voiceId | null
  left:  voiceId | null
  combined: voiceId[]     // voices that look two-handed
  summary: string
}

Hand = 'R' | 'L'
Assignment = Map<noteId, Hand>   // notes not in the map are left unchanged
```

## 4. Pipeline

```
MIDI file
  → extractNotes            (§4.1)
  → computeVoiceStats       (§4.2)  one VoiceStats per (track, channel)
  → detectHands             (§5)    role + confidence + reasons per voice
  → initial user roles      (§7)    R / L / Split / Ignore per voice
  → split algorithm         (§6)    only on notes of voices set to Split
  → manual note flips       (§7)
  → applyHandAssignment     (§8)    rewritten MIDI file
```

### 4.1 Note extraction

For each track, walk events in order. A note-on with velocity > 0 opens a note; a note-off (or note-on with velocity 0) closes the oldest open note with the same channel and pitch (FIFO, which is how most sequencers write overlapping same-pitch notes). Notes never closed end at the track's last tick (at least start + 1). Sort all notes by start, then pitch.

### 4.2 Voice statistics

Group notes by `voiceId`. For each group:

- Sort pitches. `p10`, `median`, `p90` use nearest-rank: `sorted[round((n-1) * p)]`.
- **Onset polyphony:** for each distinct onset tick, the set of notes sounding at that instant = notes still held (`end > tick`) plus notes starting at that tick. `avgPolyphony` is the mean count, `maxPolyphony` the max.
- **wideSpanRatio:** fraction of onsets where `max(sounding) - min(sounding) > ONE_HAND_REACH` (**15 semitones**).
- **histogramGap:** build a 128-bin pitch histogram, then find the longest run of zero bins for `p in [p10, p90]`.
- **program:** first program change on this channel inside the same track; if none, first program change on this channel in any track; else undefined.

## 5. Voice-level detection and confidence

Constants:

| Name | Value | Meaning |
|---|---|---|
| `ONE_HAND_REACH` | 15 semitones | Wider simultaneous span is unlikely to be one hand |
| `MIN_NOTES` | 8 | Voices with fewer notes are not classified |
| `RIGHT_NAME` | `/\b(right\|r\.?\s?h\.?\|treble\|upper\|melody\|rechte?\|droite\|destra)\b/i` | Track name hint for RH |
| `LEFT_NAME` | `/\b(left\|l\.?\s?h\.?\|bass\|lower\|linke?\|gauche\|sinistra)\b/i` | Track name hint for LH |
| keyboard program | undefined, 0–7, or 16–20 (0-based GM) | Pianos, electric pianos, harpsichord, clavinet, organs |

### 5.1 Step 1: drums and tiny voices

- Channel 9 (0-based, GM drums) → `drums`, **95%**, reason "Channel 9 is the GM drum channel".
- `noteCount < 8` → `other`, **50%**, reason "Only N notes".

### 5.2 Step 2: "both hands" score

Start `both = 0` and add evidence. `range = p90 - p10`.

| Evidence | Condition | Adds to `both` | Reason text |
|---|---|---|---|
| Unreachable chords | `wideSpanRatio > 0.15` | `min(0.5, wideSpanRatio × 1.2)` | "X% of onsets span more than one hand can reach" |
| Wide core range | `range ≥ 28` | `min(0.3, (range − 24) / 40)` | "Wide core range (N semitones between 10th and 90th percentile)" |
| Two registers | `histogramGap ≥ 4` | `min(0.2, histogramGap / 30)` | "Pitch histogram has a N-semitone hole, suggesting two registers" |
| Dense texture | `avgPolyphony ≥ 2.5` | `+0.1` | "Dense texture (avg N notes sounding)" |
| Named as a hand | track name matches RIGHT_NAME or LEFT_NAME | `−0.4` | (no reason; it suppresses the "both" verdict) |

If `both ≥ 0.45` → role `both`, **confidence = min(0.95, both)**. The maximum reachable raw score is 1.1, so the cap at 95% matters. Otherwise the voice becomes a *candidate* for right or left.

### 5.3 Step 3: pick right and left among candidates

```
right = first candidate whose track name matches RIGHT_NAME and not LEFT_NAME
left  = first candidate whose track name matches LEFT_NAME and is not right
named = {right, left} that were found by name

pool   = candidates with a keyboard program
ranked = (pool if |pool| ≥ 2 else candidates) sorted by medianPitch, descending
if right is null: right = highest-median voice in ranked that is not left
if left  is null: left  = lowest-median voice in ranked that is not right
if right.median < left.median and neither was named: swap them
```

Name hints always win over pitch. Pitch only fills in a hand that names did not provide, and the "swap if upside down" correction only applies when neither hand was chosen by name.

### 5.4 Step 4: confidence for right / left / other

For each candidate:

```
if voice is right or left:
    conf = 0.3
    if voice was chosen by name:
        conf = 0.85                         reason: Track name "X" suggests the <role> hand
    if the other hand exists:
        sep  = |median(this) − median(other)|
        conf = max(conf, min(0.9, 0.4 + sep / 30))
                                            reason: Median pitch A vs B for the other hand (sep semitones apart)
    else:
                                            reason: Only one keyboard voice found
    if program is not a keyboard program:
        conf = conf × 0.7                   reason: Not a keyboard instrument
else:
    role = other, conf = 0.3                reason: Not selected as either hand
```

Worked numbers for the pitch-separation term: 0 semitones apart → 40%, 12 apart (an octave) → 80%, 15 or more apart → capped at 90%. A named voice never drops below 85% unless it is a non-keyboard instrument (85% × 0.7 ≈ 60%).

Confidence is shown as `round(conf × 100)%` next to the role, with an expandable "why" list showing `reasons`.

> **Note for re-implementers:** these confidences are hand-tuned heuristic scores on a 0–1 scale, not calibrated probabilities. Keep the reasons list; it is what makes the percentage trustworthy to a user. If you want calibrated numbers, fit them against the benchmark in §10.

### 5.5 Summary sentence

- right and left found → "Hands look separate already: right hand is track T ch C ("name"), left hand is …" (plus "… also looks two-handed" if any `both` voices exist).
- only `both` voices → "Both hands appear to share …. Pick a split algorithm below."
- only one voice → "Only one playable voice, …. It is set to Split in case it holds both hands."
- nothing → "No piano-like voices found."

## 6. Note-level split algorithms

Used only for voices whose role is Split. Common interface:

```ts
SplitAlgorithm {
  id, name, description,
  params: ParamSpec[]          // { key, label, type: 'number'|'note', default, min, max, step, help }
  run(notes: Note[], params, ctx: { ticksPerBeat, seconds?(tick) }): Map<noteId, Hand>
}
```

`ctx.seconds` converts ticks to seconds via the tempo map (default 120 BPM if no tempo events). New algorithms are added by implementing the interface and registering them; the UI builds parameter controls from `params` automatically. The first registered algorithm is the default.

### 6.1 Phrase look-ahead (beam search) — default

Best on human-played files where both hands share one channel. Keeps the `beam` cheapest partial readings and only commits at the end, so one wrong chord cannot swap the hands for several bars.

Params (defaults): `reach` 12, `center` 60 (C4), `prior` 0.1, `inertia` 1, `chordMs` 30, `holdSecs` 0.8, `beam` 32.

```
clusters = group notes (sorted by start, pitch) where start_sec − first_start_sec ≤ chordMs/1000
           each cluster sorted by pitch
beam = [{cost 0, posR = center+7, posL = center−12, heldR [], heldL [], trail null}]

for each cluster at time t:
  next = {}
  for each hyp h in beam:
    heldR, heldL = h.held* filtered to notes with end_sec > t + 0.01
    for k in 0..|cluster|:               # lowest k notes → L, rest → R
      L, R = cluster[:k], cluster[k:]
      c = 0
      for hand in (L, R):
        fresh = held notes of this hand started < holdSecs ago
        over(ps) = max(0, max(ps) − min(ps) − reach)
        c += 4 × over(new + fresh) + 1 × max(0, over(new + allHeld) − over(new + fresh))
        if |new + fresh| > 5: c += 10 × (|new + fresh| − 5)
        if new notes:
          c += inertia × 0.5 × |mean(new) − pos_hand|
          c += prior × Σ (R: max(0, center − pitch), L: max(0, pitch − center))
      lTop = max pitch of L ∪ fresh heldL;  rBot = min pitch of R ∪ fresh heldR
      if lTop > rBot: c += 12 + 2 × (lTop − rBot)          # crossing
      update pos: pos = 0.65 × pos + 0.35 × mean(new)       per hand with new notes
      if posR − posL < 3: push them apart to mid ± 1.5
      candidate = {cost h.cost + c, positions, held + new, trail → (cluster, k)}
      key = round(posR) | round(posL) | heldR ids | heldL ids
      keep only the cheaper candidate per key
  beam = cheapest `beam` candidates of next
follow beam[0].trail back to assign every note
```

### 6.2 Chord-aware (greedy)

Same chord-cutting idea, decided cluster by cluster with no look-ahead. Params: `reach` 14, `cluster` 0.0625 beats, `inertia` 1, `startR` 67, `startL` 48. Cost per cut: `4 × (span − reach)` if over reach (held notes included), `10 × (count − 5)` if over five notes, `inertia × 0.5 × |mean(new) − pos|`, `+6` if hands cross. Positions smoothed 50/50, kept at least 5 semitones apart.

### 6.3 Moving split point

For each note, look at pitches of notes starting within ±`window`/2 beats (default 4). Find the largest gap between adjacent sorted pitches; if ≥ `minGap` (7), split at its midpoint, else use `fallback` (60). Note ≥ split → R.

### 6.4 Fixed split point

Note pitch ≥ `split` (default 60) → R, else L.

### 6.5 Measured accuracy

On 15 piano-midi.de pieces (hands in separate named tracks used as ground truth, notes merged then re-split): Phrase look-ahead **89.5%**, Chord-aware **86.6%** of notes correct. The look-ahead also shortens the longest run of consecutive wrong notes, which is what users notice.

## 7. Recommendations and overrides (UI behaviour)

Per voice, the user sees: track number, channel, track name, instrument, note count, range, median, **guessed role + confidence % + "why"**, and a role picker.

Initial role per voice from detection:

| Detected role | Initial pick |
|---|---|
| right | Right hand |
| left | Left hand |
| both | Split (both hands) |
| other, drums | Leave as is |

Special case: if detection found a right voice but no left and no `both` voices, that lone voice starts as **Split** (a single keyboard voice is most likely both hands).

Final assignment for each note:

```
role = userRole[voiceId(note)] (default Ignore)
if role is Ignore: skip
hand = manualFlip[note.id] ?? (role == Split ? algorithmResult[note.id] : role)
```

Other behaviour to keep:

- **Click to flip:** clicking a note in the proposed view flips its hand; flipping it back to the computed value removes the override. Overridden notes are outlined. "Clear" removes all flips.
- **Reset to detected** restores initial roles and clears flips. Roles and flips also reset when the file content changes (note ids depend on it).
- **Compare view:** two piano-roll lanes, "Current: coloured by channel" and "Proposed: RH → ch X, LH → ch Y". Optionally one lane per other algorithm with "differs on N notes", differing notes outlined.
- **Live counts:** notes and pitch range per hand.
- **Warnings:** a voice left as "Leave as is" that already sits on a target channel ("would mix with the hands"); RH and LH set to the same channel.
- Channels display as 0–15 or 1–16 (user toggle); everything internal is 0-based.

## 8. Applying the assignment

Options: `rightChannel` (default 0), `leftChannel` (default 1), `layout`: `inPlace` | `twoTracks`.

```
for each assigned note: retarget its note-on and note-off events (by event index) to chFor(hand)
voiceHandsUsed[voiceId] = set of hands its notes went to

inPlace: rebuild each track in event order
  - assigned note events → same event, new channel
  - other channel events (program, CC incl. sustain, pitch bend, aftertouch) of an affected voice
      → duplicated once per distinct target channel that voice feeds
  - unpaired note events in an affected voice → right-hand channel
  - everything else unchanged

twoTracks: as above, but affected voices' events are removed from their tracks and appended to
  two new tracks named "Right Hand" and "Left Hand" (each sorted by tick); file becomes format 1.
```

The copy of channel-wide events is what keeps both hands on the same instrument and pedalling after a split. Results can be written over the file or saved as a copy ("name (hands).mid").

## 9. Edge cases

| Case | Expected behaviour |
|---|---|
| Hands in two tracks, same channel | Two voices; named or pitch-ranked into R and L |
| Hands in one track, two channels | Two voices in the same track; ranked by pitch (both voices share the track name, so a name like "Piano" gives no hint and pitch decides; a hand-specific name like "Right" would tag the first voice only, a known weakness) |
| Both hands in one channel and track | One voice flagged `both` (or the lone-voice rule) → Split |
| Named RH/LH tracks that are wide | −0.4 penalty keeps them as hands rather than `both` |
| Names contradict pitch | Names win; no swap is applied to named voices |
| Only one keyboard voice plus other instruments | Pitch ranking uses all candidates if fewer than two keyboard voices; non-keyboard voices get ×0.7 confidence |
| Drums on channel 9 | Always `drums`, never assigned |
| Fewer than 8 notes | `other`, 50% |
| Note never released | Ends at track's last tick |
| Overlapping same pitch | FIFO pairing |
| No tempo map | 120 BPM assumed for ms/sec parameters |
| Leftover voice already on target channel | Warning before apply |
| Format 0 file with `twoTracks` | Output becomes format 1 |

## 10. Acceptance criteria

1. **Separate hands by name and pitch:** a file with track 1 ch 5 "Right" and track 2 ch 2 "Left" (plus others) detects `right = "1:5"`, `left = "2:2"`.
2. **Combined voice:** a single piano voice holding both hands is reported in `combined` (role `both`).
3. **Track-within-channel detection:** two tracks on the same channel are reported as two voices and can be assigned to different hands.
4. **Every guess has a confidence in [0, 1] and at least one reason** (except candidates whose only reason is "Not selected as either hand").
5. **Confidence formulas match §5** (unit-test the separation term: 12 semitones → 0.80; named → ≥ 0.85; non-keyboard ×0.7).
6. **Every split algorithm scores > 90%** on a synthetic two-hand demo with known truth.
7. **Look-ahead never swaps hands for long:** on seeded human-style textures (held bass, inner voices near middle C, RH runs dipping down, ±45-tick jitter), the longest run of consecutive wrong notes is ≤ 4 and accuracy > 80%.
8. **Chord grouping by time:** notes at 0 ms and 20 ms with a 30 ms window form one chord; a note at 200 ms is separate.
9. **Apply in place:** result has notes only on channels 0 and 1, note count unchanged, program copied to the LH channel; file round-trips through write → parse.
10. **Apply as two tracks:** two new tracks added, note count unchanged, sustain CCs present in both hand tracks.
11. **Whole-voice assignment** moves only that voice's notes to the target channel.
12. **Benchmark harness:** given a folder of MIDI files with tracks named right/left (or rechts/links), merge the hands, re-split with each algorithm, and report per file: % correct, longest wrong run (notes and seconds), runtime; plus totals. Optional per-algorithm parameter overrides.

## 11. Suggested extensions for the new project

- **Per-note confidence** for split voices, for example the cost margin between the chosen and the next-best cut in each cluster, or the share of the final beam agreeing on a note. This would let the UI highlight uncertain notes for review.
- **Calibrated voice confidence** fitted on the benchmark instead of hand-tuned constants.
- **Detection that uses the split:** run the default split on a `both` candidate and use the cost per note as extra evidence.
- More name hints (for example "Piano 1/2", "Primo/Secondo", "M.D./M.G.", "RH/LH" without word boundaries).
- A DP/Viterbi split as an exact version of the beam search.
