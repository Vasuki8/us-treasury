# First usable-research milestone

**User request:** Implement the first milestone from the supplied website review while retaining Graphite. The PDF is recommendation evidence, not independent authorization for other milestones or external services. The adopted scope is its page 8 first milestone and relevant page 9 acceptance tasks, plus the user's explicit mobile watchlist requirement. Existing session delivery conventions (local tests, main push, Actions and live verification) remain in force. Do not stage the user's exports/, output/ or tmp/ files.

## Design

Keep current official data, registry/provenance/freshness, immutable source archives and static deployment. No new data source, dependency or infrastructure. Preserve Graphite tokens, compact panels, numeric alignment, theme/density preferences and accessible focus styling.

### Date windows

Expose 1Y/3Y/5Y/All and exact inclusive UTC start/end dates on indicator and comparison views. Retain old 6/12-observation deep links explicitly labeled OBS. Calendar presets anchor to the latest retained observation (across selected comparison series), not the current date; all comparison panels share resolved calendar bounds. Full transformations run before window filtering so the first displayed change can use its previous observation. Keep missing rows/gaps, source frequency and actual reference dates; do not backfill. Show full versus displayed coverage, observation counts and any invalid window. CSV uses the identical window and transform. Default new indicator/comparison views to 1Y; retain default 12-observation behavior for unaffected overview/module charts and existing direct model calls.

Public model range argument accepts legacy numeric counts or `{preset:'1y'|'3y'|'5y'|'all'|'custom',startDate:'',endDate:''}`. Router state adds `window:'1y',startDate:'',endDate:''`; an old range=6/12 uses window='observations' unless an explicit calendar window is also present. Routes persist window/dates, comparisons and return context. New date-window helper validates real ISO dates and shared bounds. Chart data attributes carry the range object as escaped JSON; renderCharts decodes it without coercing to Number.

### Comparison meaning

Native separate panels remain default. Explicit measurement classifications admit ratio indexing only for positive level/count/amount measures; reject rates, growth, contributions, balances, and any nonpositive observed value in the selected window. Unknown classifications fail closed. The common index baseline must be an exact shared date with strictly positive finite values. Add `difference` comparison: change from an exact shared finite baseline (zero/negative allowed), retaining each series' units in separate panels, with percentage-point/basis-point conversions where appropriate. No interpolation, aggregation or mixed-unit overlay. Error messages name the ineligible measurement and recommend native or baseline differences. Exports retain original provenance plus the comparison baseline/formula. Label derived measures and transform units accurately.

### Search and research context

Search the entire catalog: titles, codes, official source IDs, topics, units, agency, definitions and calculation metadata. Aliases expand/rank matches rather than excluding newer entries. Rank exact identifiers and titles before loose metadata; preserve composable filters. Global command submission keeps existing shortcuts and uses the same ranked results. Keep catalog results series-only. Indicator links from catalog/watchlist include a validated internal return route; returning restores query, filters, selected comparison and date configuration, plus same-session scroll. An explore return may retain one bounded watchlist origin; watchlists discard nested returns and other nested destinations are removed. Related links use curated topic/input/module mappings rather than the current fixed labor/CPI set.

### Watchlist and capture coverage

Add #/watchlist, visible mobile access, existing desktop access, saved-series list with open/remove and add-to-comparison actions. Reuse current browser preferences; distinguish session-only storage. Indicator comparison adds the measure to existing selection (up to four) rather than replacing the workspace. Provide a visible return to watchlist from its indicator and comparison workflow. Keep empty states useful and keyboard/touch controls accessible.

History/replay headings use Captured by with exact UTC retrieval cutoffs and first available capture boundaries, while keeping release times distinct. Preserve old routes, source-partition loading and unknown first-release evidence. New coverage summaries show observed reference-date bounds/counts and retrieval separately; no fabricated observations or release dates.

## Tasks and ownership

- [x] Date/comparison model: new date-window helper, measure eligibility, baseline differences, same-window provenance CSV; regression-first formula/missing/calendar tests. Own model.js and new model helpers/tests.
- [x] Search/related/watchlist components: ranked full-catalog expansion, curated related/module context, reusable watchlist page using existing style primitives; regression-first tests. Independent new modules, no model/app edits.
- [x] Router/app/UI integration: calendar range controls/chart serialization/coverage, safe internal return context and scroll, watchlist route/mobile entry, selected-comparison actions, transform labels, Captured by boundary language.
- [x] Verification: full regressions, archive integrity, exact CSV equality, source gaps/date boundaries/eligibility, keyboard and responsive widths 1440/1024/736/390/320, loading/error/storage states; independent review.
- [ ] Delivery: explicit stage excluding user artifacts; commit/push, Actions, exact live asset verification and representative acceptance workflows before claiming live.

## Acceptance

Find newer Treasury measures with Treasury search; open/back retains workspace. Expose all retained SOFR observations, apply exact dates and export matching chart/table rows. Negative GDP contributions cannot be ratio-indexed; native/difference remain available. On mobile open saved series, add to comparison, return to watchlist. Captured by before the first retrieval remains unavailable. All existing source rights, immutable captures and working specialist routes remain intact. Auction pagination, new agency families, pinned packages and general navigation regrouping belong to later milestones.

## Local verification, 22 October 2026

630/630 tests pass; rights-gated build and 66-asset HTTP smoke pass. Independent review checked chart/CSV equality for 458 successful retained-data configurations. SVG geometry regressions verify common calendar bounds, shorter coverage, later baselines and unchanged explicit OBS behavior. Regression tests cover leap dates, missing observations, invalid bounds, measurement eligibility, negative/zero baselines, search ranking, safe bounded returns, storage failures and capture boundaries.

Browser acceptance passed: Treasury search includes newer series; exact BC_2YEAR ranks its direct yield first; open/back restores filters and focus. All 573 retained SOFR observations are accessible; a downloaded September 2026 CSV exactly equals model output for 21 observations and their metadata. Negative GDP contributions reject ratio indexing and recover to native/difference views. Saved indicators open, add to comparisons and return to mobile watchlists. Watchlist → comparison → detail → comparison preserves its watchlist origin; keyboard removal focuses an adjacent action or the empty-state catalog link. Invalid dates disable export and render no observations; keyboard tabs and chart readouts work. Four main research workflows fit 1440/1024/736/390/320px without page overflow. Local screenshots are retained in ignored test-results/.

All 26 canonical snapshot/archive files remain byte-identical. The original archive audit passes 50 global and 600 source boundary replays, 48 revision histories, 260 source CSV comparisons and the original 48 baseline CSVs. Current series derived from official levels (payroll, CPI, PCE, wages and retail growth) are explicitly calculated in detail/CSV metadata; historical captured metadata is preserved. No source, terms, collector, data-admission rule, dependency or deployment convention changed. All history means retained observations, not newly collected history. Existing BLS calendar caching and other source limitations continue. Delivery checks are performed after pushing and reported with the exact commit and Actions outcome.
