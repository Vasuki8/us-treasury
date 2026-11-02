# Retained-data analytical views implementation plan

**Goal:** Restore the approved Stitch charts, controls and table fields that can be supported by already retained inputs. Open one PR; do not merge or deploy it.

**Spec:** `output/stitch-live-deep-review-2026-11-01/deep-review.html` and its linked indicator, Treasury/market, Fed/FX and root-page findings. PR #34 was merged after exact-head CI passed, at `b38e1725186924948b371446a7a44b3537f10ac7`.

**Approach:** Reuse the existing native chart renderer and scoped catalogs. Use small closed view mappings, exact-period joins and separate chart CSVs, preserving selected-series exports and frozen legacy exports. Native periods, source notes, receipt lineage and units remain visible. No new chart library, source collection, forecast, licensed market quote or unverified policy annotation is introduced.

## Constraints and review focus

- No snapshot, immutable history, collector or 20 MiB-limit changes.
- A chart mode must change its actual series; a range must change actual displayed observations and the corresponding chart CSV.
- Preserve missing observations and exact month/year matches; do not replace a missing historical peer with its latest value.
- Source populations, nominal/real values, annual/quarterly horizons, and basis-point/percentage conversions remain distinct.
- Replaying a frozen context must not consult live data or silently replace historical CSV scope.
- Signed dealer positions remain signed; TIC position changes are not purchases; tentative issuance is not completed issuance.
- Unsupported views remain explicitly unavailable. Data that is public but absent from the retained capture belongs to the next batch.

## Work units

### Indicator families

- [x] Add closed family-native chart modes and separate plotted-view CSV, with selected-indicator exports unchanged.
- [x] Restore productivity/ULC comparison, compatible output/hours/index and inflation momentum views.
- [x] Expand historical ledgers from retained series with native unit labels and exact-date gaps.
- [x] Restore retained wage comparisons and annual CPI/PCE comparisons; compute labelled visible-window statistics.
- [x] Test actual series, calculations, date windows, source notes, missing peers, and selected-versus-chart exports.

### Auctions and ownership

- [x] Restore bid-to-cover, allocations and offering views with matched-auction count controls and settlement dates.
- [x] Restore TIC total, official/private and top-holder views, preserving all 13 input months for exact YoY changes.
- [x] Add separate view CSVs; preserve legacy raw CSV contracts.

### Specialist desks

- [x] Restore signed dealer-sector comparison, SOFR percentile fan and retained ON RRP volume/date.
- [x] Restore dated refunding package composition and compatible actuals from captured document text where safely parseable.
- [x] Restore TIPS breakeven/forward/liquidity views and retained inflation-wedge context/drilldowns.
- [x] Restore the FX pre/post comparison using existing scenario assumptions. Keep missing BoJ anchors, SEP priors and QT policy text explicitly unavailable.

### Shared integration and Labor

- [x] Round-trip bounded view/range controls through routes and saved/frozen context.
- [x] Bind new chart catalogs and CSV actions to the same loaded/frozen inputs.
- [x] Restore Labor's focused native/change control and retained program-native moving-average/annual/momentum choices, with matching export units.
- [x] Restore reference comparison starters. Do not add numerical uncertainty or original vintages absent from the capture.
- [x] Permit a strictly scoped SOFR distribution in the specialist catalog without live fallback.
- [x] Add only the minimal theme styling required by the restored plots.

### Verification and delivery

- [x] Run focused contract tests, complete suite, production build and repository budgets.
- [x] Exercise new controls, ranges and exports in desktop/mobile browser states in both themes.
- [x] Independent review; resolve material findings and recheck affected contracts.
- [ ] Open a PR against merged main, then stop without merging or deploying the new PR.

## Ownership and interface checks

Indicator worker owns family rendering/catalogs and data-free view definitions; root owns routes, actions and saved-context integration. Auction/ownership worker owns its two page modules; root supplies four closed state fields and catalog state. Specialist worker owns its desk modules; root extends existing desk-view keys and the distribution renderer. Root owns Labor and shared integration. No two workers mutate the same file.

The existing layout and palette are retained. Broader density/navigation cleanup and new official-source ingestion remain subsequent batches.

## Verification evidence

Final full suite: 2,647 passed, zero failures, skips or cancellations. Production build and strict built-asset smoke passed for 313 assets, including all source-history bundles. Independent financial and integration reviews have no outstanding material findings. Browser checks exercised all 26 indicator modes, auction and TIC views/ranges, Labor transformations and specialist controls, with representative desktop/mobile states in both themes. The actual ownership renderer regression now protects the view/range handoff.

New source collection and broader layout cleanup remain separate work. The new PR is to remain unmerged and undeployed.
