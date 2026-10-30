# Data freshness banner verification — October 21, 2026

The global Graphite banner shows the last successful **source** retrieval, the latest recorded refresh attempt, and named cached/unavailable sources. These timestamps come from captured source metadata; snapshot assembly time and observation periods are excluded. Eastern times include their actual EST/EDT label. The summary covers five statistical feeds and six independent release-calendar/timing captures, so a cached BLS calendar stays distinct from successful BLS statistics.

The banner sits below the ticker on every route. Its native keyboard-accessible disclosure lists each source's state, successful capture time, latest attempt and escaped error message. The disclosure survives in-app route changes. It is a static named region, without repeated live announcements during filtering or navigation. Missing or invalid retrieval timestamps remain unavailable; no age threshold or inferred publication date is introduced.

## Verification

- `npm test`: **275 passed, 0 failed**, including 14 freshness-model and four banner-rendering tests. The new tests failed before implementation and passed afterward.
- Model tests cover all eleven targets, independent BLS data/calendar states, retained-only and unavailable snapshots, missing targets, later failed attempts, excluded assembly/unknown-source timestamps, invalid UTC dates and input immutability.
- Rendering tests cover explicit timestamp labels, Eastern daylight/standard time, prominent cached names, missing captures, collapsed native disclosure, and HTML escaping.
- `npm run build` passed commercial-source validation; `node scripts/check-build.mjs` passed all **13** imported static assets.
- Local browser QA verified one banner on Overview, Calendar, Labor, Indicator and Explore; keyboard expansion displayed all eleven captures, and the expanded state survived route changes. The current BLS calendar showed its original 22:48:25 UTC capture and 403 error, while the successful source summary showed 23:18:30 UTC.
- Responsive checks at 1024, 736, 390 and 320 px confirmed the banner and expanded detail cards fit. A pre-existing ticker value overflow at 320 px was corrected by wrapping ticker items at the mobile breakpoint; page width then matched the viewport's available client width, both collapsed and expanded. Mobile disclosure targets measured 44 px high.
- Graphite, Paper and Midnight retained readable text and warning colors. Graphite and default viewport sizing were restored after QA. No browser warnings or errors were recorded.
- Independent code review found no actionable issues in timestamp semantics, missing/cache states, escaping, accessibility or route persistence.

Local screenshots are in ignored `test-results/freshness-banner-desktop.png` and `test-results/freshness-banner-mobile.png`. Deployment and exact public-asset checks follow the normal main-push workflow. This feature changes display only; source collection, data rights and the approved BLS caching policy are unchanged.
