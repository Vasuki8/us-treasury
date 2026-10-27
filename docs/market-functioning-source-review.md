# Funding and market-functioning source admission

Reviewed 2026-10-21; funding-history extension reviewed 2026-10-26. These are partial indicators with different populations and periods. They do not form a definitive liquidity or default-risk score.

## Official endpoints and scoped rights

[New York Fed Markets Data APIs](https://markets.newyorkfed.org/static/docs/markets-api.html) publishes the [OpenAPI specification](https://markets.newyorkfed.org/static/docs/markets-api.yml). The following exact endpoints returned HTTP 200:

- Current structural regimes: `https://markets.newyorkfed.org/api/pd/list/seriesbreaks.json`.
- Selected primary-dealer observations: `https://markets.newyorkfed.org/api/pd/get/SBN2024/timeseries/PDPOSGST-TOT_PDSORA-UTSETTOT_PDSIRRA-UTSETTOT_PDFTD-USTET_PDFTR-USTET.json`.
- SOFR: `https://markets.newyorkfed.org/api/rates/secured/sofr/search.json?startDate=2018-04-02&endDate=2026-10-26`.
- EFFR: `https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=2016-03-01&endDate=2026-10-26`.

The date-range endpoints use the current Eastern calendar date as endDate. The collector uses no credentials, paid provider or infrastructure. Four bounded requests retain exact response hashes, requested URLs and retrieval instants; redirects are rejected. Each response remains bounded to 4 MiB. The API specification documents inclusive start/end dates and no pagination parameter on these rate search endpoints. The regime endpoint is checked before loading observations. Dealer data admit SBN2024, beginning July 3, 2024; earlier dealer structures are not spliced. A later dealer regime requires another source review. This structural break does not truncate the independent daily rate histories.

New SOFR queries start exactly 2018-04-02 and new EFFR queries exactly 2016-03-01. The exact earlier 2024-07-03 rate queries remain admitted for immutable captures. No arbitrary start date, cross-market start date, extra/duplicate query field or alternate rate endpoint is admitted. Per-series observations must fall inside their own captured query bounds; the spread cannot precede SOFR inception. Source-level `coverageStart: 2024-07-03` continues to describe the dealer regime, while each funding series retains its own native coverage explanation and exact URL. These facts survive immutable normalization without relying on an uncaptured global setting.

The [New York Fed Terms of Use](https://www.newyorkfed.org/privacy/termsofuse) allow business copying, distribution and derivatives under conditions. This is **conditional commercial reuse, not public domain**. Preserve source/copyright and free-source links, label Meridian calculations, retain downstream terms, and imply no endorsement. Reference rates require their specific republication disclaimer. Runtime constants and per-series `sourceNotice` / `licenseUrl` carry these notices for the interface and CSV. Shared, dedicated and vintage views/exports retain these notices and original titles; executable scope is enforced in scripts/market-policy.mjs. Staff papers, agency marks, underlying transaction feeds and third-party identifiers are excluded; their permissions are not inferred from this review.

## Primary-dealer definitions, coverage and units

The [official primary-dealer statistics page](https://www.newyorkfed.org/markets/counterparties/primary-dealers-statistics) describes Thursday publication at approximately 4:15 p.m. for the previous week's data, with structural breaks in the history beginning in 1998. Its current viewer's About the Data notes describe revisions, suppression and reporting scope. Values marked `*` are withheld; missing or suppressed observations remain null and retain the source marker. Dealer data are reported by primary dealers and are not audited by the New York Fed. They do not cover the whole market.

The [official series definitions](https://markets.newyorkfed.org/api/pd/list/timeseries.json) identify the exact keys below. [July 2024 FR 2004 instructions](https://www.federalreserve.gov/apps/reportingforms/Download/DownloadAttachment?guid=950ab256-b485-4586-99b0-b27eb205fdfa) establish million-dollar reporting, fair-value position accounting and outstanding financing. The published viewer identifies fails as cumulative weekly amounts. Source millions divided by 1000 produce USD billions; this unit conversion does not change the reporting basis.

| Meridian series | Exact source identifier | Basis |
| --- | --- | --- |
| dealerNetTreasury | PDPOSGST-TOT | Wednesday net outright position at fair value, long minus short; Treasury securities excluding TIPS, including the source's immediate/forward and when-issued coverage |
| dealerRepo | PDSORA-UTSETTOT | Wednesday repurchase-agreement financing outstanding against Treasury securities excluding TIPS; dealer perspective |
| dealerReverseRepo | PDSIRRA-UTSETTOT | Wednesday reverse-repurchase financing outstanding against Treasury securities excluding TIPS; dealer perspective |
| dealerFailsDeliver | PDFTD-USTET | Cumulative weekly failed-delivery amounts, Treasury securities excluding TIPS |
| dealerFailsReceive | PDFTR-USTET | Cumulative weekly failed-receipt amounts, Treasury securities excluding TIPS |

These amounts are kept separate. A fail can persist over multiple days, and both counterparties can report its delivery/receipt sides; adding the two series would not count unique failed trades or defaults. Weekly cumulative fails are not comparable to a Wednesday position stock as an exact ratio without additional methodology. No such ratio is calculated. Repo and reverse repo are separate gross financing directions, not a net market-liquidity measure.

## Funding-rate context

The [SOFR page](https://www.newyorkfed.org/markets/reference-rates/sofr) describes a transaction-based volume-weighted median Treasury repo financing rate. It is published at approximately 8 a.m. Eastern on business days. [Reference-rate methodology and revisions](https://www.newyorkfed.org/markets/reference-rates/additional-information-about-reference-rates) describe EFFR's distinct unsecured market, approximately 9 a.m. publication, contingencies and possible same-day revisions around 2:30 p.m. Underlying effective business dates remain separate from retrieval and release timestamps; exact historical publication times are not inferred.

SOFR begins with effective date April 2, 2018, first published April 3; earlier indicative histories are excluded. Modern EFFR begins March 1, 2016. The [official methodology](https://www.newyorkfed.org/markets/reference-rates/additional-information-about-reference-rates#effr_obfr_calculation_methodology) identifies this change in source and calculation; the [March 7, 2016 H.15 release](https://www.federalreserve.gov/releases/h15/20160307/) explains the change from a volume-weighted average to a volume-weighted median. Earlier mean-based EFFR is excluded from the current median/distribution series.

The response contains `refRates` rows with effectiveDate, type, percentRate, volumeInBillions, percentPercentile1/25/75/99, optional footnoteId and revisionIndicator. Rates and percentile endpoints remain in percent. Volumes are USD billions, rounded by the source to the nearest billion. Percentiles describe each effective day's transaction-rate distribution, not time-series quantiles or confidence intervals. Empty/missing volumes or percentiles remain missing. No daily calendar dates are generated or carried forward.

The official rate pages link their [SOFR viewer source](https://www.newyorkfed.org/medialibrary/Interactives/markets-data/reference-rates/sofr/sofr-pi-ui/browser/main.js) and [EFFR viewer source](https://www.newyorkfed.org/medialibrary/Interactives/markets-data/reference-rates/effr/effr-pi-ui/browser/main.js), which supply the published footnote definitions. Raw `r` or `Y` revision indicators retain their original spelling and mean Revised. Footnote 1 means reduced volume. Footnote 2 means survey data for SOFR and brokered data for EFFR; percentile statistics are not published under these contingencies. Footnote 3 means republication of the prior day's rate because of insufficient current data; neither percentile nor volume statistics are published. These identifiers and readable source meanings are retained as optional `footnoteId` and `footnotes` fields. Unknown identifiers, contradictory statistics and changed marker types fail for review.

The actual SOFR rows for 2019-05-31 and 2021-08-05 have source footnote 2 and literal `NA` in all four percentile fields. Their published medians and volumes remain usable. Numeric endpoints become null while `percentileSourceValues` retains the four original `NA` markers; this evidence is admitted only with SOFR's survey footnote and matching null endpoints. `NA` in the median or volume, an unsupported partial marker set or an unrelated footnote is rejected. EFFR's 2017-05-31 `r` flag and 2023-07-25 reduced-volume footnote are retained. The spread remains numeric when both medians exist, even if bands are missing, and carries market-prefixed source notes from its exact-date inputs. Raw percentile marker maps and source footnote IDs stay on the original rate rows.

| Meridian series | Exact admitted source IDs | Units and calculation |
| --- | --- | --- |
| sofr | SOFR:percentRate | Published percent |
| effr | EFFR:percentRate | Published percent |
| sofrEffrSpread | SOFR:percentRate; EFFR:percentRate | Meridian calculation from 2018-04-02: 100 × (SOFR − EFFR), identical effective date, basis points |

The calculated difference compares two distinct funding markets; it is not an exact decomposition into credit/liquidity components or a stress/default score. Missing dates in either series make the difference unavailable. It may reflect several influences; correlation does not establish a driver.

## Implementation and verification

Runtime source ID: `marketFunctioning`. Standard series use the keys above; supplemental `dealerHistory` and `fundingRates` retain dates, basis, suppression and revision facts. `dealerWeeklyChanges(source)` requires the exact preceding seven-day reference date and never replaces a missing latest observation with an older value. No historical vintage is invented. Capture snapshots must remain immutable in the shared revision workflow.

The read-only live check retrieved 119 weekly observations per dealer series through October 7, 2026, 573 SOFR observations and 576 EFFR observations through October 20, 2026. The normalized result was approximately 591 KB with four provenance records. Latest repo and reverse-repo totals were suppressed and remained null. Net dealer Treasury positions were 444.683 billion dollars; failed deliveries 121.178 billion and failed receipts 137.453 billion, each under its separate reporting basis. SOFR and EFFR were both 3.88 percent, yielding a calculated zero-basis-point difference.

Seven focused tests passed after an observed failing run. They cover conversion, negative net positions, suppression, missing inputs, duplicate dates/keys, unknown structures, revision flags, exact date matching, weekly gaps, Eastern/UTC rollover, redirects, failures and structural-regime changes. Shared integration checks and deployment evidence are recorded in research-dashboard-plan.md; these source tests alone do not establish a live release.

## Funding-history extension verification

Bounded official responses retrieved at 2026-10-27T03:36:31Z, with Eastern query end date 2026-10-26, contain 2,139 SOFR rows from 2018-04-02 and 2,676 modern EFFR rows from 2016-03-01, both through 2026-10-23. Raw response sizes are 508,455 and 755,282 bytes, respectively, within the unchanged cap. Their same-date spread retains 2,151 dates from SOFR inception: 2,139 valid differences and 12 null holiday mismatches. September 17, 2019 independently reconciles SOFR 5.25 percent, EFFR 2.30 percent and a calculated 295 basis points. The May 31, 2019 survey-contingency day retains SOFR 2.49, EFFR 2.40 and a numeric 9-basis-point spread with the SOFR source note.

All 576 previously retained SOFR rows, 579 EFFR rows and 579 spread rows matched the current capture's complete observation objects exactly. The existing legacy capture, a full replay of the newly retrieved raw rate responses and an in-memory immutable normalization/replay all pass source admission. No existing capture was rewritten. The small committed fixture contains six authentic SOFR rows and six EFFR rows plus two exact-date EFFR inputs for the holiday and survey regressions, with original response receipts; it excludes the full raw downloads.

`tests/funding-history-source.test.js` covers observed failing regressions for the native starts, source markers, missing bands, revised flags, footnote meanings, per-market provenance and date boundaries, the 2019 event, native/legacy feed admission and normalization. Focused source/model/policy tests passed after the implementation. Actual refresh, complete application verification and deployment remain the integrating worker's responsibility. The ON RRP 2024 admission window and dealer SBN2024 dates, units and suppression behavior are unchanged.
