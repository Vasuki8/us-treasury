# Immutable retrieval vintages

This milestone records what Meridian actually retrieved. It does not reconstruct missing historical releases or claim that an initial capture was the first published value. No external service, credentials, database or new dependency is required. `src/vintages.js` is a pure browser-compatible model; repository refresh/build integration owns persistent storage and public export.

## Data contract

`recordVintages(previousVintages, previousSources, newSources, {checkedAt})` returns a new `{version: 1, captures: []}` object without mutating inputs. `checkedAt` is an actual completion/recording UTC ISO timestamp, at or after the successful retrieval timestamps. Each capture has:

- `sourceId`, actual source `capturedAt` from its existing `fetchedAt`, and actual `recordedAt` from `checkedAt`.
- `baseline` identifying the first captured state for that source. A prior committed snapshot can bootstrap the baseline at its own original retrieval timestamp; this is evidence of an earlier retrieval, not of an earlier release.
- Source `metadata`: agency and coverage start/end/note; original source `provenance` including response SHA256, source URL, retrieval and last-modified fields supplied by the adapter.
- A `series` dictionary of changed series. Each includes source IDs, source URL, calculation/status/coverage metadata, `upserts` of new or changed full observation records, and `deletedDates` coverage tombstones.
- `removedSeries` coverage tombstones for whole series absent from that source's new successful capture.

Observation dates and explicit null/zero values are validated. Monetary conversions or revised growth rates are not rounded again by this history model. Observation-level publication timestamps, source values and supporting numeric input fields are preserved if supplied; the model does not derive publication times from observation dates, schedules, HTTP retrieval or last-modified metadata.

Daily unchanged observations are not copied again. A genuinely new retrieval appends a compact metadata/provenance capture with no observation deltas, recording a successful confirmation of the retained values. Failed refresh attempts and source omissions append nothing. Cached captures retain their original `fetchedAt`; error/status/last-attempt/current-warning fields are deliberately excluded from capture identity because they describe later access attempts rather than changed economic observations.

The immutable key is source ID plus actual retrieval timestamp. Repeating identical admitted facts under that key is idempotent. Different values, calculations, provenance or admitted coverage metadata under an existing key are rejected as a collision. Equality uses exact canonical JSON comparison of the reconstructed state, so no cryptographic dependency or lossy checksum is needed. Older retrievals cannot be appended after a newer capture for the same source. The returned capture array retains its prior prefix; new captures are appended without rewriting historical records.

## As known on a date

`asKnownOn(vintages, cutoffISOString)` returns `{sources}` with standard source/series/observation objects reconstructed using only captures with `capturedAt <= cutoff`. The comparison is inclusive and uses full canonical UTC ISO timestamps. Before the first actual retrieval, that source is absent. A capture's later recording time does not fabricate a different retrieval history; bootstrapped prior committed timestamps must therefore be genuine existing provenance.

Periods removed from a newly collected source are absent from the corresponding later as-known state, but remain reconstructable before their coverage tombstones. If a whole source is not present in a refresh result, earlier known facts remain available; its omission alone is not proof of a retraction. Series values and source/calculation/provenance metadata are reconstructed. Supplemental non-series module datasets, charts, calendars, disclosures and legacy first-release vintages are not reconstructed by this model; an as-known indicator view must state that scope.

Date-only UI selections must resolve to a clearly disclosed UTC instant or user timezone boundary before calling this function. The API itself accepts exact canonical UTC ISO timestamps, not ambiguous date strings. A release schedule is never used to backdate knowledge.

## Observed changes and explanations

`revisionHistory(vintages, seriesId)` returns only source/period records with observed numeric or explicit null-to-number value changes. Each has `firstCaptured`, `latest`, the observed `changes`, source/series/period identity, and whether that period remains in current coverage. Latest confirmation timestamps advance through compact unchanged retrievals. Metadata-only changes and coverage deletions do not become economic revisions.

Every observed change is labeled `observed-value-change`, with `reason: unknown` until independently sourced evidence explains it. The model cannot infer an ordinary data revision, seasonal adjustment, comprehensive/benchmark revision, parser correction or methodology change from two numbers alone. A value changing from null to zero is preserved distinctly; an absent period is represented through a tombstone rather than a fabricated null or zero. A returned period that differs from its previously captured value is an observed value change even if there was a gap in source coverage, and its explanation remains unknown.

