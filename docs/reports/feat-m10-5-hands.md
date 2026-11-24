# Milestone 10.5 report: Hand detection and split

## Round 0 — 2026-11-24: plan

**Done**

- Committed the spec and mockups.
- Wrote `docs/milestones/m10-5-plan.md`. No code changed.

**How the plan was checked**

- Read the reference code at `6caa9ec` and ran it, outside the repo: detection on the 3 bundled songs and 7 fixtures; the four algorithms on the 3 songs with both hands merged to one voice; the look-ahead's runtime and uncertainty also on `long-demo`. Timings are Node on this machine, not a browser or tablet.
- `npm run check` and e2e not run: documentation only.

**Decisions not in the instructions**

- Proposals only, all in the plan: two tables instead of one, a Web Worker, notes parsed from raw events with `FACTS_VERSION` 2, a new roll component on the shared geometry.

**Known issues and open questions**

- Four design questions (plan §8, Q1–Q4): per profile or per song; the "uncertain" rule; notes detection would silence; single voices.
- The brief (`docs/brief.md`) will need updates to decisions 1, 6, 30–32, 35, 37, 75 and 127.

**Review**

- [ ] Answer Q1–Q4.
- [ ] Object to any default in Q5–Q10.
- [ ] Approve the plan.
