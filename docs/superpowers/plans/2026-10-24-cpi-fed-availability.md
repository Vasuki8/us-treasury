# Automatic CPI checks through a Federal Reserve secondary source

User authorizes another reliable CPI source so automatic checks no longer wait for BLS website access. Preserve current UI/colors and original BLS evidence. Base63afd90; branch codex/cpi-fed-availability. Earlier BLS access hardening remains separately available on codex/cpi-release-check-reliability and is not silently merged.

## Selected contract

The Cleveland Fed Median CPI landing page explicitly links headline CPI-U and core CPI CSV downloads. Actual ordinary identified requests succeeded on2026-10-24 at11:37UTC. Files expose monthly seasonally adjusted index observations (rounded) and an annualized monthly-change column. Use only the existence of usable exact-month headline/core observations. Never copy these rounded indexes or annualized changes into the original BLS Table A archive or current catalog, and never treat an observation date as a release date.

Fixed URLs:
- https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/cpi.csv?sc_lang=en
- https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/core.csv?sc_lang=en

The landing page specifically grants CC BY-SA4.0. Preserve bank/BLS attribution, source URLs, license and changes notice in the operational report; share derived availability metadata under the same license. Ingest no median/trimmed CPI, nowcasts, charts, logos, Haver Analytics products or proprietary rate feeds. October2025 is missing in the two observed CSVs and the bank's broader page warns about interpolation; explicitly exclude this known imputed month even if later supplied numerically.

FRED/ALFRED were evaluated. Their API needs a user-owned key; the release-metadata commercial reuse contract was not cleared. The Cleveland source avoids that setup. Its publication cadence is not an SLA and can lag BLS; the result means secondary CPI data availability, not verified original publication day or instant.

## Implementation tasks

- [x] Bounded worker: new scripts/sources/cleveland-cpi-availability.mjs and tests/cleveland-cpi-availability.test.js. Strict exact CSV schema/date/numeric/missingness/order checks; latest reference row must be usable, headline/core latest periods must agree and not trail the retained archive. Fixed URLs, honest identity, manual redirects/exact200,2MiB and12-second body deadlines; at most two transient attempts per document and bounded respectful Retry-After, no denial/schema/redirect retries. Return candidates with matchBy referencePeriod, period, publicationDate null, secondary evidence label; no numeric CPI values serialized in output. Preserve real accepted receipts, structured attempts and all license notices. Partial/stale/unaligned data stays explicit with no candidate.
- [x] Root: CPI upkeep calls the Cleveland collector without contacting blocked BLS HTML endpoints. Add reference-period candidate matching while preserving GDP/claims date/URL matching. Reports distinguish availability from original publication evidence, show source, scope, rights and errors. Failure remains visible independently from unrelated deployment. Manual branch workflow can verify actual hosted access. Reuse only necessary earlier reporting/gate improvements.
- [ ] Economist/source and independent code acceptance; focused red/green plus full regressions/build. Hosted branch workflow must show real Cleveland HTTP200 and aligned actual month in its artifact before merge. Original archives/current snapshots/UI files remain unchanged.
- [ ] Publish to main through existing workflow and verify real hosted upkeep success and deployed website; record exact source receipts, limits and evidence. No BLS contact request is needed or sent for this path.

## Review focus

Reject forecasts/future periods, placeholders, duplicates, invalid bodies and wrong series headers. Do not silently choose older common data when the latest row or source is missing/misaligned. New periods must queue for source review; secondary availability cannot admit BLS facts or invent dated BLS URLs. Annualized changes must not become monthly rates. Preserve license metadata on public operational artifacts. Validate actual hosted retrieval, not just injected tests.

Localverification: fullsuite1,501/1,501 passed (187seconds), build/smoke163assets underb3aca80e706a77f5. Independentcode/source review32/32 focusedchecks passed, economistcontract accepted. Actualidentifiedsourcecheck at2026-10-24T11:48:29.530Z returned200forbothfixedClevelandfiles andalignedSeptember2026. Hostedbranchverification remainsrequired beforemerge.
