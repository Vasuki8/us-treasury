# Meridian Stitch Workspace Implementation Plan

> **For agentic workers:** Use executing-plans for the shared shell; bounded page adaptation can run in parallel. The user's instruction to implement the selected Stitch UI authorizes this work.

**Goal:** Bring the latest Meridian Macro Research Workspace design into the existing US Treasury application.

**Architecture:** Adapt existing native templates and CSS instead of importing generated mockup scripts. Shared tokens, a neutral sidebar, compact utility bar, separate metric cards, analytical panes and locally scrolling tables apply throughout the site. Existing models, route/controller contracts and retained official data remain authoritative.

**Tech Stack:** Native HTML/CSS/JavaScript; existing Node test/build/Pages tools, no new runtime dependencies.

**Spec:** https://stitch.withgoogle.com/projects/7931842367557945060; retained reference HTML in output/stitch-latest. This is the user's selected design; no alternative design approval is needed.

## Global Constraints

- Use Meridian only; no Lanelytic.
- Preserve all pages, search, exports, comparison, research persistence, history and refresh safeguards.
- Preserve Light/Graphite themes, compact/comfortable density, mobile navigation and keyboard use.
- Retained official data replaces every sample observation. Do not invent unsupported API, cloud accounts, payroll vintages, trade simulations, consensus or verification badges.
- Existing self-only CSP, strict 20 MiB asset budget, minimum 13px type and 44px mobile touch controls remain.
- Implementation and a verified local preview are in scope. Do not merge or deploy without a new publication request.

## Review Focus

- All navigation destinations stay reachable in both desktop rail and mobile More menu.
- At 320/390px tables scroll locally without page overflow; controls and content remain above bottom navigation.
- All dates, units, source failures, partial coverage and preliminary status stay visible.
- Theme/density remain reversible and readable; chart contrast checks inspect final token values.
- Page layout changes preserve focused windows, selection, comparison returns and CSV exports.

### Task 1: Shared shell and visual system

**Files:** index.html, styles.css, src/app.js, src/research-navigation.js; relevant layout/contrast tests.

**Interfaces:** Keep IDs, data-nav attributes, persisted appearance values and existing delegated events. Add local inline SVG navigation icons. Replace the terminal design layer with current Stitch's neutral light sidebar, 210px rail, 44px utility header, restrained violet accent, four-corner cards and 12px grid. Use existing fonts without a network dependency.

- [x] Establish baseline focused tests.
- [x] Apply tokens and shared panel/table/control typography, desktop/mobile navigation and dark counterpart.
- [x] Ensure contrast checks evaluate effective palette rather than obsolete first declarations.
- [x] Verify focused tests and representative local pages.

### Task 2: Analytical page layouts

**Files:** src/overview-page.js, src/labor-page.js, src/indicator-page.js and shared CSS as necessary.

**Interfaces:** Existing generated routes, chart() options, disclosure keys and data-* actions remain. Overview uses briefing, four cards, stacked analytical charts alongside upcoming releases, cross-check cards and a four-column monitor. Labor uses briefing, cards, coverage notice, stacked core charts with releases/comparison context, then weekly releases/focused history/catalog. Indicator puts native reading/context before a broad history workspace. Other pages inherit the shared system.

- [x] Adapt layout markup only where required; preserve all real data and actions.
- [x] Run page/briefing/window regression tests; add tests only for changed behavior.

### Task 3: Verify and hand off

**Files:** output/stitch-implementation (untracked QA artifacts).

- [x] Full test suite, production build, strict asset smoke check.
- [x] Browser QA primary five pages plus specialist route families at desktop/mobile in both themes; inspect representative screenshots.
- [x] Verify search, theme/density, mobile menu, date editing, comparisons and return journeys.
- [x] Independent final review; resolve material findings, rerun affected checks.
- [x] Deliver local preview and screenshots with a clear publication status.

## Rulings and evidence

- The latest Stitch project contains 26 returned screens, mainly desktop specialist concepts. Existing Calendar/Explore and unsupported analytical products will use the new shared visual language while preserving supported functions. Mockup-only data services and promises are excluded.
- Already in a linked writable worktree; use a new codex branch from c9221d1. Preserve output artifacts.
- Visual CSS changes use browser inspection rather than tests mirroring style declarations. Logic changes receive focused regression tests.

## Verification completed

- Full suite: 2,365 tests passed, zero failures or skips. Final focused suite: 55 passed.
- Final production build and smoke check passed, 226 assets; existing strict 20 MiB budget intact.
- Browser QA: 170 layout cases, covering all 25 navigation destinations at 1440/390px in both themes and the five primary pages at 320/768/801/900/1024px in both themes. No page overflow or source-history loading failures.
- Visually inspected desktop/mobile Overview, Labor, Indicator, Calendar and Explore examples. Verified theme/density, global UNRATE search, mobile More/Escape focus, Calendar selection, custom Labor dates, the moved comparison starters and return-state preservation. No browser warnings/errors captured.
- Independent review of patch 95D5BC039C9C6BD9D9D00B96224B0563926ACDAA0C499F694A2F12E28D441CAE found no Critical/Important issues. One cosmetic existing specificity mismatch leaves monitor values at 20px rather than the requested 21px; retained because it is readable and does not affect the workflow.
- Browser investigation found overly narrow analytical panels at 801px. The final 801–1100px layout stacks those panels; verified Overview chart width is 544px at 801px and no overflow across all additional breakpoints.
- Effective theme palettes now live in one authoritative declaration per theme. Existing contrast checks therefore validate the rendered palette rather than a superseded declaration.
- New sidebar behavior deliberately exposes topic families initially, then preserves manual disclosure choices across pages. Its regression was observed failing before implementation and passing after it.
- Data, source/history files, refresh workflows and collection safeguards unchanged. Stitch sample figures, invented account/API functionality and unsupported simulations were not imported.
- QA evidence remains untracked in output/stitch-implementation and output/stitch-latest.
- Publication status: implementation is ready for a review PR; no merge or deployment is part of this request.

