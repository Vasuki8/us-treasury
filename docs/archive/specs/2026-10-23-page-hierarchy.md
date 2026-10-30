# Clearer hierarchy across the remaining pages

The user approved the live Overview hierarchy and explicitly requested the same clearer hierarchy and less duplication on the remaining pages, preserving the current UI and colors. This is a continuation of that approved design, for economists/investors.

## Approach

Use native page-specific composition: the principal reading, chart, table or working controls lead; supporting research remains reachable through clearly named disclosures. Consolidate repeated metadata and repeated actions. Keep existing useful hierarchy on Indicator Detail, Calendar and Explore rather than forcing the Overview's card grid onto every task. A wholesale visual replacement would conflict with the preserved-UI requirement; hiding all detail would weaken the research workflows.

## Scope and placement

- Labor: headline conditions, focus/history, distinct weekly-release context, then breadth/trends. Consolidate duplicate detail/export actions; preserve same-release prior values and revised-history distinctions.
- Indicator: latest native reading, chart/history controls, existing data/method/history tabs. Give definition and metadata one useful home; retain critical status/coverage at point of use.
- Calendar: filters, chronological agenda and selected event. Keep one visible schedule source/retrieval summary; full schedule basis in evidence details.
- Explore: search/filter/results and selection first; comparison charts lead in comparison mode. Consolidate repeated selected-series metadata and export configuration; retain mode/window/no-fill context and real CSV access.
- Macro families: selected history and main topic readings; supporting research question/methods below. External accounts retain their Summary/Trends/Decomposition/Methods organization and accounting distinctions.
- Fiscal: TTM readings/context, fiscal trends/contributors, then monthly/category/cash-financing research; debt definitions and long methods disclosed.
- Refinancing: observed principal/exposure and contractual maturities/mix before modeled scenarios. Scenario controls and assumptions needed to interpret outputs stay adjacent; full assumptions/reconciliation deeper.
- Yields: selected-date curve work before retained current context; policy/funding context secondary. Retain nominal/real matching and par-yield limitations at point of use.
- Auctions: selected result and matched peers before competitive awards/history; gross monthly activity and full methods secondary.
- Ownership: dated Z.1 positions, changes and sector table lead. Reconciliation and source methods deeper. SOMA remains a distinct weekly/par-basis section with required credit/terms.
- GDP contributions, credit/banking, release evidence, capture history, Watchlist and Research: lead their own analysis/result or working list; group supporting attribution, methods, diagnostics and frozen assumptions without hiding active controls/errors/results.

## Invariants

- Preserve the exact current Light/Graphite palettes, compact Koyfin shell, routes, native charts, data, exports, follow/save/freeze/import and existing analysis semantics.
- Do not add feeds, forecasts, scores, consensus, beginner modes or new analytical calculations.
- Missing/unavailable, cached and zero remain distinct. Interpretation-critical errors, scope/coverage limits and disabled-control reasons stay visible beside their output.
- Retain reference/publication/retrieval clocks, units, frequency, adjustment and estimate roles where needed. Schedules do not verify publications; captured changes are not official revision causes.
- Observed versus modeled, flows versus stocks, percent versus percentage points, TTM versus monthly/FYTD, and incompatible ownership/valuation bases remain explicit.
- Every newly consolidated disclosure has a stable namespaced key; its session state survives asynchronous rerenders and return navigation. The approved Overview remains unchanged.
- Existing tables may scroll locally; the page fits 320px. Preserve keyboard focus and touch usability, native chart resizing and exact data-label units.

## Acceptance

All existing routes and important subviews remain functional. Meaningful tests cover primary/supporting order, retained critical limitations/actions and disclosure state. Independent economist/investor and code review, full regression/build, desktop/mobile theme checks and exact live-asset verification precede completion.
