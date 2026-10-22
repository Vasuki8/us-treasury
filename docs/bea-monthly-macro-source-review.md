# BEA monthly prices, spending and income admission

Reviewed 22 October 2026 for commercial display, calculations and CSV redistribution in Meridian.

## Exact scope and permission

The existing keyless monthly [NIPA bulk file](https://apps.bea.gov/national/Release/TXT/NipaDataM.txt) supplies this family. The existing quarterly GDP feed remains separate. BEA's [public-domain FAQ](https://www.bea.gov/help/faq/147) permits reuse unless a particular item says otherwise. The reviewed statistical flat files have no contrary notice. Retain BEA credit, exact series/table references and URLs, and avoid endorsement claims under its [citation guidelines](https://www.bea.gov/help/guidelines-for-citing-bea). No API key, third-party data service, logo, narrative or restricted material is introduced.

The current [official series register](https://apps.bea.gov/national/Release/TXT/SeriesRegister.txt), also linked in the [2026 annual update documentation](https://www.bea.gov/information-updates-national-regional-economic-accounts), verifies the codes and table lines below. The [Personal Income and Outlays conventions](https://www.bea.gov/news/pio-release-additional-information) establish seasonality, annualized levels and the difference between published quantity-index growth and growth calculated from rounded chained-dollar levels. The reference year remains 2017 in the current update.

| Meridian measurement | Exact source code | Published table / handling |
| --- | --- | --- |
| Headline PCE price index | DPCERG | 2.8.4 line 1; SA index, 2017=100 |
| Core PCE price index | DPCCRG | 2.8.4 line 25; excludes food and energy, SA index |
| Core annual PCE inflation | DPCCRG | Calculated `100 × (index / exact year-ago month index − 1)` |
| Headline monthly PCE inflation | DPCERGM | Published 2.8.7 line 1; monthly percent, SA, not annualized |
| Core monthly PCE inflation | DPCCRGM | Published 2.8.7 line 25; monthly percent, SA, not annualized |
| Real consumption level | DPCERX | 2.8.6 line 1; raw millions of chained 2017 dollars / 1000 for billions, SAAR |
| Real consumption monthly growth | DPCERAM | Published 2.8.1 line 1 quantity-index rate; monthly percent, not annualized |
| Real disposable income level | A067RX | 2.6 line 37; raw millions of chained 2017 dollars / 1000 for billions, SAAR |
| Real disposable income monthly growth | A067RM | Published 2.6 line 43; monthly percent, not annualized |

## Coverage, cadence and calculations

An actual October 22 bulk-file inspection found 812 monthly price-index observations from January 1959 through August 2026, and 236 DPCERX monthly real-spending levels from January 2007. Monthly growth histories start one period later where applicable. The application retains up to 120 latest actual monthly rows per measure; this is a documented core-family window, not a claim of uniform earliest history. The existing GDP history retains 36 quarters.

Only the annual inflation measures are calculated from source indexes. Monthly rates use BEA's published change series so rounding of displayed indexes or real-dollar levels cannot masquerade as the exact official monthly rate. Missing/zero annual denominators yield null. No period is filled or substituted. Future reference dates are excluded, and transforms precede retention so exact baselines can be kept in source metadata.

Personal Income and Outlays updates monthly, with revised earlier estimates and annual updates. Reference dates are month starts; historical release timestamps are absent and stay null. Actual retrieval timestamps and full-response SHA256 hashes are retained. Existing BEA calendar events associate with these measurements, including spending/income under Growth filtering, without rewriting the source schedule capture. Schedule timing is not proof of publication.

## Interpretation and validation

Real-dollar levels are annualized flows, not one month's realized spending or household-level income. Monthly percent rates are not annualized. Chained-dollar components must not be added. CPI and PCE use different coverage and weighting; headline/core or income/spending comovement does not establish causation.

Regression tests verify batch selection in one file scan, duplicate/missing-series rejection, exact annual baselines, zeros/missing values, published monthly rates, million-to-billion scaling, raw source values and unknown publication dates. The existing source allowlist is extended only to the exact nine outputs and their codes; each new series is restricted to the monthly feed, while original GDP retains its quarterly feed. Immutable previous captures are preserved, and new history is first captured on its genuine retrieval date.
