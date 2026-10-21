# Graphite foundation verification

Implementation uses the selected Graphite five-page design from the earlier planning chat. Original mockups are preserved. The working app is local only, uses native ES modules without third-party runtime dependencies, and labels every dataset as synthetic.

## Automated verification

`npm test` and `npm run build` are the acceptance commands. Loopback access is required by the HTTP server test. Final results are recorded after browser QA below.

## Browser checks

- Five connected pages render, with Graphite navigation and derived values.
- Saving an indicator survives a reload.
- Level/change and six/twelve-observation controls update chart and table together.
- Chart Home/End keys return exact first/last observations.
- Skip-to-content preserves the current deep link.
- Calendar event selection survives reload; empty watchlist filters remove stale previews.
- Ordinary-language “jobs” search finds two indicators; no-match searches keep focus and offer recovery.
- Native and indexed comparisons work; back/forward restores the selected mode.
- CSV actions complete without browser errors; exact export values and metadata are covered by model tests.
- Mobile width 390px and desktop width 1440px have no document horizontal overflow.

## Independent review and fixes

- Release IDs with digits/hyphens now validate against the actual release registry.
- Deep-link selections are limited to four, matching both rendered panels and exports.
- Mixed-frequency indexed charts use exact observation dates independent of series order.
- Skip-to-content focuses main without changing the hash route.

Regression checks were observed failing before the relevant fixes. No deferred correctness findings remain.

## Limits

This milestone verifies frontend behavior with fixtures. Official ingestion, live data freshness, real release schedules, historical source vintages, server persistence, and production deployment are not implemented.

## Final result

All 41 Node tests passed. All source modules passed node --check. The static production build completed. Browser checks passed on all five pages at 390px and 1440px; no browser error/warning logs were recorded. Original artifacts remain untouched.
