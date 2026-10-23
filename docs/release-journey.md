# Release evidence and collection objectives

GDP and seasonally adjusted initial/continued claims have a joined release workspace. Calendar links select a schedule event. Indicator links can select a measurement, reference period and publication-day cutoff even where historical calendar coverage is absent. The existing lazy publication and explanation loaders are shared with Official publication history.

## Evidence contract

`matchReleaseEvidence(event, archive, {seriesId, period, publicationCutoff})` requires the reviewed agency/program, publication day, measurement ID, units, frequency, adjustment, reference period and estimate stage. GDP quarters and Advance/Second/Third stages come from the explicit schedule title. A conflicting explicit period fails closed. For claims, a schedule often has no reference week. Only a unique archived advance for the selected measurement on that release day establishes the result and its reference week; no week is derived from the schedule. Initial and continued claims can have different reference weeks.

An elapsed schedule never verifies publication. Missing, ambiguous or incompatible archive records leave a schedule-only view. Latest revised observations are never substituted. A publication-only selection preserves its exact cutoff and period and makes no claim that a matching schedule was retained.

The browser selector also rejects malformed rows, non-quarter GDP dates, non-Saturday claims weeks, inconsistent structural publication IDs, unreviewed stage labels, wrong source identifiers, nonagency evidence URLs, and missing/invalid hashed UTC retrieval receipts. It retains all eight admitted historical GDP stage labels and the original dated DOL edition. Exact manifest membership and published source values remain the responsibility of the existing source-admission policies; no second mutable manifest is introduced in the browser.

The result keeps separate roles:

- Actual: the selected GDP estimate or claims advance.
- Earlier estimate: a separately retained earlier publication of the same GDP quarter/measurement.
- Same-release prior: the explicitly revised, unrevised or status-unknown previous claims week in the exact same dated release and evidence URL.
- Earlier published prior: a separately retained earlier publication of that claims reference week. A quoted previously published count does not create an original-advance record.

Revision differences require matching units, frequency and adjustment. A source-noted applied seasonal-factor update suppresses the inferred difference across that boundary. GDP differences are percentage points in annualized growth estimates. Claims differences are thousands. Actual minus prior is not a consensus surprise.

Workbook records explicitly marked GDP not open for revision or GDP not revised remain unchanged confirmations. A status-unknown claims prior retains that status even when an earlier retained published number differs. Neutral numerical differences do not supply missing source revision classifications.

Reviewed BEA explanations match publication ID, series, quarter, stage and date through the existing explanation selector. Missing explanations remain unavailable. Claims release notes and seasonal-factor notices are not promoted to explanations of economic causes.

## Three clocks and histories

The workspace shows expected schedule, verified publication day, reference period, retained evidence retrieval, and loaded snapshot assembly separately. Publication dates retain day precision and a null exact publication instant. Schedule-to-retrieval delay can be calculated from two genuine instants, but is not publication-to-ingestion latency. Historical backfills can have long delays; these receipts do not establish live delivery performance.

Official publication history, latest revised history, and Meridian retrieval history remain separate. The history/CSV/freeze link carries the matched measurement, period and publication-day cutoff into the existing export and frozen-evidence path. Immutable publication facts and frozen history are never rewritten by this workspace.

## Collection policy

End-of-day collection remains the daily 23:37 UTC target with a 60-minute allowance and 00:17/01:17 UTC backup checks. Existing source-rights, cached-BLS exception, immutable retrieval archive, tests, build checks, compare-and-swap snapshot publication and deployment gates continue to apply.

The same GitHub Actions pipeline also checks supported GDP/claims schedules at 12:47, 13:47 and 14:47 UTC on weekdays. It requests only BEA or the DOL advance-PDF collector when a supported event is between 15 minutes and three hours after its explicit schedule. A missing daily capture takes priority and runs all collectors. These checks use the captured calendar; changed schedules and source access failures can delay collection.

The best effort objective is a targeted current-data capture within two hours of the supported schedule. This is an operating objective, not a guaranteed service level or immediate-alert promise. A successful fresh request containing an old release remains unverified and does not suppress subsequent post-schedule attempts. DOL completion requires a successful post-schedule collection, matching explicit release day and an advance with reviewed measurement metadata. GDP current NIPA feeds do not prove estimate-stage publication: absent matching retained publication evidence, the bounded checks continue and the state remains unverified.

`scripts/check-release-refresh.mjs` combines the daily and release plans and records event evidence status and minutes since schedule in the Actions summary. `src/release-operations.js` exposes the pure plan for review/testing. Failed collection stops publication of the replacement snapshot. A missing publication is not labelled an agency delay; its release result is simply unverified.

These automatic collectors update current sources and append retrieval captures. They do not automatically admit new GDP/claims publication IDs or narrative explanations to the reviewed immutable archives. That admission still requires the existing bounded source policy and capture workflow. No consensus feed, notifications, account, background alert service or new paid infrastructure is connected.

## Integration

- Route state: `page:'release'`, `eventId`, `publicationSeries`, `publicationPeriod`, `publicationCutoff`.
- Renderer: `releasePage(state, {archive, publicationState, explanations, explanationState})`.
- Archive selector: `gdp` uses `createPublicationLoader`; the two claims measurements use `createClaimsPublicationLoader`.
- Retry controls use existing `data-retry-publications` and `data-retry-publication-explanations` handlers.
- FOMC calendar additions remain date-only schedules; they are excluded from GDP/claims event-refresh targeting and verified results.
