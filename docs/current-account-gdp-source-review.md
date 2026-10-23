# Current account as a percentage of GDP

Reviewed 23 October 2026 UTC. This calculated measure reuses the two already admitted official BEA statistical inputs. No additional service, credentials, endpoint, historical backfill or source permission is required. It is a Meridian calculation from official observations, not a separately collected BEA ratio series.

## Source mapping and commercial scope

| Input | Existing measurement | Exact approved endpoint | Native convention |
| --- | --- | --- | --- |
| Numerator | `beaIta/currentAccountBalance`, ITA Table 1.1 line 30, `ITA:T1.1:line30:World:SA:Q` (Meridian table locator) | [ITA Table 1.1 CSV](https://apps.bea.gov/international/bp_web/tables/CSVNEW/Ita_T1.1.csv) | Millions of current dollars per quarter, seasonally adjusted, **not annualized** |
| Denominator | `bea/nominalGdp`, NIPA Table 1.1.5 line 1, published series `A191RC` | [Quarterly NIPA flat file](https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt) | Millions of current dollars, seasonally adjusted **annual rate** (SAAR) |

Both existing collectors divide native millions by 1,000 to obtain billions. This scale conversion does not annualize either series. The ratio therefore uses the retained billions directly with the annual-rate correction below. Exact endpoint, identity, parsing and capture admission remain governed by [ITA source review](bea-current-account-source-review.md), [economic-depth source review](economic-depth-source-review.md), `scripts/bea-ita-policy.mjs` and `scripts/economic-depth-policy.mjs`.

The [BEA public-domain policy](https://www.bea.gov/help/faq/147) permits reproduction unless a specific item states otherwise. The already reviewed agency statistical files contain no contrary restriction. Their approved scope covers commercial display, calculation and CSV export of these measurements. Retain BEA attribution, exact series/table identities, source links and actual retrieval dates. Under the [BEA citation guidelines](https://www.bea.gov/help/guidelines-for-citing-bea), identify Meridian as the calculator and avoid suggesting BEA endorses the product. This is not permission for unrelated third-party material or BEA branding.

## Unit and alignment contract

For a single exact reference quarter `q`:

```text
quarterly nominal GDP(q) = nominal GDP SAAR(q) / 4
current-account-to-GDP(q), percent
    = 100 × current-account quarterly balance(q) / (nominal GDP SAAR(q) / 4)
    = 400 × current-account quarterly balance(q) / nominal GDP SAAR(q)
```

This follows BEA's [annual-rates definition](https://www.bea.gov/help/glossary/annual-rates): quarterly dollar levels become annual rates through multiplication by four. The [ITA Table 1.1 notes](https://apps.bea.gov/iTable/?isuri=1&product=1&reqid=62&step=6&tablelist=1) explicitly identify quarterly ITA estimates as not annualized. Dividing the quarterly balance directly by GDP SAAR would understate the magnitude by four. The division by four here is a dollar-level conversion; it is unrelated to compounding or deannualizing GDP **growth** rates.

Match the same quarter-start reference date in both admitted quarterly series. Do not substitute a previous quarter, interpolate GDP, use real/chained-dollar GDP, use a growth rate, or join to a nearby release date. Null, absent, nonfinite or nonpositive GDP denominators remain unavailable. Missing or nonfinite numerators remain unavailable; an observed zero numerator is a valid zero ratio. Preserve the numerator's sign: positive is a current-account surplus, negative is a deficit. A change in the ratio is expressed in **percentage points**, not percentage growth. The ratio is not itself an annualized growth rate or a trailing-year ratio.

The current-account balance includes goods, services, primary income and secondary income. NIPA trade/net exports omit income and transfers and use national-account adjustments. Do not substitute NIPA trade balance or claim the current account is an exact GDP component. This is a size comparison between a balance-of-payments flow and domestic production, not an accounting reconciliation or causal explanation.

## Current capture check and vintage limitations

The inspected repository retains 266 current-account quarters from 1960Q1 through 2026Q2 and 318 GDP quarters from 1947Q1 through 2026Q2. Consequently the available current-account span controls current overlap, subject to exact-quarter nonmissing input checks.

For 2026Q2 the captured inputs are `−246.023` billion per quarter and `32,563.03` billion GDP SAAR. Quarterly GDP is `8,140.7575` billion, producing `−3.022114342553503%`. The official [2026Q2 ITA release](https://www.bea.gov/news/2026/us-international-transactions-and-investment-position-2nd-quarter-2026) reports a deficit magnitude rounded to 3.0% of current-dollar GDP. The signed calculated ratio is consistent at that precision; exact equality to a release-published ratio is not guaranteed when input vintages differ.

ITA table release date is `2026-09-24`; its actual retrieval is `2026-10-23T04:21:42.080Z`. The GDP source retrieval is separately `2026-10-23T02:56:31.625Z`. These retrieval timestamps identify captures, not publication instants or simultaneous release vintages. ITA updates quarterly, with annual revisions; GDP has advance, second and third estimates plus annual/benchmark revisions. A ratio can change when either input revises. The existing daily workflow may check both feeds more frequently than official observations change.

Keep each input's raw source value, exact reference date, feed identity, current/cached state, provenance and actual retrieval separately in display, exports and frozen results. Do not relabel the calculation as an official observed ratio or use one input's retrieval time as if it described both. Historical `publishedAt` fields remain null where the feeds provide no period-specific publication evidence. The table-level release date describes a current table vintage, not the first publication of every historic quarter. Retained immutable captures enable observed retrieval-vintage history going forward; they do not create unavailable first-release or historical as-known vintages. Existing frozen results must continue using their own retained inputs.

## Historical chart extension

The historical chart reuses these exact admitted input histories and the same formula; no additional source is connected. It currently computes 266 retained quarters, 1960Q1–2026Q2. A contiguous ITA quarter calendar exposes missing periods as null calculated rows, never official substitutes. GDP-only earlier/later coverage does not extend the numerator span. Date windows select the same rows for chart, table and historical CSV. CSV percentage-point changes require the exact preceding quarter also inside the export, so the first exported row has no change and missing inputs are never bridged.

The source dates are reference-quarter starts. Both input receipt sets and the original values are retained independently, with unknown publication dates left empty. Calculated chart readouts identify captured BEA inputs; frozen readouts identify recorded inputs. Historical ratios use revised captures and are not original release vintages. New pins retain only the two relevant full source-series histories, the selected range and original CSV, within the existing package byte limit. Scoped chart catalogs fail closed without those retained inputs; older pins do not acquire a historical ratio chart. Imported histories are bounded by both 5,000 raw observations per source and a 5,000-quarter expanded numerator span before calculation.
