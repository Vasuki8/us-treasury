# Claims and retail coverage

Connect the two existing unavailable indicators through the current official snapshot pipeline. Preserve the Graphite shell, native Node tooling, commercial reuse review, static hosting and existing deployment gates. User approved this development focus; Cloudflare account activation remains deferred.

## Sources and meanings

Use the official Census MARTS bulk ZIP, containing sectioned CSV metadata and observations, for total retail trade and food services (`44X72`), monthly sales (`SM`), U.S. total, seasonally adjusted. Derive month-over-month growth from the exact preceding calendar month's level; retain both source levels and do not calculate from rounded published growth. Sales are nominal. Use one current MARTS vintage, not a blend of MARTS and MRTS. Identify advance estimates, source notes and file-update metadata without inferring publication timestamps.

Use the official ETA national XML table for seasonally adjusted initial claims. Dates are week endings, counts are divided by 1,000, and source values remain available. Reject a state table or unrelated XML schema. Omit future and trailing blank weeks, preserve internal missing observations, and never turn blank/NBSP counts into zero. The historical table currently trails the advance release; show this coverage limitation alongside the data and in CSV exports. Its report execution date is not a publication date.

## Integration and integrity

Add bounded, independently testable source adapters to the existing refresh command, using the same last-good retention and response-hash provenance. Census requires safe in-memory ZIP extraction, with no archive member written to disk and explicit size/schema checks. Data requests stay server-side and credential-free. Keep 36 monthly retail observations and 52 weekly claims observations after transformations and cutoff filtering.

Review and admit only these datasets to the commercial-use policy. Add Census program attribution and DOL ETA credits to the site and exports. Preserve BLS's disclaimer. Maintain unknown historical publication dates and existing empty revision/calendar states; ingesting a new calendar is outside this change.

## Verification

Use deterministic minimal fixtures for XML, sectioned CSV and ZIP responses, including missing periods, duplicates, suppression, wrong metadata, invalid archive bounds, schema drift, source failure, raw-byte hashes and exact calculations. Verify both captured feeds against their raw values; test complete catalog, charts, source notices and CSV coverage notes. Run the full suite, build, local HTTP check and browser QA at desktop/mobile widths, then push and inspect Actions. Keep unrelated local exports and hosting credentials untouched.
