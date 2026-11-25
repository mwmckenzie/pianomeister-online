# Milestone 11 Phase 0 report: measure

## Round 0 — 2026-11-25: plan

**Done**

- Committed the brief; renumbered: performance is 11, "Tablet, MIDI out, offline" is 12, Benchmark mode is 11 Phase 0, "Parse MIDI once" is Phase 1 and "Make CI e2e workable" is Phase 5. The milestone numbers in the roadmap, the brief (decisions 33, 88), CLAUDE.md, two code comments and an `e2e.yml` comment follow. Older reports and specs keep their numbers.
- Wrote `docs/milestones/m11-plan.md` (answers to questions 1–6, the plan for the instruments). No app code changed, only two comments.

**How the answers were checked**

- The code was read. Draw calls were measured with a throwaway script outside the repo: production build, Chrome 158, RTX 4090, 1600 × 900, the transport state checked at each sample. A first run was discarded: it didn't check the state, and one quality reported a 1 px wide buffer, which didn't recur and wasn't explained.
- WebGL under `--disable-gpu` was checked with that script: SwiftShader, WebGL2 available, no GPU timer.
- Not measured: the audio block limits (read from the code), the hidden-tab playlist, the loop repeat's draw calls (milestone 9.2's numbers), and whether CPU throttling reaches SwiftShader. The plan says so for each.

**Decisions not in the instructions**

- Running the benchmark on the tablet through USB port forwarding and the production preview instead of `npm run dev -- --host` is proposed (plan Q1), not decided.

**Open questions**

- Seven, in plan §11.

**Checks**

- `npm run check`: exit 0, 933 unit tests (128 files). E2e not run: only two code comments changed.

**Review**

- [ ] Answer the questions in plan §11, or say "go" for the defaults.
- [ ] Approve the plan.
