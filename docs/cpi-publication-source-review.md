# Reviewed CPI publication evidence

Reviewed October 23, 2026 (America/Toronto). This review admits nine dated BLS Consumer Price Index HTML editions, February 13 through October 14, 2026. Latest-reference coverage is January–September 2026. Two preceding-month cells per edition additionally cover December 2025–August 2026; December is a prior comparison, not a retained original release.

The source is [BLS archived CPI releases](https://www.bls.gov/bls/news-release/cpi.htm), specifically `https://www.bls.gov/news.release/archives/cpi_MMDDYYYY.htm`. Source provenance retains the exact URL, SHA-256 of the complete raw HTTP response, actual retrieval timestamp, and server last-modified header. Nine direct HTTP retrievals succeeded on October 24 UTC, 2026, at 03:05:13.001–03:05:13.618. All nine response hashes matched the independently retained feasibility snapshots. No browser rendering, cached-search text, calendar inference, or generated retrieval receipt was used for numerical capture.

| Publication day | Latest reference | Monthly headline SA | Monthly core SA | Twelve-month headline NSA | Twelve-month core NSA | Prior monthly headline / core SA |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-02-13 | January 2026 | 0.2 | 0.3 | 2.4 | 2.5 | 0.3 / 0.2 |
| 2026-03-11 | February 2026 | 0.3 | 0.2 | 2.4 | 2.5 | 0.2 / 0.3 |
| 2026-04-10 | March 2026 | 0.9 | 0.2 | 3.3 | 2.6 | 0.3 / 0.2 |
| 2026-05-12 | April 2026 | 0.6 | 0.4 | 3.8 | 2.8 | 0.9 / 0.2 |
| 2026-06-10 | May 2026 | 0.5 | 0.2 | 4.2 | 2.9 | 0.6 / 0.4 |
| 2026-07-14 | June 2026 | -0.4 | 0.0 | 3.5 | 2.6 | 0.5 / 0.2 |
| 2026-08-12 | July 2026 | 0.1 | 0.2 | 3.4 | 2.5 | -0.4 / 0.0 |
| 2026-09-11 | August 2026 | 0.4 | 0.3 | 3.4 | 2.4 | 0.1 / 0.2 |
| 2026-10-14 | September 2026 | 0.6 | 0.3 | 3.7 | 2.6 | 0.4 / 0.3 |

All values are published percentages, with their exact one-decimal strings retained. Core means all items less food and energy. The population is CPI-U, U.S. city average. These facts reuse catalog measurement IDs but have their own explicit publication measurement metadata; they are never calculated from the current index observations. `BLS/CPI-U/Table-A/...` source identifiers are application mappings, not BLS time-series API IDs.

## Source admission

The adapter verifies one release title, one matching narrative reference period and USDL number, the publication day, one Table A, the population caption, exact row labels and IDs, the monthly SA group header, the twelve-month unadjusted header, and the month/year attached to each selected column. It selects cells by unique exact `headers`, not positional offsets. Both published and preceding-month values must match the reviewed source strings. Unknown editions, changed values, duplicate cells, or changed header roles fail closed.

Current monthly column: `cpi_pressa.h.2.8`; preceding monthly column: `.h.2.7`; monthly adjustment header: `.h.1.2`; annual unadjusted column: `.h.1.9`. Headline row: `cpi_pressa.r.1`; core row: `cpi_pressa.r.1.3`. Each fact retains its full source-cell mapping.

Annual prior values are not retained in this Table A contract, even if prose elsewhere mentions them. A current-month minus preceding-month difference is a movement between reference months. A publication difference requires the same month and measurement in separate retained editions. Zero differences remain valid; no revision cause is inferred. The February edition's annual seasonal-factor recalculation notice is retained only on that edition. The Table A missing-October/November-2025 notice is validated and retained on February–June editions where printed. Missing months are never manufactured.

Release dates have day precision and `publishedAt` is null. An embargo heading is evidence for the dated edition, not proof of an actual publication instant.

## Reuse and attribution

[BLS copyright information](https://www.bls.gov/bls/linksite.htm) permits reuse of BLS public-domain statistical publications and requests attribution. Previously copyrighted photographs and illustrations are excluded; the BLS emblem is protected and is not reused. This scoped review covers factual Table A percentages, factual header/cell identities, and necessary source notices. It does not copy page design, imagery, or unrelated content. Numerical display, CSV, and frozen evidence retain BLS attribution, the independent-product disclaimer, and the existing BLS notice: “BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.” This HTML capture does not call the BLS API or broaden its API policy.

## Capture and upkeep

`node scripts/capture-cpi-publications.mjs` locks before a fresh data-only archive read, computes missing approved fact IDs, retrieves each needed approved edition once, validates the entire selected edition, appends only missing rows, and atomically renames the completed archive. Existing rows and receipts are retained exactly. A complete archive is returned without network access. Collector or admission failures preserve the prior file; the lock and owned temporary file are cleaned up.

`node scripts/check-publication-upkeep.mjs` is read-only. It validates GDP, claims, and CPI against their existing approved scopes and reports missing approved IDs; default discovery status is explicitly unchecked. `--discover` checks the official CPI news-release feed with a dated archive-index fallback, the BEA GDP page's dated vintage-workbook links, and the latest official DOL PDF release day. These bounds are intentional: the CPI feed is rolling recent coverage, GDP discovery does not verify all news releases, and DOL discovery does not inventory every intervening historical release. Any newly discovered edition goes to a review queue; no candidate value enters an archive automatically. HTTP/parse errors remain visible as discovery-unavailable. `--json` emits the report to stdout; the caller may save it. Discovery failure, archive corruption or missing approved facts causes a failed maintenance command. The maintenance job is independent of unrelated current-data deployment.

## CPI discovery access fix — October 24, 2026

The original hosted report (Actions run 40059245626) retained all 54 approved CPI facts but recorded HTTP403 for `https://www.bls.gov/bls/news-release/cpi.htm`. A local success alone did not establish hosted reliability.

The [BLS feed directory](https://www.bls.gov/feed/) explicitly supplies `https://www.bls.gov/feed/cpi.rss` for CPI **news releases**, separately from the latest-numbers feed. Despite its suffix, the observed payload is Atom, with namespace `http://www.w3.org/2005/Atom`, feed identity `bls.gov:feed:cpi`, title `Consumer Price Index`, and dated official archive links. A direct request at `2026-10-24T04:10:25.604Z` returned 8,402 bytes, SHA-256 `a5f2a686cebc14c09693431899d7e4ce56c15c752febbdba1156b30d33f1f387`, containing 12 entries from October 24, 2025 through October 14, 2026. That observed retention is not a permanent 12-entry guarantee.

The bounded collector checks this documented feed first. It accepts only well-formed scoped Atom and dated `https://www.bls.gov/news.release/archives/cpi_MMDDYYYY.htm` identities whose entry IDs match the date. It requires overlap with the latest reviewed publication; missing overlap or an unavailable/unrecognized feed falls back to the fixed archive index. Reports identify rolling-feed versus archive-index coverage explicitly. Feed prose is not numerical evidence, and feed timestamps are not actual publication instants. No historical-completeness claim is made for rolling-feed discovery.

Requests identify the project using its existing public contact URL, in line with [BLS automated retrieval guidance](https://www.bls.gov/bls/blsterms.htm). Each endpoint has a 12-second request/body deadline, 2 MiB cap, exact HTTP 200 and manual redirect handling. At most two attempts per endpoint are permitted for temporary transport/server errors. Denial, redirects and schema failures are not retried. Rate limits and long Retry-After instructions defer the check rather than immediately requesting another BLS endpoint. Accepted responses retain real hashes/retrieval receipts; failed attempts retain sanitized status/error evidence without response bodies. No proxy, browser impersonation, security challenge or credentials are used.

The Actions summary now includes discovery scope and request failures. Any discovery failure fails the independent maintenance job, even when another family's review queue has higher aggregate status priority. Current-data verification and deployment do not depend on that maintenance job. This change admits no new numerical facts and alters no prior receipts or website assets.
