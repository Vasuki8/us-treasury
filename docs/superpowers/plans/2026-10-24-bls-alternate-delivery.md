# BLS alternate delivery and calendar plan

**Goal:** Restore automatic current-data and schedule updates using reliable, explicitly reviewed delivery sources, retaining current UI/colors, exact measurements and immutable earlier captures.

**Final selected approach:** Use the verified New York Fed Economic Indicators Calendar for the three BLS release programs. Statistical delivery stays with the original BLS API: the user explicitly selected updating healthy sources while retaining visibly cached BLS readings when no verified current replacement was found. Allow only the exact observed unredirected API503 failure with a complete validated last-good BLS capture; other source/validation failures still stop publication. No keys, copied forecasts or invented reference periods.

**Rejected alternatives:** Official bulk files contain all20 exact IDs, but both local and hosted tests with the required identified client returned403; the adapter is removed from the final patch. DBnomics's observed BLS series are stale relative to retained data. FRED requires a user-owned API key and its current service-cache terms do not clearly authorize this public persisted/exported application. None is silently substituted.

## Constraints

- All20 raw BLS IDs, native SA/NSA measures, frequency,10-calendar-year capture window, exact comparison baselines and current units remain unchanged.
- Do not ship inactive bulk-delivery code or broaden the shared HTTP limits after the identified route failed its live test.
- Use the identified project User-Agent, sequential requests spaced at least one second, bounded deadlines and no denial retries/redirect tricks.
- Admit exact New York Fed calendar URLs. Preserve original BLS numerical receipts/timestamps, true schedule publisher provenance, required notices and unchanged earlier histories.
- Keep canonical calendar category `bls` for the originating release agency; separately label provider `new-york-fed`, real source URLs and secondary-calendar basis. Unknown reference months remain null.
- Calendar horizon follows actually linked pages, with explicit coverage and no future-date inference. Require current Eastern month even if the index lags at rollover; fail on unexpected schema/denial/shrinking captured coverage.
- No UI/theme redesign. Add only required source attribution through existing disclosure/note components and exports.

## Tasks

1. **Statistical failure containment:** `scripts/sources/refresh.mjs`, daily/workflow planners and focused tests. Retain only complete admitted last-good BLS data after exact unredirected v1 HTTP503; retain original data/receipts, mark error/cached, require a new attempt for each daily slot. Other selected sources must succeed. Bounded targeted BLS recovery attempts avoid repeated full downloads.
2. **Calendar adapter:** new `scripts/sources/calendar-nyfed-bls.mjs` and focused tests. Parse only explicit BLS program dates/clocks from validated current/linked month pages, including DST/rollover/missing future horizon; preserve rights notices and actual source receipts.
3. **Admission:** new calendar-only `scripts/bls-alternate-policy.mjs`, tests and exact source review. Integrate with existing admission without widening statistical feeds or changing frozen legacy API captures.
4. **Integration:** switch automatic BLS annual-calendar retrieval to the reviewed New York Fed collector. Add `--allow-cached-bls` for the user-approved narrow statistical service-failure policy. Preserve original metadata and calendar/event source notices in existing disclosures/exports. Test release association/retry behavior, provider attribution, coverage shrink rejection and immutable archive retention.
5. **Verification and publication:** independent patch review; full tests, build/smoke, isolated hosted30-source audit and upkeep, then publish only verified replacement captures and verify production/live assets. Record actual provider availability, coverage horizon, source lags and remaining limitations.

## Execution ledger

- Read-only research verified all20 raw IDs in the8 official bulk files, including native quarterly PR/ECI and genuine shutdown gaps. Rebuilt API-compatible payload passes unchanged parsers. No source substitution/rebasing is needed.
- Actual New York Fed current/November/December2026 pages returnHTTP200 with identified requests, explicit Eastern clocks and no reference periods. January2027 not yet available; coverage must remain explicit.
- Independent rights review confirmed scoped BLS public-domain data and New York Fed permission for business use, automation, caching and derivatives with required attribution/terms/modification notice. No signup or messages were sent.
- Identified bulk adapter22tests passed, but real local and hosted run40146129094 returned403. The route was rejected and its inactive implementation/tests removed; no identity/header rotation or denial retry was attempted.
- The user explicitly chose **Update healthy sources; clearly retain cached BLS data** after the verified-source limitations were explained. This authorizes the narrow statistical503 retention mode; it does not authorize presenting old BLS data as a new capture or release.
- Calendar collector15tests, policy5tests and public/frozen integration6tests pass, including an actual8-event October–December2026 capture. Root owns final integrated verification.
