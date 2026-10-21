# Official data integration verification

## Source verification

Public, keyless requests succeeded against Treasury Fiscal Data, Treasury's daily par yield CSV, the BLS public API and BEA's NIPA quarterly/monthly flat files. The committed snapshot records each actual retrieval timestamp, source URL and SHA-256 response digest. Source histories contain 100 debt observations, the current Treasury yield history and up to 36 observations for each BEA/BLS measure. Annual-rate measures retain their original index and year-ago inputs.

Ten indicators now contain official observations. DOL claims and Census retail histories are empty and explicitly unavailable. Every production synthetic history, release event, consensus value and revision record was removed.

The BLS calendar feed returned access denied during direct verification. Calendar pages therefore link to the official BLS and BEA schedules and display no fabricated events or results. Historical observation publication timestamps remain null because these feeds do not provide them. Retrieval and source-file modification dates are separate metadata.

## Automated checks

- `npm test`: 77 passed, zero failures.
- `npm run build`: completed.
- `node scripts/check-build.mjs`: passed for 12 built entry/assets/modules, including the snapshot and registry.
- `node --check`: all browser source modules passed.
- `git diff --check`: no whitespace errors.

Deterministic tests cover official payload parsing, exact series selection, unit conversion, calendar-matched monthly/yearly changes, annual-average exclusion, missing/zero data, conflicting duplicate dates, source failure retention, actual retrieval timestamps, formula-safe CSV and retained numeric source precision. An integration assertion reconciles every retained source-value calculation with the normalized snapshot.

## Browser checks

Verified all five pages at 390px and 1440px widths without document horizontal overflow or console warnings/errors. Verified BEA values and source identifiers, unknown publication dates, six-observation period-change charts, keyboard readouts, CSV export actions, official labor headlines, unavailable claims, empty verified calendar, ordinary-language search and indexed comparisons. Treasury curves retain all 14 tenor labels and do not show a numeric value for a missing tenor.

## Independent review

Corrected conflicting Treasury dates that previously overwrote one another, BEA retrieval timestamps that previously used the cutoff clock, and numeric source strings that were unnecessarily prefixed during CSV escaping. Each fix has a regression test observed failing before correction. Snapshot assembly timestamps now follow retrieval completion.

## Operational limits

The static app reads an official snapshot; it is not an intraday market feed. `npm run data:refresh` is an explicit local update, and CI uses the committed snapshot without upstream network dependencies. Failed refreshes preserve last-good data with a visible error and a nonzero exit status. No recurring refresh, historical publication-vintage archive, verified calendar ingestion, DOL/Census integration or hosting deployment is included in this change.
