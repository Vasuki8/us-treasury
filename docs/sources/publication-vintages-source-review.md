# Official GDP publication-vintage history

Reviewed October 22, 2026. Meridian retains the **complete real-GDP column of BEA's dated September 30, 2026 GDP/GDI vintage-history workbook**: 1,076 documented publication facts, 98 contiguous reference quarters from 2002Q1 through 2026Q2, and 292 distinct publication dates from April 26, 2002 through September 30, 2026. This is the complete reviewed worksheet selection, not every historical GDP release, a full NIPA database, or a record of actual intraday server availability. It remains separate from latest revised observations and Meridian's immutable local retrieval captures.

## Exact official sources and reuse

The [September 30 GDP release](https://www.bea.gov/news/2026/gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-2nd) directly links the reviewed [September workbook](https://www.bea.gov/sites/default/files/2026-09/gdp-gdi-vintage-history.xlsx). A credential-free official GET returned HTTP 200, 75,070 bytes, SHA256 49ef37def79cf5990992f57f1cc819e50fa5b0f8d0e2f5df824f0f19d5d38bf8. Its original title is “Vintage History of Quarterly Gross Domestic Product (GDP) and Gross Domestic Income (GDI) Estimates,” and its update header is “Last Updated September 30, 2026.”

BEA's [copyright FAQ 147](https://www.bea.gov/help/faq/147) puts website information in the public domain unless otherwise stated and permits use or reproduction without specific permission. No contrary notice was found on this BEA-authored statistical workbook. Commercial numerical display and CSV redistribution fit that scoped reuse basis. Preserve BEA attribution, original source title, workbook/source links, actual retrieval provenance, source cells/tokens, reference quarter, raw estimate stage and publication date. The [citation guidelines](https://www.bea.gov/help/guidelines-for-citing-bea) specifically recommend identifying an estimate's vintage and prohibit implying BEA endorsement. This admission does not cover unrelated logos, images, third-party material, other statistical fields or arbitrary BEA URLs.

The original three 2026Q1 records remain attached to the [June workbook](https://www.bea.gov/sites/default/files/2026-06/gdp-gdi-vintage-history.xlsx), SHA256 d12fb3a5b4d9184a9288d18eb249ea14683ac2614231b018c9f02a28d3c22b73, and their original source cells, record IDs, evidence links and actual retrieval metadata. That edition contained 1,052 GDP rows through 2026Q1; all 1,052 publication keys and values were unchanged in the September edition. September adds three 2026Q2 current-quarter estimates and 21 revised-quarter rows from the 2026 annual update. The expanded archive therefore appends 1,073 new facts without rewriting the original three.

The exact three legacy evidence pages remain the [advance release](https://www.bea.gov/news/2026/gdp-advance-estimate-1st-quarter-2026), [second release](https://www.bea.gov/news/2026/gdp-second-estimate-and-corporate-profits-1st-quarter-2026) and [third release](https://www.bea.gov/news/2026/gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-1st). The new historical rows link directly to the official dated compilation that documents their values and dates; no unverified historical release-page URL is fabricated.

## Measurement, original labels and gaps

Only column E, “Real GDP,” is selected. Values are published **percent changes from the preceding quarter, seasonally adjusted at annual rates**, corresponding to A191RL, NIPA Table 1.1.1 line 1. No additional annualization or growth calculation is applied. Columns C/D current-dollar GDP/GDI and column F real GDI are excluded. A reference period such as 2026-01-01 identifies the first quarter, not a publication date.

| Original workbook estimate label | Rows |
| --- | ---: |
| Advance | 96 |
| Preliminary | 29 |
| Final | 29 |
| Second | 67 |
| Third | 68 |
| Initial | 2 |
| Updated | 1 |
| Revised | 784 |

The 2009 comprehensive update renamed the former “Preliminary” and “Final” vintages “Second” and “Third”; see BEA's [NIPA Handbook, chapter 3, estimating schedule and footnote 9](https://www.bea.gov/system/files/2019-12/All-Chapters.pdf). Raw historical labels remain unchanged. “Final” and “Third” do not mean that a quarter can never be updated again.

Two current-quarter sequences contain only two source estimates. The [2018Q4 initial release](https://www.bea.gov/index.php/news/2019/initial-gross-domestic-product-4th-quarter-and-annual-2018) explains that the shutdown-delayed Initial estimate on February 28, 2019 replaced the scheduled Advance and Second estimates; the workbook then records Third on March 28. The [2025Q3 initial release](https://www.bea.gov/news/2025/gross-domestic-product-3rd-quarter-2025-initial-estimate-and-corporate-profits) explains that Initial on December 23, 2025 replaced Advance and Second; the [Updated release](https://www.bea.gov/index.php/news/2026/gross-domestic-product-3rd-quarter-2025-updated-estimate-gdp-industry-and-corporate) on January 22, 2026 replaced the scheduled Third estimate. The archive preserves Initial/Updated rather than inventing missing routine stages or renaming them.

All 1,076 reviewed GDP tokens are finite; no GDP gaps or duplicate quarter/publication-date pairs occur in this edition. Missing GDI values represented by dots never become missing GDP. There are **141 explicit no-GDP-revision rows**: 137 say “GDP not open for revision” and four say “GDI percent change not published; GDP not revised.” Each equals the immediately preceding published GDP growth for the same quarter; the review found zero contradictions and zero missing prior baselines. They remain visible as documented confirmations, rather than being called numeric GDP revisions.

Other raw annotations include “GDI not published” and “Percent change in GDI not published.” Annotation text, original spacing and trailing spaces remain in sourcePublicationDate. A “Revised” stage alone does not establish that the displayed rounded GDP rate changed, that an annual update caused the change, or that the change is a comprehensive benchmark revision.

The [September release](https://www.bea.gov/news/2026/gdp-third-estimate-industries-corporate-profits-state-gdp-and-state-personal-income-2nd) explicitly identifies the 2026 annual update as covering 2021Q1–2026Q1. General [BEA GDP conventions](https://www.bea.gov/news/gdp-release-additional-information) distinguish current-quarter vintages, annual updates and comprehensive updates. The workbook's generic Revised rows do not individually identify all revision causes. Historical methods, definitions and reference years can change; the archive does not impose today's statistical methodology on old published estimates or present all rows as directly comparable levels.

## Worksheet contract and scope manifest

The workbook contains ReadMe and Vintage History sheets. The latter uses repeated quarterly sections, with the quarter in column A, stage in B, Real GDP in E and release date plus annotations in G. Each section explicitly repeats the units and measure headers. Examples in September:

- 2026Q2 quarter header A6; Third B10/E10/G10, Second row 11, Advance row 12.
- 2026Q1 quarter header A14; Revised row 18, Third row 19, Second row 20, Advance row 21.
- 2002Q1 quarter header A1553; Final row 1568, Preliminary row 1569, Advance row 1570.

Many historical date cells use shared rich-text runs. The parser concatenates only the supported text runs, preserving their original text, rather than converting an XML element's representation into a date. This actual edition uses text dates; reviewed whole-day Excel 1900 serial support remains for the legacy parser. The fictitious 1900 leap day, fractional dates and the unreviewed 1904 system are rejected.

scripts/gdp-publication-scope.mjs records the exact 1,076 reviewed tuples: reference period, raw stage, publication date, quarter-header row, data row, native GDP value token, and original date/annotation text. scripts/publication-policy.mjs combines that complete September table with the three legacy June record identities. All publication IDs derive from quarter, stage and publication date; the original three IDs remain unchanged. Strict admission checks the exact reviewed source token as well as its numeric value, so altering both cannot bypass validation. Any correction or schema drift in a dated official workbook fails explicitly and needs a new source review; it does not silently rewrite admitted historical facts.

## Collector, admission and append integration

The release-record shape and schema version remain unchanged. Each record has native measurement metadata, period/stage/date, publishedAt:null, day precision, original sourceValue/sourcePublicationDate/sourceCells, source identifiers and evidence link, and actual hashed retrieval provenance.

- collectPublications({ids,fetchImpl}) returns exactly the requested IDs, in request order. Its default requests only the 1,073 new September facts. An explicit request containing original IDs retrieves the June workbook for those IDs; the collector never substitutes September cells/provenance into an original June record.
- parseGdpPublicationWorkbook(bytes,{provenance,ids}) validates all 1,076 reviewed rows, 98 quarterly headers, exact tokens, stages, dates/annotations and the three unchanged overlap values in the September source before filtering output. The June branch retains its original three-fact reviewed scope and validation contract.
- assertPublicationData(archive,{complete:false}) admits valid reviewed subsets, including the empty initial archive. The ids option requires exactly that requested batch; complete:true requires all 1,076 target IDs. The build gate must require the full target after expansion.
- The append writer asks only for missing target IDs, checks the exact returned batch, preserves the original prefix and its hashes, appends once in scope order, validates completeness and writes atomically. Source/policy tests and read-only probes do not modify the canonical archive.

Only the two exact dated workbook URLs are admitted. The bounded in-memory ZIP/XML reader validates namespaces, worksheet relationships, shared strings, headers, ordered cells, supported values and exact scope. It rejects formulas, external worksheet relationships, malformed XML/declarations/entities, missing or extra rows, duplicate cells, changed units/measure/date/stage/value tokens, unreviewed annotations, unknown IDs, duplicate requests and redirects. No spreadsheet dependency, credential, paid service or new infrastructure is introduced.

## Publication dates are not retrieval or availability timestamps

Publication dates come from BEA's historical compilation. They are retained at day precision; publishedAt stays null. Release documents' embargo times and calendar schedules do not establish actual server publication instants, and the collector never infers historical UTC timestamps from them. Workbook update properties, HTTP Last-Modified and actual download times have distinct meanings and cannot substitute for those dates.

An October retrieval of a compilation documenting a 2002 estimate is evidence obtained in October, not a Meridian retrieval in 2002. Hashes describe the bytes actually downloaded now, not a guarantee that identical bytes were served on an old release date. Local “as known on” retrieval vintages and this selected official publication history must stay separate. Likewise, the current NIPA flat files provide today's revised time series and cannot reconstruct this publication history.

## Verification and limits

Regression-first tests cover all 1,076 scoped IDs, 98 quarters, native negative/zero/positive values, historical stages, shutdown exceptions, original cells, rich-text annotations and confirmations, exact requested batches, complete/subset admission, legacy identity preservation and entire-workbook checks even for one requested ID. Jointly changed value/token pairs, changes to unrequested rows and legacy overlap conflicts fail closed. Existing ZIP/XML, formula, date, redirect, byte/provenance and unsafe-input regressions remain.

A read-only probe of the actual September workbook successfully produced 1,073 new records; combining those in memory with the three original archived records passed full admission. Actual archive capture and the original-prefix audit are performed separately through the append CLI. Research downloads and probe output are confined to ignored test-results/publication-research. Existing user exports, output and tmp folders are untouched.

The coverage limit is explicit: 2002Q1 onward, quarterly real GDP growth only, the rows documented in this September edition. Earlier GDP publication vintages, current-dollar levels, GDI, regional/industry measures and later workbook editions need separate source admission. No frequency filling, interpolation, synthetic estimates, fabricated release dates or inferred benchmark causes are permitted.
