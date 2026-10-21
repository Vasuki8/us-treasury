# Official release calendar verification — 2026-10-21

Connected the existing Graphite calendar to reviewed BLS and BEA schedules. The implementation uses the existing dependency-free static snapshot pipeline and automatic deployment workflow. Cloudflare activation remains deferred.

## Scope and reuse review

The calendar covers BLS Employment Situation, CPI and JOLTS, plus BEA national GDP and Personal Income and Outlays. Both agencies' website publication policies permit public-domain reuse; the dataset-specific reasoning, conditions and primary evidence are recorded in `docs/data-sources.md` and enforced separately from statistical observations in `scripts/data-policy.mjs`. Only exact official schedule feeds and reviewed program mappings are accepted. Calendar rows must match their captured source records and response hashes. Agency credits and the site's independent status remain visible.

Census retail, DOL claims and Treasury publication schedules are not ingested. Official Census/DOL references remain linked. No weekly recurrence, observation date or retrieval time is used to invent a release date. Scheduled time passing does not prove publication. Results, forecasts, consensus, impact scores and publication revision histories remain absent.

## Official capture

- BLS annual HTML: 60 mapped events, 36 from 2026 and 24 from 2027. Current JOLTS coverage ends 2026-12-01; 2027 Employment Situation and CPI extend through 2027-12-03 and 2027-12-10 respectively. Nested source layout tables require explicit January coverage handling. Reference months and dates are read from the annual rows.
- BEA official ICS: 70 national GDP/Personal Income and Outlays events, through 2027-12-22. Original titles, UID identity, sequence and calendar-update metadata are retained. Folded lines, escaped punctuation, cancellations and rescheduling are handled. A review regression fixed trailing whitespace that hid an explicitly supplied reference period without changing the source title.
- Latest calendar capture: BLS `2026-10-21T19:21:39.818Z`; BEA `2026-10-21T19:21:39.951Z`. Each response has its own actual retrieval time and SHA256 in the snapshot. All five statistical sources and their retrieval provenance were compared with the prior commit and remain unchanged.
- Response SHA256: BLS 2026 `1bfb9d805fb7b419504962aa22773506b558534daac3b47d72c9de99fd16acac`; BLS 2027 `adc95365efa2f193c5f41a7cdc4221fc7ce89cebe831f33c7cc56c89082437cc`; BEA `c6320686f93a1200c1226ed92eed1c7d2531491006b6da7099fadaab57c433e9`.

## Behavior and verification

The default calendar window is the next 30 Eastern calendar days. Month/day, topic and watchlist filters preserve deep links. One Employment Situation event relates to unemployment, payrolls, participation and wages; following any of those series finds the shared release. Overview shows four future scheduled instants. EDT/EST derives from `America/New_York` rules: 2026-10-29 08:30 EDT is 12:30 UTC, while 2026-11-25 08:30 EST is 13:30 UTC.

A failed calendar refresh preserves the entire previous agency schedule with original retrieval/provenance and visible cached status, independently of statistical data updates. A successful refresh replaces the source's records, removing withdrawn events. If a previously captured BLS next year fails, atomic last-good retention avoids mixing fresh and stale years under a new retrieval timestamp. A next year not yet available is reported explicitly.

- `npm run data:refresh -- --sources=calendar`: both official feeds succeeded, 130 captured events, policy validation passed before snapshot replacement.
- `npm test`: 164 passed, zero failed, on local Node 24.20.0. Covers source schemas, nested annual tables, DST gaps/ambiguities, date validation, exact mappings, UID revisions/cancellation, policy rejections, failed refresh retention, calendar windows, watchlist relationships and deep links.
- `npm run build`: passed, including commercial-use policy validation.
- `node scripts/check-build.mjs`: all 12 static app assets passed the local HTTP smoke check.
- `git diff --check`: passed.
- Independent review ran 75 relevant tests, found the BEA trailing-space issue, and identified no other blocking correctness issue. The added regression was observed failing before the fix and passes afterward.
- Browser QA: month/day selection, topic filtering, overview-to-release navigation, preview selection, wages follow/unfollow, watchlist empty recovery, back navigation and deep-link reload. Confirmed October EDT and November EST, one shared labor release and the correct related indicator links. Tested widths 320, 390, 736, 1024 and 1440 pixels; no page overflow or browser warnings/errors observed.

Refresh and push future schedule snapshots with `npm run data:refresh -- --sources=calendar`. The default full refresh includes calendars. Repository Actions separately verifies Node 22 and 24, builds and deploys main; consult the run status for publication evidence.
