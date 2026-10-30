# Treasury release calendar verification — 2026-10-21

Extended the existing Graphite calendar with Treasury Fiscal Data's explicitly listed Debt to the Penny release estimates. The dependency-free snapshot pipeline, source status and existing deployment workflow are reused.

## Source and commercial reuse scope

- Calendar: `https://api.fiscaldata.treasury.gov/services/calendar/release`.
- Identity metadata: `https://api.fiscaldata.treasury.gov/services/dtg/metadata/`.
- Exact reviewed dataset: `015-BFS-2014Q3-065`, title `Debt to the Penny`, path `debt-to-the-penny`, mapped only to the existing `debt` indicator and Fiscal topic.
- Treasury's [calendar page](https://fiscaldata.treasury.gov/release-calendar/) describes its dates and times as estimates. Its own frontend [time component](https://github.com/fedspendingtransparency/fiscal-data/blob/master/src/components/calendar-entries/calendar-entry-time/calendar-entry-time.jsx) confirms service clocks are UTC. Preserve those date/time inputs and derive Eastern display fields through `America/New_York`; do not relabel UTC clocks as local time.

Fiscal Data's [License and Authorization](https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization), independently retrieved from the live official site, permits commercial copying, adaptation and redistribution. Applying its general open-data policy to factual calendar/identity service metadata is the recorded review judgment, supported by the [Copyright Office's facts/name/title exclusions](https://www.copyright.gov/what-is-copyright/). This review does not claim calendar-specific CC0 licensing. Only identity, estimated timing and source metadata are retained; narratives, imagery, logos and other datasets are excluded. Credit Treasury's Bureau of the Fiscal Service, Fiscal Data, without endorsement. The policy and evidence are recorded in `docs/data-sources.md` and enforced in `scripts/data-policy.mjs`.

No yield calendar dataset was verified in these services. Treasury's [yield methodology](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology) says yields are usually available by 6 p.m. Eastern each trading day, subject to delays. That availability deadline is not an exact dated calendar event; 3:30 p.m. is input quotation time. Yield events and auction schedules are not substituted for Debt to the Penny releases.

## Official capture and behavior

The calendar-only refresh on 2026-10-21 succeeded for all five agencies: BLS 60, BEA 70, Census 25, DOL 13 and Treasury 50, totaling 218 entries. Statistical observations, their retrieval provenance and all prior four agencies' event records were compared with the previous commit and remain unchanged.

Treasury's 50 listed estimates run from October 21, 2026 through January 4, 2027. Source clocks change from 20:15 UTC before the DST transition to 21:15 UTC afterward, both displaying 16:15 Eastern. November 11, November 26 and December 25 are absent from the Treasury list; no missing dates, weekends, holidays or later dates are generated. Observation periods remain unknown. The source `released` flag is validated as a known input schema but is discarded and never treated as verified publication history.

- Combined Treasury capture: `2026-10-21T21:21:23.628Z`.
- Calendar retrieved `2026-10-21T21:21:22.942Z`, SHA256 `06fe9f79adb6a8c22ea6b5909e045e7c2d6addf5568a290aa32ce0db0eb6d071`.
- Identity metadata retrieved `2026-10-21T21:21:23.628Z`, SHA256 `4f3d01f510658c72045996770a57f5de0ef28c44a8a5d7d568e875f20081d326`.

Both feeds are bounded to 2 MiB and must succeed with exact URLs and matching identity. Invalid schemas, dates, clocks, identities, duplicate selected dates and unexpected redirects fail before replacement. An exhausted horizon produces a visible warning. A failed agency refresh retains its last-good schedule and original retrieval/provenance, with partial calendar status. All five sources must succeed for an `ok` calendar status.

Treasury rows display `ESTIMATED` in State and beside their titles so the distinction survives narrow screens. The overview also retains that label. The preview explains that the agency's date/time estimate may change, credits the full agency, links the source and relates the existing debt indicator. Cached captures retain both cache status and the estimate basis; elapsed time does not produce a published state.

## Verification

- TDD: adapter, policy, missing-source status and UI tests were observed failing for the intended missing behavior before implementation, then passing.
- `npm test`: 210 passed, zero failed, including the local HTTP server test with loopback permission.
- `npm run build`: passed, including commercial-use validation.
- `node scripts/check-build.mjs`: all 12 static app assets passed over local HTTP.
- `git diff --check`: passed.
- Independent read-only review examined source identity, UTC/DST and date rollover, estimated semantics, rights scope, partial status and last-good retention. It ran 65 focused tests and reported no actionable findings.
- Browser QA: November Fiscal/debt watchlist filtering returned 19 listed Treasury entries; unfollowing recovered the empty state, and test watchlist state was restored. October displayed 16:15 EDT and November displayed 16:15 EST. Selected Treasury deep links survived reload. At widths 320, 390, 736, 1024 and 1440 pixels, estimate labels remained visible, full source credits fit and the page had no horizontal overflow. No browser warnings or errors were observed.

The existing Actions workflow verifies Node 22 and 24 and deploys main. Its run status and the exact live asset comparison supply publication evidence after pushing. Cloudflare account activation remains deferred as previously requested.
