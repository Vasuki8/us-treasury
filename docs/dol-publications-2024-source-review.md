# Archived DOL claims publications: 2024 extension

Reviewed October 22, 2026. This adds **52 official 2024 releases / 208 facts** to the [2025](dol-publications-2025-source-review.md) and [2026](dol-publication-history-source-review.md) batches. The complete archive now has **140 releases / 560 facts**. All 352 original records, their order and genuine retrieval receipts are preserved. Publication facts remain separate from revised XML history, current release context and immutable Meridian capture history.

## Discovery and commercial reuse

The [official ETA archive](https://oui.doleta.gov/unemploy/claims_arch.asp) returned 52 dated PDF links from `POST https://oui.doleta.gov/unemploy/archive.asp`, body `report=press&year=2024&submit=Submit`. The separately linked current `data.pdf` is excluded. Discovery receipt: `2026-10-22T22:30:29.396Z`, SHA256 `90e244465bc1f111fb4672ec866168e56149d720a3449a7eaa50001a9a3b9e44`. All 52 PDFs returned HTTP200 without redirects, totaling 31,460,795 bytes. Dates and paths were discovered rather than guessed. Exact URLs, source tokens, roles and reviewed hashes are in `scripts/dol-publication-scope-2024.mjs`; earlier scope files are unchanged.

[DOL's copyright policy](https://www.dol.gov/general/aboutdol/copyright) was retrieved directly with HTTP200 at `2026-10-22T22:30:29.326Z`, SHA256 `ccd3b6fe6c99830256bd3f54c972bc5d3434b67634c7cfd781551d0db159ce2d`. Its federal public-domain terms permit use, reproduction and distribution without permission. Commercial display, unit conversions and scoped CSV/JSON redistribution of the selected agency-authored national regular-UI numerical facts are admitted with DOL ETA credit and the policy link. No contrary notice was found for these facts in the reviewed pages. Exclude seals/logos, third-party works, copied graphics/page design and implied endorsement. Public availability alone is not the reuse basis; a renderer403 did not prevent direct rights verification.

## Coverage, roles and timing

Publication dates run **January 4–December 26, 2024**. Each PDF contributes four facts: initial advance and its same-release prior comparison, continued advance and its independently dated prior comparison. Both advance sequences have uninterrupted seven-day coverage between their endpoints. The two printed Wednesday publication dates are **July 3 and November 27**; other source dates are Thursdays. No holiday cause or fixed Thursday rule is imposed. The February 29 publication is retained, including its extracted spaced day glyph.

| Measurement | 2024-release advance weeks | Prior comparison weeks | Added facts |
| --- | --- | --- | --- |
| Initial claims | 2023-12-30–2024-12-21 | 2023-12-23–2024-12-14 | 104 |
| Continued claims | 2023-12-23–2024-12-14 | 2023-12-16–2024-12-07 | 104 |

There are 104 advances, 95 explicitly revised priors and 9 explicitly unrevised priors. No unknown prior status or missing numeric glyph was found in this cohort. The original count strings remain intact; display divides by 1,000. Continued claims concern insured unemployment/continued benefit weeks, not distinct unemployed people. A quoted previously published count never creates an unretained original advance. Earliest edge weeks still lack original releases, and other years/all later annual revisions are not automatically admitted.

The [December 26 release](https://oui.doleta.gov/press/2024/122624.pdf) supplies initial advance 219,000 for December 21 and continued advance 1,910,000 for December 14. Their retained January 2, 2025 comparisons remain separate at 220,000 and 1,896,000 respectively. Publication selection orders by source day despite appending older records after newer ones. Missing cutoffs never substitute later, current or revised observations.

Release dates have **day precision**, with `publishedAt:null`; printed 08:30 Eastern embargo timing is not proof of an exact historical server-publication instant. Actual PDF retrievals span `2026-10-22T22:30:59.984Z`–`2026-10-22T22:31:13.534Z`, with actual URL/hash/Last-Modified preserved separately. No earlier Meridian capture timestamps are invented.

## Source notices and calculations

- [March 7](https://oui.doleta.gov/press/2024/030724.pdf) schedules 2024 factors and revised 2019–2023 factors/history for March 14. It is a scheduled update, not evidence of already applied changes.
- [March 14](https://oui.doleta.gov/press/2024/031424.pdf) applies annual revisions from 2019 forward and explicitly says BLS implemented new models for both measurements. It is `applied-update`; same-week differences crossing that update are withheld. Its continued prior for February 24 is actually revised from 1,906,000 to 1,794,000. The source value is preserved without clipping or assigning a more specific cause.
- [March 21](https://oui.doleta.gov/press/2024/032124.pdf) reports corrected factor files through March 2025, affecting factors for weeks after July 27, 2024, with **no impact on the prior week's published claims**. It is `factor-file-correction`, not another applied historical-value revision. Ordinary same-week differences versus March 14 remain +3,000 initial and −8,000 continued; these are not attributed to the technical issue.

Exact source inserts must be present before their reviewed paraphrases are admitted. Unknown or altered notices fail closed. The parser handles source-extraction whitespace before the July 3 weekday comma and within the August 1 `CLAIM S` title, while still checking exact release words, weekday/date, Saturday reference weeks, counts, revision arithmetic and independent regular-state SA table evidence. No new glyph restoration is needed. The two existing URL/hash/row-restricted zero corrections remain unchanged.

## Storage and refresh

The existing locked writer re-reads the data-only archive, appends only 208 missing approved IDs, validates complete scope and replaces atomically. Retained records/receipts are not rewritten. A completed rerun makes no request or write. Build requires 560 admitted facts. The existing lazy claims loader is bounded to 560; GDP has its independent cache/error/retry state. Scoped CSVs and frozen packages retain exact historical evidence, roles, rights and genuine receipts. No dependency, credential, service, infrastructure, daily archive-discovery job or freshness target is added. Current/revised feeds, calendars, GDP and all 36 immutable snapshot captures remain unchanged.

All 52 raw PDFs and 208 facts passed independent narrative/SA-table/date/revision/receipt review and current bounded production extraction. All 88 legacy parser outputs remain object-identical to the starting commit.

Local verification: **921 tests pass**, production build and **98-asset localhost smoke check** pass. A complete capture rerun performs no fetch/write. Independent audits confirm all 352 original ordered facts and receipts, 352 scoped CSV hashes and 12 complete portable JSON/CSV packages; all 36 snapshot descriptors/physical gzip/content hashes; current sources/calendars/policies; and GDP 1,076 facts / 33 explanations remain unchanged. Six actual 2024 frozen-pin round trips retain source-specific URLs, dates, rights and PDF receipts. Independent final code review found no actionable issue.

Browser checks at 320, 390, 736, 1,024 and 1,440px preserve Graphite without page-level horizontal overflow. Keyboard selection and mobile evidence-link focus work with internal table scrolling. Checks cover the 2024/2025 handoff, initial/continued periods, March 14 suppression versus March 21 ordinary differences, empty early cutoffs disabling CSV/pin, actual CSV download announcement, existing 2026 publications and GDP history. No console errors/warnings were observed. Source artifacts, receipts, audits, full test log and screenshots remain under ignored `test-results/dol-2024-*`; raw PDFs are not shipped as app assets. Deployment is verified separately after the tested commit is pushed.
