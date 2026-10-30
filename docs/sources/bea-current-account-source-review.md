# BEA International Transactions current-account source admission

Reviewed 23 October 2026 UTC. This review admits six published U.S. balance-of-payments balances from BEA International Transactions Accounts (ITA) Table 1.1. It does not replace the separately admitted NIPA `nominalTradeBalance`, admit a third-party redistribution feed, require a BEA API key, or introduce a paid service or new infrastructure.

## Exact source and scoped commercial reuse

Use the keyless official [Table 1.1 CSV](https://apps.bea.gov/international/bp_web/tables/CSVNEW/Ita_T1.1.csv). BEA's [all-ITA download chooser](https://apps.bea.gov/international/bp_web/tb_download_type_modern.cfm?list=1&RowID=0), reached from its [international download index](https://apps.bea.gov/iTable/tb_download.html?pid=1), links the [all-ITA CSV ZIP](https://apps.bea.gov/international/bp_web/tables/CSVNEW/ITA-CSV.zip); the ZIP contains `Ita_T1.1.csv`. The individual CSV avoids an archive extraction dependency. Both endpoints returned the actual statistical files without credentials during this review. A successful HTTP status alone is insufficient: obsolete BEA file paths can return an HTML page with status 200.

The [BEA public-domain FAQ](https://www.bea.gov/help/faq/147) permits use and reproduction of posted information unless an item states otherwise. The reviewed Table 1.1 CSV identifies BEA as publisher and contains statistical observations, units, release metadata, legends and statistical footnotes. No contrary copyright, noncommercial-use, redistribution, or export restriction appears in this file. Applying that policy to this exact agency statistical file supports commercial display, calculations and export of these six balances. This is a scoped source review, not a blanket license for third-party content, BEA branding, or every other file on the website.

Retain `Source: U.S. Bureau of Economic Analysis`, the ITA table/line, direct source link and actual retrieval date in display/export attribution. The [BEA citation guidelines](https://www.bea.gov/help/guidelines-for-citing-bea) appreciate attribution and direct links, distinguish estimate vintages, and prohibit suggesting BEA endorsement of commercial products. No logo or endorsement is needed for this admission.

## Exact identity, unit and signs

All six outputs use Table 1.1, the **Seasonally adjusted** quarterly columns, current-dollar **millions of dollars at quarterly rates**. Convert the native numeric amount to displayed billions only by dividing by 1,000. These amounts are **not annualized**. In particular, a native value of `-246023` means a $246.023 billion deficit during that quarter, not a $246.023 billion annual rate.

| Output ID | Table / line | Exact source label, after trimming |
| --- | --- | --- |
| `currentAccountBalance` | 1.1 / 30 | Balance on current account (line 1 less line 9) /4/ |
| `itaGoodsServicesBalance` | 1.1 / 31 | Balance on goods and services (line 2 less line 10) |
| `itaGoodsBalance` | 1.1 / 32 | Balance on goods (line 3 less line 11) |
| `itaServicesBalance` | 1.1 / 33 | Balance on services (line 4 less line 12) |
| `itaPrimaryIncomeBalance` | 1.1 / 34 | Balance on primary income (line 5 less line 13) |
| `itaSecondaryIncomeBalance` | 1.1 / 35 | Balance on secondary income (line 8 less line 16) |

These are published balances, not locally reconstructed substitutes. Positive means surplus; negative means deficit. A negative balance becoming more negative is a widening deficit. The [official definitions](https://www.bea.gov/news/us-international-transactions-and-investment-position-release-additional-information) define the current account as goods, services, primary income and secondary income transactions between residents and nonresidents. Primary income covers investment income and compensation; secondary income covers current transfers. Capital transfers and financial-account transactions are outside the current account.

NIPA goods/services net exports omit primary income and current transfers and cannot be labeled current account. Even ITA and NIPA goods/services balances can differ because the national accounts apply concept adjustments; Table 1.1 footnote 4 explicitly points to the annual reconciliation in NIPA Table 4.3C. Keep the ITA identity and quarterly-rate convention separate from NIPA SAAR values. Any future ratio against nominal GDP SAAR must first match flow periods, for example quarter flow divided by the same quarter's GDP SAAR / 4; that calculation is not the native source series.

## File layout and stable parsing contract

The reviewed direct response contained 180,707 bytes and SHA-256 `5273df6fdfc2449333d0fb05fa0b834a167935f1588aa97baff94b3a8181f5a9`. Its server-provided HTTP `Date` was 2026-10-23 04:05:52 GMT and `Last-Modified` was 2026-09-24 12:30:03 GMT. The archive response contained 3,297,670 bytes and SHA-256 `802e6bf5adc73d1a4eaab64c713902d2669bece37046fa3c526caaaffe98cb5d`; its Table 1.1 member has exactly the same bytes/hash as the direct response. These are review receipts, not permanent expected hashes for a changing source or a substitute for the collector's own actual retrieval timestamp.

Decode the response bytes as Windows-1252. The source is not valid UTF-8 and contains byte `0xA0` (nonbreaking space), including in its `Line` and annual-year headings. Using an ordinary UTF-8 response-text decoder corrupts those characters. Trim cell text after CSV decoding; preserve the raw response hash and native observation text separately. Use a quoted-field CSV parser, since labels and footnotes contain commas and escaped quotes.

The first four CSV records are single-cell metadata:

```text
Table 1.1. U.S. International Transactions
[Millions of dollars]
Bureau of Economic Analysis
Release Date: September 24, 2026 - Next Release Date: December 18, 2026
```

Three consecutive `Line` header records follow. In the reviewed file each had 600 cells. The first two cells identify line/description. For each subsequent column, the three headers jointly identify its adjustment, year and period:

| Header record | Annual example | SA quarterly example | NSA quarterly example |
| --- | --- | --- | --- |
| Adjustment / annual year | 2025 | Seasonally adjusted | Not seasonally adjusted |
| Year | 2025 | 2026 | 2026 |
| Period | 2025 | Q2 | Q2 |

Select columns whose adjustment is exactly `Seasonally adjusted`, whose year is a valid four-digit year, and whose period is exactly `Q1` through `Q4`. Do not hardcode the number of annual columns, the first SA offset, a current year, or the final period. Annual and NSA columns must never become additional quarterly observations. Store quarter-start reference dates with the original `YYYYQn` label; these dates identify reference periods, not publication dates.

Validate the table title, dollar unit, agency, quarterly-rate footnote and unique required line identities/labels before admitting data. Header widths must agree with selected rows. Reject duplicated SA periods, malformed numbers or contradictory identities rather than silently combining them. Rows with empty line IDs are section labels; later single-cell records are notes, not observations. Preserve zero and signs. The source legends define `(*)` as a sub-$500,000 amount, `(D)` as suppressed, `n.a.` as unavailable and `.....` as not applicable or, for 1960–1997, potentially zero, unavailable or not applicable. None of those markers occurs in the selected six SA balance histories in this capture. If a marker later appears, preserve the native marker and return an unavailable value; do not guess zero or turn a footnote into a number.

The reviewed capture contains 266 observations per selected balance, from 1960Q1 through 2026Q2. At 2026Q2 the six native amounts in table order are `-246023`, `-199817`, `-291302`, `91485`, `-11405`, and `-34802` millions. All are finite signed values, with no missing markers. The first current-account observation is `350` million in 1960Q1. Keep the complete available history, with no monthly interpolation or filling.

Published rounded components need not sum exactly to the published balance. Across these 266 quarters, the largest absolute residual for current account less goods, services, primary income and secondary income balances is **$2 million**, observed at 1982Q2 (+2) and 1993Q1 (-2). The same maximum applies using the published goods/services balance plus primary and secondary income balances. Goods/services less its goods and services balances has a maximum absolute residual of $1 million. At 2026Q2 the four-component current-account residual is +$1 million. A reconciliation may allow $2 million in native units for the four components while preserving the published current-account balance unchanged; it must not rewrite a component or force exact equality.

## Releases, retrieval and history limits

The [current product page](https://www.bea.gov/data/intl-trade-investment/international-transactions) and [24 September 2026 release](https://www.bea.gov/news/2026/us-international-transactions-and-investment-position-2nd-quarter-2026) corroborate the latest reference quarter, the approximately $246.0 billion deficit, and the next scheduled 18 December 2026 release. The release was scheduled for 8:30 a.m. EDT, but the CSV header provides **calendar-date precision only**. Parse its source release date as `2026-09-24` and preserve that precision; do not fabricate a midnight publication instant or derive publication from HTTP file modification time. Parse English month names and validate the calendar date rather than relying on locale-dependent date parsing. Preserve any next-release date separately as a schedule.

The [official release/update explanation](https://www.bea.gov/news/us-international-transactions-and-investment-position-release-additional-information) states that preliminary ITA quarters are released in March, June, September and December, about 85 days after the quarter ends. The previous quarter is updated at the following release. March also revises the previous year's SA quarters to align with annual totals; June annual updates can revise at least the prior three years and can reach further back. Fetching the complete file therefore captures a current revised history, not just one new observation.

The dataset-level CSV release date describes this published table's current vintage. It is **not the original release date of every historical quarter**, and the latest reference quarter is a different field again. Keep each response's actual retrieval timestamp and hash as its retrieval vintage. Historical `publishedAt` remains null unless separate period-specific release evidence has actually been retained; neither the header date nor the reference-quarter start supplies that evidence. A new capture does not recreate historical as-known releases. BEA's citation guidelines explicitly state that its interactive tables show the latest released data, and the current release warns that those live links will be superseded at the next release; original release values belong to BEA's separate archive.
