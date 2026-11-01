# Official public inflation specialist sources

Reviewed 1 November 2026. This is an additive admission for `inflationBea` and `inflationCleveland`; it does not change the existing BLS, BEA, labor evidence or PCE contribution collectors, their history, or their source policies.

## BEA monthly detail and the CPI–PCE reconciliation

Exact public, keyless inputs:

- [NipaDataM.txt](https://apps.bea.gov/national/Release/TXT/NipaDataM.txt), native monthly observations.
- [SeriesRegister.txt](https://apps.bea.gov/national/Release/TXT/SeriesRegister.txt), exact descriptions, metric names, calculation types, scales and table/line memberships.
- [TablesRegister.txt](https://apps.bea.gov/national/Release/TXT/TablesRegister.txt), exact table identities.

The collector requires the reviewed descriptions, metric names, calculation types and scales, rather than accepting matching series codes alone. Price indexes additionally require all twelve 2017 months to average 100 within the published three-decimal rounding bound. A future rebasing fails closed instead of continuing with an incorrect reference-year label. Monthly data are bounded at 64 MiB, the series register at 2 MiB and the table register at 128 KiB. Redirects, duplicate selected periods, malformed values and changed metadata fail admission.

| Scope | Price index | Published monthly rate | Current-dollar amount for share | Table 2.8 line |
|---|---|---|---|---|
| Goods | DGDSRG | DGDSRGM | DGDSRC | 2 |
| Services | DSERRG | DSERRGM | DSERRC | 13 |
| Food and beverages purchased for off-premises consumption | DFXARG | DFXARGM | DFXARC | 9 |
| Energy goods and services | DNRGRG | DNRGRGM | DNRGRC | 27 |
| Market-based PCE excluding food and energy | DPCXRG | DPCXRGM | Not admitted | 31 |
| PCE services excluding energy and housing | IA001260 | PP001260 | LA001260 | 28 |

Indexes are published monthly SA Fisher price indexes, 2017=100, in Table 2.8.4. Table 2.8.7 monthly rates are retained directly; they are not recalculated from rounded indexes. Annual comparisons are separate Meridian calculations from the exact year-ago index. Services excluding energy and housing is an actual published series, not a subtraction of chained indexes. Food excludes restaurant meals; the [BEA source and definitions](https://www.bea.gov/data/personal-consumption-expenditures-price-index) govern each scope.

Expenditure shares are `100 × category current-dollar amount / DPCERC` in the identical month. Both inputs use Table 2.8.5 current dollars at SAAR, so their scale cancels. They approximate relative importance and are explicitly labeled as expenditure shares, not fixed Fisher weights. [BEA explains this distinction](https://www.bea.gov/help/faq/1006). Goods plus services reconcile to total PCE within integer-source rounding; a category cannot exceed the total.

The same keyless monthly file also contains the exact underlying Table 9.1U reconciliation. It does not require an additional API, workbook or provider:

| Stable output | Native code / line | Role in the published identity |
|---|---|---|
| cpiPcePublishedPce | QPCERV / 1 | Starting PCE monthly change |
| cpiPceFormulaEffect | W902RV / 2 | Less formula effect |
| cpiPceWeightEffect | W913RV / 13 | Less weight effect |
| cpiPceScopePceEffect | W921RV / 21 | Less PCE items outside CPI scope |
| cpiPceScopeCpiEffect | W927RV / 28 | Plus CPI items outside PCE scope |
| cpiPceOtherEffect | W931RV / 32 | Less other effects |
| cpiPcePublishedCpi | SRSA0V / 39 | Resulting CPI monthly change |

The published monthly identity is `CPI = PCE − formula − weight − PCE-scope + CPI-scope − other`. Original signed values are retained; the renderer must apply the role separately. The replay checks this identity on every complete shared month with a maximum rounding allowance of 0.125 percentage point: two headline rates rounded to 0.1 plus five effects rounded to 0.01. These are monthly SA rates and percentage-point effects, not a decomposition of YoY inflation. The [official BEA reconciliation explanation](https://www.bea.gov/help/faq/555) describes the effects. Missing October/November 2025 effect rows in the source remain absent, and do not acquire zeroes or nearby substitutes.

BEA permits reproduction of its public-domain website information unless otherwise noted; this admission covers its own statistical values and metadata, with [BEA attribution](https://www.bea.gov/help/guidelines-for-citing-bea) and the [public-domain policy](https://www.bea.gov/help/faq/147). Original values, explicit Meridian calculations, source URLs and response SHA256 receipts remain attached. No account or secret is used.

## Cleveland median and 16% trimmed-mean CPI

Only the Cleveland Fed's own two revised CSVs, linked by the [Median CPI page](https://www.clevelandfed.org/indicators-and-data/median-cpi), are admitted:

- [mcpi_revised.csv](https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/mcpi_revised.csv?sc_lang=en): `mcpi_monthly_chg` and `mcpi_ann_monthly_chg`.
- [trim_revised.csv](https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/trim_revised.csv?sc_lang=en): `trim_monthly_chg` and `trim_ann_monthly_chg`.

Each file is bounded at 256 KiB and requires its exact three-column header, unique first-of-month dates and finite numeric values. Native scientific notation occurs in historical files and is retained as a source string. The monthly change columns are decimal fractions; multiply by 100 once to obtain monthly percent. The annualized-monthly columns are already percentages and are retained directly. Their values must agree with `100 × ((1 + fraction)^12 − 1)` within their published one-decimal rounding.

The `*Annual` outputs are separately labeled Meridian calculations: compound twelve exact consecutive published monthly fractions, then subtract one and multiply by 100. No missing month is replaced by an adjacent row. This is different from the published `*Annualized` one-month rate. No CPI, core CPI, Haver Analytics field, chart CSV or image is ingested.

The page identifies a [CC BY-SA 4.0 license](https://creativecommons.org/licenses/by-sa/4.0/). Each normalized series retains Cleveland Fed source credit, the source title, exact download URL, license link, explicit modification statement and downstream share-alike notice. The derivative annual series remain under that license. No logo or third-party chart is copied.

The [December 2025 methodology notice](https://www.clevelandfed.org/-/media/project/clevelandfedtenant/clevelandfedsite/indicators-and-data/median-cpi/methodological-approach-interpolating-missing-october-2025-cpi-data.pdf) explains that the Cleveland Fed assigns equal one-month changes to **both October and November 2025**, using the September-to-November change. These are statistical imputations, not observed one-month readings. Both months carry `imputed: true`; trailing annual windows including either carry `imputationAffected: true`. Those flags and their observation-status labels are recomputed during browser/Node replay, so an imported capture cannot strip them. The September 2026 annual readings remain affected.

## Capture and replay contract

Each family retains at most 132 native observations per input and at most 120 available monthly observations per output. Native strings, actual source months, `publishedAt: null`, independent capture clocks and exact response receipts are preserved. Neither last-modified metadata nor the reference month is represented as an original publication instant. Different selected series may have different first dates because unpublished months stay missing.

`src/inflation-desk-schema.js` is browser-safe. It validates source fields, receipt identities/hashes/timestamps, native syntax, units, dates, scope and bounds, then regenerates every normalized series from captured native inputs and compares all metadata, calculations, rights notices and flags. The Node policy calls the same validator. Isolated-context tests execute this same code without `Buffer` or `process`, including an imputation-flag tampering rejection.

The real candidate captures are in `output/stitch-page-audit-2026-11-01/inflation/candidates.json`. They reuse the root's actual BEA monthly response and receipt from 1 November, with freshly fetched BEA registers and Cleveland CSVs; the large monthly file was not downloaded again. Approximate serialized sizes are 643 kB for `inflationBea` and 232 kB for `inflationCleveland`, 30 and 6 series respectively. All latest reference months are September 2026. Full response hashes are recorded with the candidates and the probe receipts. The five small checked-in CSV fixtures are exact subsets of those official responses, not independent full response captures.

Focused verification: parser/admission, exact-month arithmetic, signed reconciliation, rounding, rebase guard, missing months, scientific notation, redirects, browser-safe replay, mutable-authority isolation, rights and imputation mutations. Existing economic-evidence tests also pass. Parent integration owns the full suite, global registry/pipeline wiring, snapshot admission, UI rendering and final browser QA. No annual imputation-affected result may be displayed as fully observed.
