# Core labor history expansion

Reviewed October 26, 2026. The user selected core labor history after economist/investor review found payrolls, participation, employment/population and U-6 limited to 2017 onward, while unemployment already reaches 1948. The delivery extends six existing measurements using four already admitted BLS native inputs, preserving the current UI and colors.

## Exact source and independent starts

| Existing measurement | BLS native series | Native first month | Published unit |
| --- | --- | --- | --- |
| Total nonfarm payroll employment level | `CES0000000001` | January 1939 | Thousands of jobs, seasonally adjusted |
| Labor force participation | `LNS11300000` | January 1948 | Percent, seasonally adjusted |
| Employment/population | `LNS12300000` | January 1948 | Percent, seasonally adjusted |
| U-6 labor underutilization | `LNS13327709` | January 1994 | Percent, seasonally adjusted |

Four bounded, keyless one-year POSTs to the existing BLS v1 endpoint returned HTTP 200 / `REQUEST_SUCCEEDED`, empty messages and twelve numeric M01–M12 rows each. January raw values were `29923`, `58.6`, `56.6` and `11.7` respectively. Actual accepted retrieval clocks span `2026-10-26T16:49:02.468Z`–`16:49:06.188Z`. Original bytes, request scope and SHA256 receipts are retained under ignored `tmp/labor-history-source-review/`. These probes establish the reviewed first-year observations; the full bootstrap must separately validate complete retained history and exact starts.

The native source, units and rights are unchanged from the [BLS macro/labor admission](bls-macro-family-source-review.md) and [existing historical API review](unemployment-cpi-debt-history.md). BLS attribution, disclaimer, raw strings and actual receipt clocks remain in the app, CSV and portable results. No new vendor, key, paid service, output identifier or dependency is added. The private registered key remains confined to the existing trusted GitHub collection step.

## Interpretation and calculations

