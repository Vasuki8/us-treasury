# Registered BLS API backup

Reviewed October 25, 2026, Toronto local date. The user requested the free registered BLS API as an automatic backup and confirmed that their registration key is configured in repository Actions secret `BLS_API_KEY`. Authenticated access is verified separately below; configuring a secret alone does not prove access.

## Source, scope and conditions

The primary remains the exact unregistered JSON POST `https://api.bls.gov/publicAPI/v1/timeseries/data/`. The newly reviewed backup is the exact registered JSON POST `https://api.bls.gov/publicAPI/v2/timeseries/data/`, using the user's key in the request body's `registrationkey` field. No query-string authentication, other hosts, redirects, CSV proxies or independent provider are admitted.

The [BLS FAQ](https://www.bls.gov/developers/api_faqs.htm) requires v2 registration, annual renewal, and documents 500 queries per day, 50 series per query and 20 years per registered query. This application retains its existing scope of **20 native series in one request for ten calendar years**. It does not add a longer-history promise, optional API calculations, indicators or catalog-derived definitions. The [v2 signatures](https://www.bls.gov/developers/api_signature_v2.htm) support the same series/year parameters and registered key.

The existing [BLS copyright policy](https://www.bls.gov/opub/copyright-information.htm) and [API terms](https://www.bls.gov/developers/termsOfService.htm) remain applicable: scoped federal statistical facts are public domain; preserve attribution, actual successful retrieval time and the required post-retrieval disclaimer. No logo, imagery, narrative or endorsement is added. Original SA/NSA, population, units, quarterly annualization, source precision, footnotes and formulas remain unchanged. Existing parsers produce 26 direct outputs; the existing momentum helper produces the remaining five. Earlier immutable captures remain unchanged.

## Request and failure behavior

- A healthy v1 response stays keyless and uses one request. A missing key preserves the previous v1-only behavior.
- Only the exact typed, unredirected primary HTTP 503 triggers one v2 attempt, after a one-second gap. Denials, quotas, redirects, malformed primary data and API semantic failures do not trigger another route. Neither endpoint is retried within a collection.
- V2 must return an empty advisory-message list and a complete valid family. Invalid/expired-key warnings or downgraded responses cannot be presented as a healthy registered capture. Before acceptance, all 31 outputs must preserve prior reference dates and latest usable periods within the current ten-year window; year rollover can drop only dates outside that window. This includes derived momentum availability.
- A successful backup capture identifies v2 in every series URL and its one genuine hashed retrieval receipt. The failed v1 request is not invented as a successful receipt. A fixed warning explains why the backup was used. No original source or publication timestamp is rewritten.
- A failed backup rethrows the original typed v1 503 with only a safe fixed diagnosis (bounded HTTP code or generic request/validation failure). The existing narrow cached-data policy can retain complete reviewed v1 or v2 captures while healthy sources progress. Cached values keep their actual earlier timestamps; failed attempts create no new BLS capture.

Both routes are BLS services. This backup can help with endpoint-specific service failures; it cannot guarantee availability during a BLS-wide outage or publish statistics BLS has not released.

## Credential boundaries and verification

`BLS_API_KEY` is available only to the trusted main-branch refresh/source-health collection steps and the explicitly selected main-branch registered check. PRs, tests, builds, deployments and browser assets receive no key. The key is sent only to the fixed v2 endpoint in a POST body. Redirects are rejected before following, and responses that echo credential material are rejected. Registered failures do not expose raw response bodies, arbitrary exception messages, headers or echoed registration notices in public errors or reports.

The separate **Check registered BLS backup** workflow is manually dispatched on main and has read-only repository permission. It calls `scripts/check-bls-registered-access.mjs`, validates all 31 outputs and non-regressing committed coverage, and retains only safe metadata, periods/counts and actual receipts in `bls-registered-access.json`. It cannot refresh snapshots, append history, publish commits or deploy. Its failure means authenticated access has not been verified; it does not damage the last published snapshot.

For local use, provide `BLS_API_KEY` through a private process environment, then run `node scripts/check-bls-registered-access.mjs`. Never commit a key or put it in a command argument, URL, frontend setting, export or chat. Register/renew directly through [BLS](https://data.bls.gov/registrationEngine/) and update the [repository Actions secret](https://github.com/Vasuki8/us-treasury/settings/secrets/actions). No application UI or color change is required.

Local integrated verification passed **1,589 tests, zero failures**. Static build and HTTP smoke checks passed for all 163 assets. A test credential canary was absent from every build file; asset version remains `3ed38d44b96c132d`, confirming the current UI/data/theme are unchanged. Independent review's derived-momentum coverage finding was fixed and its two regressions pass; re-review found no remaining material issue. Authenticated hosted access and production results follow after execution.
