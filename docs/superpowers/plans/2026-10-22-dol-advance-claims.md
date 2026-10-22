# Separate DOL advance claims release

Add current advance initial and insured-unemployment/continued claims from DOL's official weekly news release. Preserve Graphite, the existing 1967-onward revised-history series, all stored snapshots and frozen packages. No paid source, credential, new hosting or service is required.

## Sources and design

DOL ETA's official release archive identifies `https://www.dol.gov/ui/data.pdf` as the latest complete release. Verify DOL's public-domain policy for the selected agency-authored statistics. Use a pinned maintained headless Node PDF text extractor (`unpdf`, MIT; includes Mozilla PDF.js) with a lockfile and install it in the existing Actions jobs. Keep this collector dependency out of the browser/static build. Do not hand-write a general PDF parser or import agency logos/charts/prose.

A new `dolAdvance` source has independent capture/error/cache/freshness status. Registered `claimsAdvance` and `continuedClaimsAdvance` measurements each retain only the current advance week plus the previous week's comparison value as revised/unrevised in that same release. They never splice into `claims` or `continuedClaims`. Initial and continued reference weeks remain independently parsed. Stage labels, original count strings, count/1,000 scaling, known release day, day precision, actual retrieval and byte hash accompany exports/pins.

## Tested milestones

1. Review current and earlier actual official PDFs, source rights, narrative/table agreement and schema. Test release dates, Saturday/year-boundary alignment, prior-week revision/change arithmetic, unchanged values, missing/conflicting prose, failed/oversize PDFs and stale/future releases. Use bounded byte/page/text extraction with no external resource fetches or evaluation.
2. Admit only the exact source and measurement mappings through a dedicated policy. Test identity, source/rights, count/value, day precision, roles and independent-period contracts. Add the collector to existing daily refresh and freshness targets; retain last-good advance data on failure independently of revised history.
3. Reuse registry/detail/search/watchlist/coverage/comparison/CSV components. Distinct names and reciprocal links separate advance and historical views; no extra unpinned numerical panels on existing pages. Verify captured metadata and frozen replay; earlier captures must not acquire advance observations retroactively.
4. Refresh only the new source after admission. Audit all prior source/calendar objects and immutable capture prefixes/blobs. Test CSV and frozen JSON, the full suite, build/HTTP assets, desktop/mobile and keyboard/loading/error behavior. Independently review and push via existing main/Actions conventions.
5. Verify deployment and representative public views before calling the release live. Explain remaining limits: latest release context is not historical first-release vintages; release day and an embargo clock do not prove an exact server-publication instant.
