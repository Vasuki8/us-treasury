# Treasury ownership history

The user requested the next ownership-history delivery, keeping current UI and colors. Extend the existing admitted Federal Reserve Z.1 Treasury holder history; leave separately dated SOMA at its existing 104-week scope. No new dataset, provider, credential, measurement or layout.

## Verified source and semantics

Actual October 26 source evidence under `tmp/ownership-history-source-review/` verifies 305 native F3.2.s observations: seven annual-end rows from 1945Q4 through 1951Q4, followed by 298 consecutive quarters from 1952Q1 through 2026Q2. All 25 holder sectors and three totals are numeric and every period reconciles exactly with the existing $25 million tolerance. Current last-36 rows match the committed source. Preserve the published zeros, negative residual/net positions and any future missing values; never add positivity checks or manufacture unreported quarters.

Retain all 305 native dates. Generic .Q labels describe the observed quarter ends; coverage notes explicitly identify annual-end-only 1945–51 versus quarterly from 1952. Generic changes remain changes between observations, with their actual dates. Specialist changes continue to require the exact previous quarter, leaving early annual gaps unavailable. No frequency aggregation, filled dates or global chart/model rewrite.

The Board's official central-bank series guide says fair-value stocks use combined quarterly reports from 2012Q1; earlier stocks use H.4.1. Keep native reported amounts, qualify pre-2012 Fed history in per-period valuation metadata, and add concise series/source interpretation notes. Do not assert that all earlier observations use the later fair-value method. Household residuals and reported precoverage zero tokens are not interpreted as direct survey measurements of every earlier sector. LM/FL dictionary validation and current-period valuation labels remain intact.

## Collection and lineage

Remove only the Z.1 36-row retention cap; preserve input/ZIP bounds, dates, uniqueness, exact source IDs, release-quarter checks, null behavior and reconciliation. Add honest coverage/methodology notes for the two registered Z.1 series. New standard ownership series opt in to existing `inputProvenanceScope:'observation-source-urls'` and carry their own observation source URL/hash/retrieval clock: Z.1 ZIP for the two quarterly series; SOMA API for its existing weekly series. Parent receipts still include the actual ZIP, release page and SOMA response. Legacy captures retain their previous metadata and CSV behavior.

No extra history profile/schema is needed. Existing capture serialization retains the scope flag and observation fields. Generic exports must resolve exact numerical source receipts, and specialist CSV provenance must be scoped to its dataset (Z.1 ZIP plus release page for vintage metadata; SOMA API for weekly observations), retaining New York Fed conditions on every relevant SOMA row.

## Frozen results and exports

The full sector CSV would grow from about 3.4 MB at 36 quarters to about 22 MB for full history, exceeding the existing 8 MiB attachment and 12 MiB package caps. Keep ordinary `CSV OWNERSHIP` downloads at full native history. Add an optional Z.1 observation-count scope to `ownershipCsv`; default stays all history, while ownership-page pins attach the last 36 Z.1 observations matching its existing chart plus the unchanged retained SOMA scope. Compute exact prior-quarter changes from the full source before selecting exported periods.

Frozen packages retain the complete ownership source in `context.moduleSources` and all selected reusable histories. Their visible `context.scope` explains the attachment's 36-period scope and full retained inputs. No hidden input truncation, cap increase, archive rewrite, new UI control or lost source terms. Actual full-data measurements and JSON/CSV round trips must verify ordinary freezing still works.

## Acceptance

Test full retention including annual-prefix gaps, all historical reconciliation, signed/zero/missing values, per-feed receipt replay/export and the 2012 method boundary. Verify specialist current tables/charts remain at their original scope, full CSV includes all source periods, scoped frozen CSV uses correct lookback, complete frozen inputs remain present, package limits hold and old frozen exports remain exact.

Capture only ownership through the normal strict publisher; prove all 182 baseline descriptors, compressed blobs, replay checkpoints and other sources/calendars unchanged. The new capture must show extended reusable histories at its actual retrieval time while earlier cutoffs retain 36 observations. Historical replay remains limited to registered series, not the 25-sector supplementary table. Run full checks, both supported runtimes, builds, live assets/pages and existing health alerts before completion.
