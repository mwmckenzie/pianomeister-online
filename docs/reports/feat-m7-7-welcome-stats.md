# Review report — `feat/m7-7-welcome-stats` (Milestone 7.7: Welcome & stats)

Plan: `docs/milestones/m7-7.md` with the mockups `docs/design/m7-7/source/QGWelcomeA.dc.html` and `QGStats.dc.html`. Your answers:

1. **Backdrop:** Welcome is a child route of the player, over the live paused scene. Stats uses the last-frame snapshot.
2. **Ranges:** rolling windows, labelled "7 days · 30 days · 12 months · All", with deltas "vs previous 30 days". This week on Welcome stays the calendar week.
3. **Headers:** "‹ Player" stays, with a Home button beside it on Library, Bookmarks and Stats.
4. **Keys:** H and S are in the Everywhere scope. Enter on Welcome resumes through "Open the selection", and Resume has the focus on arrival.
5. **Calendar shades:** fixed thresholds of 0 / 1–14 / 15–29 / 30–44 / 45+ minutes.

The roadmap edit marking 7.6 done goes in with this branch. Nothing is committed.

---

## 2026-11-19 — Round 1: built

### What was done

| Area           | Files                                                                                                                                                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core: insights | `core/insights/*` (new)                                                                                                                                               | **Days:**<br>• `dayKeyOf`, `shiftDayKey`, `weekdayOfKey`, `weekStartKey`;<br>• `splitByKey`: splits a stretch at any local boundary;<br>• `practiceByDay`.<br>**Welcome:**<br>• `practiceStreaks`: current (today or yesterday) and longest;<br>• `weekComparison`;<br>• `heatmapLevel` and `heatmapWeeks`;<br>• `greeting`;<br>• `pickHighlights`: tempo rise, milestone, favourite song, top bookmark, longest session;<br>• `pickSuggestions`.<br>**Stats:**<br>• `rangeWindows`;<br>• `bucketUnitFor` and `bucketPractice`;<br>• `headlineStats`;<br>• `recordsInWindow`;<br>• `timeOfDayGrid` and `TIME_BANDS`;<br>• `topPractice`;<br>• `tempoProgress`;<br>• `playLogCsv`.<br>**`dailyMinutes`** now uses the shared day split (same results). |
| Commands       | `COMMANDS.ts`, `App.vue`, `SHORTCUT_GROUPS.ts`                                                                                                                        | **Home `H` and Stats `S`:** Everywhere scope, handled with `?` on Welcome, the player, library, bookmarks and stats. The Everywhere group's "where" line is updated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Settings       | `PlayerSettings.ts`, `SETTINGS_REGISTRY.ts`, `SETTINGS_LAYOUT.ts`, `SettingHome.ts`, `AppearanceTab.vue`                                                              | Appearance → **Start → Start on** (Welcome / Player), default Welcome. New keys merge over the defaults, so there's no settings version bump.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Routing        | `router/router.ts`, `views/EmptyRoute.vue`                                                                                                                            | `/` is the player with child routes `''` (`player`) and `welcome` (lazy). `/stats` is lazy.<br>**Start guard:** at the site root (no hash), a cold start goes to Start on's page. An explicit `#/` or a reload of the player stays on the player.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Resume data    | `data/LastOpened.ts`, `data/Library.ts`, `stores/libraryStore.ts`                                                                                                     | `lastOpened` gains an optional `bar`, which needs no migration; `setStoppedBar` and `lastOpened()` are new.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Player         | `PlayerView.vue`, `player/PlayerActions.ts`, `player/playerActionsKey.ts`                                                                                             | **Welcome mode:**<br>• the canvas is blurred, saturated, dimmed and slightly scaled, with the radial dim;<br>• the timeline, the song block and the right column are hidden; the menu stays, with Home lit;<br>• the player's keys rest and the sidebar is hidden;<br>• entering Welcome pauses playback.<br>**Stopped bar:** remembered on pause, stop, song end, leaving the player and entering Welcome. It is restored at startup (clamped to the loop by the transport).<br>**Actions provided to Welcome:** resume, play, choose, the playfield panel, settings.<br>**Menu:** Home at the top and Stats after Library.<br>**Picker:** loading from it while on Welcome opens the player.                                                        |
| Welcome        | `views/WelcomeView.vue`, `welcome/ResumeCard.vue`, `WeekCard.vue`, `CalendarCard.vue`, `HighlightRotator.vue`, `SuggestionChips.vue`, `ProfileChip.vue`               | Built to QGWelcomeA:<br>• positions: greeting 70/96, card 200/96, the right column at top 100 and right 32, highlight at bottom 118, chips at bottom 48;<br>• sizes: a 520 px card and 300 px tiles; greeting 46 px / 300, the date 15 px;<br>• Enter resumes; the content re-renders on a profile switch.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Charts         | `charts/BarChart.vue`, `HeatmapGrid.vue`, `WeekdayGrid.vue`, `TopBars.vue`, `TempoLine.vue`, `ChartCard.vue`, `ChartTooltip.vue`, `ChartTip.ts`, `useElementWidth.ts` | **Hand-drawn SVG,** following the dataviz rules:<br>• one hue, with primary only for the current day or period;<br>• bars at most 24 px wide (Welcome's are 32, per the mockup), rounded at the top and square at the baseline, with a whole-slot hover area;<br>• a recessive grid; tooltips show the value first;<br>• bars and tempo points also take keyboard focus;<br>• each `ChartCard` has "Show as table".<br>**Fit:** charts measure their width; the calendar can shrink its cells to fit.                                                                                                                                                                                                                                                 |
| Stats          | `views/StatsView.vue`, `stats/HeadlineTile.vue`, `stats/usePracticeDays.ts`, `components/HomeLink.vue`                                                                | Built to QGStats: the 16 px inset; the header (‹ Player, Home, title, range, song filter, Export CSV); the 6 tiles; rows at 1.9fr/1fr and 1.25/0.75/1.1.<br>**Below 1100 px:** tiles in 3 columns, and the bottom row wraps.<br>**Scrolling:** the page scrolls vertically.<br>**CSV:** downloads as a Blob.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Other links    | `LibraryView.vue`, `BookmarkManagerView.vue`, `ProfilesTab.vue`                                                                                                       | **Home** button in the Library and Bookmarks headers; "See all stats" in Settings → Profiles.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Formatting     | `format/localeWeekStart.ts`, `dayLabel.ts`, `shortDayLabel.ts`, `bigDuration.ts`, `lastPlayedPhrase.ts`                                                               | **Week start:** from `Intl.Locale` week info, falling back to Monday.<br>**Labels:** "Thu 19 Nov", "21 Oct", "3 h 14 min", "yesterday at 21:40".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Docs           | `docs/brief.md`, `docs/roadmap.md`, `docs/milestones/m7-7.md`                                                                                                         | **Brief:** decisions 24, 27, 38, 60, 65, 66 and 89 are updated, and 93–100 are new (Welcome, Resume, highlights, suggestions, stats page, stats charts, chart accessibility, CSV).<br>**Roadmap:** 7.6 ✅ and 7.7 in progress.<br>**m7-7.md:** "Agreed when planning" (decisions 24–29).                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Decisions I made that weren't in the instructions

1. **Start on applies only at the site root.** A cold start with no hash honours the setting; `#/` links and reloading the player stay on the player. That keeps deep links and refreshes working. It also meant the existing e2e tests now open `./#/` (45 `goto`s changed mechanically).
2. **"No history" means no play records.** On a first run the player writes `lastOpened` as soon as it loads, so the card's empty state can't depend on that. The card then reads "Start practising" with the button "Start with ⟨loaded song⟩".
3. **Maybe next never suggests the song the card already offers** (`exceptSongId`).
4. **The stats "today" key is a swatch,** not the word "blue": under Ember the primary colour is orange.
5. **Tempo progress isn't tied to the range.** It runs from the window's start, but at least 12 weeks back, so 7 or 30 days still show a trend, as the mockup's 9 weeks under "Month" do.
6. **Calendar sizes:** 26 weeks for 7 and 30 days, 52 for 12 months and All, with cells shrinking to fit. At 1280 px a 52-week row is too wide for 11 px cells.
7. **"When you practise"** shades by quarters of the busiest cell. Fixed thresholds are for days, and these cells sum a whole range.
8. **Highlight periods:** "this month" and "this week" are calendar periods. Milestones show only when passed in the last 30 days.
9. **The CSV** has a UTF-8 byte-order mark, so spreadsheet apps read accents right, and CRLF line ends (RFC 4180).
10. **Accent colour for rises:** a positive change (+25% vs last week, a positive headline delta, "current 4") is in the secondary colour, as in the mockups. The words carry the meaning, so colour is never the only cue.
11. **The menu on Welcome** stays where it is in the player (under the hidden song block), not centred vertically as in the mockup. Its position doesn't jump between Welcome and the player.

### Deviations from the sources

- **Welcome's menu** has Home at the top and keeps the 7.5 Keyboard shortcuts icon and the profile item (the mockup has neither). It sits under the song block's space rather than centred.
- **"This week"** starts on the locale's first day (Sunday in the US-English test browser; Monday for en-GB).
- **The resume card's bookmark line** shows the summary only for a named bookmark; an automatic name already is the summary.
- **The stats range control** reads "7 days · 30 days · 12 months · All" (your answer), not "Week · Month · Year · All". The minutes chart's title follows the unit: "Minutes per day / week / month".
- **The "today in blue" note** became a primary swatch plus "today" (decision 4 above).
- **Sample names** in the mockups (Gymnopédie, Für Elise) are placeholders; the shots use the bundled songs.

### Test and check results

- `npm run check`: **550 unit tests** pass.
  - The new `core/insights/insights.spec.ts` covers:
    - greeting bands and "Me";
    - streaks: today vs yesterday, gaps, and the DST week in Europe/Berlin;
    - the midnight split;
    - the week comparison with Monday and Sunday starts;
    - heatmap thresholds and layout;
    - rolling windows (7 days, 30 days, 12 months, All);
    - day, week and month buckets;
    - headline numbers;
    - time-of-day bands across midnight;
    - top lists, tempo progress, highlight order and texts, suggestions (including the excluded song);
    - CSV: escaping, local time in Berlin, deleted bookmarks.
- `npm run build`: passes.
- **e2e** (production preview, `--retries=0`): **129/129** (3.1 min).
  - The first full run failed 3, all tests catching up with this milestone:
    - **Two in `longNames`:** `goto('./#/')` from the bookmark manager is now only a hash change, so the manager's "Discard this duplicate?" guard stopped it. The test now discards its duplicate.
    - **One in `shortcuts`:** it recorded `S` as a second key for Stop, but `S` is Stats now. It uses `J`.
  - **New `welcome.spec.ts`** (8 tests):
    - the start setting (Welcome, then Player);
    - "Welcome back";
    - Resume to the stored bar 26 by Enter, and bar 50 landing on the loop start 17;
    - going Home stores the bar;
    - H and S from the player and the library, plus the Home link;
    - Choose another;
    - rotation every 8 s, a pause while hovered and dot selection on the fake clock;
    - a suggestion loading;
    - This week and the calendar with the streak.
  - **New `stats.spec.ts`** (4 tests):
    - the range and song filter change the numbers, including the change against the previous 7 days;
    - top songs, Show as table, the bar tooltip, and the tempo empty state;
    - the CSV download's name and content;
    - the empty page.
- **Visual:** **82/82** affected shots: the m6 player, library and settings; all m7, m7.5 and m7.6; and the new m7.7 shots (Welcome with history and empty, Stats at 30 days with all songs, Stats at 12 months with Minuet; 1280×720 and 1024×768, Glacier and Ember).

  I compared them with QGWelcomeA and QGStats. The first pass showed three things, now fixed:
  - "Maybe next" repeated the song the empty card already offered;
  - "today in blue" was wrong under Ember;
  - at 1024×768 the Stats cards shrank into the page instead of scrolling, and the 52-week calendar scrolled sideways.

  The cheat sheet now scrolls vertically (more commands), never sideways.

### Known issues and open questions

1. **Heatmap and weekday cells have no keyboard focus.** Their tooltips are hover-only; the values are reachable through "Show as table". Making 182 cells tab stops would swamp the tab order. Is that OK, or do you want arrow-key navigation inside the grid?
2. **Rendering behind Welcome:** the scene keeps rendering every frame under the CSS blur. Welcome is idle, but on a weak tablet you may prefer a still frame there; I haven't run the perf suite this round.
3. **"Start on" and installed PWAs:** the manifest's `start_url` is the site root, so the home-screen app honours the setting.

### Manual review checklist

- [ ] Open the site root: Welcome over the blurred scene; Enter resumes paused at the remembered bar.
- [ ] Appearance → Start → Player, then reopen the site: the player.
- [ ] H and S from the player, library and bookmarks; the Home buttons in the headers.
- [ ] Welcome: This week (your locale's first day), the 12-week calendar and the streak; a highlight rotating and pausing on hover; Maybe next.
- [ ] Stats: 7 days / 30 days / 12 months / All and a song; the deltas' wording; Show as table; Export CSV opening cleanly in a spreadsheet.
- [ ] 1024×768: Welcome's cards don't collide; Stats scrolls rather than squashing the charts.

## 2026-11-20 — Round 2: frozen scene behind Welcome (blocked on e2e)

### What was done

- `Engine.setFrozen(frozen)` stops the render loop; `Engine.invalidate()` renders one frame while frozen. Frozen, a frame is drawn on freezing, on resize (and DPR), `applySettings` (theme, any setting), `setSong` and `setGuides`. Unfreezing restarts the loop with a fresh time step (no long `dt` jump). `stats()` gains `rendered` (frames since mount).
- `PlayerView`: frozen while the route is `welcome` (also when mounted on it); any `timelineChange` (seek to the stopped bar, song load, pause) calls `invalidate()`.
- Tests: `e2e/welcome.spec.ts` — "the scene behind Welcome is frozen" (no frames while idle, one after a resize, the loop again after Resume); `e2e/perf.spec.ts` — "Welcome open vs closed".

### Decisions

- The HUD's own `requestAnimationFrame` (bar/beat readout) keeps running behind Welcome: it doesn't touch WebGL and is tiny. It and the audio ticker account for most of the remaining main-thread time below.

### Results

- `npm run check`: pass (550 unit tests). `npm run build`: pass.
- `npm run test:perf` (headed, real GPU, 1600×900, Canon loaded and paused, 10 s each):

  | State | Frames rendered / s | Main-thread busy (CDP TaskDuration) |
  | --- | --- | --- |
  | Player, paused (Welcome closed) | 120 | 85.6 ms/s |
  | Welcome open (frozen) | 0 | 39.0 ms/s |

  The playback runs are unchanged: Canon frame 0.28 ms (default), 0.28 ms (sidebar open), 0.31 ms (highest), interval 8.33 ms.
- Visual shots (`m6 player|m6 library|m6 settings|m7 |m7.5|m7.6|m7.7`): 82/82.
- New Welcome e2e file alone: 9/9.
- **Full e2e (preview, `--retries=0`): FAILING — 116/130, then 115/130 on a second run.** The same ~14 tests fail with the freeze disabled (`setFrozen` made a no-op, rebuilt): the freeze is not the cause. Failing: picker (Enter loads, Esc / Library…, stored facts, sort by last practiced), bookmarks (save toast Rename/Undo, same settings again), listKeys (library, bookmark manager, picker), longNames (picker/manager/dialogs), profiles (second profile), shortcutsLayout (cheat sheet at 1280×720), stats (range and song filter). Run alone or by file (picker + bookmarks + listKeys) they pass (24/24). Round 1's full run passed 129/129 on 19 Nov; these runs started just before and after midnight (20 Nov).

### Known issues and open questions

- The full-suite failures above: not diagnosed yet. Candidates: something date-dependent after midnight (seeded "today" vs the stats/picker windows), or load-dependent timing in the full parallel run. Not committed.

## 2026-11-20 — Round 3: the full-suite e2e failures (root cause)

### Findings

1. **main fails too.** `main` (0afecc8) in a separate worktree, full suite on the preview, `--retries=0`: **107/117** (10 failed: listKeys, bookmarks, library drop, backup Merge, picker, loopBounds, debug, loopJump). So the failures are not from this branch.
2. **This branch with `--workers=1`: 130/130.** With 5 workers: 130/130 in 1.4 min, faster than 10 workers (2.9 min, failing).
3. **What the failing tests were waiting for** (traces, `--trace=retain-on-failure`): every one waited on the result of an input — a route opening (`bookmark-manager`, the library's selected row, `shortcuts-sheet`), a song or bookmark loading (`hud-title` "Invention", `hud-bookmark` "Opening", `hud-full-song`) — while the page still showed the player. The network logs show why: each page starts ~230 sample requests at once; 100+ were still pending seconds later, and the on-demand requests made after them (`BookmarkManagerView-*.js`, `HomeLink-*.js`, `ManageTabs-*.js`, `minuet-in-g.mid`) never completed within the 5 s expect — queued behind the samples on HTTP/1.1's six connections per host. Each 83 KB sample waited a median **~300 ms for its first byte**: the preview server was starved.
4. **CPU:** total **~99%** throughout a 10-worker run, almost all of it Chrome — each test's headless browser renders the WebGL scene in software at full frame rate (well over a core each). Something else was also running on the machine (a game, ~1 core). Playwright's default locally is half the logical cores: **10 workers** on this 20-thread machine.

**Root cause:** CPU oversubscription in the local e2e run (10 software-WebGL browsers + one Node preview server), not this branch. On 19 Nov the same default passed (129/129) with a lighter machine; the margin was thin.

### Suspects checked

- Welcome at startup: the e2e tests open `./#/` (the player), not Welcome; the failing ones never show Welcome.
- Freeze/invalidate hooks: the same failures with `setFrozen` a no-op (round 2).
- Extra lazy chunks: the stuck chunks are the existing BookmarkManagerView/HomeLink/ManageTabs; they're stuck behind samples, not behind other chunks.
- `./#/` vs `./`: as above.

### Fix

- `playwright.config.ts`: locally `workers: '25%'` (5 here) instead of Playwright's default 50%; CI stays at 1. No timeouts or retries changed.
- Tried and dropped: limiting smplr's sample fetches to 4 at a time (a custom `storage`) so on-demand requests always had free connections. It cleared the "stuck chunk" failures but at 10 workers sample loading then exceeded 30 s, and it would slow sample loading for users on HTTP/2 (GitHub Pages) for no gain there. Reverted.

### Results

- `npm run check`: pass (550). `npm run build`: pass.
- Full e2e on the preview, `--retries=0`, twice: **130/130 (1.6 min)** and **130/130 (1.5 min)**.
- Visual shots unchanged since round 2 (82/82); perf as in round 2.

### Open question

- The player renders at full frame rate while paused. Rendering only on change when paused (as Welcome now does) would cut the idle cost for users on tablets and for the tests; it's a behaviour change, so not done here.
