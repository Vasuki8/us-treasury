# Research phase one implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Complete and verify each bounded task before integration.

**Goal:** Make the existing dashboard a clearer daily research workflow without changing its Koyfin UI or colors.

**Architecture:** Reorganize existing data and evidence, adding bounded route state for calendar scope and current-account sections. Keep publication evidence, collection health and latest revised readings independent. Preserve calculations, exports and frozen packages.

**Tech stack:** Native JavaScript modules, static HTML/CSS, Node tests, GitHub Pages.

**Spec:** User-approved first phase and economist/investor guidance recorded below.

## Global constraints

- Keep current UI, compact navigation and exact light/Graphite palettes.
- No new feeds, consensus, forecasts or publication-coverage promises.
- Retain every current-account calculation/export and complete frozen input scope.
- Preserve exact analysis windows, source basis, reference periods and unknown publication times.
- Successful collection is not proof of publication. Unsupported or unloaded evidence cannot become verified/current/agency-late.

## Economist and investor decisions

Overview order: verified retained publications, next distinct macro catalysts, six topic readings, momentum, followed measurements and captured/collection changes. Publication order uses publication day; capture order uses capture time. Retained historical evidence must not read as a new publication today. Claims initial and continued reference weeks stay distinct.

Calendar defaults to Macro releases; Treasury & funding and All events remain available. Routine Treasury debt dates belong to Treasury, FOMC belongs to Macro. Explicit event links reveal their intended event and scope. Filters intersect; reset restores Macro/Next 30 days/all topics/all days/watchlist off. Do not imply auctions are ingested.

Current account uses Summary / Trends / Decomposition / Data & methods. Shared measure/window controls remain accessible. Summary leads with native balance, exact-quarter accounting, ratio context and focused native history. Advanced analysis stays available by section.

Navigation groups Economy, Fed & rates, Treasury & funding, Calendar, Explore, My research; evidence is secondary. Search distinguishes pages, indicators, scheduled events and saved research, preserving exact indicator-code behavior and ambiguous queries.

## Review focus

- Historical publication captures and revised readings must never masquerade as new releases.
- Treasury deep links must survive Macro defaults and retained research contexts.
- Lazy/unavailable archives, unsupported programs and expired retry windows must not imply verified publication.
- Current-account hidden sections must not remove exports or frozen inputs.
- Search and detail returns must preserve specialist filters/windows without recursive or external destinations.

## Tasks

### 1. Daily briefing and two-axis freshness
Files: `src/research-brief.js`, `src/overview-page.js`, new focused release-coverage presentation/model, relevant tests. Consume existing reviewed evidence helpers and context publication state. Root owns `app.js`/`ui.js`; return integration hooks explicitly.
- [x] Add failing regressions for separated publication/capture/collection lists, ordering and unsupported/unloaded release states.
- [x] Implement briefing panels using existing compact panel styles; preserve all topic/momentum content.
- [x] Implement explicit reference/schedule/publication status without treating retry-plan expiry as currentness.
- [x] Run focused tests and independently review evidence semantics.

### 2. Current-account sections
Files: `src/macro-coverage-page.js`, focused helper/tests. Root owns route/workspace/app integration. New state `externalView`: `summary` (default), `trends`, `decomposition`, `methods`; query `section` only for external family.
- [x] Add failing tests for default simplified surface and reachability of all advanced panels/exports.
- [x] Move existing panels into four compact linked sections; retain existing calculators and frozen context.
- [x] Verify exact windows, focus measure and all current-account model/export regressions.

### 3. Calendar views and retained context
Files: `src/calendar-scope.js`, `src/calendar-page.js`, router/workspace/context/app integration and tests. New `calendarView`: `macro` default, `treasury`, `all`; query `scope`.
- [x] Add failing tests for classification, intersection, counts, explicit Treasury event reveal and reset.
- [x] Implement view control and daily Treasury grouping; retain complete chronological All view and schedule provenance.
- [x] Serialize scope through routes/saved workspaces/pins and verify selection/focus behavior.

### 4. Navigation and grouped search
Files: `index.html`, `src/research-navigation.js`, `src/search.js` or focused global-search module, app/router/workspace context and tests.
- [x] Add failing tests for grouped results, exact codes/commands, safe specialist returns and active navigation families.
- [x] Simplify global/secondary navigation and mobile Economy entry using existing compact styles.
- [x] Implement grouped search results and specialist origin preservation with bounded safe returns.
- [x] Verify keyboard/focus, escaping and no ambiguous automatic destination.

### 5. Integration, review and publication
- [x] Run focused tests throughout, then complete suite once integrated.
- [x] Build and smoke-check exact assets; independently review whole change.
- [x] Inspect desktop/mobile and both themes, including calendar deep links, current-account tabs, search and freshness.
- [x] Publish through existing GitHub Pages pipeline, compare live assets and verify live journeys.


## Verification

- Economist and investor advisers agreed on publication/capture separation, macro calendar default, native current-account balance first, and coherent research families. An independent reviewer checked the integrated change and all reported issues were resolved and rechecked.
- Full regression suite: 1,385 passed, zero failed/cancelled/skipped (189,983 ms). Focused regressions covered calendar scope/deep links, exact codes, specialist comparison returns, archive loading, evidence matching and all current-account section/export contracts.
- Static build and smoke check passed: 151 versioned assets, including all source history bundles. Asset sources use LF consistently for reproducible deployment.
- Browser acceptance: desktop and 390/320 px mobile; Light and Graphite. Calendar defaults to 12 macro events; Treasury retains 20 debt events; All retains 32. Exact legacy Treasury links retain their revealed scope after filtering. Current-account Summary renders one native chart; controls collapse by default, retain selected context and remain open during edits. Trends/Decomposition retain their original calculations and exports.
- Exact-code search, grouped search, mobile More/Escape focus, direct GDP evidence loading, Fiscal comparison → indicator → comparison → Fiscal, and separate collection/publication clocks were inspected. No page-level horizontal overflow or browser warning/error was observed in these checks.
- No new source feeds, consensus data or publication-coverage expansion. GDP and claims remain the reviewed publication programs.
- Published implementation `c0ad1984c26c3f5144784be99773a047017bc916`. The existing daily refresh was due and produced verified snapshot revision `7e1871f52763cfc89556ea3fd38340a7a4bb61b6`, assembled `2026-10-24T00:05:06.798Z`.
- GitHub Actions run [40043126432](https://github.com/Vasuki8/us-treasury/actions/runs/40043126432) succeeded: official-source refresh, refreshed-snapshot tests/build, Node 22 and Node 24 verification, and GitHub Pages deployment. Cloudflare was correctly skipped.
- `scripts/check-live.mjs` confirmed all 151 deployed assets exactly match the local build of revision `7e1871f`.
- Live acceptance repeated: Overview loaded both reviewed publication archives; 390 px grouped search opened Trade & current account Summary with one chart and collapsed controls; Calendar opened Macro with 12 events and FOMC preview. No page overflow or browser warnings/errors observed. Temporary viewport override reset; final live Overview retained as the deliverable.
- Live screenshot saved locally at `D:/Projects/ChatGPT/New folder/us-treasury/output/research-phase-one-7e1871f.jpg`.
