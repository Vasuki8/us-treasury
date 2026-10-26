# Confirmed DOL PDF supplement

The user approved continuing the verified weekly-PDF approach. Extend the existing revised `claims` and `continuedClaims` histories beyond the lagging XML, using only explicit prior-week revised/unrevised comparisons from DOL's dated releases. Keep current advance measurements separate, preserve the current UI/colors, units, raw count strings, unknown exact publication instants and immutable captures. No new provider, key or dependency.

## Approach and limits

Retain the strict XML collector as the historical base. Discover actual dated PDF links from the official archive form POST (`report=press&year=<year>&submit=Submit`) to `https://oui.doleta.gov/unemploy/archive.asp`; do not generate a publication calendar or guess PDF availability. At most current and previous UTC year, at most eight new PDF requests per run, sequential. Previously admitted PDF rows, overlap and notice-context receipts may be retained at their original clocks, bounded by the existing 10,000-week scope. Thus a continuously maintained series does not freeze again merely because XML remains behind for more than eight weeks. Reuse `parseDolAdvanceText` and the bounded worker extractor, including their existing notice checks. Extract only `prior-week-revised` and `prior-week-unrevised`; never advance or revision-status-unknown rows.

Process newest releases backward until each series has all seven-day steps between its XML endpoint and newest confirmed prior, plus an exact numeric/raw-count XML overlap (comma formatting may differ). Scan release notice context back through the older XML endpoint on bootstrap, or the older already-verified endpoint on continuation; do not stop at the first coincidentally matching anchor. Preserve all XML rows and internal nulls. Never shrink previous coverage/latest usable date or call a regressed archive the latest source; XML catching up can supersede the supplement naturally. A fetch, unknown schema/notice, missing bridge or bounded-window failure fails the candidate and leaves prior publication intact. For every captured/known applied seasonal revision, both XML endpoints must be on/after its release date before extension; matching isolated weeks alone does not certify an older seasonal regime. Unknown seasonal notices already fail the existing PDF parser.

FRED/ALFRED were rejected as a drop-in: advance tails and unresolved retained-storage service permission. Raw state CSV/other Fed monitors require aggregation/seasonal estimation or differ from native published measures. PDF-only full history would discard the 1967 base. The approved hybrid retains that base and adds only confirmed official counts.

## Data contract

New source `revisedHistoryProfile` is exactly `{version:1,xmlThrough:{claims,continuedClaims},latestReleaseDate,overlaps:{claims,continuedClaims}}`. Each overlap is a copied eligible PDF prior row with the fields below. Preserve this profile in capture/replay; legacy unmarked captures retain their original behavior.

All observations in a profiled source use `sourceUrl`, `sourceSha256`, `retrievedAt` to select their actual receipt. XML rows otherwise stay unchanged. PDF rows additionally retain `publicationDate`, `publicationDatePrecision:'day'`, `releaseStage`, `previouslyPublishedSourceValue`, `footnotes`; keep `publishedAt:null`. Do not embed repeated receipt objects per row. Each series opts into existing `inputProvenanceScope:'observation-source-urls'`, keeps its native source ID and XML sourceUrl, and lists its actual supporting URLs. Parent provenance contains actual XML, archive-index and selected dated-PDF receipts only; source fetchedAt is their maximum real retrieval time.

New exact feed permissions apply only to a valid profile: bare XML/index endpoints and valid `https://oui.doleta.gov/press/YYYY/MMDDYY.pdf` links. Require exact URL/date/role/count/retrieval/hash consistency, a complete two-series scope, continuous appended weeks and the overlap proof. No query URLs, external hosts, inherited vendor terms, arbitrary per-row overrides or alternate adjustments.

Use compact coverage notes describing XML base date, confirmed-release supplement and remaining advance separation. CSV, charts, frozen packages and as-known replay reuse existing controls; keep the existing 12 MiB portable cap.

## Acceptance

The verified October 8/15/22 editions should extend initial claims from September 26 to October 10 (October 3: 198,000; October 10: 200,000), and continued claims to October 3 (1,703,000). All 3,117 old rows per series and all 179 prior captures remain preserved. Real source checks, full suite, exports/replay, build, both supported runtimes and exact live assets must pass before completion.
