# Official Treasury, BLS and BEA data

Replace every production sample observation with a traceable official snapshot. The user explicitly requests implementation, local testing and a push to the existing us-treasury repository. Preserve the Graphite layout and existing local development workflow.

## Data flow

Node source adapters retrieve official public feeds; a refresh command normalizes and validates the responses, preserves the last successful snapshot on failure, and writes a static browser module. The app and static build load that module without API keys, third-party proxies or a network dependency during tests. Committed snapshots make the app usable immediately after checkout. Refresh is an explicit local operation; no recurring automation is requested.

Treasury supplies gross federal debt and nominal daily par yield curves. BLS supplies unemployment, payroll employment, participation, CPI, earnings and openings. BEA supplies real GDP growth and PCE inflation using official public downloads when possible. No fabricated fallback is allowed. Missing/unavailable sources remain visible as unavailable, including the out-of-scope DOL claims and Census retail series.

## Integrity

Keep observation dates, retrieval timestamps, source URLs, source identifiers, transformation definitions and source response hashes separate. Leave historical publication dates null when absent from a source; never infer them from retrieval time or a regular release day. Remove all invented initial estimates, revisions, consensus and future release dates. Provide links to official release schedules; populate the calendar only from verifiable schedule data if available.

Compute payroll changes from consecutive monthly employment levels in thousands; CPI and earnings year-over-year changes require the exact month a year earlier; openings convert thousands to millions; debt converts dollars to trillions. GDP uses the BEA published annualized quarter-over-quarter rate; PCE inflation uses the BEA index and exact year-ago month. Null and suppressed values stay missing. Date and unit checks reject incomplete or structurally changed payloads rather than silently assigning an unrelated series.

Refreshes are bounded by timeouts and clear source-specific errors. A failed source retains its last-good observations with an error/staleness notice; a first failure has no invented observations. Strict refresh validation must be available for local source checks. The repository must not contain secrets or raw credential-bearing requests.

## Verification

Use recorded minimal source payloads for deterministic parser and transformation tests, including missing months, duplicate dates, annual-average exclusion, source errors, unavailable feeds and null publication dates. Preserve existing analytical behavior tests using test-only fixtures where required. Validate the captured snapshot against raw official responses; locally run the full suite, static build, built-asset check and browser workflows. Push the verified code and snapshots and inspect GitHub Actions to completion.
