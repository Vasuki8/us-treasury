# BLS alternate delivery and calendar plan

**Goal:** Restore automatic current-data and schedule updates using reliable, explicitly reviewed delivery sources, retaining current UI/colors, exact measurements and immutable earlier captures.

**Selected approach:** Use BLS's documented public bulk-download service for all20 existing raw identifiers, and the New York Fed's Economic Indicators Calendar for the three BLS release programs. No keys, aggregation-service licenses, copied forecasts or invented reference periods. This is an alternate delivery path for the same BLS statistics; the calendar is explicitly secondary metadata published by the New York Fed.

**Alternatives:** FRED requires a user-owned API key and its current service cache terms do not clearly fit this public persisted/exported application. DBnomics permits an API/cache with database-license obligations and possible daily lag. Direct official bulk files preserve exact native values and original public-domain scope without those additional dependencies.

## Constraints

- All20 raw BLS IDs, native SA/NSA measures, frequency,10-calendar-year capture window, exact comparison baselines and current units remain unchanged.
- Stream large bulk responses, hash the entire decoded response, retain only admitted series/window, bound decoded bytes, line buffers, requests and target rows. LN is approximately392MB decoded /47MB compressed; never store the full raw table or raise the shared HTTP limit globally.
- Use the identified project User-Agent, sequential requests spaced at least one second, bounded deadlines and no denial retries/redirect tricks.
- Admit exact bulk data/footnote files and exact New York Fed calendar URLs. Preserve per-series retrieval and true publisher provenance, required notices and unchanged original histories.
- Keep canonical calendar category `bls` for the originating release agency; separately label provider `new-york-fed`, real source URLs and secondary-calendar basis. Unknown reference months remain null.
- Calendar horizon follows actually linked pages, with explicit coverage and no future-date inference. Require current Eastern month even if the index lags at rollover; fail on unexpected schema/denial/shrinking captured coverage.
- No UI/theme redesign. Add only required source attribution through existing disclosure/note components and exports.

## Tasks

1. **Bulk adapter:** new `scripts/sources/bls-bulk.mjs` and focused tests. Fixed8 data files +6 footnote maps; streamed exact-ID extraction returns existing API-compatible parser input and complete receipts. Test real chunk boundaries, authentic footnotes, nulls, bounds, cancellation/deadlines, missing/duplicate/invalid selected rows and exact20-ID coverage. Live-test the identified adapter once.
2. **Calendar adapter:** new `scripts/sources/calendar-nyfed-bls.mjs` and focused tests. Parse only explicit BLS program dates/clocks from validated current/linked month pages, including DST/rollover/missing future horizon; preserve rights notices and actual source receipts.
3. **Admission:** new `scripts/bls-alternate-policy.mjs`, tests and exact source review. Root integrates helpers into existing data/economic-depth/macro admission without widening unrelated feeds or changing frozen legacy API captures.
4. **Integration:** replace automatic BLS API collector with bulk; retain explicit legacy API collector for offline compatibility tests. Replace automatic BLS annual-calendar retrieval with the reviewed New York Fed collector. Preserve original per-series metadata and calendar/event source notices in existing disclosures/exports. Test release association/retry behavior, provider attribution, coverage shrink rejection and immutable archive retention.
5. **Verification and publication:** independent patch review; full tests, build/smoke, isolated hosted30-source audit and upkeep, then publish only verified replacement captures and verify production/live assets. Record actual provider availability, coverage horizon, source lags and remaining limitations.

## Execution ledger

- Read-only research verified all20 raw IDs in the8 official bulk files, including native quarterly PR/ECI and genuine shutdown gaps. Rebuilt API-compatible payload passes unchanged parsers. No source substitution/rebasing is needed.
- Actual New York Fed current/November/December2026 pages returnHTTP200 with identified requests, explicit Eastern clocks and no reference periods. January2027 not yet available; coverage must remain explicit.
- Independent rights review confirmed scoped BLS public-domain data and New York Fed permission for business use, automation, caching and derivatives with required attribution/terms/modification notice. No signup or messages were sent.
