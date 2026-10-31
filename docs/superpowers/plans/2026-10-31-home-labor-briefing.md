# Homepage and Labor Briefing Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. The user approved the preceding economist/investor content proposal and requested implementation on these two pages.

**Goal:** Give visitors a concise account of changes, relevant cross-checks and a clear path into existing research.

**Architecture:** Reuse official retained series, reviewed publication evidence, charts and delegated navigation. Add a small shared reading-brief component that describes two retained observations without inferring publication, economic significance or causation. Keep all existing research and source safeguards.

**Tech Stack:** Native JavaScript/HTML/CSS, Node tests, existing GitHub repository.

**Spec:** Approved conversation proposal: homepage developments, compact readings, explanatory trends, upcoming releases, cross-checks and nonempty personal research; Labor latest readings/revision availability, payroll and unemployment trends, weekly claims, focused history and detailed catalog.

## Global Constraints

- Keep both themes, density, routes, exact historical windows, exports and saved research.
- Preserve missing observations, series-specific dates, units, critical source warnings and statistical uncertainty.
- A retrieval is not a publication; current revised payroll history cannot establish first-published estimates or release revisions.
- Preserve source collectors, immutable history, refresh workflows and the 20 MiB asset limit.
- No Lanelytic assets, new dependencies, fabricated consensus or composite economic scores.

## Review Focus

- Missing/nonfinite final observations must remain unavailable rather than falling back to older values.
- Gaps between observations must retain explicit comparison dates, not become a prior-month claim.
- Negative payroll changes must describe employment losses correctly, not label them positive gains.
- Cached or failed series must retain visible warnings in the compact briefing.
- Mobile source order, menu access and focused-history controls must work without page overflow.

### Task 1: Build evidence-based summaries and the two page hierarchies

**Files:** new src/reading-brief.js and tests/reading-brief.test.js; src/overview-page.js, src/labor-page.js, src/workspace-preview.js, styles.css; relevant overview/labor regression tests.

**Interfaces:** readingChanges(catalog, ids) returns descriptive structured comparisons; readingBrief(ids, state) renders safe linked summaries. seriesPreview gains an optional summary flag, defaulting to existing behavior. Existing data-compare, route and labor-section hooks remain.

- [x] Confirm isolated checkout and clean baseline: 27 focused tests pass.
- [x] Add failing tests for comparison direction, gaps/missing values, signed payroll values, cache warnings, independent dates and limited headline precision.
- [x] Implement the shared reading brief and compact chart preview mode.
- [x] Lead Overview with three changes; retain four readings, trends and next releases; add comparison questions; hide empty personal research.
- [x] Lead Labor with descriptive changes and revision availability; promote core trends, preserve weekly/focused-history tools, all 23 readings and uncertainty.
- [x] Update layout assertions only where order intentionally changes; retain all measurement and window checks.
- [x] Verify focused tests and desktop/mobile layouts in both themes.

### Task 2: Verify and prepare delivery

- [x] Run the full test suite, production build and strict asset checks.
- [x] Obtain independent branch review; resolve findings and verify fixes.
- [x] Prepare the focused changes and validation evidence for PR delivery.

## Execution notes

Ruling: use the existing clean managed worktree and a new codex/home-labor-briefing branch. The prior approved content proposal supplies the design; implement inline without repeating a design approval round.
Ruling: no new payroll publication collector in this UI task. Display revision coverage honestly and link existing retrieval research. Cost: first-release payroll revisions remain unavailable until independently sourced.

Implementation: readingChanges lives beside the existing dailyBrief in research-brief.js; reading-brief.js is the small linked view. This keeps collection/publication distinctions in the existing model and avoids another model module.

Review: immutable patch A6CF8A6579C75CDFB1DABAAFDA9037F0218FAD17536DE384534CEF118F917A39 received one important finding: negative payroll headlines changed the measured quantity while the displayed delta remained a change in monthly employment change. Fixed with a consistent monthly-payroll-change title and literal positive-to-negative, negative-to-negative and unchanged-negative regression cases (RED to GREEN). The unconditional preliminary heading was treated as a factual metadata issue and changed to a neutral uncertainty heading; a source-without-preliminary-flag regression also went RED to GREEN. Section numbering was aligned with the planned reorder. All 92 focused tests passed after fixes.

Review rulings: browser appearance/interactions and full-suite/build verification remain parent-owned and are checked in Task 2. Source collector accuracy is unchanged; no new data or publication assertions are introduced.

Presentation: mobile Labor omits its duplicate sibling navigation strip while keeping all destinations in More. Healthy collection status is quieter only on these two pages; warning states and expanded details retain their existing presentation.

Final validation: 2,365 tests passed, zero failures/skips. Production build and strict asset smoke checks passed for 226 assets, retaining the 20 MiB limit. Browser inspection covered both pages at 320, 390, 768, 1024 and 1440 pixels in both themes (20 cases), with no page overflow or browser warnings/errors. Both density settings, source-detail expansion, focused date edits, payroll comparison/return context and homepage growth comparison were exercised. Screenshots and logs are retained under output/home-labor-briefing (not committed).
