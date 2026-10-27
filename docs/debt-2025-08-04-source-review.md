# August 4, 2025 debt source review

**Status: published and verified.** The user approved the official rounded fallback on October 26, 2026. Source capture, independent acceptance, full release checks and live verification passed. The reviewed PDF bytes, exact primary anomaly fingerprint, million-unit values and receipt requirements are pinned in the implementation; a reconciled primary row takes precedence.

The official Daily Treasury Statement (DTS) supports a gross debt balance of **$36,838,165 million**, reported to the nearest million, for August 4, 2025. The Debt-to-the-Penny gross field under review is approximately $10 billion lower. Its public and intragovernmental components agree with DTS after rounding. DTS establishes the discrepancy but does not establish a replacement gross balance to the cent.

## Evidence and reporting basis

The [August 4 DTS](https://fiscaldata.treasury.gov/static-data/published-reports/dts/DailyTreasuryStatement_20250804.pdf), page 3, Table IIIC, reports these **closing balances today**:

| Balance | Debt-to-the-Penny capture, USD | DTS, USD millions | DTS equivalent USD, rounded |
| --- | ---: | ---: | ---: |
| Debt held by the public | 29,523,300,148,538.85 | 29,523,300 | 29,523,300,000,000 |
| Intragovernmental holdings | 7,314,864,649,375.46 | 7,314,865 | 7,314,865,000,000 |
| Total public debt outstanding | 36,828,164,797,914.31 | **36,838,165** | **36,838,165,000,000** |

The report header on page 1 identifies the units as rounded millions. The [August 5 DTS](https://fiscaldata.treasury.gov/static-data/published-reports/dts/DailyTreasuryStatement_20250805.pdf), page 3, Table IIIC, repeats all three August 4 balances in its **opening balance today** column. This is date continuity corroboration, not a substitute observation or interpolation. August 4 pages 1, 3, and 4, and August 5 page 3 were visually inspected alongside text extraction.

The [DTS dataset's Notes & Known Limitations](https://fiscaldata.treasury.gov/datasets/daily-treasury-statement/) explicitly states that both DTS and Debt to the Penny include Federal Financing Bank (FFB) debt within intragovernmental holdings. It identifies the published DTS reports as the source for the gross aggregate. Thus these balances share the relevant debt scope; no FFB adjustment should be made when comparing them.

Table IIIC separately reports **debt subject to limit of $36,727,023 million**, after deductions including other debt, unamortized discount, and FFB. That adjusted balance is not gross debt. Page 4 explains that unamortized discount concerns Treasury bills and zero-coupon bonds. Table IIIA's footnote states that transactions use face value except savings and retirement plan securities, which use current redemption value. Cash-basis adjustments in Table IIIB must not be substituted for position balances.

The official [IIIC API response](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/debt_subject_to_limit?filter=record_date:eq:2025-08-04&page%5Bsize%5D=100) confirms the two component balances but omits gross aggregate rows by design. The [IIIA API response](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/public_debt_transactions?filter=record_date:eq:2025-08-04&page%5Bsize%5D=100) contains rounded transactions, not exact position totals. Neither API supplies an independently reported exact-cent gross replacement.

## Precision and approved choice

The DTS gross value supports a conservative rounding interval of **$36,838,164,500,000 through $36,838,165,500,000**. The precise half-million tie convention is unspecified. Even the lower bound exceeds the primary gross field by $9,999,702,085.69.

The primary components sum to $36,838,164,797,914.31, exactly $10 billion above the primary gross. This sum falls within the DTS interval, but that agreement is only a check: it does not independently verify those gross cents.

**Approved choice:** use the whole August 4 DTS row as an official rounded fallback, preserving each reported value and recording `USD millions`, nearest-million rounding, and the PDF provenance. This trades component precision for a consistent, independently published row on that date. Do not append cents or present the converted whole-dollar figures as exact. Rounded DTS detail need not generally add to its reported total.

The implementation retains the contradictory raw primary triple and signed USD -10,000,000,000 residual alongside the official rounded row. It never creates an exact-cent correction from the component identity, interpolates, or splices in month-end figures. Other dates or primary fingerprints remain outside the exception. Missing, changed, redirected or oversized PDF evidence fails collection so the existing successful capture can be retained. The strict direct fiscal parser remains strict without explicitly supplied fallback evidence.

## Capture provenance and reuse

Original Treasury downloads are in `tmp/debt-discrepancy-dts/`, with extraction, page images, and individual metadata files. All five hashes were rechecked against the saved bytes. Retrieval clocks below are UTC.

| Capture | Retrieval time | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| August 4 PDF, linked above | 2026-10-27T02:39:15.2930027Z | 83,533 | `2afa2b2497dc88fb4b14893681d127d651c868b7c3d46ad0c52455df7e6f5c9f` |
| IIIC API, linked above | 2026-10-27T02:39:51.9109420Z | 5,365 | `642b8551eb4c5dff791d9ce0f83d3fbfeb363fc6b48cfd162e1b3780e7359b55` |
| IIIA API, linked above | 2026-10-27T02:39:52.5224563Z | 13,311 | `2e03af05e8789e9ab037a664588ce12337d3062e5d675aa2311f0e5a74ad6fe9` |
| August 5 PDF, linked above | 2026-10-27T02:39:52.9840909Z | 83,561 | `e54a22a8121d614043b689a9cb13ddaf4498f464fd70b1bd5da82f41244fed2d` |
| DTS dataset page, linked above | 2026-10-27T02:39:53.6441247Z | 701,455 | `22ad636d894a5a1311586106b97a0e9893c4fab4ceacdd645d668ff69b3af779` |

The reports identify the Bureau of the Fiscal Service, U.S. Department of the Treasury as their source. They are official public publications retrieved without authentication, with matching report dates and adjacent-day balances. They are a separate publication from Debt to the Penny, not evidence of a separate underlying accounting system.

Reuse concerns the published numerical facts. The [U.S. Copyright Office](https://www.copyright.gov/history/copyright-exhibit/lifecycle/) explains that facts and works created by the U.S. federal government are outside copyright protection. No special reuse restriction or third-party license notice appeared in the captured report or dataset page; no dataset-specific CC0 license was verified. Preserve Treasury attribution and links, and do not imply Treasury endorsement.

## Implementation and final capture acceptance

The runtime uses one literal reviewed row bound to the exact PDF hash, with a bounded 1 MiB download and no redirects. Both main gross debt and fiscal composition use the official million-valued figures. Each repaired observation retains `sourceUnit`, `sourcePrecisionUSD`, the actual source field, the original million-valued string, the conflicting primary triple, signed residual, both receipts and a readable note. CSV evidence columns are conditional, including the rounded predecessor or baseline for calculated changes/comparisons. Existing value cells and chart readouts show the note; layout, navigation, CSS and colors are unchanged. Older observations and packages without this metadata retain their original export format.

Scheduled commit `bba94c8` arrived during development with 23 newer source captures. The branch was fast-forwarded to its **211-capture** baseline before a fresh final affected-source collection. An earlier preflight capture made against the older branch was preserved separately under ignored `tmp/debt-rounded-fallback/`; its deltas were not spliced over a different source state or assigned artificial retrieval times.

The final Treasury capture is **2026-10-27T03:02:09.662Z**, with primary debt receipt **03:02:09.290Z**; fiscal is **03:02:09.831Z**, with primary debt receipt **03:02:09.472Z**. Both newly downloaded reports match the pinned hash. The archive now has **213 captures**. All 211 prior descriptors, compressed Git bytes and decoded captures are exact. The unchanged replay algorithm and old-cutoff replay retain the original history. Independent acceptance validates all 31 relevant Treasury/fiscal captures, final normalized replay, idempotent registration and current/scoped admission.

Exactly two existing-date registered observations change: August 4 gross debt from `36.82816479791431` to `36.838165` USD trillions, and public debt from null to `29.5233`. Its fiscal breakdown becomes `29.5233 / 7.314865 / 36.838165`, with original raw amounts retained. No new reference periods were observed. All 21 other source objects, calendars and release context are exact against `bba94c8`; fiscal monthly named amounts are unchanged.

Four genuine older packages preserve their exact JSON, CSV and attachment bytes. Five actual current packages—including both repaired indicators, a recent window omitting the repaired day, and default/All fiscal views—round-trip exactly. Default/All fiscal packages are **7,300,462 / 8,982,505 bytes**, below the unchanged 12 MiB cap. Full-history standalone debt/public-debt packages already exceeded existing limits in the baseline; those explicit limits are preserved. Detailed proofs are under ignored `tmp/debt-rounded-fallback/actual/results.json` and `reviewer-acceptance.json`.

Independent code review found and reproduced an admission gap involving stripped identifiers with a supplemental URL on an unreviewed date. A failing regression now guards every DTS reference in row URL lists or receipts; exact-date/profile validation rejects the original reproduction. No admission gate, source precision requirement or size limit was weakened. The built website passes all **163 asset checks**. Full release results are recorded after publication.

## Published verification

[Release run 40443410009](https://github.com/Vasuki8/us-treasury/actions/runs/40443410009) verified exact commit `2a217f591f0d99cd90ea00e61fb5b79023faf70e`. **All 1,833 tests passed with zero failures on both Node 22 and Node 24**, followed by successful builds and all 163 asset checks. The complete local suite also passed 1,833/1,833. All **23 statistical and seven calendar/timing outcomes** passed the read-only cloud source check, including fresh Treasury/fiscal PDF retrieval. Publication-evidence upkeep passed. The earlier branch diagnostic's unrelated housing timeout cleared in this release recheck; no source contract or test was changed to hide it.

GitHub Pages deployment succeeded; the complete release finished at **2026-10-27T03:28:20Z**. The live checker confirmed all 163 published assets exactly match the local tested build. Browser verification confirmed the August 4 gross-debt and public-debt table values, explicit USD-million precision notes, actual retrieval timestamps and existing light theme/navigation. No console warnings or errors were observed; the temporary verification tab was closed. The original primary amounts and all 211 prior published capture artifacts remain retained. UI and colors are unchanged. This final record changes documentation only.
