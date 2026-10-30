# Core labor historical coverage

The user selected core labor history for the next delivery. Extend six existing outputs without changing the UI, colors, provider, credentials, units or formulas: payroll employment level, monthly payroll change, its three-month average, participation, employment/population and U-6.

## Source scope

Use the existing BLS API and registered historical bootstrap. Four bounded keyless API probes confirmed twelve monthly rows in each native birth year: `CES0000000001` from January 1939 (29,923 thousand jobs), `LNS11300000` from January 1948 (58.6 percent), `LNS12300000` from January 1948 (56.6 percent), and `LNS13327709` from January 1994 (11.7 percent). Actual source receipts and bytes are retained under `tmp/labor-history-source-review/`. These are current revised series, not first releases or one unchanged historical methodology. CES counts jobs; CPS measures people. Preserve source footnotes and published missing values.

## Compatible admission

Preserve every existing `BLS_HISTORY_*` version-1 export and profile meaning. Add `BLS_LABOR_HISTORY_STARTS`, `BLS_LABOR_HISTORY_CODES`, `BLS_LABOR_HISTORY_OUTPUTS` and `BLS_LABOR_HISTORY_PROFILE` for the expanded contract. The new starts/codes include all old five native inputs plus payrollLevel/participation/employmentPopulation/underemployment. The new outputs include all old thirteen plus payrollLevel/payroll/payrollAverage3m/participation/employmentPopulation/underemployment (nineteen total).

The new exact profile is `{version:2,scope:'unemployment-cpi-core-labor',firstPeriods:<nine native starts>,contextYears:1}`. Export `blsHistoryDefinition(source)` returning the matched `{profile,starts,codes,outputs}` only for a complete valid version-1 or version-2 marker. `hasBlsHistory` accepts both. Admission and macro per-observation permissions use the selected definition; a version-1 marker cannot grant the six new outputs historical receipt permissions. Old immutable captures keep their exact keys, metadata, receipts and CSV behavior. Existing registered HTTP503 caching remains narrow and applies only to a valid complete admitted profile.

## Collection

Re-use strict monthly parsing and add only the four approved native codes to historical scope. Default registered bootstrap now targets version 2. A previous version-1 profile upgrades through a complete registered bootstrap when a key is available. Without a key, it continues its existing version-1 routine update and retains its full coverage. A version-2 source continues with the existing single fresh ten-calendar-year request and context-year stitching, including primary/registered fallback. An absent profile without a key keeps the existing primitive behavior. Invalid markers fail before replacement.

Pass the chosen definition through the existing bounded bootstrap, native context checks, stitching, receipt selection, no-shrink admission and metadata. Keep overlapping twenty-year registered windows, actual per-input starting years, sequential requests and one-second pacing. No pre-birth queries, unsupported quarterly/JOLTS extension, secret echo, new dependency or alternate feed. A changed seam context triggers a full rebuild of the active scope when a key is available; otherwise preserve the old source through the existing failure path.

Payroll change requires an exact previous calendar month. The first native month remains null for change; the first three-month average is usable only after three consecutive non-null monthly changes. Preserve internal missing months and all exact inputs, raw level strings and per-row URL/hash/retrieval evidence. The other twelve BLS outputs retain their current windows. Do not manufacture publication instants or prior vintages.

## Integration and delivery

Use the existing All/custom windows, coverage inventory, labor comparisons, CSV, pins and capture replay. Keep the twelve-MiB portable limit; full-history packages succeed with all requested data or report the existing size limit, with no truncation. Add a trusted manual `core-labor` refresh scope selecting only BLS, using the already configured GitHub secret. No key is read locally.

Validate all old captures as an exact prefix, old version-1 replay and CSV, native starts and independent coverage, period-exact payroll seams and average warm-up, real missing values, one-window routine maintenance, context repair, credential safety, complete scoped receipts, frozen exports and current UI/colors. Capture actual data through the existing trusted publisher, run complete final-data tests, both supported runtimes and asset checks, deploy and verify the live website before completion.
