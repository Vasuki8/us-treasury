# Real earnings, private employment breadth and PCE price contributions

Reviewed 27 October 2026 Eastern time (captures occurred 28 October UTC). These are additional official statistical measurements, not release-consensus estimates or reconstructed first-release vintages. No accounts, subscriptions, mirror, proxy, changed identity after denial or new dependency were used.

## Labor statistics and commercial reuse

The [BLS copyright policy](https://www.bls.gov/opub/copyright-information.htm) permits reuse of agency statistics with source credit, excluding protected artwork and the BLS emblem. [BLS API conditions](https://www.bls.gov/developers/termsOfService.htm) require the retained disclaimer that BLS cannot vouch for data or analysis after retrieval. This review admits commercial display, calculation, captured storage and CSV/package redistribution of only the five series below through the existing approved keyless v1 statistical API, `https://api.bls.gov/publicAPI/v1/timeseries/data/`. The collector rejects redirects and incomplete/malformed families. It introduces no v2 registration or key requirement.

The official [CES data-type dictionary](https://download.bls.gov/pub/time.series/ce/ce.datatype), [series format guide](https://www.bls.gov/help/hlpforma.htm#CE), [CES concepts](https://www.bls.gov/opub/hom/ces/concepts.htm) and [Real Earnings technical note](https://www.bls.gov/news.release/realer.tn.htm) establish the native IDs, populations and horizons. The dictionary was consulted as official metadata through web research; it is not a replacement statistical feed. [BLS's own correction notice](https://www.bls.gov/bls/cesbook_stores_correction.htm) independently spells out the two exact real-earnings IDs.

| Local series | Native BLS ID | Scope |
| --- | --- | --- |
| realHourlyEarnings | CES0500000013 | All private nonfarm payroll employees, real hourly earnings |
| realWeeklyEarnings | CES0500000012 | Same population, real weekly earnings |
| privateDiffusion1m | CES0500000021 | Total private industries, one-month span |
| privateDiffusion3m | CES0500000022 | Total private industries, three-month span |
| privateDiffusion6m | CES0500000023 | Total private industries, six-month span |

Real earnings are BLS-published constant 1982–1984 dollar values deflated by CPI-U, seasonally adjusted. This is the all-employees population; the production/nonsupervisory CPI-W population is not substituted. Hourly and weekly charts retain separate native units/scales. Weekly earnings reflect both hourly earnings and paid weekly hours. These payroll means include part-time and multiple-jobholder jobs; changing employment composition can move them. They are neither medians nor a fixed-worker wage index. Optional displayed monthly/yearly changes are explicitly calculated from exact source months in the rounded published level series; they do not claim to be independently rounded BLS release growth rates. A missing exact baseline yields unavailable.

Diffusion is the percentage of detailed private industries with rising employment plus half the percentage unchanged, with 50 as balanced breadth. The 1/3/6-month measures all use seasonally adjusted industry employment; no unadjusted 12-month measure is mixed into their comparison. These indexes measure industry breadth, not employment-weighted growth, the share of jobs expanding, or how many workers gained pay. A common 0–100 scale and visible 50 reference are appropriate.

The actual production-sized capture at `2026-10-28T03:00:41.900Z`, SHA256 `70277c5c24f0e3f1efca810e8503496c14f662c0ab7ac0bd5e97f883a627404d`, contains **117 observations per series, January 2017–September 2026**. Latest values are real hourly earnings **11.24**, real weekly earnings **386.76**, diffusion **49.0 / 57.0 / 54.8** for 1/3/6 months. Native source strings and all footnote code/text pairs are preserved. September is marked preliminary by BLS. Publication dates remain null; actual retrieval is separate. An earlier 33-month investigative probe was not substituted for this larger captured response. Latest revised history is not an archived original release.

## Payroll release evidence and uncertainty

The honest project identity received HTTP403 from each exact route below, once, and stopped that page route:

| Exact page | Actual failed attempt (UTC) |
| --- | --- |
| https://www.bls.gov/news.release/empsit.nr0.htm | 2026-10-28T02:57:03.738Z |
| https://www.bls.gov/news.release/realer.t01.htm | 2026-10-28T02:57:04.872Z |
| https://www.bls.gov/web/empsit/cesdiff1.htm | 2026-10-28T02:57:06.014Z |
| https://www.bls.gov/news.release/archives/empsit_10022026.htm | 2026-10-28T03:41:22.330Z |

The approved statistical API subsequently succeeded as its existing independent delivery channel. It supplies current revised values and preliminary flags, **not an independently dated Employment Situation publication, printed previously published job gains or same-release prior-two-month revision evidence**. A search-readable official summary is useful for investigation but is not represented as a captured publication with a raw-response receipt. The existing official bulk route also has a previously documented honest-client denial; it was not retried to evade it. The archived-publication requirement therefore remains a genuine capture dependency: successful permissible acquisition and validation of the official dated release/archived release bytes. No current revised level difference is relabeled an original or same-release revision, and no empty payroll-publication panel is added.

The October 2 archived release was independently identified by review and tested as its own static archive resource, using the same honest project identity. It too returned HTTP403. The primary web research tool can present extracted official page contents, but exposes no raw response bytes or raw-byte SHA256 receipt. Its extracted text is not silently hashed and called the publisher response. The dated archive route remains a useful direct source link, but is not admitted as fabricated captured evidence.

Near the labor headlines, the current payroll source's retained preliminary flag is shown. The [official Employment Situation technical note](https://www.bls.gov/news.release/empsit.tn.htm) explains sampling/nonsampling error and gives an approximate 90-percent sampling interval of ±122,000 for a **one-month payroll change**. The note is used only as methodological context. The app expressly does not apply that interval to the **difference between two monthly gains**, does not assert significance for acceleration/deceleration and does not treat sampling error as all uncertainty. CES initial estimates can revise as additional reports and seasonal factors arrive. No confidence interval is manufactured for unemployment at its current level.

## BEA PCE contribution route

The [BEA public-domain policy](https://www.bea.gov/help/faq/147) and [citation guidance](https://www.bea.gov/help/guidelines-for-citing-bea) admit commercial display, calculation, storage and redistribution of the selected official NIPA statistics with BEA credit. The existing approved, keyless monthly flat file is the sole runtime URL: `https://apps.bea.gov/national/Release/TXT/NipaDataM.txt`. No BEA API key is required. Individual publication timestamps are not in that file and remain null.

Direct official register receipts at `2026-10-28T02:57:07.422Z` and `02:57:08.613Z` identify **T20808: Table 2.8.8. Contributions to Percent Change in Prices for Personal Consumption Expenditures by Major Type of Product, Monthly**. The Series Register SHA256 is `159175ff182598eaa0b99ac09724b8c0c7844276c52dab0cd946f21c5dc50f6d`; Tables Register SHA256 is `f4242d561e9349df07cab6aaf4474a2f520d6eef9a7d1d6f20579c0c20f224e3`. These metadata files support mapping and are not extra runtime numerical feeds.

| Local series | BEA code | Table 2.8.8 line | Unit / hierarchy |
| --- | --- | --- | --- |
| pcePriceGrowth | DPCERGM | 1 | Percent change from preceding month |
| pceGoodsPriceContribution | CE000885 | 2 | Percentage-point top-level contribution |
| pceServicesPriceContribution | CE000888 | 13 | Percentage-point top-level contribution |
| pceHousingPriceContribution | CE001177 | 29 | Percentage-point detail within services |

These are **seasonally adjusted monthly changes, not annualized**. They are published BEA price contributions, not CPI category effects or quantities. Goods plus services form the sole top-level partition; housing is detail and is not added again. No relative-importance weight multiplication, chained-dollar sum, invented contribution or causal interpretation is used. The published headline is rounded to one decimal, components to two, giving `0.05 + 2 × 0.005 = 0.06` pp independent rounding allowance. Missing components yield an incomplete decomposition, never zero; a complete decomposition outside the allowance fails admission. The latest reference month stays latest even if incomplete.

The actual monthly-file receipt at `2026-10-28T02:57:57.218Z` has SHA256 `bd202765789e4b378ad632cc1836287de7454ae1b86cfa1481c22bc49eabbffd` and last-modified `Wed, 30 Sep 2026 12:30:02 GMT`. The file has 811 months per selected code from February 1959–August 2026. The compact new dataset retains the latest **120 observations, September 2016–August 2026**, with native strings and no filled gaps. August headline is **0.3%**, goods **0.10 pp**, services **0.21 pp**, housing **0.03 pp**; the two top-level components sum to **0.31 pp**, retaining the **−0.01 pp** residual. July is independently **0.1%, −0.03 pp, 0.08 pp, 0.04 pp**. This is current revised history captured now, not an earlier release vintage.

## Runtime, refresh and verification

`scripts/sources/labor-evidence.mjs` and `pce-price-contributions.mjs` expose independent collectors in the normal refresh command; each uses the common bounded response/provenance helpers. `scripts/economic-evidence-policy.mjs` is integrated into shared fail-closed source admission and the production build. `src/economic-evidence-registry.js` admits nine measurements to full detail, comparison, watchlist and research exports. Only these two new source families extend normalized capture metadata for population, horizon and contribution parent; historical sources/captures are not retrofitted.

The initial authentic capture module is `src/economic-evidence-snapshot.js`; runtime uses the maintained main snapshot when present. The main implementation appends the two authentic source captures through existing immutable history storage. This review does not authorize overwriting an earlier capture. Source-specific CSV and frozen attachments retain the exact selected dates, original values/strings, null publication dates, footnotes, units, definitions, hierarchy, source credit, reuse notice and hash/retrieval receipts. Full retained tables are available behind disclosure; charts respect the selected historical window and native gaps while the latest readings remain separate.

Focused checks cover exact metadata/IDs, invalid values, missing/duplicate series/periods, bounds, footnotes, missing exact comparison baselines, top-level reconciliation and non-double-counted housing, export/freeze source receipts, and immutable normalization/replay. Application-wide verification is recorded by the main implementation.

Initial append verification preserved every original source, calendar, release list and all **218** existing capture objects/descriptors; exactly two authentic baselines were appended, giving **220**. Their compressed content-addressed paths are `history/83dc9a61806d065508a15d5bf95d9ed0663cbc3ab3d9126f1cd5ef252727f5cd.json.gz` (labor) and `history/0d841415a9f8ed2146291c9d4e31191f40b4a9d0da2dd25478d7f80fab219e98.json.gz` (PCE). Shared admission validates them through the unchanged immutable writer. Normal refresh health now explicitly includes both new source IDs; failure reporting cannot reject those admitted IDs as unknown.

## Conditional PCE base-effects calculator

The calculator adds no data source. It uses the admitted seasonally adjusted `pceIndex` or `pceCoreIndex`, with an exact captured latest observation and at most thirteen required source months. A constant user-assumed monthly price change compounds the future index for 1–12 months. Each resulting annual rate divides by that future month's exact year-ago observed index. The table identifies both the historical denominator and the historical monthly inflation rate rolling out, with the exact preceding base-month input retained. Missing/nonpositive bases remain unavailable; a missing latest observation does not select an older anchor.

The separate target solver calculates the constant monthly index growth needed to reach a user-entered annual rate at the chosen horizon. It uses the exact denominator and an nth root of the required index ratio, never subtraction of annual rates. Outputs are expressly conditional modeled arithmetic, not a forecast, market consensus or official BEA projection. The shared responsive chart retains keyboard/exact-value evidence and a conditional label. CSV/frozen packages retain assumptions, formulas, historical inputs, source receipts and results. Imported contexts are validated, recomputed with order-independent canonical equality and rendered read-only; frozen controls cannot mutate live assumptions or export current-source data. The ordinary real-earnings/contribution evidence likewise uses shared scoped charts; its full bounded captured source preserves latest context separately from the selected chart/export window.