Use **first captured** in the product. **First reported**, **advance estimate** or a named benchmark explanation requires separately verified original release/vintage evidence. Before multiple observations of a given period exist, show the lack of observed revision history plainly. Do not show a zero revision as proof that a value was never revised historically.

## Verification

Focused tests cover immutable baseline/delta appends, exact-key collisions, failed cached attempts, cutoff inclusivity, retrieval versus publication/recording time, compact unchanged confirmations, missing periods and removed series, independent new sources, null versus zero, malformed dates/values and future recording times. All are local deterministic tests; no network, filesystem writes or account state is required by the model.

Persistence must use the repository's existing atomic snapshot publishing and commercial-data admission checks. Source provenance remains subject to each dataset's existing rights and redistribution policy. This model adds no dataset permission or endorsement claim.

## Immutable storage and browser delivery

The replay model still consumes the exact v1 capture array. The committed root now stores current data and `vintageArchive`, an ordered index of `src/history/<compressed-sha256>.json.gz` files. Entries retain compressed/content hashes and lengths plus original source, capture/recording timestamps and baseline flag. Each file contains one original capture object. Previously committed bytes and the index prefix may never change. Legacy inline history remains readable for migration. `loadSnapshotHistory(root, {directory})` verifies and hydrates this representation; pass the absolute source directory explicitly.

The bot publisher validates the exact staged tree and creates a commit from that immutable tree with an expected-parent compare-and-swap, followed by a normal push. Files or index entries changing during network/staging cannot change the verified commit contents. This bot path intentionally uses Git plumbing rather than local commit hooks or signing configuration. A post-staging validation failure leaves the index available for inspection and does not reset concurrent user staging.

`writeStoredSnapshot(fullSnapshot, {destination, previous})` accepts inline hydrated `vintages` without `vintageArchive`, validates the retained prefix, writes/verifies immutable files first, then atomically renames the new root. Refresh returns this hydrated shape. Build and public projection may use a hydrated root containing both fields. Existing blobs are reused byte for byte, including older valid gzip encodings. An interrupted write can leave an orphan; it cannot advance the root to missing files, and publication stages only newly referenced files. Do not delete or overwrite a referenced capture to repair a failed run. Corrupt/missing referenced files stop validation; recover their original bytes from Git.

Generated modules pool repeated long strings using ordinary JavaScript constants. Values, units and provenance remain exact. Public projection omits both inline history and the storage index, replacing them with a small `historyArchive` descriptor. Build and development hydrate and admit all historical data before serving current data plus one gzip archive bundle and its plain JSON fallback. Bundle URLs live beside the modules within the deployment version. Static and live smoke checks follow both lazy files and compare exact bytes and MIME types.

Only the Revision history page or an indicator Revisions tab requests the archive. The loader verifies same-deployment URLs, bounded byte lengths, SHA256, capture count and replay structure, shares one request, caches successful history and memoizes requested series comparisons. CSV remains disabled until ready. Failed loading shows a retry control and never substitutes current observations or an empty successful history. Loading completion preserves current navigation, UTC inputs, keyboard focus and scroll. Browsers with native gzip support request the compressed bundle; others request the JSON fallback.

The 22 October 2026 migration retained all 25 capture objects, including unchanged confirmations, without a new retrieval. Initial generated snapshot JavaScript fell from 15,047,274 to 3,232,647 bytes (78.5%); the lazy gzip bundle was 114,047 bytes. Committed root plus 25 compressed files totaled 3,362,118 bytes. A local simulation of 12 unchanged source confirmations added 7,874 compressed bytes (17,060 uncompressed), while every retained file remained identical. These are artifact sizes, not a promised wall-clock speedup or an estimate for releases with changed observations. Git retains earlier commits; repository history is not rewritten. The index and public history bundle still grow with retained captures, and history views currently download the full bundle on their first use.

Run `node scripts/check-snapshot-history.mjs` for admission/integrity and size checks. With an ignored original full JSON snapshot, `--baseline=<path>` additionally compares retained captures, every original cutoff and one millisecond before it, per-series revisions and latest-cutoff vintage CSV bytes.