[BLS's CES FAQ](https://www.bls.gov/web/empsit/cesfaq.htm) and [CES historical-series discussion](https://www.bls.gov/opub/mlr/2015/article/comparing-with-the-original-a-look-at-current-employment-statistics-vintage-data.htm) establish the current total-nonfarm aggregate's January 1939 start. These counts measure payroll jobs, including multiple jobs held by one person. Do not splice discontinued SIC histories onto the current NAICS aggregate or infer a constant historical industry classification. Annual benchmarking can revise past values.

[CPS definitions](https://www.bls.gov/cps/definitions.htm) distinguish participation and employment/population, both using civilian noninstitutional population age 16 and over, from U-6's labor-force-plus-marginally-attached denominator. CPS counts people rather than payroll jobs. [CPS documentation](https://www.bls.gov/cps/documentation.htm) records the 1994 survey redesign and population-control changes affecting comparability. Published levels and source notes are retained; no artificial step adjustment is introduced.

U-6's retrospective January 1994 start does not establish original publication then. BLS's [alternative-measures history](https://www.bls.gov/opub/btn/archive/the-unemployment-rate-and-beyond-alternative-measures-of-labor-underutilization.pdf) and [methodology paper](https://www.bls.gov/osmr/research-papers/2009/ec090020.htm) describe the subsequent publication history. The delivery is current revised statistical history, separate from dated first-release archives. Exact historical publication instants remain unknown.

Monthly payroll gains remain the exact current-minus-previous-month employment levels, in thousands. The first native January 1939 gain is null because December 1938 is unavailable; the first possible gain is February. The existing three-month average requires three exact consecutive numeric changes, first possible in April 1939. Missing inputs remain null and cannot become a longer-period change or a filled average. [BLS API period conventions](https://www.bls.gov/developers/api_signature.htm) identify M13 as annual data; it is excluded rather than treated as December.

## Compatible collection and provenance

The existing version-1 unemployment/CPI contract remains valid with its exact five native starts and thirteen outputs. An explicit version-2 profile admits those inputs plus these four labor series, covering nineteen existing outputs. The total catalog remains 136 measurements and BLS still supplies 31 outputs. The other twelve BLS outputs retain their current windows; JOLTS, wages, hours, prime-age ratios and quarterly compensation/productivity are outside this delivery.

The existing registered bootstrap retains overlapping bounded twenty-year windows, native birth-year grouping, sequential pacing, strict response/advisory validation and credential-echo protection. A registered version-1 source upgrades via a complete version-2 backfill; without a key, it maintains version-1 history through its existing routine path. Version 2 then uses the same single fresh ten-calendar-year query, with the first year reserved as checked context, source-specific receipt selection and no-shrink checks. Changed context requires a complete registered repair or a visible failure preserving the previous capture. A failed first bootstrap cannot masquerade as a successful expansion.

Each historical row retains the actual endpoint, SHA256, retrieval clock, raw value and exact calculation inputs. Scope-aware admission checks the complete profile, independent starts and receipt/input bounds. Version 1 cannot grant the six new labor outputs per-observation historical permissions. Old capture identities, metadata and CSV behavior are not retrofitted. The existing narrow registered-API HTTP503 retention policy, retries and alerts remain intact.

All/custom windows, earlier-cycle comparisons, coverage inventory, CSV, captured-by replay and frozen results reuse existing controls. The portable twelve-MiB limit and browser-library limits stay unchanged: requested data is preserved completely or the existing size error is shown, with no silent truncation.

## Verification record

The trusted manual `core-labor` scope selects only BLS, retains the existing registered secret boundary and preserves all publication gates. The new selector regression was observed failing before implementation and passing afterward with automatic/all-source modes unchanged. Actual full-history capture, archive-prefix acceptance, complete tests, live deployment and source/alert outcomes will be recorded after verification.

Initial local verification passed all **1,772 tests**, with zero failures or skips. Focused evidence includes nineteen collector/migration/inventory/export/package tests, seven exact-profile admission tests, existing parser/registered/cached/backup tests and the workflow scope checks. Independent economic/source and engineering reviews found no material blocker. The registered-health fixture now converts a genuinely admitted retained source rather than overwriting its profile and raw evidence; it still verifies one current-window request, all 31 outputs and exact preservation of the previous source. A deliberately invalid predecessor was rejected before that fixture correction. No source safeguard, package limit or timeout was weakened. Actual captured-data and deployment evidence follows.

## Verified registered capture and preservation

The trusted [BLS-only cloud run](https://github.com/Vasuki8/us-treasury/actions/runs/40366490646) captured the expanded source at `2026-10-26T17:13:31.690Z`. All 1,772 tests passed against that actual refreshed snapshot, followed by build and the complete 163-asset HTTP smoke check, before the publisher committed `9d29379c5cf30b0808830d69755bd6ecb104b3f1`. The key was neither read nor stored locally. One genuine BLS capture extends the archive from 181 to 182 entries.

| Measurement | Retained monthly rows | Usable rows | First usable month |
| --- | ---: | ---: | --- |
| Payroll employment level | 1,053 | 1,053 | January 1939 |
| Monthly payroll change | 1,053 | 1,052 | February 1939 |
| Three-month payroll average | 1,053 | 1,050 | April 1939 |
| Participation | 945 | 944 | January 1948 |
| Employment/population | 945 | 944 | January 1948 |
| U-6 | 393 | 392 | January 1994 |

All six end in September 2026. Native missing values remain null. Independent acceptance against `82527a23798e07ad106add9a056bcabdcf0e718a` verified every original descriptor, compressed Git blob, decoded capture object and all 181 replay checkpoints exactly, including both version-1 BLS capture cutoffs. Other sources, calendars and release schedules remain exact. All 14,311 old BLS dates remain; no raw strings or provider values changed. All 48 independent birth-year observations match their actual API probe bytes. The audit independently recomputed every one of the 1,053 payroll changes and 1,053 three-month averages.

Four previously unavailable 2017 calculations gain valid earlier inputs: January payroll change is `145628 − 145408 = 220` thousand jobs; the January/February/March three-month averages become `(118+225+220)/3`, `(225+220+218)/3` and `(220+218+124)/3`. These are newly resolved calculation boundaries, not provider revisions or rewritten old captures. The original archived nulls and their CSV remain exact. Native inputs and their actual receipts are retained in the acceptance evidence. Real version-2 conversion to the weekly registered-health check also passes with 31 outputs, one fresh-window receipt and no historical profile.

Actual portable verification passed exact JSON and CSV round trips for all four payroll/U-6 histories (3,552 rows; 5,884,534-byte CSV; 8,836,427-byte package), both participation/employment histories (1,890 rows; 4,278,926-byte package), a 48-row 2008 comparison and the twelve-row January–April 1939 payroll warm-up view. Every exported row resolves to its exact actual receipt. Original missing-value markers retain the existing spreadsheet-safe CSV escape; raw JSON markers remain exact. All packages fit the unchanged twelve-MiB portable limit. The two All-history packages exceed the separate three-MiB durable browser-library budget and retain the existing session-only warning and independent JSON download; no storage cap is raised. The local final-data build and all 163 HTTP asset checks pass. Both runtime and live-deployment evidence follows.

## Final cloud and live verification

Both Node 22 and Node 24 checked out the exact captured-data commit `9d29379c5cf30b0808830d69755bd6ecb104b3f1` and independently passed all **1,772 tests**, builds and 163-asset HTTP checks. The [release workflow](https://github.com/Vasuki8/us-treasury/actions/runs/40366490646) deployed GitHub Pages and completed successfully at `2026-10-26T17:34:03Z`.

The first separate public asset check encountered HTTP503 for one historical gzip asset. The bounded retry then verified all 163 live assets exactly against the local final-data build, with no source or test change. Live browser checks confirmed payroll history from January 1939, the unavailable first monthly change, three unavailable initial average months, participation from January 1948 and U-6 from January 1994. Retained counts and source notes match the accepted capture; historical publication dates remain unknown and the current reading stays independent of a custom historical chart window. No browser console errors were observed. Layout, navigation, styles and colors remain unchanged.

The follow-on [cloud data-health and renewal run](https://github.com/Vasuki8/us-treasury/actions/runs/40369830948) completed successfully at `2026-10-26T17:34:46Z`, and no GitHub issues remained open at the final check. Existing retries, failure alerts and renewal reminders retain their behavior. This subsequent documentation-only evidence update changes no deployed code or data.
