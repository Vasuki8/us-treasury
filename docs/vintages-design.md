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
