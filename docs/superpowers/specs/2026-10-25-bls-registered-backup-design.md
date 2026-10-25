# Registered BLS backup

The user requested the free registered BLS API as an automatic backup, retaining the existing UI and colors. They previously accepted a user-owned free API key. This is an additional delivery route within BLS, not an independent upstream or a guarantee against agency-wide failure.

## Selected approach

Keep unregistered v1 as the primary. After its exact unredirected HTTP 503, make at most one registered v2 request when `BLS_API_KEY` is configured, spaced by one second. Reuse the same 20 native identifiers, ten-calendar-year window, parsers, 31 outputs and formulas. Do not fall back on access denial, quotas, redirects or malformed primary data. Missing keys preserve current behavior.

Accept a complete validated v2 family atomically. Successful provenance and series URLs must identify v2, never v1. Reject v2 API errors/unknown advisories, malformed/partial data and secret-bearing output. The exact optional-catalog-unavailable notice for a requested native ID is nonfatal only after the observations validate; it already occurs on the working primary and does not define measurements. Preserve previous immutable captures and the existing BLS disclaimer. If backup collection fails after primary 503, retain the original typed primary failure plus a fixed safe backup diagnosis; the existing validated cached-data exception can then keep healthy sources updating. Prior successful receipts can be either reviewed exact API endpoint.

Provide a manual registered-only read-only check to verify the configured key even while v1 is healthy. It must validate the complete family and non-regressing coverage against the committed capture, emit only safe summaries and receipts, and never publish data. Its success is required before calling authenticated access verified.

## Credentials and workflow

The user registers with BLS and stores their key in GitHub Actions secret `BLS_API_KEY`. Registration includes their CAPTCHA and agreement; the agent does not complete those steps. Only trusted main-branch refresh, source-health and explicitly selected registered-access steps receive the secret. PRs, build/test/deployment/client code receive no key. POST it only in the fixed v2 request body; never put it in URLs, logs, reports, exports, bundles or committed files. Reject redirects before transmitting it elsewhere. No new dependencies.

## Alternatives

Making v2 the default would use the credential on every run and depart from the requested backup behavior. Independent mirrors still lack complete verified coverage/precision/reuse authorization. The selected conditional backup is the smallest change matching the request.

## Completion

Verify fallback/no-fallback paths, complete v2 provenance/admission, cached recovery after both routes fail, immutable old replay, secret-safe errors, absence of secrets in public outputs, workflow trust boundaries, full suite and build. Publish the verified implementation. If no key is supplied, describe it as installed but inactive and explicitly leave authenticated availability unverified; do not fabricate a credential or claim activation.
