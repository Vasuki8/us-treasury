# Funding and market-functioning source admission

Reviewed 2026-10-21. These are partial indicators with different populations and periods. They do not form a definitive liquidity or default-risk score.

## Official endpoints and scoped rights

[New York Fed Markets Data APIs](https://markets.newyorkfed.org/static/docs/markets-api.html) publishes the [OpenAPI specification](https://markets.newyorkfed.org/static/docs/markets-api.yml). The following exact endpoints returned HTTP 200:

- Current structural regimes: `https://markets.newyorkfed.org/api/pd/list/seriesbreaks.json`.
- Selected primary-dealer observations: `https://markets.newyorkfed.org/api/pd/get/SBN2024/timeseries/PDPOSGST-TOT_PDSORA-UTSETTOT_PDSIRRA-UTSETTOT_PDFTD-USTET_PDFTR-USTET.json`.
- SOFR: `https://markets.newyorkfed.org/api/rates/secured/sofr/search.json?startDate=2024-07-03&endDate=2026-10-21`.
- EFFR: `https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=2024-07-03&endDate=2026-10-21`.

The date-range endpoints use the current Eastern calendar date as endDate. The collector uses no credentials, paid provider or infrastructure. Four bounded requests retain exact response hashes, requested URLs and retrieval instants; redirects are rejected. The regime endpoint is checked before loading observations. The module admits SBN2024, beginning July 3, 2024; it does not splice earlier structures. A later regime requires another source review.

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

The response contains `refRates` rows with effectiveDate, type, percentRate, volumeInBillions, percentPercentile1/25/75/99 and revisionIndicator. A published `Y` revision flag is retained. Empty/missing volumes or percentiles remain missing, including when source contingencies apply. No daily calendar dates are generated or carried forward.

| Meridian series | Exact admitted source IDs | Units and calculation |
| --- | --- | --- |
| sofr | SOFR:percentRate | Published percent |
| effr | EFFR:percentRate | Published percent |
| sofrEffrSpread | SOFR:percentRate; EFFR:percentRate | Meridian calculation: 100 × (SOFR − EFFR), identical effective date, basis points |

The calculated difference compares two distinct funding markets; it is not an exact decomposition into credit/liquidity components or a stress/default score. Missing dates in either series make the difference unavailable. It may reflect several influences; correlation does not establish a driver.

## Implementation and verification

Runtime source ID: `marketFunctioning`. Standard series use the keys above; supplemental `dealerHistory` and `fundingRates` retain dates, basis, suppression and revision facts. `dealerWeeklyChanges(source)` requires the exact preceding seven-day reference date and never replaces a missing latest observation with an older value. No historical vintage is invented. Capture snapshots must remain immutable in the shared revision workflow.

The read-only live check retrieved 119 weekly observations per dealer series through October 7, 2026, 573 SOFR observations and 576 EFFR observations through October 20, 2026. The normalized result was approximately 591 KB with four provenance records. Latest repo and reverse-repo totals were suppressed and remained null. Net dealer Treasury positions were 444.683 billion dollars; failed deliveries 121.178 billion and failed receipts 137.453 billion, each under its separate reporting basis. SOFR and EFFR were both 3.88 percent, yielding a calculated zero-basis-point difference.

Seven focused tests passed after an observed failing run. They cover conversion, negative net positions, suppression, missing inputs, duplicate dates/keys, unknown structures, revision flags, exact date matching, weekly gaps, Eastern/UTC rollover, redirects, failures and structural-regime changes. Shared integration checks and deployment evidence are recorded in research-dashboard-plan.md; these source tests alone do not establish a live release.
