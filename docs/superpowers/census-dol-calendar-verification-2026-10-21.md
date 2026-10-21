# Census and DOL calendar verification — 2026-10-21

Extended the existing Graphite calendar and static snapshot pipeline with official Census advance-retail dates and DOL ETA weekly claims schedules. This extends the earlier BLS/BEA calendar capture; Treasury publication schedules remain outside the current scope.

## Sources and commercial reuse review

- Census: explicitly displayed retail titles, dates, times and reference months from its annual HTML calendar. When the canonical calendar advances to next year, its discovered current-year archive must also succeed. Suspended or TBA rows are omitted even when hidden sort keys contain obsolete dates. The scoped rights review covers factual federal metadata with Census/program credit, source links and retrieval timestamps. Census DS027 and Copyright Office guidance support that review; no calendar-specific CC0 license is claimed. Narrative, HTML, logos and imagery are excluded. Evidence and qualifications are recorded in `docs/data-sources.md` and enforced in `scripts/data-policy.mjs`.
- DOL: the official `claims_arch.asp` publication rule and posted holiday-exception table. DOL's public-domain policy supports commercial reuse of this agency-authored factual material with source credit and no implied endorsement. Each response retains its hash, raw publication rule, parsed exceptions and retrieval timestamp.

DOL publishes a recurring Thursday 08:30 rule rather than listing every release separately. Only the upcoming 90 Eastern calendar days are expanded, capped by the last posted exception year; elapsed dates and historical reconstruction are excluded. Posted Wednesday exceptions replace their nominal Thursday. Dates retain stable nominal-week identities, and the UI labels `AGENCY RULE` or `AGENCY EXCEPTION` beside the title and in the preview. Observation periods remain unknown. The source's generic EST wording is interpreted as Eastern time, including DST, consistent with DOL's official release embargo; that interpretation is disclosed.

## Official capture

The calendar-only refresh succeeded on 2026-10-21, yielding 168 schedule entries: BLS 60, BEA 70, Census 25 and DOL 13. All four sources are required for an `ok` calendar status. Per-source failures retain the original last-good capture with a visible cached/error state.

- Census retrieved `2026-10-21T20:18:38.791Z`: 13 entries in 2026 and 12 in 2027. The next retail release is 2026-11-17 08:30 EST, explicitly covering October 2026. Canonical 2027 SHA256: `9629ed5b7952c97b8ec18561df558d08f92942dc1c4e85d737594d62efa14e14`; discovered 2026 archive SHA256: `e3c5cd2a6f3092ae675b89586c5803642837a33052cfe40ff677f2414aa9f9b0`.
- DOL retrieved `2026-10-21T20:18:38.758Z`: 13 upcoming events from October 22, 2026 through January 14, 2027. Coverage window is October 21, 2026 through January 18, 2027 inclusive. The posted November 25 exception replaces November 26; 2027 Veterans Day and Thanksgiving exception handling is covered by tests. SHA256: `80e78de786a55636aec60c2bdb23773c237ef973eee33293b136016294ce3ded`.
- Existing BLS and BEA calendar event records were compared with the previous commit and remain unchanged. All statistical indicator sources, values and retrieval provenance also remain unchanged; only calendar retrievals were refreshed.

## Verification

- `npm test`: 194 passed, zero failed on local Node 24. The sandbox initially blocked the HTTP server test's loopback connection; rerunning with local network permission passed the complete suite.
- `npm run build`: passed, including the commercial-use policy checks.
- `node scripts/check-build.mjs`: all 12 built assets passed over local HTTP.
- `git diff --check`: passed.
- New adapter and UI regression tests were observed failing before implementation and passing afterward. Coverage includes annual rollover, visible versus hidden dates, suspended schedules, malformed responses, exact feed/program scope, DST, holiday replacement, elapsed dates, window boundaries, policy rejection, partial status and last-good retention.
- Independent review examined the adapters, policy enforcement, refresh behavior, source credits and rights evidence. It ran 45 focused tests and reported no findings.
- Local browser checks confirmed both new sources, November 25's replacement of November 26, Census's explicit reference month, claims/retail follow and watchlist filtering, topic/day/month filters, reset and deep-link reload. User watchlist state was restored after testing. DOL basis labels remain visible on narrow screens. Widths 320, 390, 736, 1024 and 1440 pixels had no page overflow; no browser warnings or errors were observed.

The existing GitHub Actions workflow tests Node 22 and 24, builds and deploys main. The deployment run and live asset comparison supply publication evidence after this commit is pushed. Cloudflare account activation remains deferred as requested.
