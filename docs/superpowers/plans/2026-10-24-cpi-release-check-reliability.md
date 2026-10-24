# CPI automatic release-check reliability

User-authorized bug fix: make automatic CPI release checks reliable; preserve UI/colors, retained facts and source-review admission. Base63afd90. Reuse the attached isolated worktree on codex/cpi-release-check-reliability.

## Evidence and approach

The prior Actions artifact from run40059245626 records HTTP403 for the sole BLS archive-index request. A normal local request succeeds, so local success cannot settle hosted behavior. BLS explicitly documents its CPI news-release feed at https://www.bls.gov/feed/cpi.rss, distinct from latest-numbers feeds. Actual retrieved content is Atom with12 recent dated archive links, overlapping the latest reviewed publication. It is a legitimate discovery surface, not evidence admission or proof of publication instants. Its observed timestamps sometimes precede the release time and must not become actual publication timestamps.

Use the fixed official news-release feed first, with the archive index as a fixed fallback. Report recent-feed versus archive-index discovery scope explicitly; never imply that a rolling feed inventories all historical editions. Require feed overlap with the latest reviewed release before accepting its recent-discovery result. Missing overlap falls back to the index. Both unavailable remains a visible error. No proxies, identity spoofing, credentials, browser challenges or generated schedule-based release identities.

Use the existing honest project bot identity/contact, endpoint-specific Accept, manual redirects, exact200 responses,2MiB limits and preserved accepted-response receipts. At most two attempts per endpoint,12-second request deadlines and bounded delays for transport/transient HTTP failures. Do not retry denial, redirect or schema failures. Respect server Retry-After beyond the budget by deferring; do not immediately try another same-host endpoint after rate limiting.

## Tasks

- [x] Source collector/parser plus regression tests (bounded worker): new scripts/sources/cpi-discovery.mjs and tests/cpi-discovery.test.js. Exports discoverCpiCandidates (existing HTML contract), parseCpiReleaseFeed, collectCpiReleaseDiscovery. Return status/candidates/provenance/attempts/source/coverage/error with sanitized structured failure details. Preserve candidates as review-only identities.
- [x] Root integration/report/workflow tests: replace only CPI discovery path; preserve GDP/claims behavior and old archive values. Summary shows source/scope/failure reasons. Independent upkeep job reports discovery failures unsuccessfully while verify/deploy remain independent. Allow explicit manual branch verification without branch deployment. Add actual request-path integration regressions and workflow dependency checks.
- [ ] Run focused and full tests/build checks; independently review source/error/retry contracts. Verify on hosted branch workflow and inspect JSON artifact, not only job success. Update source-review/README with bounded feed scope and observed limitations.
- [ ] Publish verified fix through existing main workflow. Recheck hosted artifact and unchanged live runtime/UI assets; record outcome. Preserve existing user workspace artifacts.

## Review risks

- Misleading rolling-feed scope or stale feed accepted without reviewed-anchor overlap.
- Mutable links, foreign channels, date/entry identity mismatch or malformed XML treated as official candidates.
- Partial responses, redirects and response bodies accepted as healthy source evidence.
- Excessive/rejected retries, ignored rate limiting or request deadlines that omit body reads.
- Successful pipeline masking failed discovery, or maintenance failure blocking unrelated data publication.

Local verification:1,499/1,499 full-suite checks passed (223 seconds); final focused30/30 checks passed; independent source/integration review found no remaining material issue. Build/smoke confirms163 unchanged website assets under b56c1a3eb5476c93. Identified-client official checks at04:21 and04:24 UTC still received403 on both fixedBLS endpoints. This patch is not yet proof of restored source access; hosted branch artifact verification is required before claiming resolution.

Hosted verification complete: run40062327314 passed Node22/24 verification/build/smoke, but the actual CPI upkeep artifact confirms403forbothfixedofficialsources, oneattempt each. Source access is an external blocker; keep changes on the tested branch and do notmergeorclaimautomaticaccessrestored. Prepared owner-reviewable request docs/cpi-source-access-request.md. No external message sent. Publication task remains unfinished until approved source access is demonstrated.
