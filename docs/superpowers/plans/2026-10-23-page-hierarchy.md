# Remaining page hierarchy implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Execute the approved Overview pattern using native renderers.

**Goal:** Apply clearer hierarchy and less duplication across all remaining pages while retaining the current UI and exact Light/Graphite colors.

**Architecture:** Native page-specific composition with a small disclosure helper and session disclosure-state integration. Existing models, charts, controls and research package contracts stay in place.

**Tech stack:** Native JavaScript modules, CSS, Node tests, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-23-page-hierarchy.md`. Economist/investor placement guidance is retained in `tmp/remaining-hierarchy-domain.md`.

## Global constraints

- Preserve current UI/colors, the approved Overview, all native datasets/analyses, routes and research workflows.
- Primary analysis/result/working list leads; supporting methods/diagnostics are disclosed. Existing useful page hierarchy receives targeted consolidation.
- Keep material errors, coverage caveats, source/clock distinctions, units and observed/model distinctions at point of use.
- Do not change data policy, calculations, package formats, feeds or chart lifecycle.
- Root owns shared UI/state/CSS/router files and tests/pages.test.js; implementers edit only their assigned page files/tests.
- Shared helper contract: `supportingDetails(key,label,body,{meta='',open=false,className=''}={})` from `src/page-hierarchy.js`; stable fully namespaced keys such as `yields:methods`. It renders `details.supporting-details.hierarchy-details[data-page-disclosure]`; body is existing trusted native HTML, other strings escaped.
- Shared root wrapper `.page-hierarchy[data-hierarchy-page]` scopes styling to non-Overview pages. Existing page-specific classes/IDs remain.
- Do not commit, publish, run the full suite, start browser/server or edit shared CSS from an implementation subtask. Write any proposed CSS to the task report for root.

## Review focus

- Hidden controls/graphs must render correctly after expansion and preserve disclosure choices on async rerenders.
- Source rights/notices and material limitations must remain accessible; warnings must not disappear inside closed details.
- Date-window-dependent histories must remain distinct from latest reading snapshots and selected schedule/reference dates.
- Retained input metadata must not be dropped from CSV or frozen results when UI panels consolidate.
- No duplicated interactive IDs, repeated primary-value panels or broken comparison/return navigation.

### Task 1: Shared hierarchy and session disclosure behavior

**Owner/files:** Root: new `src/page-hierarchy.js`; `src/overview-disclosures.js`, `src/app.js`, `src/pages.js`, `src/ui.js`, `styles.css`; `tests/page-hierarchy.test.js`, `tests/pages.test.js`, `tests/research-app-actions.test.js`.
**Interfaces:** Provide the helper contract above before implementers import it. Extend existing session disclosure memory to include `data-page-disclosure` without colliding with Overview keys; preserve old export/tests. Wrap non-Overview content in `.page-hierarchy`, preserving the existing page dispatcher.
- [x] Add meaningful failing tests for escaped/stable disclosures and namespaced cross-page open/closed restoration, preserving Overview behavior.
- [x] Implement helper and memory; add scoped layout/supporting-detail styles with exact existing tokens. Compact repeated metric comparison prose with unchanged delta units/prior dates, retaining full explanation in the title and current date in its own line. Redraw only an expanded chart subtree with its native/frozen catalog.
- [x] Run focused integration tests; update the actual-app harness to supply the real chart expansion helper and verify live/frozen expansion callbacks.

### Task 2: Primary analysis and discovery pages

**Owner/files:** Primary implementer: `src/labor-page.js`, `src/indicator-page.js`, `src/calendar-page.js`, `src/explore-page.js`, `src/macro-coverage-page.js`; their focused tests and new `tests/primary-hierarchy.test.js`. Do not edit shared tests/pages.test.js or the Overview tests. Existing radar-overview-indicator.test.js Indicator suffix may be adapted only if required, never its Overview cases.
**Interfaces:** Use shared helper and fully namespaced keys; existing IDs/data actions/native chart definitions stay. Read the spec and economist placement map. Root handles shared wrappers/CSS/memory.
- [x] Inspect current renderer/tests; write targeted failing acceptance checks for changed primary/supporting order and retained critical actions/caveats.
- [x] Consolidate duplicate Labor detail/export actions, repeated Indicator metadata, Calendar source/retrieval, Explore comparison metadata/export block. Macro families: move supporting research question below focused history; retain external accounts sections and identity/decomposition caveats.
- [x] Keep active search/filter/date/transform/data tabs/selection/CSV and material warnings visible; use native controls and data.
- [x] Run focused existing and new tests; self-review; write report to task brief's report path with files, tests and any CSS needs.

### Task 3: Treasury specialist pages

**Owner/files:** Treasury implementer: `src/fiscal-page.js`, `src/refinancing-page.js`, `src/yields-page.js`, `src/auctions-page.js`, `src/ownership-page.js`, `src/market-functioning-page.js`; their focused tests and new `tests/treasury-hierarchy.test.js`.
**Interfaces:** Use shared helper; fully namespaced stable keys; native dataset/model/CSV/action contracts unchanged. Read spec and economist map.
- [x] Add targeted failing tests for main observed analysis before supporting methods/model detail and retained scope/errors/controls/attributions.
- [x] Apply page-specific placement in spec. Do not collapse scenario controls/essential hypothetical assumptions or matched-date/tenor caveats; keep SOMA separate with rights notices.
- [x] Preserve current outputs/units/methodology/exports; disclose supporting history, source diagnostics, definitions or long methods where appropriate.
- [x] Run focused tests; self-review; write task report with actual tests and any CSS needs.

### Task 4: Context, evidence and research-library pages

**Owner/files:** Context implementer: `src/macro-page.js`, `src/credit-context-page.js`, `src/vintages-page.js`, `src/release-page.js`, `src/watchlist-page.js`, `src/research-page.js`; their focused tests and new `tests/context-hierarchy.test.js`.
**Interfaces:** Use shared helper; fully namespaced keys. Read spec and economist map. Keep frozen package shapes/export provenance unchanged; root handles shared app/CSS.
- [x] Add targeted failing acceptance checks for leading analysis/results/lists and preserved evidence/capture/source distinctions and actions.
- [x] Consolidate supporting methods, provenance and diagnostics; make working results/lists primary. Avoid wrapping required controls, failed-loading recovery, publication selection or active frozen result in closed sections.
- [x] Preserve CPI limitation state, source credits/rights, capture metadata mismatch warnings, release schedule-only/verified distinctions, Watchlist order/compare/follow, all Research subviews/import/save/freeze/exports and frozen inputs.
- [x] Run focused tests; self-review; report actual files/tests and CSS needs.

### Task 5: Review, verification and live publication

**Owner/files:** Root plus independent review agents; shared assertions and `docs/superpowers/page-hierarchy-verification-2026-10-23.md`.
- [x] Review each group for spec and code quality; resolve material findings. Economist/investor reviews final page order and caveats.
- [x] Normalize LF, run full regression (1,427 passed), build and all-asset smoke check (153 assets).
- [x] Browser-check all routes and important subviews on desktop, 390px/320px, Light/Graphite; exercise disclosures, async load, main controls, native charts and existing research workflows. Published proof follows deployment.
- [x] Commit scoped changes and publish via existing workflow as authorized by continuation of live rollout. CI, all 153 exact live assets and desktop/mobile published views verified; runtime and evidence recorded in `docs/superpowers/page-hierarchy-verification-2026-10-23.md`.
