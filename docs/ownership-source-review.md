# Treasury ownership: source review and implementation contract

Reviewed October 21, 2026. The module compares reported ownership positions within each official dataset's definitions. It does not calculate a combined ownership total across incompatible dates or valuations, and it does not infer purchases or sales from changes in holdings.

## Connected sources and rights

### Federal Reserve Board Financial Accounts (Z.1)

- [Official current release](https://www.federalreserve.gov/releases/z1/default.htm).
- [Official compressed CSV/dictionary download](https://www.federalreserve.gov/releases/z1/current/z1_csv_files.zip), specifically `csv/F3_2_s.csv` and `data_dictionary/F3_2_s.txt`.
- [F3.2.s Treasury securities](https://www.federalreserve.gov/releases/z1/current/html/F3_2_s.htm) is the current name of the table previously numbered L.210. The Board renumbered its tables in June 2026. Series identifiers, rather than obsolete table numbers or physical line positions, select observations.
- [Federal Reserve Board copyright policy](https://www.federalreserve.gov/disclaimer.htm) permits copying and distribution of its public-domain information with source credit, except material identified as belonging to a third party. The reviewed table and dictionary contain Board statistical positions with no contrary notice found. This scoped review covers those statistics and calculations, excluding seals, imagery and separate third-party products.

Data are quarter-end positions, with annual-end-only observations before 1952. The reviewed release was dated **September 11, 2026**, covering **2026:Q2**. The original implementation retained the latest 36 observations. The [October 26 history expansion](ownership-history-expansion.md) now retains all **305 published dates**: seven annual-end observations from 1945:Q4 through 1951:Q4 and 298 consecutive quarters from 1952:Q1. CSV/dictionary units are **USD millions**, while the HTML/PDF table displays billions. The adapter verifies dictionary units before conversion; stored position values are billions and reusable series are trillions.

The current release date is captured and checked against the latest quarter in the archive. It identifies the **current vintage**, not the original publication date of every historical observation. Historical `publishedAt` values remain unknown; retrieval time and response SHA-256 are captured separately. Current-release historical observations can change through revisions or methodological changes.

### New York Fed SOMA Holdings: aggregate summary only

- [Official SOMA Holdings page](https://www.newyorkfed.org/markets/soma-holdings.html).
- [Documented aggregate summary endpoint](https://markets.newyorkfed.org/api/soma/summary.json), from the [official Markets Data APIs](https://markets.newyorkfed.org/static/docs/markets-api.html) and its [YAML specification](https://markets.newyorkfed.org/static/docs/markets-api.yml).
- [New York Fed Terms of Use](https://www.newyorkfed.org/privacy/termsofuse.html) permit business use, storage, copying, distribution and derivative works subject to attribution, retained source identifiers and redistribution conditions. SOMA aggregate holdings are not among the listed restricted content categories. This is a scoped permission review, not a public-domain or CC0 claim.

The required standard notice is:

> © 2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org.

Retain the source title **SOMA Holdings**, attribution, free source URL and terms URL with displayed and exported data. Redistribution must preserve the same permissions, conditions and restrictions; clearly identify Meridian calculations and avoid suggesting New York Fed endorsement. The notice year follows the capture year. These requirements are stored in `soma` and in `series.somaTreasuryHoldings` metadata for the app and CSV layer. No security-level SOMA data or CUSIP reference information is collected.

The summary begins **July 9, 2003**. The usual observation is Wednesday close, published Thursday by close; the API also explicitly includes holiday exception dates. The adapter preserves actual posted dates and warns on exceptions rather than generating a Wednesday record. The [October 26 SOMA history expansion](soma-history-expansion.md) retains all **1,216 native dates through October 21, 2026**, replacing the original 104-observation retention limit. It does not invent historical publication instants. API values are USD, converted to billions for positions and trillions for the reusable series.

Required fields are `asOfDate`, `bills`, `notesbonds`, `tips`, `frn` and `tipsInflationCompensation`. Treasury principal is the sum of the four Treasury categories; adjusted principal additionally includes the separately reported TIPS inflation compensation. API `total` includes agency debt, MBS and CMBS and **is not a Treasury-only total**. Those asset classes are excluded. Missing or malformed required components reject collection, except the API's exact blank FRN token is retained as null with an explicit status. Before Treasury's first FRN issue on January 31, 2014, a qualified calculation excludes the not-yet-existing instrument. From issuance onward, a blank FRN makes principal and adjusted principal unavailable; compensation remains observed. There are 552 qualified pre-issuance dates, 15 unavailable post-issuance dates and 649 dates with complete numeric Treasury components in this capture. Blank historical FRN values are never converted to observed zeros.

## Valuation, sector scope and reconciliation

The following Z.1 series provide the reusable histories:

| Series | Meaning | Basis |
| --- | --- | --- |
| `LM263061105.Q` | Rest of the world Treasury securities | Quarter-end market value |
| `LM713061103.Q` | Central bank Treasury securities | Quarter-end market value |
| `FL893061105.Q` | All sectors Treasury assets | Reported table aggregate, including mixed sector valuation bases |
| `FL313161105.Q` | Federal government marketable Treasury liabilities | Reported liability basis |
| `LM903061103.Q` | Instrument valuation discrepancy | Published reconciliation difference |

Twenty-five top-level holder sectors are selected explicitly, excluding nested bill/other-security lines and pension subcomponents that would double count. All names and units are checked against the archive dictionary. LM sector lines are market valued; FL sector lines retain their published non-market basis. The adapter does not relabel every sector as market value. Net dealer and domestic hedge-fund positions remain net positions, not gross inventories.

When observations are complete, sector sums reconcile to the published asset total, and assets plus the published valuation discrepancy reconcile to liabilities, within a bounded rounding tolerance of $25 million. Missing positions remain null and mark reconciliation incomplete. The discrepancy is retained and explained; it is not assigned to a fictional owner or interpreted as purchases. These totals differ from MSPD and Debt to the Penny, which have different valuation, instrument and government-holdings coverage. Z.1 includes some Federal Financing Bank securities and excludes nonmarketable securities from this Treasury security instrument table.

SOMA par holdings are separately dated and valued. They are not added to Z.1 central-bank market-value positions. A higher or lower SOMA value cannot by itself explain a difference in quarterly Z.1 positions. Within-dataset changes are computed only for the exact preceding quarter or week, with no gap filling. Source explanations cover valuation, maturities, reporting changes and transactions as possible contributors without asserting which occurred absent corresponding evidence.

## TIC country coverage remains unconnected

The official [TIC table 5 text feed](https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/slt_table5.txt) was inspected and contains 13 recent monthly periods. The live table ended August 2026. It reports foreign holdings of Treasury marketable and nonmarketable bills, bonds and notes; it is not directly interchangeable with Z.1 marketable security positions. [Treasury's TIC FAQ](https://home.treasury.gov/data/treasury-international-capital-tic-system-home-page/frequently-asked-questions-regarding/ticfaq2) describes estimated market values for long-term securities, face values for bills, reporting lags and important valuation/scope differences.

No dataset-specific TIC redistribution license or explicit Treasury authorship/reuse notice was verified during this review. Public access and a third-party site's public-domain label are insufficient under this repository's admission rule, so **TIC values and country rows are not ingested**. The module links this limitation and supplies aggregate foreign positions through the reviewed Z.1 series instead. A later TIC admission requires documented primary reuse evidence.

Treasury's table notes and FAQ explain that country attribution can follow custodians or intermediaries rather than ultimate investors. Changes in country holdings can result from valuation, custody transfers, maturities, survey/reporting changes or transactions; they are not automatically purchases or sales. These limitations remain relevant if TIC is admitted later.

## Adapter and model contract

`collectOwnership({fetchImpl, now})` returns `id: 'ownership'`, `fetchedAt`, standard `series`, `z1`, `soma`, `provenance`, `warnings`, `limitations` and the required New York Fed attribution/terms/redistribution fields. The three exact feeds are requested without credentials or new infrastructure. A failed selected feed rejects this candidate so the existing source refresh mechanism can retain its last-good capture.

Standard series IDs are `foreignTreasuryHoldings`, `fedTreasuryHoldings` and `somaTreasuryHoldings`. Source IDs are `LM263061105.Q`, `LM713061103.Q` and `SOMA:treasury-adjusted-par`, respectively. Z.1 series are official observations with unit conversion; the Treasury-only SOMA sum is clearly calculated. Its title, attribution, terms URL and redistribution notice travel with series metadata for exports.

`z1` contains `asOf`, `releaseDate`, `unit: 'USD billions'`, `sectors`, `assets`, `liabilities`, `valuationDiscrepancy`, `reconciled` and full native `history`. Each sector stores `code`, `label`, nullable `value`, `valuation` and original `sourceDescription`; historical central-bank rows qualify the pre-2012 H.4.1 method. `soma` stores separate `asOf`, nullable par `principal` and `adjustedPrincipal`, observed `inflationCompensation`, source title/conditions and full native `history`; blank FRN rows also retain `frnStatus` as `not-issued` or `unavailable` with null component values. New registered captures retain exact per-observation numerical feed/hash/retrieval references and affected-row footnotes, while older captures keep their original scope.

`summarizeOwnership(source)` returns the separate dates, current positions, exact-prior-quarter sector `change`/`previousDate`, separate SOMA change, reconciliation fields and limitations. Missing inputs produce unavailable or null calculations. It never returns a combined cross-source total or infers causal demand from stock changes.

## Verification evidence

Tests were observed failing before implementation. They cover exact series/dictionary units, distinct valuation bases, missing positions, sector reconciliation, duplicated or malformed quarters, Treasury-only SOMA aggregation, separately reported TIPS compensation, official holiday-date handling, missing components, source failures, release-quarter mismatches, prior-period gaps and export attribution metadata.

Live collection on October 21 Toronto time (October 22 UTC) verified 36 Z.1 quarters and 25 sectors: June 30, 2026 assets **$29.013612T**, discrepancy **$1.864675T**, liabilities **$30.878287T**. Rest-of-world market-valued holdings were **$9.269220T** and central-bank market-valued holdings **$4.082698T**. Separately, October 14 SOMA principal was **$4.4639745402T** plus **$0.1065772117T** TIPS compensation, giving calculated adjusted principal **$4.5705517519T**. These figures document that capture; they are not permanently current values.

The ZIP reader retains its default 100-entry limit. Only the explicitly scoped Z.1 caller opts into a bounded 1,000-entry limit; existing CRC, declared/inflated output bounds, encryption and directory checks remain intact. A focused regression verifies default rejection, explicit admission and retained per-entry byte limits for archives exceeding 100 entries.
