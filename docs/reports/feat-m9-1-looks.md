# Review report — `feat/m9-1-looks` (Milestone 9.1: Looks v2, range trimming, built-in looks)

Spec: `docs/milestones/m9-1.md`. Plan: `docs/milestones/m9-1-plan.md`. Commits are local only (not pushed), as agreed.

## 2026-11-22 — Plan, before building

### What was done

- Created branch `feat/m9-1-looks` from `main` (milestone 9 merged).
- Roadmap: 9 ✅; 9.1 added between 9 and 9.5, marked in progress.
- Wrote `docs/milestones/m9-1-plan.md`, covering:
  - where the spec meets today's code;
  - the plans for sections A, B and C;
  - the 9.5 overlay design;
  - brief changes and the build order;
  - five questions.

No code changed.

### Decisions I made that weren't in the instructions (proposed in the plan)

- The active look id stays in localStorage with the settings; saved looks move to Dexie v6 (plan S6).
- Existing `look:…` ids are kept; new looks get UUIDs (plan S4).
- Classic pins every key explicitly, so default changes can't move it.
- Range sheets for motion use a new test-only fixed-step capture hook (`?capture=1`). The hook also reports particle counts against the budget.

### Results

No code changes yet. Not run: `npm run check`, `npm run build`.

### Open questions

See plan §8. In short:

1. Resolution settings count as cost?
2. Built-ins reset the camera?
3. Backup collision rules for looks?
4. Range sheets as a zip outside git?
5. Export a modified look as saved or as current?

### Manual review checklist

- [ ] Read `docs/milestones/m9-1-plan.md` and answer §8.
- [ ] Roadmap row for 9.1.
