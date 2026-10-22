# Fiscal pressure source review

Reviewed 21 October 2026 for Meridian, `Vasuki8/us-treasury`. Scope is factual Treasury fiscal/debt statistics, their calculated metrics and downloadable CSVs. Agency seals, copied narrative, photographs and third-party material are excluded.

## Commercial admission

[Treasury Fiscal Data's License and Authorization](https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization) explicitly allows commercial use, copying, adaptation and redistribution without restriction. The page was fetched directly with HTTP 200 during this review; the search browser's separate 403 was not treated as an unavailable license. This is the existing repository's Fiscal Data admission basis, extended to these exact official dataset endpoints. Retain Treasury/Bureau of the Fiscal Service attribution, source URLs and retrieval provenance; label application calculations independently. No account, API key, paid service or new infrastructure is needed.

## Exact endpoints and fields

All paths below follow `https://api.fiscaldata.treasury.gov/services/api/fiscal_service`. Live API responses returned HTTP 200. Each capture uses `requestText`, a SHA256 of exact response bytes, real retrieval time and original URL. Redirects and incomplete monthly-table pagination are rejected. The current adapter requests MTS history from January of the capture year minus six through the capture date, and the most recent 100 debt observations to match the existing debt dashboard; it does not claim to display the datasets' entire historical coverage. The debt pagination link intentionally denotes older observations outside that stated window.

| Purpose | Endpoint | Selected factual fields and rules |
| --- | --- | --- |
| Receipts, outlays, published budget net interest, contributors | [`/v1/accounting/mts/mts_table_9`](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_9) | `record_date,parent_id,classification_id,classification_desc,current_month_rcpt_outly_amt,data_type_cd,record_type_cd`. Locate `Receipts` and `Net Outlays` section headers and their `Total` rows through the per-publication parent hierarchy. `Net Interest` is the published function within `Net Outlays`. Contributor rows are descendant detail rows (`data_type_cd=D`), excluding totals and headings. IDs change between publications and are never treated as stable series IDs. |
| Monthly financing bridge | [`/v1/accounting/mts/mts_table_2`](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_2) | `record_date,classification_desc,current_month_budget_amt`. Exact labels: `Total Receipts`, `Total Outlays`, `Total Surplus (+) or Deficit (-)`, `Borrowing from the Public`, `Reduction of Operating Cash, Increase (-)`, `By Other Means`. Actual-month fields only; exclude FYTD and mixed-unit budget estimate columns. |
| Explicitly million-denominated scale check | [`/v1/accounting/mts/mts_receipts_outlays_deficit_surplus`](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_receipts_outlays_deficit_surplus) | `record_date,amt_category,mil_amt`. Latest aligned receipts/outlays verify that table 9 actuals use dollar scale. Not substituted for older monthly amounts: this series can contain revised totals different from the original monthly-statement rows. |
| Public versus gross debt | [`/v2/accounting/od/debt_to_penny`](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny) | `record_date,debt_held_public_amt,intragov_hold_amt,tot_pub_debt_out_amt`. Amounts in USD dollars. Public debt is converted to USD trillions separately; gross debt includes intragovernmental holdings. |

The official [dataset metadata service](https://api.fiscaldata.treasury.gov/services/dtg/metadata/) identifies MTS as `015-BFS-2014Q1-13` and Debt to the Penny as `015-BFS-2014Q3-065`. Metadata was read to verify scope/definitions; this service is supporting review evidence, not a runtime feed of new observations.

## Coverage, cadence and dates

[Monthly Treasury Statement](https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/) is monthly. The metadata service lists table 2 and table 9 coverage from 31 March 2015, and the dedicated monthly receipts/outlays series from 31 October 1980; financing in that longer series is not readily available before January 2010. Current latest reference month at review: September 2026. Table 9/table 2 `record_date` values are month ends, although the generic metadata definition calls them publication dates. Their actual September values have `record_date=2026-09-30` and were fetched in October; this field must not be represented as the actual release instant. `publishedAt` stays null. Reference period, retrieval time and source update metadata are distinct.

[Debt to the Penny](https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/) updates at the end of each business day for the preceding business day. Total coverage begins 1 April 1993. Public/intragovernmental breakdown is annual from September 1997 through September 2001, monthly through March 2005, then daily from April 2005; earlier zeros are not reliable evidence of a zero public-debt balance. The adapter's modern rolling window avoids that earlier missing-breakdown regime. Debt held by the public includes Federal Reserve Banks and foreign holders, and is not limited to private or domestic investors. Debt-to-Penny intragovernmental holdings include Federal Financing Bank securities, which can differ from other Treasury datasets' coverage.

No release dates, historical first-release dates or historical publication instants are invented. Store immutable retrieval snapshots going forward; an initial retrieval does not prove what was known at an earlier date.

## Units and sample checks

There is a material documentation inconsistency: generic MTS descriptions say all values are millions, but actual current-month table 2/table 9 JSON values are full dollars with cents. For September 2026, table 9 receipts are `557874519238.24`, outlays `584774866340.26`, net interest `34787531902.86`. The dedicated explicitly labeled million series reports receipts `557875` and outlays `584775`. The adapter checks the latest common report against both series within `$500,001`, reflecting nearest-million rounding plus a dollar of floating-point allowance. An impossible scale or absent latest common check fails closed; historical actuals are converted by `/1e9` to USD billions. Budget estimates such as `5475705.00` are not used.

As of 20 October 2026, Debt to the Penny reported gross debt `40439546016039.08`, public debt `32566198492042.62`, and intragovernmental debt `7873347523996.46` dollars. These three current values reconcile. The raw strings for all three measures are retained in the supplemental debt breakdown, alongside their calculated trillion-dollar values. Do not infer more precision in on-screen rounded displays than the calculation/export states.

The current 100 observations (29 May through 20 October 2026 at review) reconcile within $1. An investigation of a longer debt window found an older source anomaly on 4 August 2025: public plus intragovernmental debt exceeds published gross debt by $10 billion. No figures were corrected or substituted. That row is outside this milestone's stated 100-observation stock window; full historical debt reconciliation is deferred and must address this anomaly before admitting a longer window. Current-window decomposition inconsistencies fail closed.

## Calculations and interpretation

- Positive deficit = outlays minus receipts. Table 2's budget balance has the opposite sign (surplus positive, deficit negative); table 1 and the dedicated longer series use deficit positive.
- Primary deficit = deficit minus published **net budget interest**, using aligned month inputs. Gross Treasury debt-interest expense is a different measure and is not substituted for missing net interest.
- A trailing 12-month total requires exactly 12 consecutive nonmissing monthly observations. Never add FYTD values across months or reset a trailing window in October.
- Net-interest-to-revenue uses aligned net interest / receipts, preferably trailing totals to avoid tax-payment seasonality; missing or zero-denominator inputs remain unavailable.
- Contributor changes describe accounting components of the observed change, not proven economic causes. Offset receipts and negative outlays can offset increases. Preserve a residual if source components do not add exactly to totals, rather than forcing a match.
- The financing bridge is deficit = borrowing from the public + reduction of operating cash + other means + calculated source residual. A cash increase is a negative reduction. Historical source financing discrepancies are retained explicitly: 26 months in 2020–2023 have a residual exceeding $1, with the largest reviewed discrepancy about minus $2.890 million in July 2021. Current September 2026 reconciles. No source amount is changed to clear the residual.
- Deficit is a period flow. Gross debt and debt held by the public are stocks with different scopes. Cash balances, other financing, intragovernmental activity and debt-accounting details prevent equating a deficit to a change in total outstanding debt.

Historical current-month rows are **as recorded in each monthly statement; later revisions may not be incorporated**. Example: the August 2026 original table 9 outlay differs from the August comparative shown in September table 1. This milestone does not pretend those series are interchangeable or reconstruct missing historical vintages.

## Admission identifiers

Runtime source ID: `fiscal`.

- `receipts`: `mts_table_9:Receipts:Total:current_month_rcpt_outly_amt`
- `outlays`: `mts_table_9:Net Outlays:Total:current_month_rcpt_outly_amt`
- `netInterest`: `mts_table_9:Net Interest:current_month_rcpt_outly_amt`
- `publicDebt`: `debt_held_public_amt`

The supplemental monthly object contains only aligned statement periods, reported amounts, factual contributor labels, fiscal-year labels, and explicit calculated deficit/financing residuals. Its provenance must allow only the four endpoint paths above. Missing net interest remains null; it never falls back to gross interest or zero.
