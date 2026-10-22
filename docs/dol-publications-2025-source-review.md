# Archived DOL claims publications: 2025 extension

Reviewed October 22, 2026. This extends the [original 2026 admission](dol-publication-history-source-review.md) with **46 official 2025 releases and 184 facts**. The complete archive now has **88 releases / 352 facts**. The original 168 records, their order and actual retrieval receipts are preserved exactly. Revised XML history, current advance context, calendars, GDP publications and immutable snapshot captures are unchanged.

## Discovery and commercial display/export

The [official ETA archive](https://oui.doleta.gov/unemploy/claims_arch.asp) returned 46 distinct links from `POST https://oui.doleta.gov/unemploy/archive.asp`, body `report=press&year=2025&submit=Submit`. Discovery receipt: `2026-10-22T22:02:54.914Z`, SHA256 `3adf9e071bc6cf1d87bfca6dd4abff253ca6c1237faada6d28b89e4aa84c4ed1`. All linked PDFs returned HTTP200 without redirects, totaling 25,498,305 bytes. No release dates or paths were guessed. Exact URLs, source tokens, roles and reviewed PDF hashes are in `scripts/dol-publication-scope-2025.mjs`; the original 2026 manifest is unchanged.

[DOL's copyright policy](https://www.dol.gov/general/aboutdol/copyright) was retrieved directly with HTTP200 at `2026-10-22T22:02:55.072Z`, SHA256 `ffb7b996ac416fdf55f27c611d3deab2ccb1fd72b4555b63370461472a3d8af0`. Its federal public-domain terms permit use, reproduction and distribution without permission. The admitted commercial scope is the selected agency-authored national regular-UI numerical facts, unit conversions, factual release metadata and original Meridian paraphrases, with DOL ETA credit and the policy link in display/CSV/JSON. No contrary notice was found for these facts in the reviewed PDF pages. Exclude seals/logos, third-party works, copied graphics/page design and implied endorsement. Public availability alone is not the reuse basis. The web renderer's403 did not prevent direct verification of the policy.

## Coverage and unavailable publications

Publication dates run **January 2–December 31, 2025**. Each PDF retains four facts: initial advance and prior comparison, and continued advance and its independently dated prior comparison. Counts remain exact strings; display divides by 1,000. Continued claims describe insured unemployment/continued weeks claimed, not unique unemployed people.

| Measurement | 2025-release advance weeks | Prior comparison weeks | Added facts |
| --- | --- | --- | --- |
| Initial claims | 2024-12-28–2025-12-27 | 2024-12-21–2025-12-20 | 92 |
| Continued claims | 2024-12-21–2025-12-20 | 2024-12-14–2025-12-13 | 92 |

The [November 20 release](https://oui.doleta.gov/press/2025/112025.pdf) explicitly says no news releases were published for **October 2–November 13, 2025**, because of the lapse in appropriations. Seven advance weeks are unavailable for each measurement: initial September 27–November 8 and continued September 20–November 1, each Saturday. Missing releases are not reconstructed from revised history, later comparisons or assumed weekly publication dates.

That release reports prior initial claims **228,000 for November 8** and continued claims **1,946,000 for November 1** in its regular-state SA tables. Its narrative does not identify either as revised/unrevised and quotes no earlier published count. These two facts retain `prior-week-status-unknown`, label **Prior comparison (status unknown)** and `previouslyPublishedSourceValue:null`. They are facts published November 20, with no invented original advance. Current advances in that PDF are 220,000 for November 15 and1,974,000 for November 8. Table headers, raw counts and signed narrative changes independently reconcile.

Five printed Wednesday release dates—January 8, June 18, November 26, December 24 and December 31—are retained exactly, without imposing a Thursday-only rule or assigning an unverified holiday reason. The December 31 release now supplies the original 199,000 initial advance for December 27; its January 2026 comparison remains a separate fact. Earliest edge weeks still lack an original advance.

Publication dates have **day precision**, `publishedAt:null`. Printed 08:30 Eastern embargo timing constrains retrieval eligibility, not the actual historical server-publication instant. Actual PDF retrievals span `2026-10-22T22:04:56.823Z`–`2026-10-22T22:05:16.586Z`; each fact preserves its genuine receipt/hash/Last-Modified. These retrievals do not create earlier Meridian captures.

## Annual updates and bounded extraction

The [March 20 release](https://oui.doleta.gov/press/2025/032025.pdf) schedules 2025 factors and revised 2020–2024 factors/history for March 27. The [March 27 release](https://oui.doleta.gov/press/2025/032725.pdf) explicitly applies the annual revision from 2020 forward. Exact source inserts are reviewed separately and represented by scheduled/applied paraphrases. Comparisons crossing the applied update are withheld; ordinary revision causes are not inferred. Four facts per PDF do not cover all historical annual revisions.

The parser permits the reviewed highest/lowest-level aside for the appropriate initial/insured-unemployment subject, including a standalone aside. Unknown notices or contradictory date/count/revision/table evidence fail closed. Unspecified prior status is accepted only with the exact November 20 shutdown notice; its raw prior count comes from the independent SA table. The daily current-source policy still enforces its own admitted roles.

In the [September 11 PDF](https://oui.doleta.gov/press/2025/091125.pdf), text extraction omits a printed continued-SA change **0**. Two reviewers visually confirmed page 4: `1,939,000 / 1,939,000 / 0 / 1,944,000 / 1,845,000`. The narrative says unchanged. Restoration requires the exact source URL, PDF SHA256 `f4ba1484bf28e725205ef24c3ddb0c25e279c25349fe07d3db0e6e8571f53f1a`, unique full row and subsequent narrative/table reconciliation. Only the two affected continued facts carry its explanation. The existing March 2026 correction is unchanged; other numeric gaps remain errors.

## Storage, refresh and verification

The existing append-only writer appends only 184 missing reviewed IDs under a file lock after a fresh data-only read and atomic replacement. Build requires the complete 352-fact scope. A completed rerun does not fetch or rewrite. The browser lazily loads only the selected claims publication archive, bounded to 352 facts, with existing source-specific loading/error/retry behavior. The Graphite interface, weekly day cutoff, scoped CSV and immutable portable packages are reused. Future scope expansion requires another review; this archive does not create a daily discovery job or another freshness target. No dependency, credential, service or hosting changes are introduced.

All 46 PDFs were independently audited against their narrative, regular-state SA table/reference dates and raw receipt hashes. The current production worker/adapter re-extracted every raw PDF and admitted 184 facts. The original 42 PDF parses remain object-identical and all 168 retained facts/receipts remain valid. Regression coverage includes year-crossing weeks, Wednesday cutoffs, shutdown gaps/unknown priors, seasonal updates, strict zero correction, append-only/no-refetch behavior, CSV/package round trips and tampered-build rejection.

Local verification: **912 tests pass**, production build and **98-asset HTTP smoke check** pass. A complete capture rerun performs no fetch/write. Independent preservation checks confirm all original 168 fact/receipt objects, 168 scoped CSVs and six portable JSON/CSV packages; all 36 physical snapshot blobs and descriptors; current observations/calendars/policies; and all 1,076 GDP facts / 33 explanations. Independent final code review found no remaining actionable issue.

Browser verification at 320, 390, 736, 1,024 and 1,440px shows no page-level horizontal overflow. Graphite styling is unchanged; the evidence table scrolls within its panel on mobile, and keyboard focus reaches its evidence links. The keyboard measurement selector, separate continued-week selection, unknown-prior explanation, early-cutoff disabled CSV/pin, actual CSV download announcement, December 2025 / January 2026 handoff and existing GDP view were checked. No browser console errors/warnings were observed. Source receipts, audits, full test log and screenshots remain in ignored `test-results/dol-2025-*`; raw PDFs are not public app assets. Deployment status is verified separately after pushing the tested commit.
